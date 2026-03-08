<script lang="ts">
	import {
		IconLayoutDashboard,
		IconCalendar,
		IconCalendarWeek,
		IconClock,
		IconLivePhoto,
		IconUsers,
		IconUsersGroup,
		IconBallAmericanFootball,
		IconAlertTriangle,
		IconPlayerPlay,
		IconPlus
	} from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';

	let { data } = $props();
	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).dashboard
	);

	let todaysEvents = $derived(data.todaysEvents ?? []);
	let upcomingEvents = $derived(data.upcomingEvents ?? []);
	let pendingActions = $derived(data.stats?.pendingActions ?? 0);
	let practicesToday = $derived(data.stats?.practicesToday ?? 0);
	let scheduleFilter = $state<'completed' | 'in_progress' | 'scheduled'>('in_progress');

	const filterOptions = [
		{
			id: 'completed',
			label: 'Completed',
			activeClass: 'button-secondary',
			inactiveClass: 'button-secondary-outlined'
		},
		{
			id: 'in_progress',
			label: 'Live',
			activeClass: 'button-primary',
			inactiveClass: 'button-primary-outlined'
		},
		{
			id: 'scheduled',
			label: 'Scheduled',
			activeClass: 'button-secondary',
			inactiveClass: 'button-secondary-outlined'
		}
	] as const;

	let filteredEvents = $derived(
		scheduleFilter === 'scheduled'
			? todaysEvents.filter((game) => !game.status || game.status === 'scheduled')
			: todaysEvents.filter((game) => game.status === scheduleFilter)
	);
	let activeFilterLabel = $derived(
		filterOptions.find((option) => option.id === scheduleFilter)?.label ?? 'Scheduled'
	);
	let lastPageError = $state('');

	$effect(() => {
		const message = (data?.error ?? '').trim();
		if (!message) {
			lastPageError = '';
			return;
		}

		if (message === lastPageError) {
			return;
		}

		lastPageError = message;
		toast.error(message, {
			id: 'dashboard-page-error',
			title: pageLabel,
			duration: null,
			showProgress: false
		});
	});
</script>

