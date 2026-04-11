<script lang="ts">
	import { IconChevronLeft, IconChevronRight } from '@tabler/icons-svelte';
	import { createEventDispatcher, tick } from 'svelte';

	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import {
		isTopDatePicker,
		registerOpenDatePicker,
		unregisterOpenDatePicker
	} from '$lib/components/date-picker-stack.js';
	import {
		clamp,
		resolveAnchoredFloatingPosition,
		toFixedStyle
	} from '$lib/components/floating-position.js';
	import {
		buildCalendarMonthWindow,
		buildCalendarGrid,
		consumeCalendarWheelDelta,
		formatMonthReferenceLabel,
		formatPickerValueForDisplay,
		inferPickerYearRange,
		parsePickerValue,
		resolveCalendarKeyboardDateKey,
		resolveCalendarMonthStripPageOffset,
		shouldResetCalendarWheelGesture,
		shiftMonthReference,
		type MonthReference
	} from '$lib/components/date-picker.js';
	import {
		resolveDateRangeCalendarMonth,
		resolveDateRangeCalendarMonths,
		normalizeDateRangeValue,
		resolveDateRangeSelectionState,
		type DateRangeBoundary
	} from '$lib/components/date-range-picker.js';

	interface Props {
		id?: string;
		startName?: string;
		endName?: string;
		startValue?: string;
		endValue?: string;
		min?: string;
		max?: string;
		minYear?: number;
		maxYear?: number;
		disabled?: boolean;
		ariaLabel?: string;
		format?: string;
		startLabel?: string;
		endLabel?: string;
		shellClass?: string;
		segmentClass?: string;
		startSegmentClass?: string;
		endSegmentClass?: string;
		panelClass?: string;
	}

	type DatePickerOption = { value: string; label: string; disabled?: boolean };
	type RangeCalendarSide = DateRangeBoundary;
	type MonthPageSlot = 'previous' | 'current' | 'next';
	type CalendarWheelState = {
		remainderDeltaY: number;
		isGestureLocked: boolean;
		lockedDirection: -1 | 0 | 1;
		lastEventTimestamp: number | null;
		unlockTimeoutId: ReturnType<typeof setTimeout> | null;
	};
	type MonthAnimationState = {
		slideDirection: -1 | 0 | 1;
		isTransitioning: boolean;
		pendingVisibleMonth: MonthReference | null;
	};
	type RangeCalendarMonthPage = {
		slot: MonthPageSlot;
		reference: MonthReference;
		cells: ReturnType<typeof buildCalendarGrid>;
	};
	type RangeCalendarSection = {
		key: RangeCalendarSide;
		label: string;
		month: MonthReference;
		monthPages: RangeCalendarMonthPage[];
		monthOptions: DatePickerOption[];
		yearOptions: DatePickerOption[];
		canMoveBackward: boolean;
		canMoveForward: boolean;
		monthStripClass: string;
		monthStripStyle: string;
	};

	let {
		id,
		startName,
		endName,
		startValue = $bindable(''),
		endValue = $bindable(''),
		min,
		max,
		minYear,
		maxYear,
		disabled = false,
		ariaLabel = 'Choose date range',
		format,
		startLabel = 'Start',
		endLabel = 'End',
		shellClass = 'date-range-picker-trigger-shell',
		segmentClass = 'date-range-picker-trigger-segment',
		startSegmentClass = '',
		endSegmentClass = '',
		panelClass = ''
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		input: { startDate: string; endDate: string };
		change: { startDate: string; endDate: string };
		open: { startDate: string; endDate: string };
		close: { startDate: string; endDate: string };
	}>();

	const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';
	const EDGE_PADDING_PX = 8;
	const TRIGGER_GAP_PX = 8;
	const CALENDAR_WHEEL_THRESHOLD = 72;
	const CALENDAR_WHEEL_GESTURE_GAP_MS = 80;
	const MONTH_STRIP_TRANSITION_FALLBACK_MS = 120;
	const datePickerId = Symbol('date-range-picker');

	let root = $state<HTMLDivElement | null>(null);
	let triggerShell = $state<HTMLDivElement | null>(null);
	let startTriggerButton = $state<HTMLButtonElement | null>(null);
	let endTriggerButton = $state<HTMLButtonElement | null>(null);
	let returnFocusTarget = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let isDesktop = $state(false);
	let panelStyle = $state('position: fixed; left: 0px; top: 0px; visibility: hidden;');
	let focusActiveDateFrameId: number | null = null;
	let activeBoundary = $state<DateRangeBoundary>('start');
	let visibleStartMonth = $state<MonthReference>(resolveVisibleBoundaryMonth('start'));
	let visibleEndMonth = $state<MonthReference>(resolveVisibleBoundaryMonth('end'));
	let activeDateKey = $state(currentBoundaryDate('start'));
	let startMonthAnimationState = $state<MonthAnimationState>({
		slideDirection: 0,
		isTransitioning: false,
		pendingVisibleMonth: null
	});
	let endMonthAnimationState = $state<MonthAnimationState>({
		slideDirection: 0,
		isTransitioning: false,
		pendingVisibleMonth: null
	});
	let startCalendarWheel = $state<CalendarWheelState>({
		remainderDeltaY: 0,
		isGestureLocked: false,
		lockedDirection: 0,
		lastEventTimestamp: null,
		unlockTimeoutId: null
	});
	let startMonthTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let endMonthTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let endCalendarWheel = $state<CalendarWheelState>({
		remainderDeltaY: 0,
		isGestureLocked: false,
		lockedDirection: 0,
		lastEventTimestamp: null,
		unlockTimeoutId: null
	});

	function joinClassNames(...values: Array<string | false | null | undefined>): string {
		return values
			.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
			.map((value) => value.trim())
			.join(' ');
	}

	function currentRange() {
		return normalizeDateRangeValue(String(startValue ?? ''), String(endValue ?? ''));
	}

	function currentBoundaryDate(boundary: DateRangeBoundary): string {
		const range = currentRange();
		return boundary === 'start' ? range.startDate : range.endDate;
	}

	function displayValue(dateKey: string): string {
		return formatPickerValueForDisplay(dateKey, 'date', format);
	}

	function monthReferenceFromDateKey(dateKey: string): MonthReference {
		const parsed = parsePickerValue(dateKey, 'date');
		if (parsed) {
			return {
				year: parsed.year,
				month: parsed.month
			};
		}

		const now = new Date();
		return {
			year: now.getFullYear(),
			month: now.getMonth() + 1
		};
	}

	function compareMonthReference(left: MonthReference, right: MonthReference): number {
		if (left.year !== right.year) return left.year - right.year;
		return left.month - right.month;
	}

	function wheelStateFor(side: RangeCalendarSide): CalendarWheelState {
		return side === 'start' ? startCalendarWheel : endCalendarWheel;
	}

	function animationStateFor(side: RangeCalendarSide): MonthAnimationState {
		return side === 'start' ? startMonthAnimationState : endMonthAnimationState;
	}

	function currentVisibleMonth(side: RangeCalendarSide): MonthReference {
		return side === 'start' ? visibleStartMonth : visibleEndMonth;
	}

	function resolveVisibleBoundaryMonth(boundary: DateRangeBoundary): MonthReference {
		return resolveDateRangeCalendarMonth(currentBoundaryDate(boundary), min, max);
	}

	function syncVisibleMonthsToRange(
		startDate: string = currentRange().startDate,
		endDate: string = currentRange().endDate
	): void {
		const resolvedMonths = resolveDateRangeCalendarMonths(startDate, endDate, min, max);
		visibleStartMonth = resolvedMonths.startMonth;
		visibleEndMonth = resolvedMonths.endMonth;
	}

	function unlockCalendarWheelGesture(side: RangeCalendarSide): void {
		const wheelState = wheelStateFor(side);
		wheelState.remainderDeltaY = 0;
		wheelState.isGestureLocked = false;
		wheelState.lockedDirection = 0;
	}

	function clearCalendarWheelGestureTimeout(side: RangeCalendarSide): void {
		const wheelState = wheelStateFor(side);
		if (wheelState.unlockTimeoutId === null) return;
		clearTimeout(wheelState.unlockTimeoutId);
		wheelState.unlockTimeoutId = null;
	}

	function scheduleCalendarWheelGestureUnlock(side: RangeCalendarSide): void {
		const wheelState = wheelStateFor(side);
		clearCalendarWheelGestureTimeout(side);
		wheelState.unlockTimeoutId = setTimeout(() => {
			wheelState.unlockTimeoutId = null;
			unlockCalendarWheelGesture(side);
			wheelState.lastEventTimestamp = null;
		}, CALENDAR_WHEEL_GESTURE_GAP_MS);
	}

	function clearMonthTransitionTimeout(side: RangeCalendarSide): void {
		const timeoutId = side === 'start' ? startMonthTransitionTimeoutId : endMonthTransitionTimeoutId;
		if (timeoutId === null) return;
		clearTimeout(timeoutId);
		if (side === 'start') {
			startMonthTransitionTimeoutId = null;
			return;
		}

		endMonthTransitionTimeoutId = null;
	}

	function setVisibleMonth(side: RangeCalendarSide, nextReference: MonthReference): void {
		const nextMonth = shiftMonthReference(nextReference, 0, 'date', min, max);
		if (side === 'start') {
			visibleStartMonth = nextMonth;
			return;
		}

		visibleEndMonth = nextMonth;
	}

	function resetMonthAnimation(side: RangeCalendarSide): void {
		clearMonthTransitionTimeout(side);
		clearCalendarWheelGestureTimeout(side);
		unlockCalendarWheelGesture(side);
		wheelStateFor(side).lastEventTimestamp = null;
		const animationState = animationStateFor(side);
		animationState.slideDirection = 0;
		animationState.isTransitioning = false;
		animationState.pendingVisibleMonth = null;
	}

	function resetAllCalendarMotion(): void {
		resetMonthAnimation('start');
		resetMonthAnimation('end');
	}

	function finalizeMonthAnimation(side: RangeCalendarSide): void {
		const animationState = animationStateFor(side);
		if (!animationState.pendingVisibleMonth) {
			resetMonthAnimation(side);
			return;
		}

		const nextVisibleMonth = animationState.pendingVisibleMonth;
		clearMonthTransitionTimeout(side);
		animationState.pendingVisibleMonth = null;
		animationState.slideDirection = 0;
		animationState.isTransitioning = false;
		setVisibleMonth(side, nextVisibleMonth);

		if (activeBoundary === side && panel?.contains(document.activeElement)) {
			void tick().then(() => {
				focusActiveDateButton();
			});
		}
	}

	function startMonthAnimation(side: RangeCalendarSide, direction: -1 | 1): void {
		const animationState = animationStateFor(side);
		if (animationState.isTransitioning || animationState.slideDirection !== 0) return;

		const nextVisibleMonth = shiftMonthReference(currentVisibleMonth(side), direction, 'date', min, max);
		if (compareMonthReference(nextVisibleMonth, currentVisibleMonth(side)) === 0) {
			wheelStateFor(side).remainderDeltaY = 0;
			return;
		}

		animationState.pendingVisibleMonth = nextVisibleMonth;
		animationState.isTransitioning = true;
		animationState.slideDirection = direction;
		clearMonthTransitionTimeout(side);
		const timeoutId = setTimeout(() => {
			finalizeMonthAnimation(side);
		}, MONTH_STRIP_TRANSITION_FALLBACK_MS);
		if (side === 'start') {
			startMonthTransitionTimeoutId = timeoutId;
			return;
		}

		endMonthTransitionTimeoutId = timeoutId;
	}

	function jumpToMonth(side: RangeCalendarSide, nextReference: MonthReference): void {
		resetMonthAnimation(side);
		setVisibleMonth(side, nextReference);
	}

	function monthOptions(reference: MonthReference): DatePickerOption[] {
		return Array.from({ length: 12 }, (_, index) => {
			const month = index + 1;
			return {
				value: String(month),
				label: formatMonthReferenceLabel({ year: reference.year, month })
			};
		});
	}

	function yearOptions(reference: MonthReference): DatePickerOption[] {
		const range = currentRange();
		const yearRange = inferPickerYearRange(
			[reference.year, range.startDate, range.endDate],
			{
				minYear,
				maxYear
			}
		);

		return Array.from({ length: yearRange.maxYear - yearRange.minYear + 1 }, (_, index) => {
			const year = yearRange.minYear + index;
			return {
				value: String(year),
				label: String(year)
			};
		});
	}

	function updatePanelPosition(): void {
		if (typeof window === 'undefined' || !isDesktop || !panel || !triggerShell) return;

		const anchorRect = triggerShell.getBoundingClientRect();
		const panelRect = panel.getBoundingClientRect();
		const position = resolveAnchoredFloatingPosition({
			anchorRect,
			panelWidth: panelRect.width,
			panelHeight: panelRect.height,
			align: 'left',
			gapPx: TRIGGER_GAP_PX,
			paddingPx: EDGE_PADDING_PX,
			preferVertical: 'bottom',
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight
		});
		const centeredLeft = clamp(
			anchorRect.left + (anchorRect.width - panelRect.width) / 2,
			EDGE_PADDING_PX,
			window.innerWidth - EDGE_PADDING_PX - panelRect.width
		);

		panelStyle = toFixedStyle(
			{
				...position,
				left: centeredLeft
			},
			panelRect.width > position.maxWidth ? `max-width: ${Math.round(position.maxWidth)}px;` : ''
		);
	}

	function focusActiveDateButton(): boolean {
		const activeButton = panel?.querySelector<HTMLButtonElement>(
			`[data-date-range-calendar="${activeBoundary}"] [data-date-range-day="${activeDateKey}"]`
		);
		if (!activeButton) return false;
		activeButton.focus({ preventScroll: true });
		return document.activeElement === activeButton;
	}

	function clearFocusActiveDateFrame(): void {
		if (focusActiveDateFrameId === null || typeof window === 'undefined') return;
		window.cancelAnimationFrame(focusActiveDateFrameId);
		focusActiveDateFrameId = null;
	}

	function queueFocusActiveDateButton(attemptsRemaining = 3): void {
		if (typeof window === 'undefined' || !open) return;
		clearFocusActiveDateFrame();
		void tick().then(() => {
			if (!open) return;
			focusActiveDateFrameId = window.requestAnimationFrame(() => {
				focusActiveDateFrameId = null;
				if (focusActiveDateButton() || attemptsRemaining <= 0) return;
				queueFocusActiveDateButton(attemptsRemaining - 1);
			});
		});
	}

	async function openPanel(boundary: DateRangeBoundary, triggerButton: HTMLButtonElement | null): Promise<void> {
		if (disabled) return;
		activeBoundary = boundary;
		activeDateKey = currentBoundaryDate(boundary);
		syncVisibleMonthsToRange();
		if (boundary === 'start') {
			visibleStartMonth = resolveVisibleBoundaryMonth('start');
		} else {
			visibleEndMonth = resolveVisibleBoundaryMonth('end');
		}
		resetAllCalendarMotion();
		returnFocusTarget = triggerButton;
		if (open) {
			await tick();
			updatePanelPosition();
			queueFocusActiveDateButton();
			return;
		}

		open = true;
		dispatch('open', currentRange());
		await tick();
		updatePanelPosition();
		queueFocusActiveDateButton();
	}

	function closePanel(returnFocus = false): void {
		if (!open) return;
		open = false;
		resetAllCalendarMotion();
		clearFocusActiveDateFrame();
		panelStyle = 'position: fixed; left: 0px; top: 0px; visibility: hidden;';
		dispatch('close', currentRange());
		if (returnFocus) {
			returnFocusTarget?.focus();
		}
	}

	function updateActiveBoundary(boundary: DateRangeBoundary): void {
		activeBoundary = boundary;
		activeDateKey = currentBoundaryDate(boundary);
		setVisibleMonth(boundary, monthReferenceFromDateKey(activeDateKey));
		queueFocusActiveDateButton();
	}

	function applyBoundaryDateChange(dateKey: string, boundary: DateRangeBoundary): void {
		const nextSelectionState = resolveDateRangeSelectionState(currentRange(), dateKey, boundary);
		startValue = nextSelectionState.startDate;
		endValue = nextSelectionState.endDate;
		activeBoundary = nextSelectionState.activeBoundary;
		activeDateKey = currentBoundaryDate(activeBoundary);
		syncVisibleMonthsToRange(nextSelectionState.startDate, nextSelectionState.endDate);
		dispatch('input', {
			startDate: nextSelectionState.startDate,
			endDate: nextSelectionState.endDate
		});
		dispatch('change', {
			startDate: nextSelectionState.startDate,
			endDate: nextSelectionState.endDate
		});
		queueFocusActiveDateButton();
	}

	function selectDate(dateKey: string, boundary: DateRangeBoundary): void {
		applyBoundaryDateChange(dateKey, boundary);
	}

	function moveSelectedBoundaryDate(dateKey: string, boundary: DateRangeBoundary): void {
		applyBoundaryDateChange(dateKey, boundary);
	}

	function handleDayKeydown(event: KeyboardEvent, dateKey: string, boundary: DateRangeBoundary): void {
		const nextDateKey = resolveCalendarKeyboardDateKey(dateKey, event.key, event.shiftKey);
		if (!nextDateKey) return;
		event.preventDefault();
		moveSelectedBoundaryDate(nextDateKey, boundary);
	}

	function moveMonth(side: RangeCalendarSide, direction: -1 | 1): void {
		if (animationStateFor(side).isTransitioning) {
			finalizeMonthAnimation(side);
		}
		startMonthAnimation(side, direction);
	}

	function handleLeftMonthChange(nextValue: string): void {
		const nextMonth = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(nextMonth)) return;
		jumpToMonth('start', { year: visibleStartMonth.year, month: nextMonth });
	}

	function handleLeftYearChange(nextValue: string): void {
		const nextYear = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(nextYear)) return;
		jumpToMonth('start', { year: nextYear, month: visibleStartMonth.month });
	}

	function handleRightMonthChange(nextValue: string): void {
		const nextMonth = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(nextMonth)) return;
		jumpToMonth('end', { year: visibleEndMonth.year, month: nextMonth });
	}

	function handleRightYearChange(nextValue: string): void {
		const nextYear = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(nextYear)) return;
		jumpToMonth('end', { year: nextYear, month: visibleEndMonth.month });
	}

	function handleCalendarWheel(event: WheelEvent, side: RangeCalendarSide): void {
		if (disabled || event.ctrlKey) return;
		event.preventDefault();

		activeBoundary = side;
		const wheelState = wheelStateFor(side);
		const nextWheelTimestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : null;
		if (
			nextWheelTimestamp !== null &&
			shouldResetCalendarWheelGesture(
				wheelState.lastEventTimestamp,
				nextWheelTimestamp,
				wheelState.lockedDirection,
				event.deltaY,
				CALENDAR_WHEEL_GESTURE_GAP_MS
			)
		) {
			unlockCalendarWheelGesture(side);
		}
		wheelState.lastEventTimestamp = nextWheelTimestamp;
		scheduleCalendarWheelGestureUnlock(side);

		if (wheelState.isGestureLocked) {
			return;
		}

		const wheelResult = consumeCalendarWheelDelta(
			wheelState.remainderDeltaY,
			event.deltaY,
			CALENDAR_WHEEL_THRESHOLD
		);
		wheelState.remainderDeltaY = wheelResult.remainderDeltaY;
		if (wheelResult.monthDelta === 0) return;

		wheelState.isGestureLocked = true;
		wheelState.lockedDirection = wheelResult.monthDelta < 0 ? -1 : 1;
		wheelState.remainderDeltaY = 0;
		if (animationStateFor(side).isTransitioning) {
			finalizeMonthAnimation(side);
		}
		moveMonth(side, wheelResult.monthDelta < 0 ? -1 : 1);
	}

	function shouldHandleCalendarNavigationKey(event: KeyboardEvent): boolean {
		if (!open || !isTopDatePicker(datePickerId)) return false;
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;
		if (
			event.key !== 'ArrowLeft' &&
			event.key !== 'ArrowRight' &&
			event.key !== 'ArrowUp' &&
			event.key !== 'ArrowDown'
		) {
			return false;
		}

		const target = event.target;
		if (!(target instanceof Element)) return true;
		if (target.closest('[data-date-range-day], .date-range-picker-calendars')) return true;
		if (target.closest('[role="listbox"], [role="option"]')) return false;
		if (target.closest('button:not([data-date-range-day])')) return false;
		return true;
	}

	function handleCalendarNavigationKey(event: KeyboardEvent): void {
		const nextDateKey = resolveCalendarKeyboardDateKey(activeDateKey, event.key, event.shiftKey);
		if (!nextDateKey) return;
		event.preventDefault();
		event.stopPropagation();
		moveSelectedBoundaryDate(nextDateKey, activeBoundary);
	}

	function handleMonthStripTransitionEnd(event: TransitionEvent, side: RangeCalendarSide): void {
		if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
		const animationState = animationStateFor(side);
		if (animationState.slideDirection === 0 || !animationState.pendingVisibleMonth) return;
		finalizeMonthAnimation(side);
	}

	function boundaryButtonClass(boundary: DateRangeBoundary): string {
		return joinClassNames(
			'date-range-picker-boundary-button',
			activeBoundary === boundary && 'date-range-picker-boundary-button-active'
		);
	}

	function dayButtonClass(cell: ReturnType<typeof buildCalendarGrid>[number]): string {
		return joinClassNames(
			'date-picker-day',
			cell.isCurrentMonth ? '' : 'date-picker-day-muted',
			cell.isDisabled && 'date-picker-day-disabled',
			cell.isInRange && !cell.isRangeStart && !cell.isRangeEnd && 'date-picker-day-in-range',
			cell.isRangeStart && 'date-picker-day-range-start',
			cell.isRangeEnd && 'date-picker-day-range-end',
			cell.isToday && !cell.isRangeStart && !cell.isRangeEnd && 'date-picker-day-today',
			cell.isSelected && !cell.isRangeStart && !cell.isRangeEnd && 'date-picker-day-selected'
		);
	}

	const leftMonthOptions = $derived.by(() => monthOptions(visibleStartMonth));
	const rightMonthOptions = $derived.by(() => monthOptions(visibleEndMonth));
	const leftYearOptions = $derived.by(() => yearOptions(visibleStartMonth));
	const rightYearOptions = $derived.by(() => yearOptions(visibleEndMonth));
	const startCalendarMonthPages = $derived.by(() =>
		buildCalendarMonthWindow(visibleStartMonth, 'date', min, max).map((reference, index) => {
			const slot: MonthPageSlot = index === 0 ? 'previous' : index === 1 ? 'current' : 'next';
			return {
				slot,
				reference,
				cells: buildCalendarGrid(reference, {
					type: 'date',
					value: currentRange().startDate,
					min,
					max,
					rangeStart: currentRange().startDate,
					rangeEnd: currentRange().endDate
				})
			};
		})
	);
	const endCalendarMonthPages = $derived.by(() =>
		buildCalendarMonthWindow(visibleEndMonth, 'date', min, max).map((reference, index) => {
			const slot: MonthPageSlot = index === 0 ? 'previous' : index === 1 ? 'current' : 'next';
			return {
				slot,
				reference,
				cells: buildCalendarGrid(reference, {
					type: 'date',
					value: currentRange().endDate,
					min,
					max,
					rangeStart: currentRange().startDate,
					rangeEnd: currentRange().endDate
				})
			};
		})
	);
	const canMoveBackward = $derived.by(
		() => compareMonthReference(shiftMonthReference(visibleStartMonth, -1, 'date', min, max), visibleStartMonth) !== 0
	);
	const canMoveForward = $derived.by(
		() => compareMonthReference(shiftMonthReference(visibleEndMonth, 1, 'date', min, max), visibleEndMonth) !== 0
	);
	const startCanMoveForward = $derived.by(
		() => compareMonthReference(shiftMonthReference(visibleStartMonth, 1, 'date', min, max), visibleStartMonth) !== 0
	);
	const endCanMoveBackward = $derived.by(
		() => compareMonthReference(shiftMonthReference(visibleEndMonth, -1, 'date', min, max), visibleEndMonth) !== 0
	);
	const startMonthStripClass = $derived.by(() =>
		joinClassNames(
			'date-picker-month-strip',
			startMonthAnimationState.slideDirection !== 0 && 'date-picker-month-strip-animating'
		)
	);
	const endMonthStripClass = $derived.by(() =>
		joinClassNames(
			'date-picker-month-strip',
			endMonthAnimationState.slideDirection !== 0 && 'date-picker-month-strip-animating'
		)
	);
	const startMonthStripStyle = $derived.by(
		() =>
			`transform: translateY(calc(-1 * ${resolveCalendarMonthStripPageOffset(startMonthAnimationState.slideDirection)} * var(--date-picker-month-page-height)));`
	);
	const endMonthStripStyle = $derived.by(
		() =>
			`transform: translateY(calc(-1 * ${resolveCalendarMonthStripPageOffset(endMonthAnimationState.slideDirection)} * var(--date-picker-month-page-height)));`
	);
	const calendarSections = $derived.by<RangeCalendarSection[]>(() => [
		{
			key: 'start',
			label: startLabel,
			month: visibleStartMonth,
			monthPages: startCalendarMonthPages,
			monthOptions: leftMonthOptions,
			yearOptions: leftYearOptions,
			canMoveBackward: canMoveBackward,
			canMoveForward: startCanMoveForward,
			monthStripClass: startMonthStripClass,
			monthStripStyle: startMonthStripStyle
		},
		{
			key: 'end',
			label: endLabel,
			month: visibleEndMonth,
			monthPages: endCalendarMonthPages,
			monthOptions: rightMonthOptions,
			yearOptions: rightYearOptions,
			canMoveBackward: endCanMoveBackward,
			canMoveForward: canMoveForward,
			monthStripClass: endMonthStripClass,
			monthStripStyle: endMonthStripStyle
		}
	]);

	$effect(() => {
		if (!open) {
			activeDateKey = currentBoundaryDate(activeBoundary);
			syncVisibleMonthsToRange();
		}
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mediaQueryList = window.matchMedia(DESKTOP_MEDIA_QUERY);
		const updateDesktopState = () => {
			isDesktop = mediaQueryList.matches;
		};
		updateDesktopState();
		mediaQueryList.addEventListener('change', updateDesktopState);
		return () => {
			mediaQueryList.removeEventListener('change', updateDesktopState);
		};
	});

	$effect(() => {
		if (!open) return;
		registerOpenDatePicker(datePickerId);
		return () => {
			unregisterOpenDatePicker(datePickerId);
		};
	});

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;

		let frameId: number | null = null;
		const schedulePositionUpdate = () => {
			if (!isDesktop || frameId !== null) return;
			frameId = window.requestAnimationFrame(() => {
				frameId = null;
				updatePanelPosition();
			});
		};

		const handleWindowPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node) || !root) return;
			if (root.contains(target)) return;
			closePanel();
		};

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (shouldHandleCalendarNavigationKey(event)) {
				handleCalendarNavigationKey(event);
				return;
			}
			if (event.key !== 'Escape') return;
			if (!isTopDatePicker(datePickerId)) return;
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			closePanel(true);
		};

		void tick().then(() => {
			updatePanelPosition();
		});

		window.addEventListener('pointerdown', handleWindowPointerDown);
		window.addEventListener('keydown', handleWindowKeydown, true);
		window.addEventListener('resize', schedulePositionUpdate);
		window.addEventListener('scroll', schedulePositionUpdate, true);

		return () => {
			window.removeEventListener('pointerdown', handleWindowPointerDown);
			window.removeEventListener('keydown', handleWindowKeydown, true);
			window.removeEventListener('resize', schedulePositionUpdate);
			window.removeEventListener('scroll', schedulePositionUpdate, true);
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
		};
	});

	$effect(() => {
		return () => {
			clearMonthTransitionTimeout('start');
			clearMonthTransitionTimeout('end');
			clearCalendarWheelGestureTimeout('start');
			clearCalendarWheelGestureTimeout('end');
			clearFocusActiveDateFrame();
		};
	});
