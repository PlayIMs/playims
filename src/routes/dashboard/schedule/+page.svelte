<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import {
		IconCalendar,
		IconCalendarWeek,
		IconChevronLeft,
		IconChevronRight,
		IconLivePhoto,
		IconPlus
	} from '@tabler/icons-svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { inferPickerYearRange } from '$lib/components/date-picker.js';
	import { hasOpenDatePicker } from '$lib/components/date-picker-stack.js';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import ScheduleAgendaView from '$lib/components/dashboard/schedule/ScheduleAgendaView.svelte';
	import ScheduleDayView from '$lib/components/dashboard/schedule/ScheduleDayView.svelte';
	import ScheduleWeekView from '$lib/components/dashboard/schedule/ScheduleWeekView.svelte';
	import ScheduleMonthView from '$lib/components/dashboard/schedule/ScheduleMonthView.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import {
		buildNextScheduleHref,
		buildCenteredScheduleDays,
		buildCenteredScheduleMonths,
		buildCenteredScheduleWeeks,
		buildScheduleOptionCollections,
		countScheduleRangeDays,
		filterScheduleEvents,
		getScheduleEventDateKey,
		getScheduleRangeForView,
		normalizeScheduleDateRange,
		resolveNextScheduleShortcutDate,
		resolveScheduleNavigatorFocusDateKey,
		resolveScheduleKeyboardShortcutMove,
		resolveScheduleQuickShortcutDate,
		sanitizeScheduleFilters,
		shiftScheduleAnchorDate,
		shouldHandleScheduleKeyboardNavigation,
		summarizeScheduleEvents,
		type ScheduleEventRecord,
		type ScheduleFilters,
		type ScheduleKeyboardShortcutMove,
		type ScheduleManageAction,
		type ScheduleOptionCount
	} from '$lib/utils/schedule-page.js';
	import {
		buildScheduleEventWizardCollections,
		sanitizeScheduleEventWizardSelection,
		type ScheduleEventWizardOptions,
		type ScheduleEventWizardSelection
	} from '$lib/utils/schedule-event-wizard.js';
	import { buildScheduleEventWizardBlockingFieldErrors } from '$lib/utils/schedule-event-wizard-steps.js';
	import type { PageData } from './$types';
	import { toast } from '$lib/toasts';
	import CreateEventWizard from './_wizards/CreateEventWizard.svelte';
	import EnterResultsWizard from './_wizards/EnterResultsWizard.svelte';

	const FILTER_DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2';
	const NAVIGATION_SIDE_SECTION_CLASS = 'w-full xl:w-[9rem] xl:shrink-0';
	const NAVIGATION_VIEW_BUTTON_CLASS =
		'h-[3.375rem] w-full border-0 bg-white px-4 py-0 text-sm font-semibold leading-none text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-3';
	const NAVIGATOR_TRANSITION_DURATION_MS = 140;
	const NAVIGATOR_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
	const NAVIGATOR_FULL_VIEWPORT_TRANSITION_RATIO = 0.92;
	const NAVIGATOR_TRANSITION_DISTANCE_MULTIPLIER = {
		day: 1,
		week: 1.35,
		month: 1.75
	} satisfies Record<ScheduleKeyboardShortcutMove['unit'], number>;
	const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	type ScheduleDisplayMode = 'day' | 'week' | 'month' | 'date-range' | 'entire-season';
	type CreateEventForm = ScheduleEventWizardSelection & {
		scheduledStartAt: string;
		scheduledEndAt: string;
		weekNumber: string;
		roundLabel: string;
		notes: string;
		isPostseason: boolean;
	};
	type EventResultsForm = {
		homeScore: string;
		awayScore: string;
	};
	const DEFAULT_VIEW: ScheduleDisplayMode = 'day';
	const VIEW_DROPDOWN_OPTIONS = [
		{ value: 'day', label: 'Day' },
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'date-range', label: 'Date Range' },
		{ value: 'entire-season', label: 'Entire Season' }
	] satisfies Array<{ value: ScheduleDisplayMode; label: string }>;

	let { data } = $props<{ data: PageData }>();
	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).schedule
	);

	let searchQuery = $state('');
	let selectedSeasonId = $state('all');
	let selectedOfferingId = $state('all');
	let selectedLeagueId = $state('all');
	let selectedDivisionId = $state('all');
	let selectedView = $state<ScheduleDisplayMode>(DEFAULT_VIEW);
	let anchorDate = $state(todayDateKey());
	let selectedMonthDate = $state(todayDateKey());
	let selectedRangeStartDate = $state(todayDateKey());
	let selectedRangeEndDate = $state(todayDateKey());
	let navigatorDayStrip = $state<HTMLDivElement | null>(null);
	let navigatorTrack = $state<HTMLDivElement | null>(null);
	let scheduleSearchInput = $state<HTMLInputElement | null>(null);
	let stateHydrated = $state(false);
	let lastPageError = $state('');
	let scheduleEvents = $state<ScheduleEventRecord[]>([]);
	let createEventOpen = $state(false);
	let createEventSubmitting = $state(false);
	let createEventUnsavedConfirmOpen = $state(false);
	let createEventFormError = $state('');
	let createEventFieldErrors = $state<Record<string, string>>({});
	let createEventInitialSignature = $state('');
	let createEventForm = $state<CreateEventForm>({
		seasonId: '',
		offeringId: '',
		leagueId: '',
		divisionId: '',
		homeTeamId: '',
		awayTeamId: '',
		facilityId: '',
		facilityAreaId: '',
		scheduledStartAt: `${todayDateKey()}T18:00`,
		scheduledEndAt: `${todayDateKey()}T19:00`,
		weekNumber: '',
		roundLabel: '',
		notes: '',
		isPostseason: false
	});
	let editEventOpen = $state(false);
	let editEventSubmitting = $state(false);
	let editEventUnsavedConfirmOpen = $state(false);
	let editEventFormError = $state('');
	let editEventFieldErrors = $state<Record<string, string>>({});
	let editEventInitialSignature = $state('');
	let editEvent: ScheduleEventRecord | null = $state(null);
	let editEventForm = $state<CreateEventForm>({
		seasonId: '',
		offeringId: '',
		leagueId: '',
		divisionId: '',
		homeTeamId: '',
		awayTeamId: '',
		facilityId: '',
		facilityAreaId: '',
		scheduledStartAt: `${todayDateKey()}T18:00`,
		scheduledEndAt: `${todayDateKey()}T19:00`,
		weekNumber: '',
		roundLabel: '',
		notes: '',
		isPostseason: false
	});
	let resultsEvent: ScheduleEventRecord | null = $state(null);
	let resultsEventOpen = $state(false);
	let resultsEventSubmitting = $state(false);
	let resultsEventUnsavedConfirmOpen = $state(false);
	let resultsEventFormError = $state('');
	let resultsEventFieldErrors = $state<Record<string, string>>({});
	let resultsEventForm = $state<EventResultsForm>({
		homeScore: '',
		awayScore: ''
	});
	let deleteEventSubmitting = $state(false);
	let deleteEvent: ScheduleEventRecord | null = $state(null);
	let duplicateEventSubmittingId = $state('');
	let restoreEventSubmittingId = $state('');

	const events = $derived(scheduleEvents);
	const scheduleDateYearRange = $derived.by(() =>
		inferPickerYearRange(
			[
				anchorDate,
				...events.map((event: ScheduleEventRecord) =>
					getScheduleEventDateKey(event.scheduledStartAt)
				)
			],
			{ pastYears: 1, futureYears: 2 }
		)
	);

	function todayDateKey(): string {
		const today = new Date();
		return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
			today.getDate()
		).padStart(2, '0')}`;
	}

	function formatCompactDate(dateKey: string): string {
		if (!isDateKey(dateKey)) return '--/--/----';
		const [year, month, day] = dateKey.split('-');
		return `${month}/${day}/${year}`;
	}

	function isDateKey(value: string | null | undefined): value is string {
		return DATE_KEY_REGEX.test(value ?? '');
	}

	function normalizeScheduleView(value: string | null | undefined): ScheduleDisplayMode {
		if (
			value === 'day' ||
			value === 'week' ||
			value === 'month' ||
			value === 'date-range' ||
			value === 'entire-season'
		) {
			return value;
		}

		return DEFAULT_VIEW;
	}

	function parseQueryValue(value: string | null | undefined, fallback = 'all'): string {
		const normalized = value?.trim();
		return normalized && normalized.length > 0 ? normalized : fallback;
	}

	function toDropdownOptions(allLabel: string, options: ScheduleOptionCount[]) {
		return [
			{ value: 'all', label: allLabel },
			...options.map((option) => ({
				value: option.value,
				label: option.label,
				rightLabel: String(option.count)
			}))
		];
	}

	function appendOptionIfMissing(
		options: ScheduleOptionCount[],
		option: { value: string; label: string } | null
	): ScheduleOptionCount[] {
		if (!option?.value || !option.label) return options;
		if (options.some((existing) => existing.value === option.value)) return options;

		return [
			{
				value: option.value,
				label: option.label,
				count: 0
			},
			...options
		];
	}

	function formatLongDate(dateKey: string): string {
		const parsed = new Date(`${dateKey}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) return dateKey;

		return parsed.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatMonthLabel(dateKey: string): string {
		const parsed = new Date(`${dateKey}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) return dateKey;

		return parsed.toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDateRangeDayCount(totalDays: number): string {
		return `${totalDays} day${totalDays === 1 ? '' : 's'} included`;
	}

	function createEmptyEventOptions(): ScheduleEventWizardOptions {
		return {
			seasons: [],
			offerings: [],
			leagues: [],
			divisions: [],
			teams: [],
			facilities: [],
			facilityAreas: []
		};
	}

	function createEventFormSignature(form: CreateEventForm): string {
		return JSON.stringify(form);
	}

	function eventFormSignature(form: CreateEventForm): string {
		return createEventFormSignature(form);
	}

	function formatDateTimeLocalValue(value: string | null | undefined): string {
		if (!value) return '';

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '';

		const year = parsed.getFullYear();
		const month = String(parsed.getMonth() + 1).padStart(2, '0');
		const day = String(parsed.getDate()).padStart(2, '0');
		const hours = String(parsed.getHours()).padStart(2, '0');
		const minutes = String(parsed.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	function buildEventFormFromRecord(event: ScheduleEventRecord): CreateEventForm {
		const selection = sanitizeScheduleEventWizardSelection(createEventOptions, {
			seasonId: event.seasonId ?? '',
			offeringId: event.offeringId ?? '',
			leagueId: event.leagueId ?? '',
			divisionId: event.divisionId ?? '',
			homeTeamId: event.homeTeamId ?? '',
			awayTeamId: event.awayTeamId ?? '',
			facilityId: event.facilityId ?? '',
			facilityAreaId: event.facilityAreaId ?? ''
		});

		return {
			...selection,
			scheduledStartAt:
				formatDateTimeLocalValue(event.scheduledStartAt) ||
				buildDefaultEventDateTime(anchorDate, 18),
			scheduledEndAt:
				formatDateTimeLocalValue(event.scheduledEndAt) || buildDefaultEventDateTime(anchorDate, 19),
			weekNumber: event.weekNumber !== null ? String(event.weekNumber) : '',
			roundLabel: event.roundLabel ?? '',
			notes: event.notes ?? '',
			isPostseason: event.isPostseason
		};
	}

	function parseScoreValue(value: string | null | undefined): string {
		const normalized = value?.trim();
		if (!normalized) return '';
		return normalized;
	}

	function buildResultsFormFromRecord(event: ScheduleEventRecord | null): EventResultsForm {
		if (!event) return { homeScore: '', awayScore: '' };

		const score = parseScoreValue(event.score);
		if (!score) return { homeScore: '', awayScore: '' };

		const match = score.match(/^(\d+)\s*-\s*(\d+)$/);
		if (!match) return { homeScore: '', awayScore: '' };

		return {
			homeScore: match[1] ?? '',
			awayScore: match[2] ?? ''
		};
	}

	function resultsEventFormSignature(form: EventResultsForm): string {
		return JSON.stringify(form);
	}

	function updateScheduleEvent(nextEvent: ScheduleEventRecord): void {
		scheduleEvents = scheduleEvents.map((event) => (event.id === nextEvent.id ? nextEvent : event));
	}

	function removeScheduleEvent(eventId: string): void {
		scheduleEvents = scheduleEvents.filter((event) => event.id !== eventId);
	}

	function insertScheduleEventAfter(sourceEventId: string, nextEvent: ScheduleEventRecord): void {
		const sourceIndex = scheduleEvents.findIndex((event) => event.id === sourceEventId);
		const nextEvents = scheduleEvents.filter((event) => event.id !== nextEvent.id);

		if (sourceIndex < 0) {
			scheduleEvents = [...nextEvents, nextEvent];
			return;
		}

		nextEvents.splice(sourceIndex + 1, 0, nextEvent);
		scheduleEvents = nextEvents;
	}

	function sortScheduleEventsByDisplay(eventsToSort: ScheduleEventRecord[]): ScheduleEventRecord[] {
		return [...eventsToSort].sort((a, b) => {
			const aStart = Date.parse(a.scheduledStartAt ?? '');
			const bStart = Date.parse(b.scheduledStartAt ?? '');
			const aValue = Number.isFinite(aStart) ? aStart : Number.POSITIVE_INFINITY;
			const bValue = Number.isFinite(bStart) ? bStart : Number.POSITIVE_INFINITY;
			if (aValue !== bValue) return aValue - bValue;
			const scoreDiff = b.scoreSortValue - a.scoreSortValue;
			if (scoreDiff !== 0) return scoreDiff;
			return a.matchup.localeCompare(b.matchup);
		});
	}

	function buildDefaultEventDateTime(dateKey: string, hour: number): string {
		return `${dateKey}T${String(hour).padStart(2, '0')}:00`;
	}

	function setSelectedDate(dateKey: string): void {
		anchorDate = dateKey;
		selectedMonthDate = dateKey;
		syncScheduleUrl(true);
	}

	function setSelectedDateRange(startDate: string, endDate: string): void {
		const normalizedRange = normalizeScheduleDateRange(startDate, endDate, anchorDate);
		selectedRangeStartDate = normalizedRange.startDate;
		selectedRangeEndDate = normalizedRange.endDate;
		anchorDate = normalizedRange.startDate;
		selectedMonthDate = normalizedRange.startDate;
		syncScheduleUrl(true);
	}

	function changeView(nextView: ScheduleDisplayMode): void {
		if (nextView === selectedView) return;

		if (nextView === 'date-range') {
			const nextRange =
				selectedView === 'week'
					? selectedWeekRange
					: selectedView === 'month'
						? selectedMonthRange
						: selectedView === 'date-range'
							? selectedDateRange
							: {
									startDate: anchorDate,
									endDate: anchorDate
								};
			selectedRangeStartDate = nextRange.startDate;
			selectedRangeEndDate = nextRange.endDate;
			anchorDate = nextRange.startDate;
			selectedMonthDate = nextRange.startDate;
		} else if (selectedView === 'date-range') {
			anchorDate = selectedDateRange.startDate;
			selectedMonthDate = selectedDateRange.startDate;
		}

		selectedView = nextView;
		if (nextView === 'month') {
			selectedMonthDate = anchorDate;
		}
		syncScheduleUrl(true);
	}

	function syncScheduleUrl(immediate = false): void {
		if (!browser || !stateHydrated) return;

		const nextHref = buildNextScheduleHref(window.location.href, {
			searchQuery,
			selectedSeasonId,
			defaultSeasonId,
			selectedOfferingId,
			selectedLeagueId,
			selectedDivisionId,
			selectedView,
			defaultView: DEFAULT_VIEW,
			anchorDate,
			selectedMonthDate,
			selectedRangeStartDate,
			selectedRangeEndDate,
			today: todayDateKey()
		});

		if (!nextHref) return;

		if (immediate) {
			// use a same-page replace navigation so the visible address bar updates immediately without adding history entries.
			void goto(nextHref, {
				replaceState: true,
				noScroll: true,
				keepFocus: true,
				invalidateAll: false
			});
			return;
		}

		replaceState(nextHref, {});
	}

	function moveAnchor(direction: -1 | 1): void {
		const unit = selectedView === 'week' ? 'week' : selectedView === 'month' ? 'month' : 'day';
		const nextDateKey = shiftScheduleAnchorDate(anchorDate, unit, direction);
		setSelectedDate(nextDateKey);
		void animateNavigatorTransition({ direction, unit });
	}

	function resolveNavigatorTransitionDistance(unit: ScheduleKeyboardShortcutMove['unit']): number {
		if (!navigatorTrack) return 0;

		const trackWidth = navigatorTrack.getBoundingClientRect().width;
		if (trackWidth <= 0) return 0;

		if (selectedView === 'week' || selectedView === 'month') {
			return Math.max(48, trackWidth * NAVIGATOR_FULL_VIEWPORT_TRANSITION_RATIO);
		}

		const childCount = navigatorTrack.childElementCount;
		if (childCount <= 0) return 0;

		const cellWidth = trackWidth / childCount;
		const multiplier = NAVIGATOR_TRANSITION_DISTANCE_MULTIPLIER[unit];
		return Math.max(24, Math.min(cellWidth * multiplier, cellWidth * 2));
	}

	async function animateNavigatorTransition(
		transition: ScheduleKeyboardShortcutMove | null | undefined
	): Promise<void> {
		if (!browser || !transition) return;

		await tick();

		if (!browser || !navigatorTrack || typeof navigatorTrack.animate !== 'function') return;

		const transitionDistance = resolveNavigatorTransitionDistance(transition.unit);
		if (transitionDistance <= 0) return;

		const startOffset = transition.direction > 0 ? transitionDistance : -transitionDistance;

		for (const animation of navigatorTrack.getAnimations()) {
			animation.cancel();
		}

		navigatorTrack.animate(
			[
				{
					transform: `translateX(${startOffset}px)`
				},
				{
					transform: 'translateX(0)'
				}
			],
			{
				duration: NAVIGATOR_TRANSITION_DURATION_MS,
				easing: NAVIGATOR_TRANSITION_EASING
			}
		);
	}

	async function focusNavigatorAnchor(
		dateKey: string,
		options?: { transition?: ScheduleKeyboardShortcutMove | null }
	): Promise<void> {
		await animateNavigatorTransition(options?.transition);

		const target = navigatorDayStrip?.querySelector<HTMLButtonElement>(
			`[data-schedule-navigator-anchor="${dateKey}"]`
		);
		if (!target) return;

		target.focus({ preventScroll: true });
	}

	function handleNavigatorDayKeydown(event: KeyboardEvent, dateKey: string): void {
		const shortcutMove = resolveScheduleKeyboardShortcutMove(event.key, event.shiftKey);
		const nextDateKey = resolveNextScheduleShortcutDate(dateKey, event.key, event.shiftKey);
		if (!nextDateKey) return;

		event.preventDefault();
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey, { transition: shortcutMove });
	}

	function handleNavigatorWeekKeydown(event: KeyboardEvent, dateKey: string): void {
		const shortcutMove = resolveScheduleKeyboardShortcutMove(event.key, true);
		const nextDateKey = resolveNextScheduleShortcutDate(dateKey, event.key, true);
		if (!nextDateKey) return;

		event.preventDefault();
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey, { transition: shortcutMove });
	}

	function handleNavigatorMonthKeydown(event: KeyboardEvent, dateKey: string): void {
		const shortcutMove = resolveScheduleKeyboardShortcutMove(event.key, event.shiftKey);
		const nextDateKey = resolveNextScheduleShortcutDate(dateKey, event.key, event.shiftKey);
		if (!nextDateKey) return;

		event.preventDefault();
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey, { transition: shortcutMove });
	}

	function resetFilters(): void {
		searchQuery = '';
		selectedSeasonId = defaultSeasonId;
		selectedOfferingId = 'all';
		selectedLeagueId = 'all';
		selectedDivisionId = 'all';
	}

	function handleMonthDateSelect(dateKey: string): void {
		setSelectedDate(dateKey);
	}

	function clearCreateEventApiErrors(): void {
		createEventFormError = '';
		createEventFieldErrors = {};
	}

	function clearEditEventApiErrors(): void {
		editEventFormError = '';
		editEventFieldErrors = {};
	}

	function clearResultsEventApiErrors(): void {
		resultsEventFormError = '';
		resultsEventFieldErrors = {};
	}

	function normalizeCreateEventFieldErrors(
		fieldErrors: Record<string, string[] | undefined> | undefined
	): Record<string, string> {
		return Object.fromEntries(
			Object.entries(fieldErrors ?? {})
				.map(([key, messages]) => [key, messages?.[0] ?? ''])
				.filter((entry) => entry[1].trim().length > 0)
		);
	}

	function buildInitialCreateEventForm(): CreateEventForm {
		const options = createEventOptions;
		const preferredSeasonId =
			(selectedSeasonId !== 'all' ? selectedSeasonId : '') ||
			(defaultSeasonId !== 'all' ? defaultSeasonId : '') ||
			options.seasons.find((season) => season.isCurrent)?.id ||
			options.seasons[0]?.id ||
			'';
		const preferredSelection = sanitizeScheduleEventWizardSelection(options, {
			seasonId: preferredSeasonId,
			offeringId: selectedOfferingId !== 'all' ? selectedOfferingId : '',
			leagueId: selectedLeagueId !== 'all' ? selectedLeagueId : '',
			divisionId: selectedDivisionId !== 'all' ? selectedDivisionId : '',
			homeTeamId: '',
			awayTeamId: '',
			facilityId: '',
			facilityAreaId: ''
		});

		return {
			...preferredSelection,
			scheduledStartAt: buildDefaultEventDateTime(anchorDate, 18),
			scheduledEndAt: buildDefaultEventDateTime(anchorDate, 19),
			weekNumber: '',
			roundLabel: '',
			notes: '',
			isPostseason: false
		};
	}

	function closeCreateEventWizard(): void {
		createEventOpen = false;
		createEventSubmitting = false;
		createEventUnsavedConfirmOpen = false;
		clearCreateEventApiErrors();
	}

	function requestCloseCreateEventWizard(): void {
		if (createEventSubmitting) return;
		if (createEventFormSignature(createEventForm) === createEventInitialSignature) {
			closeCreateEventWizard();
			return;
		}
		createEventUnsavedConfirmOpen = true;
	}

	function closeEditEventWizard(): void {
		editEventOpen = false;
		editEventSubmitting = false;
		editEventUnsavedConfirmOpen = false;
		clearEditEventApiErrors();
		editEvent = null;
	}

	function requestCloseEditEventWizard(): void {
		if (editEventSubmitting) return;
		if (eventFormSignature(editEventForm) === editEventInitialSignature) {
			closeEditEventWizard();
			return;
		}
		editEventUnsavedConfirmOpen = true;
	}

	function closeResultsEventWizard(): void {
		resultsEventOpen = false;
		resultsEventSubmitting = false;
		resultsEventUnsavedConfirmOpen = false;
		clearResultsEventApiErrors();
		resultsEvent = null;
	}

	function requestCloseResultsEventWizard(): void {
		if (resultsEventSubmitting) return;
		if (
			resultsEventFormSignature(resultsEventForm) ===
			resultsEventFormSignature(buildResultsFormFromRecord(resultsEvent))
		) {
			closeResultsEventWizard();
			return;
		}
		resultsEventUnsavedConfirmOpen = true;
	}

	function applyCreateEventSelectionPatch(patch: Partial<ScheduleEventWizardSelection>): void {
		clearCreateEventApiErrors();
		const nextSelection = sanitizeScheduleEventWizardSelection(createEventOptions, {
			seasonId: createEventForm.seasonId,
			offeringId: createEventForm.offeringId,
			leagueId: createEventForm.leagueId,
			divisionId: createEventForm.divisionId,
			homeTeamId: createEventForm.homeTeamId,
			awayTeamId: createEventForm.awayTeamId,
			facilityId: createEventForm.facilityId,
			facilityAreaId: createEventForm.facilityAreaId,
			...patch
		});
		createEventForm = {
			...createEventForm,
			...nextSelection
		};
	}

	function applyEditEventSelectionPatch(patch: Partial<ScheduleEventWizardSelection>): void {
		clearEditEventApiErrors();
		const nextSelection = sanitizeScheduleEventWizardSelection(createEventOptions, {
			seasonId: editEventForm.seasonId,
			offeringId: editEventForm.offeringId,
			leagueId: editEventForm.leagueId,
			divisionId: editEventForm.divisionId,
			homeTeamId: editEventForm.homeTeamId,
			awayTeamId: editEventForm.awayTeamId,
			facilityId: editEventForm.facilityId,
			facilityAreaId: editEventForm.facilityAreaId,
			...patch
		});
		editEventForm = {
			...editEventForm,
			...nextSelection
		};
	}

	function openEditEventWizard(event: ScheduleEventRecord): void {
		editEvent = event;
		editEventForm = buildEventFormFromRecord(event);
		editEventInitialSignature = eventFormSignature(editEventForm);
		clearEditEventApiErrors();
		editEventUnsavedConfirmOpen = false;
		editEventOpen = true;
	}

	function openResultsEventWizard(event: ScheduleEventRecord): void {
		resultsEvent = event;
		resultsEventForm = buildResultsFormFromRecord(event);
		clearResultsEventApiErrors();
		resultsEventUnsavedConfirmOpen = false;
		resultsEventOpen = true;
	}

	function openDeleteEventConfirmation(event: ScheduleEventRecord): void {
		deleteEvent = event;
	}

	function handleScheduleManageAction(
		action: ScheduleManageAction,
		event: ScheduleEventRecord
	): void {
		if (!canManageEvents) return;

		if (action === 'edit') {
			openEditEventWizard(event);
			return;
		}

		if (action === 'enter-results') {
			openResultsEventWizard(event);
			return;
		}

		if (action === 'duplicate') {
			void submitDuplicateEvent(event);
			return;
		}

		if (action === 'delete') {
			openDeleteEventConfirmation(event);
		}
	}

	function handleAddEvent(): void {
		if (!canManageEvents) {
			toast.error('Only managers, administrators, and developers can add events.', {
				id: 'schedule-add-event-forbidden',
				title: pageLabel
			});
			return;
		}

		const initialForm = buildInitialCreateEventForm();
		createEventForm = initialForm;
		createEventInitialSignature = createEventFormSignature(initialForm);
		clearCreateEventApiErrors();
		createEventUnsavedConfirmOpen = false;
		createEventOpen = true;
	}

	async function submitCreateEvent(): Promise<void> {
		if (createEventSubmitting) return;

		createEventSubmitting = true;
		clearCreateEventApiErrors();

		const payload = {
			event: {
				seasonId: createEventForm.seasonId,
				offeringId: createEventForm.offeringId,
				leagueId: createEventForm.leagueId,
				divisionId: createEventForm.divisionId,
				homeTeamId: createEventForm.homeTeamId,
				awayTeamId: createEventForm.awayTeamId,
				scheduledStartAt: createEventForm.scheduledStartAt,
				scheduledEndAt: createEventForm.scheduledEndAt,
				facilityId: createEventForm.facilityId || null,
				facilityAreaId: createEventForm.facilityAreaId || null,
				weekNumber:
					createEventForm.weekNumber.trim().length > 0
						? Number.parseInt(createEventForm.weekNumber, 10)
						: null,
				roundLabel: createEventForm.roundLabel.trim() || null,
				notes: createEventForm.notes.trim() || null,
				isPostseason: createEventForm.isPostseason
			}
		};

		try {
			const response = await fetch('/api/intramural-sports/events', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = (await response.json().catch(() => null)) as {
				success?: boolean;
				error?: string;
				fieldErrors?: Record<string, string[] | undefined>;
				data?: { event?: ScheduleEventRecord };
			} | null;

			if (!response.ok || !result?.success || !result.data?.event) {
				createEventFormError = result?.error?.trim() || 'Unable to save event right now.';
				createEventFieldErrors = normalizeCreateEventFieldErrors(result?.fieldErrors);
				return;
			}

			const createdEvent = result.data.event;
			scheduleEvents = [
				...scheduleEvents.filter((event) => event.id !== createdEvent.id),
				createdEvent
			];
			const isVisibleInCurrentFilters =
				filterScheduleEvents([createdEvent], normalizedFilters).filter(
					(event) => getScheduleEventDateKey(event.scheduledStartAt) !== null
				).length > 0;

			closeCreateEventWizard();
			toast.success(
				isVisibleInCurrentFilters
					? 'Event added to the schedule.'
					: 'Event created. It may be hidden by your current filters.',
				{
					id: `schedule-create-event:${createdEvent.id}`,
					title: pageLabel
				}
			);
		} catch (error) {
			console.error('Failed to create schedule event:', error);
			createEventFormError = 'Unable to save event right now.';
		} finally {
			createEventSubmitting = false;
		}
	}

	async function submitEditEvent(): Promise<void> {
		if (editEventSubmitting) return;
		if (!editEvent?.id) return;

		editEventSubmitting = true;
		clearEditEventApiErrors();

		const payload = {
			action: 'edit',
			event: {
				id: editEvent.id,
				seasonId: editEventForm.seasonId,
				offeringId: editEventForm.offeringId,
				leagueId: editEventForm.leagueId,
				divisionId: editEventForm.divisionId,
				homeTeamId: editEventForm.homeTeamId,
				awayTeamId: editEventForm.awayTeamId,
				scheduledStartAt: editEventForm.scheduledStartAt,
				scheduledEndAt: editEventForm.scheduledEndAt,
				facilityId: editEventForm.facilityId || null,
				facilityAreaId: editEventForm.facilityAreaId || null,
				weekNumber:
					editEventForm.weekNumber.trim().length > 0
						? Number.parseInt(editEventForm.weekNumber, 10)
						: null,
				roundLabel: editEventForm.roundLabel.trim() || null,
				notes: editEventForm.notes.trim() || null,
				isPostseason: editEventForm.isPostseason
			}
		};

		try {
			const response = await fetch('/api/intramural-sports/events', {
				method: 'PATCH',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = (await response.json().catch(() => null)) as {
				success?: boolean;
				error?: string;
				fieldErrors?: Record<string, string[] | undefined>;
				data?: { event?: ScheduleEventRecord };
			} | null;

			if (!response.ok || !result?.success || !result.data?.event) {
				editEventFormError = result?.error?.trim() || 'Unable to save event right now.';
				editEventFieldErrors = normalizeCreateEventFieldErrors(result?.fieldErrors);
				return;
			}

			const updatedEvent = result.data.event;
			updateScheduleEvent(updatedEvent);
			closeEditEventWizard();
			toast.success('Event updated.', {
				id: `schedule-edit-event:${updatedEvent.id}`,
				title: pageLabel
			});
		} catch (error) {
			console.error('Failed to update schedule event:', error);
			editEventFormError = 'Unable to save event right now.';
		} finally {
			editEventSubmitting = false;
		}
	}

	async function submitResultsEvent(): Promise<void> {
		if (resultsEventSubmitting) return;
		if (!resultsEvent?.id) return;

		resultsEventSubmitting = true;
		clearResultsEventApiErrors();

		const payload = {
			action: 'enter-results',
			event: {
				id: resultsEvent.id,
				homeScore: Number.parseInt(resultsEventForm.homeScore, 10),
				awayScore: Number.parseInt(resultsEventForm.awayScore, 10)
			}
		};

		try {
			const response = await fetch('/api/intramural-sports/events', {
				method: 'PATCH',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = (await response.json().catch(() => null)) as {
				success?: boolean;
				error?: string;
				fieldErrors?: Record<string, string[] | undefined>;
				data?: { event?: ScheduleEventRecord };
			} | null;

			if (!response.ok || !result?.success || !result.data?.event) {
				resultsEventFormError = result?.error?.trim() || 'Unable to save results right now.';
				resultsEventFieldErrors = normalizeCreateEventFieldErrors(result?.fieldErrors);
				return;
			}

			const updatedEvent = result.data.event;
			updateScheduleEvent(updatedEvent);
			closeResultsEventWizard();
			toast.success('Game results saved.', {
				id: `schedule-event-results:${updatedEvent.id}`,
				title: pageLabel
			});
		} catch (error) {
			console.error('Failed to save schedule event results:', error);
			resultsEventFormError = 'Unable to save results right now.';
		} finally {
			resultsEventSubmitting = false;
		}
	}

	async function submitDeleteEvent(): Promise<void> {
		if (deleteEventSubmitting) return;
		if (!deleteEvent?.id) return;

		deleteEventSubmitting = true;
		const deletedEvent = deleteEvent;
		const deletedEventId = deletedEvent.id;

		const payload = {
			action: 'delete',
			eventId: deletedEventId
		};

		try {
			const response = await fetch('/api/intramural-sports/events', {
				method: 'DELETE',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = (await response.json().catch(() => null)) as {
				success?: boolean;
				error?: string;
				data?: { eventId?: string };
			} | null;

			if (!response.ok || !result?.success) {
				toast.error(result?.error?.trim() || 'Unable to delete event right now.', {
					id: `schedule-delete-event-error:${deletedEventId}`,
					title: pageLabel
				});
				return;
			}

			removeScheduleEvent(deletedEventId);
			deleteEvent = null;
			toast.success('Game deleted.', {
				id: `schedule-delete-event:${deletedEventId}`,
				title: pageLabel,
				duration: 8000,
				important: true,
				actions: [
					{
						label: 'Undo',
						style: 'outline',
						onClick: () => submitRestoreDeletedEvent(deletedEvent)
					}
				]
			});
		} catch (error) {
			console.error('Failed to delete schedule event:', error);
			toast.error('Unable to delete event right now.', {
				id: `schedule-delete-event-error:${deletedEventId}`,
				title: pageLabel
			});
		} finally {
			deleteEventSubmitting = false;
		}
	}

	async function submitRestoreDeletedEvent(event: ScheduleEventRecord): Promise<void> {
		if (restoreEventSubmittingId === event.id) return;

		restoreEventSubmittingId = event.id;

		const payload = {
			action: 'restore-delete',
			eventId: event.id
		};

		try {
			const response = await fetch('/api/intramural-sports/events', {
				method: 'PATCH',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = (await response.json().catch(() => null)) as {
				success?: boolean;
				error?: string;
				data?: { event?: ScheduleEventRecord };
			} | null;

			if (!response.ok || !result?.success || !result.data?.event) {
				toast.error(result?.error?.trim() || 'Unable to restore event right now.', {
					id: `schedule-restore-event-error:${event.id}`,
					title: pageLabel
				});
				return;
			}

			const restoredEvent = result.data.event;
			scheduleEvents = sortScheduleEventsByDisplay([
				...scheduleEvents.filter((existing) => existing.id !== restoredEvent.id),
				restoredEvent
			]);
			toast.success('Game restored.', {
				id: `schedule-restore-event:${restoredEvent.id}`,
				title: pageLabel
			});
		} catch (error) {
			console.error('Failed to restore schedule event:', error);
			toast.error('Unable to restore event right now.', {
				id: `schedule-restore-event-error:${event.id}`,
				title: pageLabel
			});
		} finally {
			restoreEventSubmittingId = '';
		}
	}

	async function submitDuplicateEvent(sourceEvent: ScheduleEventRecord): Promise<void> {
		if (duplicateEventSubmittingId === sourceEvent.id) return;

		duplicateEventSubmittingId = sourceEvent.id;

		const payload = {
			action: 'duplicate',
			eventId: sourceEvent.id
		};

		try {
			const response = await fetch('/api/intramural-sports/events', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			const result = (await response.json().catch(() => null)) as {
				success?: boolean;
				error?: string;
				fieldErrors?: Record<string, string[] | undefined>;
				data?: { event?: ScheduleEventRecord };
			} | null;

			if (!response.ok || !result?.success || !result.data?.event) {
				toast.error(result?.error?.trim() || 'Unable to duplicate event right now.', {
					id: `schedule-duplicate-event-error:${sourceEvent.id}`,
					title: pageLabel
				});
				return;
			}

			const createdEvent = result.data.event;
			insertScheduleEventAfter(sourceEvent.id, createdEvent);
			const isVisibleInCurrentFilters =
				filterScheduleEvents([createdEvent], normalizedFilters).filter(
					(event) => getScheduleEventDateKey(event.scheduledStartAt) !== null
				).length > 0;

			toast.success(
				isVisibleInCurrentFilters
					? 'Event duplicated.'
					: 'Event duplicated. It may be hidden by your current filters.',
				{
					id: `schedule-duplicate-event:${createdEvent.id}`,
					title: pageLabel
				}
			);
		} catch (error) {
			console.error('Failed to duplicate schedule event:', error);
			toast.error('Unable to duplicate event right now.', {
				id: `schedule-duplicate-event-error:${sourceEvent.id}`,
				title: pageLabel
			});
		} finally {
			duplicateEventSubmittingId = '';
		}
	}

	function hasOpenScheduleDropdown(): boolean {
		if (typeof document === 'undefined') return false;
		return Boolean(
			document.querySelector('[data-listbox-dropdown-trigger="true"][aria-expanded="true"]')
		);
	}

	function isEditableKeyboardTarget(target: EventTarget | null): boolean {
		const element =
			target instanceof HTMLElement
				? target
				: document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
		if (!element) return false;
		if (element.isContentEditable || element.closest('[contenteditable="true"]')) return true;
		if (element.closest('input, textarea, select')) return true;
		return false;
	}

	function handleGlobalScheduleNavigatorKeydown(event: KeyboardEvent): void {
		if (!browser || event.defaultPrevented) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (isEditableKeyboardTarget(event.target)) return;

		const quickDateKey = resolveScheduleQuickShortcutDate(event.key);
		if (quickDateKey) {
			event.preventDefault();
			setSelectedDate(quickDateKey);
			void focusNavigatorAnchor(quickDateKey);
			return;
		}

		if (
			!shouldHandleScheduleKeyboardNavigation({
				key: event.key,
				shiftKey: event.shiftKey,
				hasOpenDatePicker: hasOpenDatePicker(),
				hasOpenDropdown: hasOpenScheduleDropdown(),
				isEditableTarget: false
			})
		) {
			return;
		}

		const shortcutMove = resolveScheduleKeyboardShortcutMove(event.key, event.shiftKey);
		const nextDateKey = resolveNextScheduleShortcutDate(anchorDate, event.key, event.shiftKey);
		if (!nextDateKey) return;

		event.preventDefault();
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey, { transition: shortcutMove });
	}

	async function focusActiveScheduleNavigator(): Promise<void> {
		if (!browser) return;
		const focusDateKey = resolveScheduleNavigatorFocusDateKey(selectedView, anchorDate);
		if (!focusDateKey) return;
		await focusNavigatorAnchor(focusDateKey);
	}

	onMount(() => {
		window.addEventListener('keydown', handleGlobalScheduleNavigatorKeydown);
		void focusActiveScheduleNavigator();

		return () => {
			window.removeEventListener('keydown', handleGlobalScheduleNavigatorKeydown);
		};
	});

	afterNavigate(() => {
		void focusActiveScheduleNavigator();
	});

	$effect(() => {
		if (stateHydrated) return;

		const params = $page.url.searchParams;
		const hydratedAnchorDate = isDateKey(params.get('date'))
			? (params.get('date') as string)
			: todayDateKey();
		const hydratedRange = normalizeScheduleDateRange(
			params.get('startDate') ?? hydratedAnchorDate,
			params.get('endDate') ?? hydratedAnchorDate,
			hydratedAnchorDate
		);
		searchQuery = params.get('q')?.trim() ?? '';
		selectedSeasonId = parseQueryValue(params.get('season'), defaultSeasonId);
		selectedOfferingId = parseQueryValue(params.get('offering'));
		selectedLeagueId = parseQueryValue(params.get('league'));
		selectedDivisionId = parseQueryValue(params.get('division'));
		selectedView = normalizeScheduleView(params.get('view'));
		anchorDate = hydratedAnchorDate;
		selectedMonthDate = isDateKey(params.get('selectedDay'))
			? (params.get('selectedDay') as string)
			: anchorDate;
		selectedRangeStartDate = hydratedRange.startDate;
		selectedRangeEndDate = hydratedRange.endDate;
		stateHydrated = true;
	});

	const rawFilters = $derived.by<ScheduleFilters>(() => ({
		seasonId: selectedSeasonId,
		offeringId: selectedOfferingId,
		leagueId: selectedLeagueId,
		divisionId: selectedDivisionId,
		teamId: 'all',
		status: 'all',
		searchQuery
	}));
	const defaultSeasonId = $derived.by(() => {
		return data.currentSeasonId?.trim() || 'all';
	});
	const canManageEvents = $derived.by(() => data.permissions?.MANAGE_OFFERINGS === true);
	const createEventOptions = $derived.by<ScheduleEventWizardOptions>(
		() => (data.createEventOptions ?? createEmptyEventOptions()) as ScheduleEventWizardOptions
	);
	const createEventCollections = $derived.by(() =>
		buildScheduleEventWizardCollections(createEventOptions, {
			seasonId: createEventForm.seasonId,
			offeringId: createEventForm.offeringId,
			leagueId: createEventForm.leagueId,
			divisionId: createEventForm.divisionId,
			homeTeamId: createEventForm.homeTeamId,
			awayTeamId: createEventForm.awayTeamId,
			facilityId: createEventForm.facilityId,
			facilityAreaId: createEventForm.facilityAreaId
		})
	);
	const createEventCanSubmit = $derived.by(
		() =>
			Object.keys(buildScheduleEventWizardBlockingFieldErrors(createEventOptions, createEventForm))
				.length === 0
	);
	const editEventCollections = $derived.by(() =>
		buildScheduleEventWizardCollections(createEventOptions, {
			seasonId: editEventForm.seasonId,
			offeringId: editEventForm.offeringId,
			leagueId: editEventForm.leagueId,
			divisionId: editEventForm.divisionId,
			homeTeamId: editEventForm.homeTeamId,
			awayTeamId: editEventForm.awayTeamId,
			facilityId: editEventForm.facilityId,
			facilityAreaId: editEventForm.facilityAreaId
		})
	);
	const editEventCanSubmit = $derived.by(
		() =>
			editEventForm.seasonId.trim().length > 0 &&
			editEventForm.offeringId.trim().length > 0 &&
			editEventForm.leagueId.trim().length > 0 &&
			editEventForm.divisionId.trim().length > 0 &&
			editEventForm.homeTeamId.trim().length > 0 &&
			editEventForm.awayTeamId.trim().length > 0 &&
			editEventForm.scheduledStartAt.trim().length > 0 &&
			editEventForm.scheduledEndAt.trim().length > 0
	);
	const resultsEventCanSubmit = $derived.by(
		() =>
			resultsEventForm.homeScore.trim().length > 0 && resultsEventForm.awayScore.trim().length > 0
	);
	const navigatorDays = $derived.by(() => buildCenteredScheduleDays(anchorDate, 3));
	const navigatorMonths = $derived.by(() => buildCenteredScheduleMonths(anchorDate));
	const navigatorWeeks = $derived.by(() => buildCenteredScheduleWeeks(anchorDate, 2, 2));
	const navigatorVisibleCellCount = $derived.by(() => (selectedView === 'week' ? 5 : 7));
	const navigatorSelectionOverlayStyle = $derived.by(
		() => `width: calc(100% / ${navigatorVisibleCellCount});`
	);
	const selectedMonthRange = $derived.by(() => getScheduleRangeForView(anchorDate, 'month'));
	const selectedWeekRange = $derived.by(() => getScheduleRangeForView(anchorDate, 'week'));
	const selectedDateRange = $derived.by(() =>
		normalizeScheduleDateRange(selectedRangeStartDate, selectedRangeEndDate, anchorDate)
	);
	const selectedDateRangeDayCount = $derived.by(() => countScheduleRangeDays(selectedDateRange));

	const normalizedFilters = $derived.by(() => {
		const sanitized = sanitizeScheduleFilters(events, rawFilters);
		const canPreserveDefaultSeason =
			selectedSeasonId === defaultSeasonId &&
			defaultSeasonId !== 'all' &&
			(data.currentSeasonName?.trim()?.length ?? 0) > 0;

		return {
			...sanitized,
			seasonId: canPreserveDefaultSeason ? selectedSeasonId : sanitized.seasonId
		};
	});
	const filterOptions = $derived.by(() =>
		buildScheduleOptionCollections(events, normalizedFilters)
	);
	const filteredEvents = $derived.by(() =>
		filterScheduleEvents(events, normalizedFilters).filter(
			(event) => getScheduleEventDateKey(event.scheduledStartAt) !== null
		)
	);
	const filteredSummary = $derived.by(() => summarizeScheduleEvents(filteredEvents));
	const seasonFilterOptions = $derived.by(() => {
		const currentSeasonOption =
			defaultSeasonId !== 'all' && data.currentSeasonName?.trim()
				? {
						value: defaultSeasonId,
						label: data.currentSeasonName.trim()
					}
				: null;

		return toDropdownOptions(
			'All seasons',
			appendOptionIfMissing(filterOptions.seasonOptions, currentSeasonOption)
		);
	});
	const offeringFilterOptions = $derived.by(() =>
		toDropdownOptions('All offerings', filterOptions.offeringOptions)
	);
	const leagueFilterOptions = $derived.by(() =>
		toDropdownOptions('All leagues', filterOptions.leagueOptions)
	);
	const divisionFilterOptions = $derived.by(() =>
		toDropdownOptions('All divisions', filterOptions.divisionOptions)
	);
	const hasActiveFilters = $derived.by(
		() =>
			searchQuery.trim().length > 0 ||
			selectedSeasonId !== defaultSeasonId ||
			selectedOfferingId !== 'all' ||
			selectedLeagueId !== 'all' ||
			selectedDivisionId !== 'all'
	);

	$effect(() => {
		if (!stateHydrated) return;

		if (selectedSeasonId !== normalizedFilters.seasonId)
			selectedSeasonId = normalizedFilters.seasonId;
		if (selectedOfferingId !== normalizedFilters.offeringId)
			selectedOfferingId = normalizedFilters.offeringId;
		if (selectedLeagueId !== normalizedFilters.leagueId)
			selectedLeagueId = normalizedFilters.leagueId;
		if (selectedDivisionId !== normalizedFilters.divisionId)
			selectedDivisionId = normalizedFilters.divisionId;
	});

	$effect(() => {
		if (!browser || !stateHydrated) return;
		syncScheduleUrl();
	});

	$effect(() => {
		scheduleEvents = data.events ?? [];
	});

	$effect(() => {
		const message = (data?.error ?? '').trim();
		if (!message) {
			lastPageError = '';
			return;
		}

		if (message === lastPageError) return;

		lastPageError = message;
		toast.error(message, {
			id: 'schedule-page-error',
			title: pageLabel,
			duration: null,
			showProgress: false
		});
	});
</script>

<PageTitle pageTitle={pageLabel} />

<svelte:head>
	<meta
		name="description"
		content="Browse intramural events with hierarchical filters and day, week, month, custom date-range, or entire-season schedule views."
	/>
</svelte:head>

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
						aria-hidden="true"
					>
						<IconCalendarWeek class="w-7 h-7 lg:w-8 lg:h-8" />
					</div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						{pageLabel}
					</h1>
				</div>
				<DashboardSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-6">
		<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
			<div class="min-w-0 space-y-4">
				<section class="section-shell">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4 space-y-4">
						<div class="flex flex-col gap-4">
							<div class="space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									{#if filteredSummary.live > 0}
										<span class="badge-primary px-2 py-1 text-[11px] uppercase tracking-wide">
											{filteredSummary.live} live
											<IconLivePhoto class="ml-1 h-3.5 w-3.5 animate-pulse" />
										</span>
									{/if}
									{#if filteredSummary.needsAttention > 0}
										<span class="badge-warning px-2 py-1 text-[11px] uppercase tracking-wide">
											{filteredSummary.needsAttention} attention
										</span>
									{/if}
								</div>
							</div>
						</div>

						<div class="overflow-hidden border border-neutral-950 bg-white">
							<div class="flex flex-col xl:flex-row xl:items-stretch">
								<div
									class={selectedView === 'date-range'
										? 'w-full xl:w-[22rem] xl:shrink-0'
										: NAVIGATION_SIDE_SECTION_CLASS}
								>
									{#if selectedView === 'date-range'}
										<div class="border-b border-neutral-950 bg-white xl:border-b-0 xl:border-r">
											<DateRangePicker
												startValue={selectedDateRange.startDate}
												endValue={selectedDateRange.endDate}
												minYear={scheduleDateYearRange.minYear}
												maxYear={scheduleDateYearRange.maxYear}
												ariaLabel="Choose schedule date range"
												startLabel="Start"
												endLabel="End"
												panelAlign="left"
												on:change={(event) => {
													setSelectedDateRange(event.detail.startDate, event.detail.endDate);
												}}
											/>
										</div>
									{:else}
										<DatePicker
											type="date"
											value={anchorDate}
											minYear={scheduleDateYearRange.minYear}
											maxYear={scheduleDateYearRange.maxYear}
											ariaLabel="Choose schedule date"
											panelAlign="left"
											triggerClass="flex h-[3.375rem] w-full cursor-pointer items-center justify-start gap-3 border-b border-neutral-950 bg-white px-4 py-0 text-sm font-semibold leading-none text-neutral-950 xl:border-b-0 xl:border-r"
											on:change={(event) => {
												if (isDateKey(event.detail.value)) {
													setSelectedDate(event.detail.value);
												}
											}}
										>
											{#snippet trigger()}
												<IconCalendar class="h-5 w-5 shrink-0 text-neutral-950" />
												<span class="tabular-nums">{formatCompactDate(anchorDate)}</span>
											{/snippet}
										</DatePicker>
									{/if}
								</div>

								<div
									class="flex min-w-0 flex-1 items-stretch border-b border-neutral-950 xl:border-b-0"
									bind:this={navigatorDayStrip}
								>
									{#if selectedView === 'date-range'}
										<div class="flex min-w-0 flex-1 items-stretch bg-white">
											<div
												class="flex min-w-0 flex-1 items-center justify-center px-4 py-2 text-center"
											>
												<div class="min-w-0">
													<p
														class="text-lg font-semibold leading-none text-neutral-950 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]"
													>
														{formatDateRangeDayCount(selectedDateRangeDayCount)}
													</p>
												</div>
											</div>
										</div>
									{:else}
										<HoverTooltip
											case="preserve"
											rows={[
												{
													text: 'Previous Day',
													shortcutKeys: ['ArrowLeft']
												},
												{
													text: 'Previous Week',
													shortcutKeys: ['Shift', 'ArrowLeft']
												},
												{
													text: 'Previous Month',
													shortcutKeys: ['Shift', 'ArrowUp']
												}
											]}
										>
											<button
												type="button"
												class="inline-flex h-[3.375rem] w-10 shrink-0 items-center justify-center border-r border-neutral-950 bg-white text-neutral-900 transition-colors hover:bg-neutral-50 hover:text-neutral-950 cursor-pointer"
												aria-label={selectedView === 'week'
													? 'View previous week'
													: selectedView === 'month'
														? 'View previous month'
														: 'View previous day'}
												onclick={() => {
													moveAnchor(-1);
												}}
											>
												<IconChevronLeft class="h-5 w-5" />
											</button>
										</HoverTooltip>

										{#if selectedView === 'week'}
											<div class="relative min-w-0 flex-1 overflow-hidden bg-white">
												<div
													class="pointer-events-none absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 bg-primary-50"
													style={navigatorSelectionOverlayStyle}
												></div>
												<div
													class="relative z-10 grid h-[3.375rem] min-w-0 flex-1 grid-cols-5"
													bind:this={navigatorTrack}
												>
													{#each navigatorWeeks as week, index (week.anchorDate)}
														<button
															type="button"
															data-schedule-navigator-anchor={week.anchorDate}
															class={`schedule-navigator-cell group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center transition-colors cursor-pointer border-none outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
																index === navigatorWeeks.length - 1
																	? ''
																	: 'border-r border-neutral-300'
															} ${
																week.startDate === selectedWeekRange.startDate
																	? 'bg-transparent text-neutral-950'
																	: 'bg-transparent text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
															}`}
															aria-current={week.startDate === selectedWeekRange.startDate
																? 'date'
																: undefined}
															aria-label={`View schedule week of ${formatLongDate(week.startDate)} through ${formatLongDate(week.endDate)}`}
															onclick={() => {
																setSelectedDate(week.anchorDate);
															}}
															onkeydown={(event) => {
																handleNavigatorWeekKeydown(event, week.anchorDate);
															}}
														>
															<span
																class={`text-lg font-semibold tabular-nums leading-none whitespace-nowrap ${
																	week.startDate === selectedWeekRange.startDate
																		? 'text-primary-700'
																		: week.isCurrentWeek
																			? 'text-primary-600'
																			: 'text-neutral-950'
																}`}
															>
																{week.rangeLabel}
															</span>
															<span class="text-[11px] font-semibold uppercase tracking-wide">
																{week.monthLabel}
															</span>
															<span
																class={`mt-0.5 h-0.5 w-10 ${
																	week.startDate === selectedWeekRange.startDate
																		? 'bg-primary-700'
																		: 'bg-transparent group-hover:bg-neutral-300'
																}`}
															></span>
														</button>
													{/each}
												</div>
											</div>
										{:else if selectedView === 'month'}
											<div class="relative min-w-0 flex-1 overflow-hidden bg-white">
												<div
													class="pointer-events-none absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 bg-primary-50"
													style={navigatorSelectionOverlayStyle}
												></div>
												<div
													class="relative z-10 grid h-[3.375rem] min-w-0 flex-1 grid-cols-7"
													bind:this={navigatorTrack}
												>
													{#each navigatorMonths as month, index (month.anchorDate)}
														<button
															type="button"
															data-schedule-navigator-anchor={month.anchorDate}
															class={`schedule-navigator-cell group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center transition-colors cursor-pointer border-none outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
																index === navigatorMonths.length - 1
																	? ''
																	: 'border-r border-neutral-300'
															} ${
																month.startDate === selectedMonthRange.startDate
																	? 'bg-transparent text-neutral-950'
																	: 'bg-transparent text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
															}`}
															aria-current={month.startDate === selectedMonthRange.startDate
																? 'date'
																: undefined}
															aria-label={`View schedule month of ${month.monthLabel} ${month.rangeLabel}`}
															onclick={() => {
																setSelectedDate(month.anchorDate);
															}}
															onkeydown={(event) => {
																handleNavigatorMonthKeydown(event, month.anchorDate);
															}}
														>
															<span
																class={`text-lg font-semibold tabular-nums leading-none whitespace-nowrap ${
																	month.startDate === selectedMonthRange.startDate
																		? 'text-primary-700'
																		: month.isCurrentMonth
																			? 'text-primary-600'
																			: 'text-neutral-950'
																}`}
															>
																{month.rangeLabel}
															</span>
															<span class="text-[11px] font-semibold uppercase tracking-wide">
																{month.monthLabel}
															</span>
															<span
																class={`mt-0.5 h-0.5 w-10 ${
																	month.startDate === selectedMonthRange.startDate
																		? 'bg-primary-700'
																		: 'bg-transparent group-hover:bg-neutral-300'
																}`}
															></span>
														</button>
													{/each}
												</div>
											</div>
										{:else}
											<div class="relative min-w-0 flex-1 overflow-hidden bg-white">
												<div
													class="pointer-events-none absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 bg-primary-50"
													style={navigatorSelectionOverlayStyle}
												></div>
												<div
													class="relative z-10 grid h-[3.375rem] min-w-0 flex-1 grid-cols-7"
													bind:this={navigatorTrack}
												>
													{#each navigatorDays as day, index (day.dateKey)}
														<button
															type="button"
															data-schedule-navigator-anchor={day.dateKey}
															class={`schedule-navigator-cell group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center transition-colors cursor-pointer border-none outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
																index === navigatorDays.length - 1
																	? ''
																	: 'border-r border-neutral-300'
															} ${
																day.dateKey === anchorDate
																	? 'bg-transparent text-neutral-950'
																	: 'bg-transparent text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
															}`}
															aria-current={day.dateKey === anchorDate ? 'date' : undefined}
															aria-label={`View schedule for ${formatLongDate(day.dateKey)}`}
															onclick={() => {
																setSelectedDate(day.dateKey);
															}}
															onkeydown={(event) => {
																handleNavigatorDayKeydown(event, day.dateKey);
															}}
														>
															<span
																class={`text-lg font-semibold tabular-nums leading-none ${
																	day.dateKey === anchorDate
																		? 'text-primary-700'
																		: day.isToday
																			? 'text-primary-600'
																			: 'text-neutral-950'
																}`}
															>
																{day.dayNumber}
															</span>
															<span class="text-[11px] font-semibold uppercase tracking-wide">
																{day.monthLabel}
															</span>
															<span
																class={`mt-0.5 h-0.5 w-8 ${
																	day.dateKey === anchorDate
																		? 'bg-primary-700'
																		: 'bg-transparent group-hover:bg-neutral-300'
																}`}
															></span>
														</button>
													{/each}
												</div>
											</div>
										{/if}

										<HoverTooltip
											case="preserve"
											rows={[
												{
													text: 'Next Day',
													shortcutKeys: ['ArrowRight']
												},
												{
													text: 'Next Week',
													shortcutKeys: ['Shift', 'ArrowRight']
												},
												{
													text: 'Next Month',
													shortcutKeys: ['Shift', 'ArrowDown']
												}
											]}
										>
											<button
												type="button"
												class="inline-flex h-[3.375rem] w-10 shrink-0 items-center justify-center border-l border-neutral-950 bg-white text-neutral-900 transition-colors hover:bg-neutral-50 hover:text-neutral-950 cursor-pointer"
												aria-label={selectedView === 'week'
													? 'View next week'
													: selectedView === 'month'
														? 'View next month'
														: 'View next day'}
												onclick={() => {
													moveAnchor(1);
												}}
											>
												<IconChevronRight class="h-5 w-5" />
											</button>
										</HoverTooltip>
									{/if}
								</div>

								<div
									class={`${NAVIGATION_SIDE_SECTION_CLASS} border-t border-neutral-950 xl:border-l xl:border-t-0`}
								>
									<ListboxDropdown
										options={VIEW_DROPDOWN_OPTIONS}
										value={selectedView}
										ariaLabel="Choose schedule view"
										align="right"
										buttonClass={NAVIGATION_VIEW_BUTTON_CLASS}
										panelWidthMode="trigger"
										on:change={(event) => {
											changeView(event.detail.value as ScheduleDisplayMode);
										}}
									/>
								</div>
							</div>
						</div>
					</div>

					<div class="p-4">
						{#if filteredEvents.length === 0}
							<div class="border border-neutral-950 bg-white p-8 text-center space-y-3">
								<div
									class="mx-auto inline-flex h-14 w-14 items-center justify-center border border-neutral-950 bg-neutral-50"
									aria-hidden="true"
								>
									<IconCalendar class="h-8 w-8 text-secondary-900" />
								</div>
								<div class="space-y-1">
									<h3 class="text-2xl font-bold font-serif text-neutral-950">No matching events</h3>
									<p class="text-sm font-sans text-neutral-950">
										Try widening your filters or clearing the search to bring schedule items back
										into view.
									</p>
								</div>
							</div>
						{:else if selectedView === 'day'}
							<ScheduleDayView
								events={filteredEvents}
								dateKey={anchorDate}
								{canManageEvents}
								deleteConfirmEventId={deleteEvent?.id ?? null}
								deleteConfirmSubmitting={deleteEventSubmitting}
								onManageAction={handleScheduleManageAction}
								onDeleteCancel={() => {
									deleteEvent = null;
								}}
								onDeleteConfirm={() => {
									void submitDeleteEvent();
								}}
							/>
						{:else if selectedView === 'week'}
							<ScheduleWeekView
								events={filteredEvents}
								{anchorDate}
								{canManageEvents}
								deleteConfirmEventId={deleteEvent?.id ?? null}
								deleteConfirmSubmitting={deleteEventSubmitting}
								onManageAction={handleScheduleManageAction}
								onDeleteCancel={() => {
									deleteEvent = null;
								}}
								onDeleteConfirm={() => {
									void submitDeleteEvent();
								}}
							/>
						{:else if selectedView === 'date-range'}
							<ScheduleAgendaView
								events={filteredEvents}
								startDate={selectedDateRange.startDate}
								endDate={selectedDateRange.endDate}
								emptyMessage="No scheduled events fall within the selected date range."
								{canManageEvents}
								deleteConfirmEventId={deleteEvent?.id ?? null}
								deleteConfirmSubmitting={deleteEventSubmitting}
								onManageAction={handleScheduleManageAction}
								onDeleteCancel={() => {
									deleteEvent = null;
								}}
								onDeleteConfirm={() => {
									void submitDeleteEvent();
								}}
							/>
						{:else if selectedView === 'entire-season'}
							<ScheduleAgendaView
								events={filteredEvents}
								emptyMessage="No scheduled events are available for the filtered season."
								{canManageEvents}
								deleteConfirmEventId={deleteEvent?.id ?? null}
								deleteConfirmSubmitting={deleteEventSubmitting}
								onManageAction={handleScheduleManageAction}
								onDeleteCancel={() => {
									deleteEvent = null;
								}}
								onDeleteConfirm={() => {
									void submitDeleteEvent();
								}}
							/>
						{:else}
							<ScheduleMonthView
								events={filteredEvents}
								{anchorDate}
								selectedDate={selectedMonthDate}
								onSelectDate={handleMonthDateSelect}
								{canManageEvents}
								deleteConfirmEventId={deleteEvent?.id ?? null}
								deleteConfirmSubmitting={deleteEventSubmitting}
								onManageAction={handleScheduleManageAction}
								onDeleteCancel={() => {
									deleteEvent = null;
								}}
								onDeleteConfirm={() => {
									void submitDeleteEvent();
								}}
							/>
						{/if}
					</div>
				</section>
			</div>

			<aside class="w-full min-w-0 space-y-3 2xl:sticky 2xl:top-4">
				<button
					type="button"
					class="button-primary inline-flex w-full cursor-pointer items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={!canManageEvents}
					onclick={handleAddEvent}
				>
					<IconPlus class="h-4 w-4" />
					<span>Add Event</span>
				</button>

				<section class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<h2 class="dashboard-section-title text-neutral-950">Filters</h2>
					</div>

					<div class="space-y-4 p-4">
						<p class="text-sm text-neutral-950">
							Narrow the schedule by season, offering, league, and division.
						</p>

						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Search</p>
							<SearchInput
								id="schedule-search"
								label="Search schedule"
								value={searchQuery}
								bind:inputElement={scheduleSearchInput}
								type="search"
								placeholder="Search matchup, league, division, location, or note"
								inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm disabled:cursor-not-allowed"
								clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
								on:input={(event) => {
									searchQuery = event.detail.value;
								}}
							/>
						</div>

						<div class="space-y-4">
							<section class="space-y-2">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Season</p>
								<ListboxDropdown
									options={seasonFilterOptions}
									value={selectedSeasonId}
									ariaLabel="Filter schedule by season"
									buttonClass={FILTER_DROPDOWN_BUTTON_CLASS}
									disabled={seasonFilterOptions.length <= 1}
									on:change={(event) => {
										selectedSeasonId = event.detail.value;
									}}
								/>
							</section>

							<section class="space-y-2">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Offering
								</p>
								<ListboxDropdown
									options={offeringFilterOptions}
									value={selectedOfferingId}
									ariaLabel="Filter schedule by offering"
									buttonClass={FILTER_DROPDOWN_BUTTON_CLASS}
									disabled={offeringFilterOptions.length <= 1}
									on:change={(event) => {
										selectedOfferingId = event.detail.value;
									}}
								/>
							</section>

							<section class="space-y-2">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">League</p>
								<ListboxDropdown
									options={leagueFilterOptions}
									value={selectedLeagueId}
									ariaLabel="Filter schedule by league"
									buttonClass={FILTER_DROPDOWN_BUTTON_CLASS}
									disabled={leagueFilterOptions.length <= 1}
									on:change={(event) => {
										selectedLeagueId = event.detail.value;
									}}
								/>
							</section>

							<section class="space-y-2">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Division
								</p>
								<ListboxDropdown
									options={divisionFilterOptions}
									value={selectedDivisionId}
									ariaLabel="Filter schedule by division"
									buttonClass={FILTER_DROPDOWN_BUTTON_CLASS}
									disabled={divisionFilterOptions.length <= 1}
									on:change={(event) => {
										selectedDivisionId = event.detail.value;
									}}
								/>
							</section>
						</div>

						<button
							type="button"
							class="button-neutral-outlined inline-flex w-full items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
							disabled={!hasActiveFilters}
							onclick={resetFilters}
						>
							Reset Filters
						</button>
					</div>
				</section>
			</aside>
		</div>
	</div>
</div>

<CreateEventWizard
	open={createEventOpen}
	form={createEventForm}
	fieldErrors={createEventFieldErrors}
	formError={createEventFormError}
	submitting={createEventSubmitting}
	canSubmit={createEventCanSubmit}
	unsavedConfirmOpen={createEventUnsavedConfirmOpen}
	options={createEventOptions}
	collections={createEventCollections}
	onSelectionChange={applyCreateEventSelectionPatch}
	onRequestClose={requestCloseCreateEventWizard}
	onSubmit={() => {
		void submitCreateEvent();
	}}
	onInput={clearCreateEventApiErrors}
	onUnsavedConfirm={closeCreateEventWizard}
	onUnsavedCancel={() => {
		createEventUnsavedConfirmOpen = false;
	}}
/>

<CreateEventWizard
	open={editEventOpen}
	title="Edit Event"
	closeAriaLabel="Close edit event wizard"
	submitLabel="Save Changes"
	submittingLabel="Saving..."
	form={editEventForm}
	fieldErrors={editEventFieldErrors}
	formError={editEventFormError}
	submitting={editEventSubmitting}
	canSubmit={editEventCanSubmit}
	unsavedConfirmOpen={editEventUnsavedConfirmOpen}
	options={createEventOptions}
	collections={editEventCollections}
	onSelectionChange={applyEditEventSelectionPatch}
	onRequestClose={requestCloseEditEventWizard}
	onSubmit={() => {
		void submitEditEvent();
	}}
	onInput={clearEditEventApiErrors}
	onUnsavedConfirm={closeEditEventWizard}
	onUnsavedCancel={() => {
		editEventUnsavedConfirmOpen = false;
	}}
/>

<EnterResultsWizard
	open={resultsEventOpen}
	event={resultsEvent}
	form={resultsEventForm}
	fieldErrors={resultsEventFieldErrors}
	formError={resultsEventFormError}
	submitting={resultsEventSubmitting}
	canSubmit={resultsEventCanSubmit}
	unsavedConfirmOpen={resultsEventUnsavedConfirmOpen}
	onRequestClose={requestCloseResultsEventWizard}
	onSubmit={() => {
		void submitResultsEvent();
	}}
	onInput={clearResultsEventApiErrors}
	onUnsavedConfirm={closeResultsEventWizard}
	onUnsavedCancel={() => {
		resultsEventUnsavedConfirmOpen = false;
	}}
/>

<style>
	:global(.schedule-navigator-cell:focus),
	:global(.schedule-navigator-cell:focus-visible) {
		outline: none !important;
		outline-offset: 0 !important;
		box-shadow: none !important;
		-webkit-box-shadow: none !important;
		border-color: transparent !important;
		--tw-ring-color: transparent !important;
		--tw-ring-shadow: 0 0 #0000 !important;
	}
</style>