<svelte:head>
	<title>{pageLabel} - PlayIMs</title>
	<meta
		name="description"
		content="Manage your intramural sports leagues, view today's schedule, track live games, and monitor team standings."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<IconLayoutDashboard class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
					{pageLabel}
				</h1>
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-6">
		<div class="flex flex-wrap items-center gap-3">
			<a
				href="/dashboard/events/new"
				class="button-primary px-3 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
			>
				<IconPlus class="w-4 h-4" />
				<span>New Game</span>
			</a>
			<a
				href="/dashboard/teams/new"
				class="button-secondary px-3 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
			>
				<IconUsers class="w-4 h-4" />
				<span>Add Team</span>
			</a>
			<a
				href="/dashboard/schedule"
				class="button-secondary px-3 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
			>
				<IconCalendarWeek class="w-4 h-4" />
				<span>Schedule</span>
			</a>
		</div>

		<section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
			<div
				class="border-2 border-neutral-950 bg-neutral p-4 flex items-center justify-between gap-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Active Players</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">
						{data.stats?.totalUsers ?? 0}
					</p>
				</div>
				<div class="bg-secondary p-2" aria-hidden="true">
					<IconUsers class="w-6 h-6 text-white" />
				</div>
			</div>
			<div
				class="border-2 border-neutral-950 bg-neutral p-4 flex items-center justify-between gap-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Active Teams</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">
						{data.stats?.totalTeams ?? 0}
					</p>
				</div>
				<div class="bg-secondary p-2" aria-hidden="true">
					<IconUsersGroup class="w-6 h-6 text-white" />
				</div>
			</div>
			<div
				class="border-2 border-neutral-950 bg-neutral p-4 flex items-center justify-between gap-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Active Leagues</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">
						{data.stats?.totalLeagues ?? 0}
					</p>
				</div>
				<div class="bg-secondary p-2" aria-hidden="true">
					<IconBallAmericanFootball class="w-6 h-6 text-white" />
				</div>
			</div>
			<div
				class="border-2 border-neutral-950 bg-neutral p-4 flex items-center justify-between gap-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Games Today</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">
						{data.stats?.gamesToday ?? 0}
					</p>
				</div>
				<div class="bg-secondary p-2" aria-hidden="true">
					<IconCalendar class="w-6 h-6 text-white" />
				</div>
			</div>
			<div
				class="border-2 border-neutral-950 bg-neutral p-4 flex items-center justify-between gap-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Practices Today</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">
						{practicesToday}
					</p>
				</div>
				<div class="bg-secondary p-2" aria-hidden="true">
					<IconClock class="w-6 h-6 text-white" />
				</div>
			</div>
			<div
				class="border-2 border-primary-500 bg-neutral p-4 flex items-center justify-between gap-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wide text-primary-700 font-sans">Live Now</p>
					<p class="text-3xl font-bold text-primary-700 font-serif">
						{data.stats?.liveGames ?? 0}
					</p>
				</div>
				<div class="bg-primary p-2" aria-hidden="true">
					<IconLivePhoto class="w-6 h-6 text-white animate-pulse" />
				</div>
			</div>
		</section>

		<div class="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
			<div class="space-y-6">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="p-4 border-b border-neutral-950 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
					>
						<div>
							<h2 class="text-xl font-bold font-serif text-neutral-950">Today's Lineup</h2>
							<p class="text-xs text-neutral-950 font-sans">
								Track live games, completions, and scheduled starts.
							</p>
						</div>
						<div
							class="flex flex-wrap items-center gap-2"
							role="radiogroup"
							aria-label="Filter today's lineup"
						>
							{#each filterOptions as option}
								<button
									type="button"
									role="radio"
									aria-checked={scheduleFilter === option.id}
									class={`${scheduleFilter === option.id ? option.activeClass : option.inactiveClass} px-3 py-2 text-xs font-bold uppercase tracking-wide`}
									onclick={() => {
										scheduleFilter = option.id;
									}}
								>
									{option.label}
								</button>
							{/each}
							<a
								href={`/schedule?status=${encodeURIComponent(scheduleFilter)}`}
								class="px-1 py-2 text-xs font-bold uppercase tracking-wide text-secondary-500 hover:text-secondary-600"
							>
								View all ->
							</a>
						</div>
					</div>

					{#if filteredEvents.length > 0}
						<div class="divide-y divide-neutral-950">
							{#each filteredEvents as game}
								<div class="p-4">
									<div class="grid grid-cols-1 lg:grid-cols-[170px_1fr_auto] gap-4 items-center">
										<div class="flex items-center gap-3">
											<div class="bg-secondary p-2" aria-hidden="true">
												<IconClock class="w-5 h-5 text-white" />
											</div>
											<div>
												<p class="text-base font-bold text-neutral-950 font-serif">
													{game.time}
												</p>
												<p class="text-xs text-neutral-950 font-sans">
													<DateHoverText
														display={game.date}
														value={game.scheduledStartAt ?? game.date}
														includeTime={false}
													/>
												</p>
											</div>
										</div>
										<div>
											<p class="text-sm font-semibold text-neutral-950 font-sans">
												{game.matchup}
											</p>
											<p class="text-xs text-neutral-950 font-sans">
												{game.sport} - {game.location}
											</p>
										</div>
										<div class="flex items-center gap-2 justify-start lg:justify-end">
											{#if game.score}
												<span
													class="border border-secondary-300 bg-secondary-500 text-secondary-25 px-2 py-1 text-xs font-bold"
												>
													{game.score}
												</span>
											{/if}
											{#if game.status === 'in_progress'}
												<span class="bg-primary-500 text-white px-2 py-1 text-xs font-bold">
													LIVE
												</span>
											{:else if game.status === 'completed'}
												<span
													class="border border-secondary-300 text-neutral-950 px-2 py-1 text-xs font-bold"
												>
													FINAL
												</span>
											{:else}
												<span
													class="border border-secondary-500 text-secondary-700 px-2 py-1 text-xs font-bold"
												>
													UPCOMING
												</span>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-6 text-center">
							<div
								class="bg-secondary-500 text-secondary-25 w-14 h-14 flex items-center justify-center mx-auto mb-3"
							>
								<IconCalendar class="w-7 h-7" />
							</div>
							<p class="text-neutral-950 font-medium font-sans">
								No {activeFilterLabel.toLowerCase()} games for today.
							</p>
							<p class="text-neutral-950 text-xs mt-1 font-sans">
								Schedule a game or check back later.
							</p>
						</div>
					{/if}
				</section>

				<section class="border-2 border-neutral-950 bg-neutral">
					<div class="p-4 border-b border-neutral-950 flex items-center justify-between">
						<h2 class="text-xl font-bold font-serif text-neutral-950">This Week</h2>
						<span class="text-xs uppercase tracking-wide text-neutral-950 font-sans">
							Next 7 Days
						</span>
					</div>
					{#if upcomingEvents.length > 0}
						<div class="divide-y divide-neutral-950">
							{#each upcomingEvents as game}
								<div class="p-4">
									<div class="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-4 items-center">
										<div>
											<p class="text-xs text-neutral-950 font-sans uppercase tracking-wide">
												<DateHoverText
													display={game.date}
													value={game.scheduledStartAt ?? game.date}
													includeTime={false}
												/>
											</p>
											<p class="text-sm font-semibold text-neutral-950 font-sans">
												{game.time}
											</p>
										</div>
										<div>
											<p class="text-sm font-semibold text-neutral-950 font-sans">
												{game.matchup}
											</p>
											<p class="text-xs text-neutral-950 font-sans">
												{game.sport} - {game.location}
											</p>
										</div>
										<span class="text-xs text-neutral-950 font-sans">{game.sport}</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-6 text-center">
							<p class="text-neutral-950 font-medium font-sans">No upcoming games this week.</p>
							<p class="text-neutral-950 text-xs mt-1 font-sans">
								Add events to keep leagues moving.
							</p>
						</div>
					{/if}
				</section>
			</div>

			<aside class="space-y-6">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div class="p-4 border-b border-neutral-950 flex items-center justify-between">
						<h2 class="text-xl font-bold font-serif text-neutral-950">Recent Activity</h2>
						<span class="text-xs uppercase tracking-wide text-neutral-950 font-sans">Latest</span>
					</div>
					{#if data.recentActivity && data.recentActivity.length > 0}
						<div class="divide-y divide-neutral-950">
							{#each data.recentActivity as activity}
								<div class="p-4">
									<div class="flex items-center gap-3">
										<div class="bg-secondary p-2" aria-hidden="true">
											<IconPlayerPlay class="w-5 h-5 text-white" />
										</div>
										<div class="flex-1 min-w-0">
											<p class="text-sm text-neutral-950 font-sans truncate">
												{activity.message}
											</p>
											<p class="text-xs text-neutral-950 font-sans">
												<DateHoverText
													display={activity.time}
													value={activity.timeValue ?? activity.time}
													includeTime={false}
												/>
											</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-6 text-center">
							<p class="text-neutral-950 text-sm font-sans">No recent activity.</p>
						</div>
					{/if}
				</section>

				{#if pendingActions > 0}
					<section class="border-2 border-secondary-500 bg-secondary-100 p-4">
						<div class="flex items-center gap-4">
							<div
								class="bg-secondary-500 text-white w-12 h-12 flex items-center justify-center font-bold text-xl font-serif"
							>
								{pendingActions}
							</div>
							<div>
								<p class="font-bold text-neutral-950 font-sans">Pending Actions</p>
								<p class="text-sm text-neutral-950 font-sans">Items requiring attention.</p>
							</div>
						</div>
						<a
							href="/dashboard/rosters"
							class="mt-4 block w-full text-center border border-secondary-500 bg-neutral text-secondary-700 py-2 text-sm font-bold font-sans"
						>
							Review Now
						</a>
					</section>
				{/if}
			</aside>
		</div>
	</div>
</div>

