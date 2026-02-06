<script lang="ts">
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconCalendar from '@tabler/icons-svelte/icons/calendar';
	import IconCalendarWeek from '@tabler/icons-svelte/icons/calendar-week';
	import IconClock from '@tabler/icons-svelte/icons/clock';
	import IconLivePhoto from '@tabler/icons-svelte/icons/live-photo';

	type ScheduleEvent = {
		id: string;
		type: string;
		status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed' | 'other';
		statusLabel: string;
		scheduledStartAt: string | null;
		scheduledEndAt: string | null;
		sportName: string;
		leagueName: string;
		divisionName: string;
		matchup: string;
		location: string;
		weekNumber: number | null;
		roundLabel: string | null;
		notes: string | null;
		isPostseason: boolean;
		score: string | null;
	};

	type OptionCount = {
		value: string;
		label: string;
		count: number;
	};

	type ScheduleSummary = {
		total: number;
		live: number;
		scheduled: number;
		completed: number;
		needsAttention: number;
	};

	type SchedulePageData = {
		generatedAt: string;
		events: ScheduleEvent[];
		sportOptions: OptionCount[];
		statusOptions: OptionCount[];
		summary: ScheduleSummary;
		error?: string;
	};

	type WindowFilter = 'all' | 'today' | 'next7' | 'next30' | 'past7';

	let { data } = $props<{ data: SchedulePageData }>();

	let searchQuery = $state('');
	let selectedStatus = $state('all');
	let selectedSport = $state('all');
	let selectedWindow = $state<WindowFilter>('all');

	const events = $derived(data.events ?? []);
	const sportOptions = $derived(data.sportOptions ?? []);
	const statusOptions = $derived(data.statusOptions ?? []);
	const summary = $derived(
		data.summary ?? { total: 0, live: 0, scheduled: 0, completed: 0, needsAttention: 0 }
	);

	const windowOptions = [
		{ value: 'all', label: 'All dates' },
		{ value: 'today', label: 'Today' },
		{ value: 'next7', label: 'Next 7 days' },
		{ value: 'next30', label: 'Next 30 days' },
		{ value: 'past7', label: 'Past 7 days' }
	] as const;

	function parseDate(value: string | null): Date | null {
		if (!value) return null;
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed;
	}

	function formatTimeRange(start: string | null, end: string | null): string {
		const startDate = parseDate(start);
		if (!startDate) return 'Time not set';

		const startText = startDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		const endDate = parseDate(end);
		if (!endDate) return startText;

		const endText = endDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		return `${startText} - ${endText}`;
	}

	function getDateKey(value: string | null): string {
		const date = parseDate(value);
		if (!date) return 'unscheduled';
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatGroupLabel(key: string): string {
		if (key === 'unscheduled') return 'Unscheduled';

		const date = new Date(`${key}T00:00:00`);
		if (Number.isNaN(date.getTime())) return key;

		const today = new Date();
		const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
		const dayStart = date.getTime();

		if (dayStart === todayStart) {
			return `Today - ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
		}

		if (dayStart === tomorrowStart) {
			return `Tomorrow - ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
		}

		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function isInWindow(dateValue: string | null, window: WindowFilter): boolean {
		if (window === 'all') return true;

		const parsedDate = parseDate(dateValue);
		if (!parsedDate) return false;

		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const nextDay = todayStart + 24 * 60 * 60 * 1000;
		const dateMs = parsedDate.getTime();

		if (window === 'today') {
			return dateMs >= todayStart && dateMs < nextDay;
		}

		if (window === 'next7') {
			return dateMs >= todayStart && dateMs < todayStart + 7 * 24 * 60 * 60 * 1000;
		}

		if (window === 'next30') {
			return dateMs >= todayStart && dateMs < todayStart + 30 * 24 * 60 * 60 * 1000;
		}

		return dateMs >= todayStart - 7 * 24 * 60 * 60 * 1000 && dateMs < todayStart;
	}

	function matchesQuery(event: ScheduleEvent, query: string): boolean {
		if (!query) return true;
		const lowerQuery = query.toLowerCase();
		const searchable = [
			event.matchup,
			event.sportName,
			event.leagueName,
			event.divisionName,
			event.location,
			event.roundLabel || '',
			event.notes || ''
		]
			.join(' ')
			.toLowerCase();

		return searchable.includes(lowerQuery);
	}

	function statusBadgeClass(status: ScheduleEvent['status']): string {
		if (status === 'in_progress') return 'bg-primary-500 text-white border-primary-500';
		if (status === 'completed') return 'bg-secondary-500 text-secondary-25 border-secondary-500';
		if (status === 'cancelled' || status === 'postponed')
			return 'bg-accent-100 text-accent-800 border-accent-500';
		if (status === 'scheduled') return 'bg-neutral text-neutral-950 border-secondary-300';
		return 'bg-neutral text-neutral-950 border-secondary-300';
	}

	const filteredEvents = $derived.by(() => {
		const query = searchQuery.trim();

		return events.filter((event: ScheduleEvent) => {
			if (selectedStatus !== 'all' && event.statusLabel !== selectedStatus) return false;
			if (selectedSport !== 'all' && event.sportName !== selectedSport) return false;
			if (!isInWindow(event.scheduledStartAt, selectedWindow)) return false;
			if (!matchesQuery(event, query)) return false;
			return true;
		});
	});

	const groupedEvents = $derived.by(() => {
		const groups = new Map<string, ScheduleEvent[]>();

		for (const event of filteredEvents) {
			const key = getDateKey(event.scheduledStartAt);
			const existing = groups.get(key);
			if (existing) {
				existing.push(event);
			} else {
				groups.set(key, [event]);
			}
		}

		return Array.from(groups.entries())
			.sort(([a], [b]) => {
				if (a === b) return 0;
				if (a === 'unscheduled') return 1;
				if (b === 'unscheduled') return -1;
				return a.localeCompare(b);
			})
			.map(([key, value]) => ({
				key,
				label: formatGroupLabel(key),
				events: value
			}));
	});

	const filteredSummary = $derived.by(() => ({
		total: filteredEvents.length,
		live: filteredEvents.filter((event: ScheduleEvent) => event.status === 'in_progress').length,
		scheduled: filteredEvents.filter((event: ScheduleEvent) => event.status === 'scheduled').length,
		completed: filteredEvents.filter((event: ScheduleEvent) => event.status === 'completed').length,
		needsAttention: filteredEvents.filter(
			(event: ScheduleEvent) => event.status === 'cancelled' || event.status === 'postponed'
		).length
	}));

	function resetFilters() {
		searchQuery = '';
		selectedStatus = 'all';
		selectedSport = 'all';
		selectedWindow = 'all';
	}
</script>

<svelte:head>
	<title>Schedule - PlayIMs</title>
	<meta
		name="description"
		content="View upcoming and completed intramural events, with sport and status filters."
	/>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
	<header class="border-2 border-secondary-300 bg-neutral p-5">
		<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
			<div class="flex items-start gap-4">
				<div class="bg-primary p-3 text-white" aria-hidden="true">
					<IconCalendarWeek class="w-7 h-7" />
				</div>
				<div>
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">League Calendar</p>
					<h1 class="text-4xl font-bold font-serif text-neutral-950">Schedule</h1>
					<p class="text-sm text-neutral-950 font-sans">
						{summary.total} total event{summary.total === 1 ? '' : 's'} loaded
					</p>
				</div>
			</div>
			<div class="text-xs text-neutral-950 font-sans">
				Last refreshed: {new Date(data.generatedAt).toLocaleString('en-US')}
			</div>
		</div>
	</header>

	{#if data.error}
		<div class="bg-accent-100 border-2 border-accent-500 text-neutral-950 p-4">
			<div class="flex items-center gap-3">
				<IconAlertTriangle class="w-6 h-6 text-accent-700" />
				<p class="font-sans">{data.error}</p>
			</div>
		</div>
	{/if}

	<section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
		<div class="border-2 border-secondary-300 bg-neutral p-4">
			<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Visible Events</p>
			<p class="text-3xl font-bold text-neutral-950 font-serif">{filteredSummary.total}</p>
		</div>
		<div class="border-2 border-primary-500 bg-neutral p-4">
			<p class="text-xs uppercase tracking-wide text-primary-700 font-sans">Live</p>
			<div class="flex items-center gap-2">
				<p class="text-3xl font-bold text-primary-700 font-serif">{filteredSummary.live}</p>
				{#if filteredSummary.live > 0}
					<IconLivePhoto class="w-5 h-5 text-primary-700 animate-pulse" />
				{/if}
			</div>
		</div>
		<div class="border-2 border-secondary-300 bg-neutral p-4">
			<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Scheduled</p>
			<p class="text-3xl font-bold text-neutral-950 font-serif">{filteredSummary.scheduled}</p>
		</div>
		<div class="border-2 border-secondary-300 bg-neutral p-4">
			<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Completed</p>
			<p class="text-3xl font-bold text-neutral-950 font-serif">{filteredSummary.completed}</p>
		</div>
		<div class="border-2 border-accent-500 bg-accent-100 p-4 col-span-2 md:col-span-1">
			<p class="text-xs uppercase tracking-wide text-accent-800 font-sans">Needs Attention</p>
			<p class="text-3xl font-bold text-accent-800 font-serif">{filteredSummary.needsAttention}</p>
		</div>
	</section>

	<section class="border-2 border-secondary-300 bg-neutral p-4 space-y-4">
		<div class="flex flex-col gap-1">
			<h2 class="text-xl font-bold font-serif text-neutral-950">Filters</h2>
			<p class="text-xs text-neutral-950 font-sans">
				Filter by text, sport, status, and date range.
			</p>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-4 gap-3">
			<div class="lg:col-span-2">
				<label
					class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
					for="schedule-search"
				>
					Search
				</label>
				<input
					id="schedule-search"
					type="text"
					class="input-primary"
					placeholder="Team, league, location, or note"
					bind:value={searchQuery}
				/>
			</div>
			<div>
				<label
					class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
					for="schedule-status"
				>
					Status
				</label>
				<select
					id="schedule-status"
					class="select-primary custom-select"
					bind:value={selectedStatus}
				>
					<option value="all">All statuses</option>
					{#each statusOptions as option}
						<option value={option.value}>
							{option.label} ({option.count})
						</option>
					{/each}
				</select>
			</div>
			<div>
				<label
					class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
					for="schedule-sport"
				>
					Sport
				</label>
				<select id="schedule-sport" class="select-primary custom-select" bind:value={selectedSport}>
					<option value="all">All sports</option>
					{#each sportOptions as option}
						<option value={option.value}>
							{option.label} ({option.count})
						</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
			<div class="w-full lg:w-72">
				<label
					class="block text-xs uppercase tracking-wide text-neutral-950 font-bold mb-1"
					for="schedule-window"
				>
					Date Window
				</label>
				<select
					id="schedule-window"
					class="select-primary custom-select"
					bind:value={selectedWindow}
				>
					{#each windowOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<button
				type="button"
				class="button-primary-outlined px-4 py-2 text-xs font-bold uppercase tracking-wide w-full lg:w-auto"
				onclick={resetFilters}
			>
				Reset Filters
			</button>
		</div>
	</section>

	{#if groupedEvents.length === 0}
		<section class="border-2 border-secondary-300 bg-neutral p-8 text-center">
			<div class="bg-secondary p-3 inline-flex mb-4" aria-hidden="true">
				<IconCalendar class="w-8 h-8 text-white" />
			</div>
			<h2 class="text-2xl font-bold font-serif text-neutral-950 mb-1">No matching events</h2>
			<p class="text-sm text-neutral-950 font-sans">
				Try widening your filters or clearing the search.
			</p>
		</section>
	{:else}
		<div class="space-y-4">
			{#each groupedEvents as group}
				<section class="border-2 border-secondary-300 bg-neutral">
					<div class="p-4 border-b border-secondary-300 flex items-center justify-between gap-4">
						<div>
							<h2 class="text-xl font-bold font-serif text-neutral-950">{group.label}</h2>
							<p class="text-xs text-neutral-950 font-sans">
								{group.events.length} event{group.events.length === 1 ? '' : 's'}
							</p>
						</div>
					</div>

					<div class="divide-y divide-secondary-300">
						{#each group.events as event}
							<article class="p-4">
								<div class="grid grid-cols-1 xl:grid-cols-[190px_1fr_auto] gap-4 xl:items-center">
									<div class="space-y-2">
										<div class="flex items-center gap-2 text-neutral-950">
											<IconClock class="w-4 h-4" />
											<p class="text-sm font-bold font-sans">
												{formatTimeRange(event.scheduledStartAt, event.scheduledEndAt)}
											</p>
										</div>
										{#if event.roundLabel || event.weekNumber !== null}
											<p class="text-xs text-neutral-950 font-sans">
												{#if event.roundLabel}
													{event.roundLabel}
												{/if}
												{#if event.roundLabel && event.weekNumber !== null}
													<span> - </span>
												{/if}
												{#if event.weekNumber !== null}
													Week {event.weekNumber}
												{/if}
											</p>
										{/if}
									</div>

									<div class="space-y-1">
										<p class="text-base font-bold text-neutral-950 font-serif">{event.matchup}</p>
										<p class="text-sm text-neutral-950 font-sans">
											{event.sportName} - {event.leagueName} - {event.divisionName}
										</p>
										<p class="text-sm text-neutral-950 font-sans">{event.location}</p>
										{#if event.notes}
											<p class="text-xs text-neutral-950 font-sans">{event.notes}</p>
										{/if}
									</div>

									<div class="flex flex-wrap items-center gap-2 xl:justify-end">
										{#if event.score}
											<span
												class="border border-secondary-300 bg-secondary-500 text-secondary-25 px-2 py-1 text-xs font-bold"
											>
												{event.score}
											</span>
										{/if}
										{#if event.isPostseason}
											<span
												class="border border-primary-500 text-primary-700 px-2 py-1 text-xs font-bold"
											>
												POSTSEASON
											</span>
										{/if}
										<span
											class={`border px-2 py-1 text-xs font-bold ${statusBadgeClass(event.status)}`}
										>
											{event.statusLabel}
										</span>
									</div>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
