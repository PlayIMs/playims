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
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import { inferPickerYearRange } from '$lib/components/date-picker.js';
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
		resolveScheduleNavigatorDirection,
		sanitizeScheduleFilters,
		shiftScheduleAnchorDate,
		summarizeScheduleEvents,
		type ScheduleEventRecord,
		type ScheduleFilters,
		type ScheduleOptionCount,
		type ScheduleRange
	} from '$lib/utils/schedule-page.js';
	import type { PageData } from './$types';
	import { toast } from '$lib/toasts';

	const FILTER_DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2';
	const NAVIGATION_SIDE_SECTION_CLASS = 'w-full xl:w-[9rem] xl:shrink-0';
	const NAVIGATION_VIEW_BUTTON_CLASS =
		'h-[3.375rem] w-full border-0 bg-white px-4 py-0 text-sm font-semibold leading-none text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-3';
	const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	type ScheduleDisplayMode = 'day' | 'week' | 'month' | 'date-range' | 'entire-season';
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
	let scheduleSearchInput = $state<HTMLInputElement | null>(null);
	let stateHydrated = $state(false);
	let lastPageError = $state('');

	const events = $derived(data.events ?? []);
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

	function formatRangeLabel(
		range: { startDate: string; endDate: string },
		view: 'day' | 'week' | 'month'
	): string {
		if (view === 'day') return formatLongDate(range.startDate);
		if (view === 'month') return formatMonthLabel(range.startDate);

		const start = new Date(`${range.startDate}T00:00:00`);
		const end = new Date(`${range.endDate}T00:00:00`);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			return `${range.startDate} - ${range.endDate}`;
		}

		if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
			return `${start.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric'
			})} - ${end.toLocaleDateString('en-US', {
				day: 'numeric',
				year: 'numeric'
			})}`;
		}

		return `${start.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		})} - ${end.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})}`;
	}

	function isDateWithinRange(dateKey: string | null, startDate: string, endDate: string): boolean {
		return Boolean(dateKey && dateKey >= startDate && dateKey <= endDate);
	}

	function formatDateRangeDayCount(totalDays: number): string {
		return `${totalDays} day${totalDays === 1 ? '' : 's'} included`;
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
		setSelectedDate(
			shiftScheduleAnchorDate(
				anchorDate,
				selectedView === 'week' ? 'week' : selectedView === 'month' ? 'month' : 'day',
				direction
			)
		);
	}

	async function focusNavigatorAnchor(dateKey: string): Promise<void> {
		await tick();
		navigatorDayStrip
			?.querySelector<HTMLButtonElement>(`[data-schedule-navigator-anchor="${dateKey}"]`)
			?.focus();
	}

	function handleNavigatorDayKeydown(event: KeyboardEvent, dateKey: string): void {
		const direction = resolveScheduleNavigatorDirection(event.key, event.shiftKey);
		if (direction === null) return;

		event.preventDefault();
		const normalizedDirection: -1 | 1 = direction < 0 ? -1 : 1;
		const nextDateKey =
			Math.abs(direction) === 1
				? shiftScheduleAnchorDate(dateKey, 'day', normalizedDirection)
				: shiftScheduleAnchorDate(dateKey, 'week', normalizedDirection);
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey);
	}

	function handleNavigatorWeekKeydown(event: KeyboardEvent, dateKey: string): void {
		const direction = resolveScheduleNavigatorDirection(event.key, true);
		if (direction === null) return;

		event.preventDefault();
		const normalizedDirection: -1 | 1 = direction < 0 ? -1 : 1;
		const nextDateKey = shiftScheduleAnchorDate(dateKey, 'week', normalizedDirection);
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey);
	}

	function handleNavigatorMonthKeydown(event: KeyboardEvent, dateKey: string): void {
		const direction = resolveScheduleNavigatorDirection(event.key);
		if (direction === null) return;

		event.preventDefault();
		const normalizedDirection: -1 | 1 = direction < 0 ? -1 : 1;
		const nextDateKey = shiftScheduleAnchorDate(dateKey, 'month', normalizedDirection);
		setSelectedDate(nextDateKey);
		void focusNavigatorAnchor(nextDateKey);
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

	function handleAddEvent(): void {
		toast.info('Event creation is not connected on the schedule page yet.', {
			id: 'schedule-add-event-coming-soon',
			title: pageLabel
		});
	}

	async function focusScheduleSearch(): Promise<void> {
		if (!browser) return;
		await tick();
		scheduleSearchInput?.focus();
	}

	onMount(() => {
		void focusScheduleSearch();
	});

	afterNavigate(() => {
		void focusScheduleSearch();
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
	const navigatorDays = $derived.by(() => buildCenteredScheduleDays(anchorDate, 3));
	const navigatorMonths = $derived.by(() => buildCenteredScheduleMonths(anchorDate));
	const navigatorWeeks = $derived.by(() => buildCenteredScheduleWeeks(anchorDate));
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
	const visibleRange = $derived.by<ScheduleRange>(() => {
		if (selectedView === 'week') return getScheduleRangeForView(anchorDate, 'week');
		if (selectedView === 'month') return getScheduleRangeForView(anchorDate, 'month');
		if (selectedView === 'date-range') return selectedDateRange;
		if (selectedView === 'entire-season') {
			const firstDateKey = filteredEvents[0]
				? getScheduleEventDateKey(filteredEvents[0].scheduledStartAt)
				: anchorDate;
			const lastDateKey = filteredEvents[filteredEvents.length - 1]
				? getScheduleEventDateKey(filteredEvents[filteredEvents.length - 1].scheduledStartAt)
				: anchorDate;

			return {
				startDate: firstDateKey ?? anchorDate,
				endDate: lastDateKey ?? anchorDate
			};
		}

		return {
			startDate: anchorDate,
			endDate: anchorDate
		};
	});
	const visibleRangeLabel = $derived.by(() => {
		if (selectedView === 'entire-season') {
			if (selectedSeasonId !== 'all') {
				const explicitSeasonLabel =
					selectedSeasonId === defaultSeasonId && data.currentSeasonName?.trim()
						? data.currentSeasonName.trim()
						: filterOptions.seasonOptions.find((option) => option.value === selectedSeasonId)
								?.label;

				return explicitSeasonLabel ? `${explicitSeasonLabel} season` : 'Entire season';
			}

			return 'Entire filtered schedule';
		}

		if (selectedView === 'date-range') {
			return formatRangeLabel(visibleRange, 'week');
		}

		if (selectedView === 'month') {
			return formatRangeLabel(visibleRange, 'month');
		}

		return formatRangeLabel(visibleRange, selectedView === 'week' ? 'week' : 'day');
	});
	const visibleScheduledCount = $derived.by(() =>
		selectedView === 'entire-season'
			? filteredEvents.length
			: filteredEvents.filter((event) =>
					isDateWithinRange(
						getScheduleEventDateKey(event.scheduledStartAt),
						visibleRange.startDate,
						visibleRange.endDate
					)
				).length
	);

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

	const workspaceHeading = $derived.by(() => {
		if (selectedView === 'day') return 'Day Agenda';
		if (selectedView === 'week') return 'Week Board';
		if (selectedView === 'month') return 'Month Calendar';
		if (selectedView === 'date-range') return 'Date Range Agenda';
		if (selectedView === 'entire-season') return 'Entire Season Agenda';
		return 'Week Board';
	});

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
									<h2 class="text-2xl font-bold font-serif text-neutral-950">{workspaceHeading}</h2>
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

						<div class="flex flex-wrap items-center justify-end gap-2">
							<div class="flex flex-wrap items-center gap-2 text-xs text-neutral-950 font-sans">
								<span
									class="badge-secondary-outlined px-2 py-1 text-[11px] uppercase tracking-wide"
								>
									{filteredSummary.scheduled} scheduled
								</span>
								<span class="badge-secondary px-2 py-1 text-[11px] uppercase tracking-wide">
									{filteredSummary.completed} completed
								</span>
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
												on:change={(event) => {
													setSelectedDateRange(
														event.detail.startDate,
														event.detail.endDate
													);
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
											triggerClass="flex h-[3.375rem] w-full items-center justify-start gap-3 border-b border-neutral-950 bg-white px-4 py-0 text-sm font-semibold leading-none text-neutral-950 xl:border-b-0 xl:border-r"
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
											<div class="flex min-w-0 flex-1 items-center justify-center px-4 py-2 text-center">
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

										{#if selectedView === 'week'}
										<div class="grid h-[3.375rem] min-w-0 flex-1 grid-cols-6">
											{#each navigatorWeeks as week, index (week.anchorDate)}
												<button
													type="button"
													data-schedule-navigator-anchor={week.anchorDate}
													class={`group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center transition-colors cursor-pointer ${
														index === navigatorWeeks.length - 1 ? '' : 'border-r border-neutral-300'
													} ${
														week.startDate === selectedWeekRange.startDate
															? 'bg-neutral-50 text-neutral-950'
															: 'bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
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
														class={`mt-1 h-0.5 w-10 ${
															week.startDate === selectedWeekRange.startDate
																? 'bg-primary-700'
																: 'bg-transparent group-hover:bg-neutral-300'
														}`}
													></span>
												</button>
											{/each}
										</div>
										{:else if selectedView === 'month'}
										<div class="grid h-[3.375rem] min-w-0 flex-1 grid-cols-7">
											{#each navigatorMonths as month, index (month.anchorDate)}
												<button
													type="button"
													data-schedule-navigator-anchor={month.anchorDate}
													class={`group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center transition-colors cursor-pointer ${
														index === navigatorMonths.length - 1
															? ''
															: 'border-r border-neutral-300'
													} ${
														month.startDate === selectedMonthRange.startDate
															? 'bg-neutral-50 text-neutral-950'
															: 'bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
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
														class={`mt-1 h-0.5 w-10 ${
															month.startDate === selectedMonthRange.startDate
																? 'bg-primary-700'
																: 'bg-transparent group-hover:bg-neutral-300'
														}`}
													></span>
												</button>
											{/each}
										</div>
										{:else}
										<div class="grid h-[3.375rem] min-w-0 flex-1 grid-cols-7">
											{#each navigatorDays as day, index (day.dateKey)}
												<button
													type="button"
													data-schedule-navigator-anchor={day.dateKey}
													class={`group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center transition-colors cursor-pointer ${
														index === navigatorDays.length - 1 ? '' : 'border-r border-neutral-300'
													} ${
														day.dateKey === anchorDate
															? 'bg-neutral-50 text-neutral-950'
															: 'bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
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
														class={`mt-1 h-0.5 w-8 ${
															day.dateKey === anchorDate
																? 'bg-primary-700'
																: 'bg-transparent group-hover:bg-neutral-300'
														}`}
													></span>
												</button>
											{/each}
										</div>
										{/if}

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
										listClass="w-56"
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
							<ScheduleDayView events={filteredEvents} dateKey={anchorDate} />
						{:else if selectedView === 'week'}
							<ScheduleWeekView events={filteredEvents} {anchorDate} />
						{:else if selectedView === 'date-range'}
							<ScheduleAgendaView
								events={filteredEvents}
								startDate={selectedDateRange.startDate}
								endDate={selectedDateRange.endDate}
								emptyMessage="No scheduled events fall within the selected date range."
							/>
						{:else if selectedView === 'entire-season'}
							<ScheduleAgendaView
								events={filteredEvents}
								emptyMessage="No scheduled events are available for the filtered season."
							/>
						{:else}
							<ScheduleMonthView
								events={filteredEvents}
								{anchorDate}
								selectedDate={selectedMonthDate}
								onSelectDate={handleMonthDateSelect}
							/>
						{/if}
					</div>
				</section>
			</div>

			<aside class="w-full min-w-0 space-y-3 2xl:sticky 2xl:top-4">
				<button
					type="button"
					class="button-primary inline-flex w-full cursor-pointer items-center justify-center gap-2"
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