</script>

<div class="date-range-picker-root" bind:this={root}>
	{#if startName}
		<input type="hidden" name={startName} value={String(startValue ?? '')} />
	{/if}
	{#if endName}
		<input type="hidden" name={endName} value={String(endValue ?? '')} />
	{/if}

	<div class={shellClass} bind:this={triggerShell}>
		<button
			id={id}
			type="button"
			class={joinClassNames(segmentClass, startSegmentClass)}
			aria-label={`${ariaLabel} start date`}
			aria-haspopup="dialog"
			aria-expanded={open}
			disabled={disabled}
			bind:this={startTriggerButton}
			onclick={() => {
				void openPanel('start', startTriggerButton);
			}}
		>
			<span class="date-range-picker-trigger-copy">
				<span class="date-range-picker-trigger-label">{startLabel}</span>
				<span class="date-range-picker-trigger-value">{displayValue(currentRange().startDate)}</span>
			</span>
		</button>

		<button
			type="button"
			class={joinClassNames(segmentClass, endSegmentClass)}
			aria-label={`${ariaLabel} end date`}
			aria-haspopup="dialog"
			aria-expanded={open}
			disabled={disabled}
			bind:this={endTriggerButton}
			onclick={() => {
				void openPanel('end', endTriggerButton);
			}}
		>
			<span class="date-range-picker-trigger-copy">
				<span class="date-range-picker-trigger-label">{endLabel}</span>
				<span class="date-range-picker-trigger-value">{displayValue(currentRange().endDate)}</span>
			</span>
		</button>
	</div>

	{#if open}
		{#if !isDesktop}
			<button
				type="button"
				class="date-picker-mobile-backdrop"
				aria-label="Close date range picker"
				onclick={() => {
					closePanel(true);
				}}
			></button>
		{/if}

		<div
			bind:this={panel}
			class={joinClassNames(
				'date-picker-panel date-range-picker-panel',
				isDesktop ? 'date-picker-panel-desktop date-range-picker-panel-desktop' : 'date-picker-panel-mobile date-range-picker-panel-mobile',
				panelClass
			)}
			style={isDesktop ? panelStyle : undefined}
		>
			<div class="date-range-picker-boundary-row">
				<button type="button" class={boundaryButtonClass('start')} onclick={() => updateActiveBoundary('start')}>
					<span class="date-range-picker-boundary-label">{startLabel}</span>
					<span class="date-range-picker-boundary-value">{displayValue(currentRange().startDate)}</span>
				</button>
				<button type="button" class={boundaryButtonClass('end')} onclick={() => updateActiveBoundary('end')}>
					<span class="date-range-picker-boundary-label">{endLabel}</span>
					<span class="date-range-picker-boundary-value">{displayValue(currentRange().endDate)}</span>
				</button>
			</div>

			<div class="date-range-picker-calendars">
				{#each calendarSections as calendar}
					<section
						class="date-range-picker-calendar"
						data-date-range-calendar={calendar.key}
						aria-label={`${calendar.label} calendar for ${formatMonthReferenceLabel(calendar.month)} ${calendar.month.year}`}
					>
						<div class="date-range-picker-calendar-header">
							<button
								type="button"
								class="date-picker-nav-button"
								aria-label={`View previous ${calendar.label.toLowerCase()} month`}
								disabled={!calendar.canMoveBackward}
								onclick={() => {
									activeBoundary = calendar.key;
									moveMonth(calendar.key, -1);
								}}
							>
								<IconChevronLeft class="h-5 w-5" />
							</button>

							<div class="date-range-picker-heading-group">
								<ListboxDropdown
									options={calendar.monthOptions}
									value={String(calendar.month.month)}
									ariaLabel={`Choose ${calendar.label.toLowerCase()} calendar month`}
									buttonClass="date-picker-heading-dropdown w-full"
									listClass="w-52"
									on:change={(event) => {
										if (calendar.key === 'start') {
											handleLeftMonthChange(event.detail.value);
										} else {
											handleRightMonthChange(event.detail.value);
										}
									}}
								/>
								<ListboxDropdown
									options={calendar.yearOptions}
									value={String(calendar.month.year)}
									ariaLabel={`Choose ${calendar.label.toLowerCase()} calendar year`}
									buttonClass="date-picker-heading-dropdown w-full"
									listClass="w-36"
									on:change={(event) => {
										if (calendar.key === 'start') {
											handleLeftYearChange(event.detail.value);
										} else {
											handleRightYearChange(event.detail.value);
										}
									}}
								/>
							</div>

							<button
								type="button"
								class="date-picker-nav-button"
								aria-label={`View next ${calendar.label.toLowerCase()} month`}
								disabled={!calendar.canMoveForward}
								onclick={() => {
									activeBoundary = calendar.key;
									moveMonth(calendar.key, 1);
								}}
							>
								<IconChevronRight class="h-5 w-5" />
							</button>
						</div>

						<div class="date-picker-weekdays" aria-hidden="true">
							{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as weekday}
								<span>{weekday}</span>
							{/each}
						</div>

						<div
							class="date-picker-month-viewport date-range-picker-month-viewport"
							role="group"
							aria-label={`${calendar.label} calendar grid for ${formatMonthReferenceLabel(calendar.month)} ${calendar.month.year}`}
							onwheel={(event) => {
								handleCalendarWheel(event, calendar.key);
							}}
						>
							<div
								class={calendar.monthStripClass}
								style={calendar.monthStripStyle}
								ontransitionend={(event) => {
									handleMonthStripTransitionEnd(event, calendar.key);
								}}
							>
								{#each calendar.monthPages as monthPage (`${calendar.key}-${monthPage.slot}-${monthPage.reference.year}-${monthPage.reference.month}`)}
									<div
										class="date-picker-grid date-picker-month-page"
										role="grid"
										data-month-page={monthPage.slot}
										aria-hidden={monthPage.slot !== 'current'}
										aria-label={`${formatMonthReferenceLabel(monthPage.reference)} ${monthPage.reference.year}`}
									>
										{#each monthPage.cells as cell (`${calendar.key}-${monthPage.slot}-${cell.dateKey}`)}
											<button
												type="button"
												role="gridcell"
												data-date-range-day={cell.dateKey}
												tabindex={monthPage.slot === 'current' && calendar.key === activeBoundary && cell.dateKey === activeDateKey
													? 0
													: -1}
												aria-selected={cell.isRangeStart || cell.isRangeEnd}
												aria-current={cell.isToday ? 'date' : undefined}
												disabled={cell.isDisabled}
												class={dayButtonClass(cell)}
												onclick={() => {
													selectDate(cell.dateKey, calendar.key);
												}}
												onfocus={() => {
													activeBoundary = calendar.key;
													activeDateKey = cell.dateKey;
												}}
												onkeydown={(event) => {
													handleDayKeydown(event, cell.dateKey, calendar.key);
												}}
											>
												{cell.dayNumber}
											</button>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					</section>
				{/each}
			</div>
		</div>
	{/if}
</div>
