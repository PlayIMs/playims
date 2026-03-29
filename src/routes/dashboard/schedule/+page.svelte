<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		IconAlertTriangle,
		IconCalendar,
		IconCalendarWeek,
		IconChevronLeft,
		IconChevronRight,
		IconLivePhoto
	} from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DashboardMegaSearchLauncher from '$lib/components/dashboard/DashboardMegaSearchLauncher.svelte';
	import ScheduleDayView from '$lib/components/dashboard/schedule/ScheduleDayView.svelte';
	import ScheduleWeekView from '$lib/components/dashboard/schedule/ScheduleWeekView.svelte';
	import ScheduleMonthView from '$lib/components/dashboard/schedule/ScheduleMonthView.svelte';
	import ScheduleEventCard from '$lib/components/dashboard/schedule/ScheduleEventCard.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import {
		buildScheduleOptionCollections,
		bucketScheduleEventsByTiming,
		filterScheduleEvents,
		getScheduleEventDateKey,
		getScheduleRangeForView,
		sanitizeScheduleFilters,
		shiftScheduleAnchorDate,
		summarizeScheduleEvents,
		type ScheduleFilters,
		type ScheduleOptionCount,
		type ScheduleView
	} from '$lib/utils/schedule-page.js';
	import type { PageData } from './$types';
	import { toast } from '$lib/toasts';

	const FILTER_DROPDOWN_BUTTON_CLASS =
		'button-secondary-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2';
	const VIEW_BUTTON_CLASS =
		'px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer inline-flex items-center justify-center';
	const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
	const DEFAULT_VIEW: ScheduleView = 'week';

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
	let selectedTeamId = $state('all');
	let selectedStatus = $state('all');
	let selectedView = $state<ScheduleView>(DEFAULT_VIEW);
	let anchorDate = $state(todayDateKey());
	let selectedMonthDate = $state(todayDateKey());
	let stateHydrated = $state(false);
	let lastPageError = $state('');

	const events = $derived(data.events ?? []);

	function todayDateKey(): string {
		const today = new Date();
		return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
			today.getDate()
		).padStart(2, '0')}`;
	}

	function isDateKey(value: string | null | undefined): value is string {
		return DATE_KEY_REGEX.test(value ?? '');
	}

	function normalizeScheduleView(value: string | null | undefined): ScheduleView {
		if (value === 'day' || value === 'month') return value;
		return DEFAULT_VIEW;
	}

	function parseQueryValue(value: string | null | undefined): string {
		const normalized = value?.trim();
		return normalized && normalized.length > 0 ? normalized : 'all';
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

	function setQueryParam(url: URL, key: string, value: string | null): void {
		if (value && value.trim().length > 0) {
			url.searchParams.set(key, value);
			return;
		}

		url.searchParams.delete(key);
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
		view: ScheduleView
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

	function changeView(nextView: ScheduleView): void {
		selectedView = nextView;
		selectedMonthDate = anchorDate;
	}

	function moveAnchor(direction: -1 | 1): void {
		const nextAnchorDate = shiftScheduleAnchorDate(anchorDate, selectedView, direction);
		anchorDate = nextAnchorDate;
		selectedMonthDate = nextAnchorDate;
	}

	function jumpToToday(): void {
		const today = todayDateKey();
		anchorDate = today;
		selectedMonthDate = today;
	}

	function resetFilters(): void {
		searchQuery = '';
		selectedSeasonId = 'all';
		selectedOfferingId = 'all';
		selectedLeagueId = 'all';
		selectedDivisionId = 'all';
		selectedTeamId = 'all';
		selectedStatus = 'all';
	}

	function handleMonthDateSelect(dateKey: string): void {
		selectedMonthDate = dateKey;
		if (dateKey.slice(0, 7) !== anchorDate.slice(0, 7)) {
			anchorDate = dateKey;
		}
	}

	$effect(() => {
		if (stateHydrated) return;

		const params = $page.url.searchParams;
		searchQuery = params.get('q')?.trim() ?? '';
		selectedSeasonId = parseQueryValue(params.get('season'));
		selectedOfferingId = parseQueryValue(params.get('offering'));
		selectedLeagueId = parseQueryValue(params.get('league'));
		selectedDivisionId = parseQueryValue(params.get('division'));
		selectedTeamId = parseQueryValue(params.get('team'));
		selectedStatus = parseQueryValue(params.get('status'));
		selectedView = normalizeScheduleView(params.get('view'));
		anchorDate = isDateKey(params.get('date')) ? (params.get('date') as string) : todayDateKey();
		selectedMonthDate = isDateKey(params.get('selectedDay'))
			? (params.get('selectedDay') as string)
			: anchorDate;
		stateHydrated = true;
	});

	const rawFilters = $derived.by<ScheduleFilters>(() => ({
		seasonId: selectedSeasonId,
		offeringId: selectedOfferingId,
		leagueId: selectedLeagueId,
		divisionId: selectedDivisionId,
		teamId: selectedTeamId,
		status: selectedStatus,
		searchQuery
	}));

	const normalizedFilters = $derived.by(() => sanitizeScheduleFilters(events, rawFilters));
	const filterOptions = $derived.by(() =>
		buildScheduleOptionCollections(events, normalizedFilters)
	);
	const filteredEvents = $derived.by(() => filterScheduleEvents(events, normalizedFilters));
	const filteredSummary = $derived.by(() => summarizeScheduleEvents(filteredEvents));
	const eventBuckets = $derived.by(() => bucketScheduleEventsByTiming(filteredEvents));
	const visibleRange = $derived.by(() => getScheduleRangeForView(anchorDate, selectedView));
	const visibleRangeLabel = $derived.by(() => formatRangeLabel(visibleRange, selectedView));
	const visibleScheduledCount = $derived.by(
		() =>
			eventBuckets.scheduled.filter((event) =>
				isDateWithinRange(
					getScheduleEventDateKey(event.scheduledStartAt),
					visibleRange.startDate,
					visibleRange.endDate
				)
			).length
	);

	const seasonFilterOptions = $derived.by(() =>
		toDropdownOptions('All seasons', filterOptions.seasonOptions)
	);
	const offeringFilterOptions = $derived.by(() =>
		toDropdownOptions('All offerings', filterOptions.offeringOptions)
	);
	const leagueFilterOptions = $derived.by(() =>
		toDropdownOptions('All leagues', filterOptions.leagueOptions)
	);
	const divisionFilterOptions = $derived.by(() =>
		toDropdownOptions('All divisions', filterOptions.divisionOptions)
	);
	const teamFilterOptions = $derived.by(() =>
		toDropdownOptions('All teams', filterOptions.teamOptions)
	);
	const statusFilterOptions = $derived.by(() =>
		toDropdownOptions('All statuses', filterOptions.statusOptions)
	);

	const hasActiveFilters = $derived.by(
		() =>
			searchQuery.trim().length > 0 ||
			selectedSeasonId !== 'all' ||
			selectedOfferingId !== 'all' ||
			selectedLeagueId !== 'all' ||
			selectedDivisionId !== 'all' ||
			selectedTeamId !== 'all' ||
			selectedStatus !== 'all'
	);

	const workspaceHeading = $derived.by(() => {
		if (selectedView === 'day') return 'Day Agenda';
		if (selectedView === 'month') return 'Month Calendar';
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
		if (selectedTeamId !== normalizedFilters.teamId) selectedTeamId = normalizedFilters.teamId;
		if (selectedStatus !== normalizedFilters.status) selectedStatus = normalizedFilters.status;
	});

	$effect(() => {
		if (!browser || !stateHydrated) return;

		const nextUrl = new URL($page.url);
		const today = todayDateKey();

		setQueryParam(nextUrl, 'q', searchQuery.trim() || null);
		setQueryParam(nextUrl, 'season', selectedSeasonId !== 'all' ? selectedSeasonId : null);
		setQueryParam(nextUrl, 'offering', selectedOfferingId !== 'all' ? selectedOfferingId : null);
		setQueryParam(nextUrl, 'league', selectedLeagueId !== 'all' ? selectedLeagueId : null);
		setQueryParam(nextUrl, 'division', selectedDivisionId !== 'all' ? selectedDivisionId : null);
		setQueryParam(nextUrl, 'team', selectedTeamId !== 'all' ? selectedTeamId : null);
		setQueryParam(nextUrl, 'status', selectedStatus !== 'all' ? selectedStatus : null);
		setQueryParam(nextUrl, 'view', selectedView !== DEFAULT_VIEW ? selectedView : null);
		setQueryParam(nextUrl, 'date', anchorDate !== today ? anchorDate : null);
		setQueryParam(
			nextUrl,
			'selectedDay',
			selectedView === 'month' && selectedMonthDate !== anchorDate ? selectedMonthDate : null
		);

		const currentPath = `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
		const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
		if (currentPath !== nextPath) {
			replaceState(nextPath, $page.state);
		}
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
		content="Browse intramural events with hierarchical filters and day, week, or month schedule views."
	/>
