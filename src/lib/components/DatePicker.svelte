<script lang="ts">
	import {
		IconCalendar,
		IconChevronLeft,
		IconChevronRight,
		IconClock
	} from '@tabler/icons-svelte';
	import { createEventDispatcher, tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

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
		buildShortcutValue,
		clampPickerValue,
		consumeCalendarWheelDelta,
		formatMonthReferenceLabel,
		formatPickerValueForDisplay,
		inferPickerYearRange,
		mergeDateKeyWithValue,
		moveDisplaySelectionRange,
		parseDisplayPickerValue,
		parsePickerValue,
		resolveCalendarKeyboardDateKey,
		resolveCalendarMonthStripPageOffset,
		resolveDisplaySelectionRange,
		shouldResetCalendarWheelGesture,
		shiftMonthReference,
		type DatePickerShortcut,
		type DatePickerType,
		type MonthReference
	} from '$lib/components/date-picker.js';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'value' | 'children'> {
		id?: string;
		name?: string;
		type?: DatePickerType;
		value?: string;
		min?: string;
		max?: string;
		minYear?: number;
		maxYear?: number;
		step?: string | number;
		disabled?: boolean;
		required?: boolean;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		ariaLabel?: string;
		format?: string;
		placeholder?: string;
		inputClass?: string;
		triggerClass?: string;
		panelClass?: string;
		inputElement?: HTMLInputElement | null;
		trigger?: Snippet<[boolean, string]>;
	}

	type DatePickerOption = { value: string; label: string; disabled?: boolean };
	type MonthPageSlot = 'previous' | 'current' | 'next';

	let {
		id,
		name,
		type = 'date',
		value = $bindable(''),
		min,
		max,
		minYear,
		maxYear,
		step,
		disabled = false,
		required = false,
		autocomplete = 'off',
		ariaLabel,
		format,
		placeholder,
		inputClass = 'input-secondary min-h-10 pr-10 py-2 text-sm disabled:cursor-not-allowed',
		triggerClass = 'date-picker-trigger-shell',
		panelClass = '',
		inputElement = $bindable<HTMLInputElement | null>(null),
		trigger,
		...inputProps
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		input: { value: string };
		change: { value: string };
		focus: { value: string };
		blur: { value: string };
		open: { value: string };
		close: { value: string };
	}>();

	const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';
	const EDGE_PADDING_PX = 8;
	const TRIGGER_GAP_PX = 8;
	const CALENDAR_WHEEL_THRESHOLD = 72;
	const CALENDAR_WHEEL_GESTURE_GAP_MS = 30;
	const MONTH_STRIP_TRANSITION_FALLBACK_MS = 120;
	const datePickerId = Symbol('date-picker');

	let root = $state<HTMLDivElement | null>(null);
	let inputShell = $state<HTMLDivElement | null>(null);
	let triggerButton = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let isDesktop = $state(false);
	let calendarWheelRemainder = $state(0);
	let isCalendarWheelGestureLocked = $state(false);
	let calendarWheelLockedDirection = $state<-1 | 0 | 1>(0);
	let lastCalendarWheelEventTimestamp = $state<number | null>(null);
	let monthSlideDirection = $state<-1 | 0 | 1>(0);
	let isMonthTransitioning = $state(false);
	let pendingVisibleMonth = $state<MonthReference | null>(null);
	let focusActiveDateFrameId: number | null = null;
	let panelStyle = $state('position: fixed; left: 0px; top: 0px; visibility: hidden;');
	const initialNow = new Date();
	let monthTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let draftValue = $state(
		untrack(() => formatPickerValueForDisplay(String(value ?? ''), type, format))
	);
	let visibleMonth = $state<MonthReference>({
		year: initialNow.getFullYear(),
		month: initialNow.getMonth() + 1
	});
	let activeDateKey = $state(
		`${initialNow.getFullYear()}-${pad2(initialNow.getMonth() + 1)}-${pad2(initialNow.getDate())}`
	);

	function resolveVisibleMonth(currentValue: string, currentType: DatePickerType): MonthReference {
		const parsed = parsePickerValue(currentValue, currentType);
		const now = new Date();
		return {
			year: parsed?.year ?? now.getFullYear(),
			month: parsed?.month ?? now.getMonth() + 1
		};
	}

	function resolveActiveDateKey(currentValue: string, currentType: DatePickerType): string {
		const parsed = parsePickerValue(currentValue, currentType);
		if (parsed) {
			return `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
		}

		const now = new Date();
		return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
	}

	function pad2(next: number): string {
		return String(next).padStart(2, '0');
	}

	function joinClassNames(...values: Array<string | false | null | undefined>): string {
		return values
			.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
			.map((value) => value.trim())
			.join(' ');
	}

	function monthLabel(reference: MonthReference): string {
		return formatMonthReferenceLabel(reference);
	}

	function compareMonthReference(left: MonthReference, right: MonthReference): number {
		if (left.year !== right.year) return left.year - right.year;
		return left.month - right.month;
	}

	function matchesMonthBounds(
		reference: MonthReference,
		monthMin: string | undefined,
		monthMax: string | undefined,
		currentType: DatePickerType
	): boolean {
		const minReference = resolveVisibleMonth(monthMin ?? '', currentType);
		const maxReference = resolveVisibleMonth(monthMax ?? '', currentType);
		const hasMin = Boolean(parsePickerValue(monthMin ?? '', currentType));
		const hasMax = Boolean(parsePickerValue(monthMax ?? '', currentType));

		if (hasMin && compareMonthReference(reference, minReference) < 0) return false;
		if (hasMax && compareMonthReference(reference, maxReference) > 0) return false;
		return true;
	}

	function minuteStepValue(inputStep: string | number | undefined): number {
		const numericStep =
			typeof inputStep === 'number' ? inputStep : Number.parseInt(String(inputStep ?? '60'), 10);
		if (!Number.isFinite(numericStep) || numericStep <= 0) return 1;
		return Math.max(1, Math.round(numericStep / 60));
	}

	function monthOptions(): DatePickerOption[] {
		return Array.from({ length: 12 }, (_, index) => {
			const month = index + 1;
			return {
				value: String(month),
				label: monthLabel({ year: visibleMonth.year, month }),
				disabled: !matchesMonthBounds({ year: visibleMonth.year, month }, min, max, type)
			};
		});
	}

	function yearOptions(): DatePickerOption[] {
		const parsedValueYear = parsePickerValue(String(value ?? ''), type)?.year;
		const yearRange = inferPickerYearRange([visibleMonth.year, parsedValueYear], {
			minYear,
			maxYear
		});
		const yearFloor = yearRange.minYear;
		const yearCeiling = yearRange.maxYear;

		return Array.from({ length: yearCeiling - yearFloor + 1 }, (_, index) => {
			const year = yearFloor + index;
			const option = { year, month: visibleMonth.month };
			return {
				value: String(year),
				label: String(year),
				disabled: !matchesMonthBounds(option, min, max, type)
			};
		});
	}

	function currentDateKey(): string {
		const parsed = parsePickerValue(String(value ?? ''), type);
		if (parsed) {
			return `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
		}

		const now = new Date();
		return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
	}

	function currentDisplayValue(currentValue: string): string {
		return formatPickerValueForDisplay(currentValue, type, format);
	}

	function currentTimeValue(): { hour: string; minute: string } {
		const parsed = parsePickerValue(String(value ?? ''), 'datetime-local');
		const now = new Date();
		return {
			hour: pad2(parsed?.hour ?? now.getHours()),
			minute: pad2(parsed?.minute ?? now.getMinutes())
		};
	}

	function setInputSelection(start: number, end: number): void {
		if (!inputElement || disabled || !draftValue) return;
		inputElement.setSelectionRange(start, end);
	}

	function selectInputSegmentAtCaret(caret?: number): void {
		if (!inputElement || disabled || !draftValue) return;
		const selection = resolveDisplaySelectionRange(
			draftValue,
			type,
			format,
			caret ?? inputElement.selectionStart ?? 0
		);
		setInputSelection(selection.start, selection.end);
	}

	function queueInputSegmentSelection(caret?: number): void {
		queueMicrotask(() => {
			selectInputSegmentAtCaret(caret);
		});
	}

	function commitValue(nextValue: string, emitChange = true): void {
		const clampedValue = clampPickerValue(nextValue, type, min, max);
		value = clampedValue;
		draftValue = currentDisplayValue(clampedValue);
		activeDateKey = resolveActiveDateKey(clampedValue, type);
		dispatch('input', { value: clampedValue });
		if (emitChange) {
			dispatch('change', { value: clampedValue });
		}
	}

	function updatePanelPosition(): void {
		if (typeof window === 'undefined' || !isDesktop || !panel) return;

		const anchorRect = (inputShell ?? triggerButton)?.getBoundingClientRect();
		if (!anchorRect) return;
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

		const maxWidthStyle =
			panelRect.width > position.maxWidth ? `max-width: ${Math.round(position.maxWidth)}px;` : '';
		panelStyle = toFixedStyle(
			{
				...position,
				left: centeredLeft
			},
			maxWidthStyle
		);
	}

	function focusActiveDateButton(): boolean {
		const selector = `[data-month-page="current"] [data-date-picker-day="${activeDateKey}"]`;
		const activeButton = panel?.querySelector<HTMLButtonElement>(selector);
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

	function clearMonthTransitionTimeout(): void {
		if (monthTransitionTimeoutId === null) return;
		clearTimeout(monthTransitionTimeoutId);
		monthTransitionTimeoutId = null;
	}

	function unlockCalendarWheelGesture(): void {
		isCalendarWheelGestureLocked = false;
		calendarWheelLockedDirection = 0;
		calendarWheelRemainder = 0;
	}

	function resetMonthAnimation(): void {
		clearMonthTransitionTimeout();
		unlockCalendarWheelGesture();
		lastCalendarWheelEventTimestamp = null;
		monthSlideDirection = 0;
		isMonthTransitioning = false;
		pendingVisibleMonth = null;
	}

	function finalizeMonthAnimation(): void {
		if (!pendingVisibleMonth) {
			resetMonthAnimation();
			return;
		}

		const nextVisibleMonth = pendingVisibleMonth;
		clearMonthTransitionTimeout();
		pendingVisibleMonth = null;
		monthSlideDirection = 0;
		isMonthTransitioning = false;
		visibleMonth = nextVisibleMonth;

		if (panel?.contains(document.activeElement)) {
			void tick().then(() => {
				focusActiveDateButton();
			});
		}
	}

	function startMonthAnimation(direction: -1 | 1): void {
		if (isMonthTransitioning || monthSlideDirection !== 0) return;

		const nextVisibleMonth = shiftMonthReference(visibleMonth, direction, type, min, max);
		if (compareMonthReference(nextVisibleMonth, visibleMonth) === 0) {
			calendarWheelRemainder = 0;
			return;
		}

		pendingVisibleMonth = nextVisibleMonth;
		isMonthTransitioning = true;
		monthSlideDirection = direction;
		clearMonthTransitionTimeout();
		monthTransitionTimeoutId = setTimeout(() => {
			finalizeMonthAnimation();
		}, MONTH_STRIP_TRANSITION_FALLBACK_MS);
	}

	function jumpToMonth(nextMonth: MonthReference): void {
		resetMonthAnimation();
		visibleMonth = nextMonth;
	}

	async function openPanel(): Promise<void> {
		if (disabled || open) return;
		open = true;
		resetMonthAnimation();
		visibleMonth = resolveVisibleMonth(String(value ?? ''), type);
		activeDateKey = resolveActiveDateKey(String(value ?? ''), type);
		dispatch('open', { value: String(value ?? '') });
		await tick();
		updatePanelPosition();
		queueFocusActiveDateButton();
	}

	function closePanel(returnFocus = false): void {
		if (!open) return;
		open = false;
		resetMonthAnimation();
		clearFocusActiveDateFrame();
		panelStyle = 'position: fixed; left: 0px; top: 0px; visibility: hidden;';
		dispatch('close', { value: String(value ?? '') });
		if (returnFocus) {
			triggerButton?.focus();
		}
	}

	function togglePanel(): void {
		if (open) {
			closePanel();
			return;
		}
		void openPanel();
	}

	function applyShortcut(shortcut: DatePickerShortcut): void {
		commitValue(buildShortcutValue(String(value ?? ''), type, shortcut));
		visibleMonth = resolveVisibleMonth(String(value ?? ''), type);
		activeDateKey = resolveActiveDateKey(String(value ?? ''), type);
	}

	function handleTextInput(event: Event): void {
		const nextValue = (event.currentTarget as HTMLInputElement).value;
		draftValue = nextValue;
		const parsedDisplayValue = parseDisplayPickerValue(nextValue, type, format);
		if (!parsedDisplayValue) {
			dispatch('input', { value: nextValue });
			return;
		}

		const normalizedValue = clampPickerValue(parsedDisplayValue, type, min, max);
		value = normalizedValue;
		activeDateKey = resolveActiveDateKey(normalizedValue, type);
		dispatch('input', { value: normalizedValue });
	}

	function handleTextBlur(): void {
		const normalizedInputValue = parseDisplayPickerValue(draftValue, type, format);
		if (normalizedInputValue) {
			const normalized = clampPickerValue(normalizedInputValue, type, min, max);
			value = normalized;
			draftValue = currentDisplayValue(normalized);
			activeDateKey = resolveActiveDateKey(normalized, type);
			dispatch('change', { value: normalized });
			dispatch('blur', { value: normalized });
			return;
		}

		draftValue = currentDisplayValue(String(value ?? ''));
		dispatch('blur', { value: draftValue });
	}

	function handleTextFocus(): void {
		dispatch('focus', { value: draftValue });
		queueInputSegmentSelection(0);
	}

	function handleTextMouseup(): void {
		queueInputSegmentSelection();
	}

	function handleInputKeydown(event: KeyboardEvent): void {
		if (disabled) return;
		if (event.key === 'ArrowDown' && (event.altKey || event.metaKey)) {
			event.preventDefault();
			void openPanel();
			return;
		}

		if (event.key === 'Escape' && open) {
			event.preventDefault();
			closePanel();
			return;
		}

		if (
			(event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
			!event.altKey &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.shiftKey &&
			draftValue &&
			inputElement
		) {
			event.preventDefault();
			const selection = moveDisplaySelectionRange(
				draftValue,
				type,
				format,
				inputElement.selectionStart ?? 0,
				inputElement.selectionEnd ?? 0,
				event.key === 'ArrowLeft' ? -1 : 1
			);
			setInputSelection(selection.start, selection.end);
		}
	}

	function selectDate(dateKey: string): void {
		if (type === 'date') {
			commitValue(dateKey);
		} else {
			commitValue(mergeDateKeyWithValue(dateKey, String(value ?? ''), type));
		}
		visibleMonth = resolveVisibleMonth(String(value ?? ''), type);
		activeDateKey = dateKey;
		closePanel(true);
	}

	function moveSelectedDate(dateKey: string): void {
		const nextValue =
			type === 'date'
				? dateKey
				: mergeDateKeyWithValue(dateKey, String(value ?? ''), type);
		const clampedValue = clampPickerValue(nextValue, type, min, max);
		const parsed = parsePickerValue(clampedValue, type);
		if (!parsed) return;

		commitValue(clampedValue);
		const nextDateKey = `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
		activeDateKey = nextDateKey;
		jumpToMonth({ year: parsed.year, month: parsed.month });
		queueFocusActiveDateButton();
	}

	function moveMonth(delta: number): void {
		if (!Number.isFinite(delta) || delta === 0) return;
		startMonthAnimation(delta < 0 ? -1 : 1);
	}

	function handleCalendarWheel(event: WheelEvent): void {
		if (disabled || event.ctrlKey) return;
		event.preventDefault();

		const nextWheelTimestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : null;
		if (
			nextWheelTimestamp !== null &&
			shouldResetCalendarWheelGesture(
				lastCalendarWheelEventTimestamp,
				nextWheelTimestamp,
				calendarWheelLockedDirection,
				event.deltaY,
				CALENDAR_WHEEL_GESTURE_GAP_MS
			)
		) {
			unlockCalendarWheelGesture();
		}
		lastCalendarWheelEventTimestamp = nextWheelTimestamp;

		if (isCalendarWheelGestureLocked) {
			return;
		}

		const wheelResult = consumeCalendarWheelDelta(
			calendarWheelRemainder,
			event.deltaY,
			CALENDAR_WHEEL_THRESHOLD
		);
		calendarWheelRemainder = wheelResult.remainderDeltaY;
		if (wheelResult.monthDelta === 0) {
			return;
		}

		isCalendarWheelGestureLocked = true;
		calendarWheelLockedDirection = wheelResult.monthDelta < 0 ? -1 : 1;
		calendarWheelRemainder = 0;
		const nextDirection: -1 | 1 = wheelResult.monthDelta < 0 ? -1 : 1;
		if (isMonthTransitioning) {
			finalizeMonthAnimation();
		}

		startMonthAnimation(nextDirection);
	}

	function handleMonthChange(nextValue: string): void {
		const nextMonth = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(nextMonth)) return;
		jumpToMonth({ year: visibleMonth.year, month: nextMonth });
	}

	function handleYearChange(nextValue: string): void {
		const nextYear = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(nextYear)) return;
		jumpToMonth({ year: nextYear, month: visibleMonth.month });
	}

	function updateTimePart(part: 'hour' | 'minute', nextValue: string): void {
		const numericValue = Number.parseInt(nextValue, 10);
		if (!Number.isFinite(numericValue)) return;

		const time = currentTimeValue();
		const nextHour = part === 'hour' ? pad2(numericValue) : time.hour;
		const nextMinute = part === 'minute' ? pad2(numericValue) : time.minute;
		const baseDateKey = currentDateKey();
		commitValue(`${baseDateKey}T${nextHour}:${nextMinute}`);
	}

	function dayButtonClass(
		cell: ReturnType<typeof buildCalendarGrid>[number]
	): string {
		return joinClassNames(
			'date-picker-day',
			cell.isCurrentMonth ? '' : 'date-picker-day-muted',
			cell.isDisabled ? 'date-picker-day-disabled' : '',
			cell.isToday && !cell.isSelected ? 'date-picker-day-today' : '',
			cell.isSelected ? 'date-picker-day-selected' : ''
		);
	}

	function handleDayKeydown(event: KeyboardEvent, dateKey: string): void {
		const nextDateKey = resolveCalendarKeyboardDateKey(dateKey, event.key, event.shiftKey);
		if (!nextDateKey) return;

		event.preventDefault();
		moveSelectedDate(nextDateKey);
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
		if (target.closest('[data-date-picker-day], .date-picker-month-viewport')) return true;
		if (target.closest('input, textarea, select, [role="listbox"], [role="option"]')) return false;
		if (target.closest('button:not([data-date-picker-day])')) return false;
		return true;
	}

	function handleCalendarNavigationKey(event: KeyboardEvent): void {
		const nextDateKey = resolveCalendarKeyboardDateKey(activeDateKey, event.key, event.shiftKey);
		if (!nextDateKey) return;
		event.preventDefault();
		event.stopPropagation();
		moveSelectedDate(nextDateKey);
	}

	function handleMonthStripTransitionEnd(event: TransitionEvent): void {
		if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
		if (monthSlideDirection === 0 || !pendingVisibleMonth) return;
		finalizeMonthAnimation();
	}

	function timeOptions(unit: 'hour' | 'minute'): DatePickerOption[] {
		if (unit === 'hour') {
			return Array.from({ length: 24 }, (_, hour) => ({
				value: pad2(hour),
				label: pad2(hour)
			}));
		}

		const increment = minuteStepValue(step);
		const currentMinute = Number.parseInt(currentTimeValue().minute, 10);
		const optionValues = new Set<number>();
		for (let minute = 0; minute < 60; minute += increment) {
			optionValues.add(minute);
		}
		optionValues.add(currentMinute);

		return Array.from(optionValues)
			.sort((left, right) => left - right)
			.map((minute) => ({
				value: pad2(minute),
				label: pad2(minute)
			}));
	}

	const calendarMonthWindow = $derived.by(() => buildCalendarMonthWindow(visibleMonth, type, min, max));
	const calendarMonthPages = $derived.by(() =>
		calendarMonthWindow.map((reference, index) => {
			const slot: MonthPageSlot = index === 0 ? 'previous' : index === 1 ? 'current' : 'next';
			return {
				slot,
				reference,
				cells: buildCalendarGrid(reference, {
					value: String(value ?? ''),
					type,
					min,
					max
				})
			};
		})
	);
	const selectedTime = $derived.by(() => currentTimeValue());
	const minuteOptionsList = $derived.by(() => timeOptions('minute'));
	const hourOptionsList = $derived.by(() => timeOptions('hour'));
	const monthOptionList = $derived.by(() => monthOptions());
	const yearOptionList = $derived.by(() => yearOptions());
	const monthStripClass = $derived.by(() =>
		joinClassNames(
			'date-picker-month-strip',
			monthSlideDirection !== 0 && 'date-picker-month-strip-animating'
		)
	);
	const monthStripStyle = $derived.by(() => {
		const pageOffset = resolveCalendarMonthStripPageOffset(monthSlideDirection);
		return `transform: translateY(calc(-1 * ${pageOffset} * var(--date-picker-month-page-height)));`;
	});
	const canMoveBackward = $derived.by(() => {
		const previousMonth = shiftMonthReference(visibleMonth, -1, type, min, max);
		return compareMonthReference(previousMonth, visibleMonth) !== 0;
	});
	const canMoveForward = $derived.by(() => {
		const nextMonth = shiftMonthReference(visibleMonth, 1, type, min, max);
		return compareMonthReference(nextMonth, visibleMonth) !== 0;
	});
	const resolvedPlaceholder = $derived.by(() =>
		placeholder ?? (type === 'date' ? format ?? 'MM/DD/YYYY' : `${format ?? 'MM/DD/YYYY'} HH:mm`)
	);

	$effect(() => {
		const normalizedValue = String(value ?? '');
		const displayValue = currentDisplayValue(normalizedValue);
		if (displayValue === draftValue) return;
		draftValue = displayValue;
		if (!open) {
			visibleMonth = resolveVisibleMonth(normalizedValue, type);
			activeDateKey = resolveActiveDateKey(normalizedValue, type);
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
			if (!root) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
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
			clearMonthTransitionTimeout();
			clearFocusActiveDateFrame();
		};
	});
</script>

<div class="date-picker-root" bind:this={root}>
	{#if name}
		<input type="hidden" {name} value={String(value ?? '')} />
	{/if}

	{#if trigger}
		<button
			id={id}
			type="button"
			class={triggerClass}
			aria-label={ariaLabel}
			aria-haspopup="dialog"
			aria-expanded={open}
			{disabled}
			bind:this={triggerButton}
			onclick={togglePanel}
		>
			{@render trigger(open, String(value ?? ''))}
		</button>
	{:else}
		<div class="date-picker-input-shell" bind:this={inputShell}>
			<input
				{...inputProps}
				{id}
				type="text"
				aria-label={ariaLabel}
				aria-haspopup="dialog"
				aria-required={required ? 'true' : undefined}
				placeholder={resolvedPlaceholder}
				{autocomplete}
				{disabled}
				bind:this={inputElement}
				class={`${inputClass} date-picker-input`}
				value={draftValue}
				oninput={handleTextInput}
				onfocus={handleTextFocus}
				onblur={handleTextBlur}
				onkeydown={handleInputKeydown}
				onmouseup={handleTextMouseup}
			/>
			<button
				type="button"
				class="date-picker-open-button"
				aria-label={ariaLabel ?? 'Open date picker'}
				{disabled}
				bind:this={triggerButton}
				onclick={togglePanel}
			>
				<IconCalendar class="h-4 w-4" />
			</button>
		</div>
	{/if}

	{#if open}
		{#if !isDesktop}
			<button
				type="button"
				class="date-picker-mobile-backdrop"
				aria-label="Close date picker"
				onclick={() => {
					closePanel(true);
				}}
			></button>
		{/if}

		<div
			bind:this={panel}
			class={joinClassNames(
				'date-picker-panel',
				isDesktop ? 'date-picker-panel-desktop' : 'date-picker-panel-mobile',
				type === 'datetime-local' ? 'date-picker-panel-datetime' : 'date-picker-panel-date',
				panelClass
			)}
			style={isDesktop ? panelStyle : undefined}
		>
			<div class="date-picker-panel-header">
				<button
					type="button"
					class="date-picker-nav-button"
					aria-label="View previous month"
					disabled={!canMoveBackward}
					onclick={() => {
						moveMonth(-1);
					}}
				>
					<IconChevronLeft class="h-5 w-5" />
				</button>

				<div class="date-picker-heading-row">
					<ListboxDropdown
						options={monthOptionList}
						value={String(visibleMonth.month)}
						ariaLabel="Choose month"
						buttonClass="date-picker-heading-dropdown w-full"
						listClass="w-52"
						on:change={(event) => {
							handleMonthChange(event.detail.value);
						}}
					/>

					<ListboxDropdown
						options={yearOptionList}
						value={String(visibleMonth.year)}
						ariaLabel="Choose year"
						buttonClass="date-picker-heading-dropdown w-full"
						listClass="w-36"
						on:change={(event) => {
							handleYearChange(event.detail.value);
						}}
					/>
				</div>

				<button
					type="button"
					class="date-picker-nav-button"
					aria-label="View next month"
					disabled={!canMoveForward}
					onclick={() => {
						moveMonth(1);
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
				class="date-picker-month-viewport"
				role="group"
				aria-label={`${monthLabel(visibleMonth)} ${visibleMonth.year}`}
				onwheel={handleCalendarWheel}
			>
				<div
					class={monthStripClass}
					style={monthStripStyle}
					ontransitionend={handleMonthStripTransitionEnd}
				>
					{#each calendarMonthPages as monthPage (`${monthPage.slot}-${monthPage.reference.year}-${monthPage.reference.month}`)}
						<div
							class="date-picker-grid date-picker-month-page"
							role="grid"
							data-month-page={monthPage.slot}
							aria-hidden={monthPage.slot !== 'current'}
							aria-label={`${monthLabel(monthPage.reference)} ${monthPage.reference.year}`}
						>
							{#each monthPage.cells as cell (`${monthPage.slot}-${cell.dateKey}`)}
								<button
									type="button"
									role="gridcell"
									data-date-picker-day={cell.dateKey}
									tabindex={monthPage.slot === 'current' && cell.dateKey === activeDateKey ? 0 : -1}
									aria-selected={cell.isSelected}
									aria-current={cell.isToday ? 'date' : undefined}
									disabled={cell.isDisabled}
									class={dayButtonClass(cell)}
									onclick={() => {
										selectDate(cell.dateKey);
									}}
									onfocus={() => {
										activeDateKey = cell.dateKey;
									}}
									onkeydown={(event) => {
										handleDayKeydown(event, cell.dateKey);
									}}
								>
									{cell.dayNumber}
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			{#if type === 'datetime-local'}
				<div class="date-picker-time-shell">
					<div class="date-picker-time-header">
						<IconClock class="h-4 w-4" />
						<span>Time</span>
					</div>
					<div class="date-picker-time-controls">
						<ListboxDropdown
							options={hourOptionsList}
							value={selectedTime.hour}
							ariaLabel="Choose hour"
							buttonClass="date-picker-time-dropdown"
							listClass="w-24"
							on:change={(event) => {
								updateTimePart('hour', event.detail.value);
							}}
						/>
						<span class="date-picker-time-separator">:</span>
						<ListboxDropdown
							options={minuteOptionsList}
							value={selectedTime.minute}
							ariaLabel="Choose minute"
							buttonClass="date-picker-time-dropdown"
							listClass="w-24"
							on:change={(event) => {
								updateTimePart('minute', event.detail.value);
							}}
						/>
					</div>
				</div>
			{/if}

			<div class="date-picker-shortcuts">
				<button
					type="button"
					class="date-picker-shortcut-button"
					onclick={() => {
						applyShortcut('yesterday');
					}}
				>
					Yesterday
				</button>
				<button
					type="button"
					class="date-picker-shortcut-button date-picker-shortcut-button-primary"
					onclick={() => {
						applyShortcut('today');
					}}
				>
					Today
				</button>
				<button
					type="button"
					class="date-picker-shortcut-button"
					onclick={() => {
						applyShortcut('tomorrow');
					}}
				>
					Tomorrow
				</button>
			</div>
		</div>
	{/if}
</div>