</svelte:head>

<div class="w-full space-y-4">
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
				<DashboardMegaSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-6">
		<div class="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
			<aside class="section-shell self-start space-y-4 p-4 xl:sticky xl:top-4">
				<div class="space-y-1">
					<p class="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-950">Filters</p>
					<p class="text-sm text-neutral-950">
						Narrow the schedule from season down to team, then add status when needed.
					</p>
				</div>

				<div class="space-y-3">
					<div class="space-y-1">
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
					</div>

					<div class="space-y-1">
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Offering</p>
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
					</div>

					<div class="space-y-1">
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
					</div>

					<div class="space-y-1">
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Division</p>
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
					</div>

					<div class="space-y-1">
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Team</p>
						<ListboxDropdown
							options={teamFilterOptions}
							value={selectedTeamId}
							ariaLabel="Filter schedule by team"
							buttonClass={FILTER_DROPDOWN_BUTTON_CLASS}
							disabled={teamFilterOptions.length <= 1}
							on:change={(event) => {
								selectedTeamId = event.detail.value;
							}}
						/>
					</div>

					<div class="space-y-1">
						<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Status</p>
						<ListboxDropdown
							options={statusFilterOptions}
							value={selectedStatus}
							ariaLabel="Filter schedule by status"
							buttonClass={FILTER_DROPDOWN_BUTTON_CLASS}
							disabled={statusFilterOptions.length <= 1}
							on:change={(event) => {
								selectedStatus = event.detail.value;
							}}
						/>
					</div>
				</div>

				<button
					type="button"
					class="button-secondary-outlined inline-flex w-full items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
					disabled={!hasActiveFilters}
					onclick={resetFilters}
				>
					Reset Filters
				</button>

				<div class="border border-neutral-950 bg-white p-3 space-y-2">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
						Last refreshed
					</p>
					<p class="text-sm text-neutral-950 font-sans">
						<DateHoverText
							display={new Date(data.generatedAt).toLocaleString('en-US')}
							value={data.generatedAt}
							includeTime
						/>
					</p>
				</div>
			</aside>

			<div class="min-w-0 space-y-4">
				<section class="section-shell">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4 space-y-4">
						<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
							<div class="space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-2xl font-bold font-serif text-neutral-950">{workspaceHeading}</h2>
									<span
										class="badge-neutral-outlined px-2 py-1 text-[11px] uppercase tracking-wide"
									>
										<DateHoverText
											display={visibleRangeLabel}
											value={visibleRange.startDate}
											endValue={visibleRange.endDate}
										/>
									</span>
									<span
										class="badge-neutral-outlined px-2 py-1 text-[11px] uppercase tracking-wide"
									>
										{filteredSummary.total} filtered
									</span>
									<span
										class="badge-neutral-outlined px-2 py-1 text-[11px] uppercase tracking-wide"
									>
										{visibleScheduledCount} visible
									</span>
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
								<p class="text-sm text-neutral-950 font-sans">
									Use the toolbar to move through time, then switch between day, week, and month
									layouts without losing your filters.
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<button
									type="button"
									class="button-secondary-outlined dashboard-icon-button cursor-pointer"
									aria-label="Previous schedule range"
									onclick={() => {
										moveAnchor(-1);
									}}
								>
									<IconChevronLeft class="h-4 w-4" />
								</button>
								<button
									type="button"
									class="button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer"
									onclick={jumpToToday}
								>
									Today
								</button>
								<button
									type="button"
									class="button-secondary-outlined dashboard-icon-button cursor-pointer"
									aria-label="Next schedule range"
									onclick={() => {
										moveAnchor(1);
									}}
								>
									<IconChevronRight class="h-4 w-4" />
								</button>
								<div class="flex items-stretch gap-2">
									<button
										type="button"
										class={`${selectedView === 'day' ? 'button-primary' : 'button-secondary-outlined'} ${VIEW_BUTTON_CLASS}`}
										onclick={() => {
											changeView('day');
										}}
									>
										Day
									</button>
									<button
										type="button"
										class={`${selectedView === 'week' ? 'button-primary' : 'button-secondary-outlined'} ${VIEW_BUTTON_CLASS}`}
										onclick={() => {
											changeView('week');
										}}
									>
										Week
									</button>
									<button
										type="button"
										class={`${selectedView === 'month' ? 'button-primary' : 'button-secondary-outlined'} ${VIEW_BUTTON_CLASS}`}
										onclick={() => {
											changeView('month');
										}}
									>
										Month
									</button>
								</div>
							</div>
						</div>

						<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
							<SearchInput
								id="schedule-search"
								label="Search schedule"
								value={searchQuery}
								placeholder="Search matchup, league, division, location, or note"
								on:input={(event) => {
									searchQuery = event.detail.value;
								}}
							/>

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
						{:else if eventBuckets.scheduled.length === 0}
							<div class="border border-warning-300 bg-warning-50 p-4 space-y-2">
								<div class="flex items-center gap-2">
									<IconAlertTriangle class="h-5 w-5 text-warning-700" />
									<h3 class="text-lg font-bold font-serif text-neutral-950">No dated events yet</h3>
								</div>
								<p class="text-sm font-sans text-neutral-950">
									The current filters only match unscheduled events. You can still review those
									below.
								</p>
							</div>
						{:else if selectedView === 'day'}
							<ScheduleDayView events={filteredEvents} dateKey={anchorDate} />
						{:else if selectedView === 'week'}
							<ScheduleWeekView events={filteredEvents} {anchorDate} />
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

				<section class="section-shell">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 class="dashboard-section-title text-neutral-950">Unscheduled Events</h2>
								<p class="text-sm font-sans text-neutral-950">
									These events match the current filters but do not have a scheduled date yet.
								</p>
							</div>
							<span class="badge-neutral-outlined px-2 py-1 text-[11px] uppercase tracking-wide">
								{eventBuckets.unscheduled.length} unscheduled
							</span>
						</div>
					</div>

					<div class="p-4 space-y-3">
						{#if eventBuckets.unscheduled.length === 0}
							<div class="border border-neutral-950 bg-white p-4">
								<p class="text-sm font-sans text-neutral-950">
									All currently filtered events already have dates on the schedule.
								</p>
							</div>
						{:else}
							{#each eventBuckets.unscheduled as event (event.id)}
								<ScheduleEventCard {event} showDate showTime={false} />
							{/each}
						{/if}
					</div>
				</section>
			</div>
		</div>
	</div>
</div>
