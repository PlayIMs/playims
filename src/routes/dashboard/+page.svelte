<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		IconLayoutDashboard,
		IconCalendar,
		IconLivePhoto,
		IconUsers,
		IconUsersGroup,
		IconBallAmericanFootball,
		IconPlayerPlay,
		IconBuildingStadium,
		IconTrophy,
		IconPin,
		IconSpeakerphone,
		IconTargetArrow,
		IconArrowRight
	} from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import DashboardCreateSeasonWizard from './DashboardCreateSeasonWizard.svelte';
	import { buildDashboardSeasonActionOptions } from './dashboard-season-actions';
	import ManageSeasonWizard from './offerings/_wizards/ManageSeasonWizard.svelte';
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
	let alerts = $derived(data.alerts ?? []);
	let currentSeason = $derived(data.currentSeason ?? null);
	let seasonHistory = $derived(data.seasonHistory ?? []);
	let registrationDeadlines = $derived(data.registrationDeadlines ?? []);
	let liveGames = $derived(todaysEvents.filter((g) => g.status === 'in_progress'));
	const DASHBOARD_DATE_SEPARATOR = '\u2013';
	const activityLinkClass =
		'font-semibold text-secondary-700 underline decoration-secondary-400 underline-offset-2 hover:text-secondary-900';
	const SEASON_ACTION_SPLIT_BUTTON_CLASS =
		'button-primary-outlined h-[1.875rem] px-2 text-xs font-bold uppercase tracking-wide cursor-pointer';
	const SEASON_ACTION_SPLIT_MENU_BUTTON_CLASS =
		'button-primary-outlined -ml-[2px] h-[1.875rem] px-1 cursor-pointer';
	let isCreateSeasonModalOpen = $state(false);
	let isManageSeasonModalOpen = $state(false);

	let scheduleFilter = $state<'all' | 'in_progress' | 'scheduled' | 'completed'>('all');
	let filteredEvents = $derived(
		scheduleFilter === 'all'
			? todaysEvents
			: scheduleFilter === 'scheduled'
				? todaysEvents.filter((g) => !g.status || g.status === 'scheduled')
				: todaysEvents.filter((g) => g.status === scheduleFilter)
	);

	let lastPageError = $state('');
	$effect(() => {
		const message = (data?.error ?? '').trim();
		if (!message) {
			lastPageError = '';
			return;
		}
		if (message === lastPageError) return;
		lastPageError = message;
		toast.error(message, {
			id: 'dashboard-page-error',
			title: pageLabel,
			duration: null,
			showProgress: false
		});
	});

	const hasAnyData = $derived(
		(data.stats?.totalUsers ?? 0) > 0 ||
			(data.stats?.totalTeams ?? 0) > 0 ||
			(data.stats?.totalLeagues ?? 0) > 0 ||
			todaysEvents.length > 0
	);
	const canManageOfferings = $derived(data.permissions?.MANAGE_OFFERINGS === true);
	const shouldShowProminentCurrentSeason = $derived(currentSeason !== null || canManageOfferings);
	const selectedManageSeasonId = $derived.by(
		() => currentSeason?.id ?? seasonHistory.find((season) => season.isCurrent)?.id ?? seasonHistory[0]?.id ?? ''
	);
	const seasonActionOptions = $derived.by(() =>
		canManageOfferings
			? buildDashboardSeasonActionOptions({ hasSeasonHistory: seasonHistory.length > 0 })
			: []
	);

	function openManageSeasonWizard(): void {
		if (!canManageOfferings || seasonHistory.length === 0) return;
		isManageSeasonModalOpen = true;
	}

	function openCreateSeasonWizard(): void {
		if (!canManageOfferings) return;
		isCreateSeasonModalOpen = true;
	}

	function closeCreateSeasonWizard(): void {
		isCreateSeasonModalOpen = false;
	}

	function closeManageSeasonWizard(): void {
		isManageSeasonModalOpen = false;
	}

	async function handleCreateSeasonSaved(
		event: CustomEvent<{ selectedSeasonId: string }>
	): Promise<void> {
		void event;
		isCreateSeasonModalOpen = false;
		await invalidateAll();
	}

	async function handleManageSeasonSaved(
		_event: CustomEvent<{ selectedSeasonId?: string | null }>
	): Promise<void> {
		await invalidateAll();
	}

	function handleSeasonPrimaryAction(): void {
		if (!canManageOfferings) return;
		if (seasonHistory.length > 0) {
			openManageSeasonWizard();
			return;
		}
		openCreateSeasonWizard();
	}

	function handleSeasonAction(value: string): void {
		if (!canManageOfferings) return;
		if (value === 'manage-seasons') {
			openManageSeasonWizard();
			return;
		}
		if (value === 'create-season') {
			openCreateSeasonWizard();
		}
	}
</script>

<PageTitle pageTitle={pageLabel} />

<svelte:head>
	<meta
		name="description"
		content="Manage your intramural sports leagues, view today's schedule, track live games, and monitor team standings."
	/>
	<meta name="robots" content="noindex, follow" />
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
						<IconLayoutDashboard class="w-7 h-7 lg:w-8 lg:h-8" />
					</div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950">
						{pageLabel}
					</h1>
				</div>
				<DashboardSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-3">
		{#if liveGames.length > 0}
			<div
				class="border-2 border-primary-500 bg-primary-50 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1"
			>
				<div class="flex items-center gap-2 shrink-0">
					<IconLivePhoto class="w-4 h-4 text-primary-600 animate-pulse" />
					<span class="text-[11px] font-bold uppercase tracking-wide text-primary-700 font-sans">
						{liveGames.length} Live
					</span>
				</div>
				{#each liveGames as game}
					<span class="text-xs text-primary-800 border-l border-primary-300 pl-3 font-sans">
						{game.matchup}
						{#if game.score}
							<span class="font-bold ml-1">{game.score}</span>
						{/if}
					</span>
				{/each}
			</div>
		{/if}

		{#if shouldShowProminentCurrentSeason}
			<section class="border-2 border-neutral-950 bg-neutral">
				<div
					class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-2"
				>
						<h2 class="text-sm font-bold font-serif text-neutral-950">Current Season</h2>
						{#if canManageOfferings}
							<SplitAddAction
								label="Manage"
								options={seasonActionOptions}
								align="right"
								ariaLabel="Manage seasons"
								buttonClass={SEASON_ACTION_SPLIT_BUTTON_CLASS}
								menuButtonClass={SEASON_ACTION_SPLIT_MENU_BUTTON_CLASS}
								listClass="w-64"
								on:click={handleSeasonPrimaryAction}
								on:action={(event) => {
									handleSeasonAction(event.detail.value);
								}}
							/>
					{:else}
						<a
							href="/dashboard/offerings"
							class="text-[10px] font-bold uppercase tracking-wide text-secondary-700 hover:text-secondary-900"
						>
							Offerings &rarr;
						</a>
					{/if}
				</div>
				<div class="p-4 space-y-3">
					{#if currentSeason}
						<div class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
							<div class="min-w-0">
								<p class="text-2xl font-bold font-serif text-neutral-950">
									{currentSeason.name}
								</p>
								<p class="mt-1 text-sm text-neutral-950 font-sans">
									<DateHoverText
										display={`${currentSeason.startLabel ?? 'TBD'}${currentSeason.endLabel ? ` ${DASHBOARD_DATE_SEPARATOR} ${currentSeason.endLabel}` : ''}`}
										value={currentSeason.startDate ?? currentSeason.startLabel ?? 'TBD'}
										endValue={currentSeason.endDate ?? undefined}
										includeTime={false}
										maxWidthClass="max-w-[32rem]"
									/>
								</p>
							</div>

							<div class="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
								<div class="border border-neutral-300 bg-white px-3 py-2">
									<p class="text-[10px] font-bold uppercase tracking-wide text-neutral-600 font-sans">
										Offerings
									</p>
									<p class="mt-1 text-lg font-bold font-serif text-neutral-950">
										{currentSeason.offeringCount}
									</p>
								</div>
								<div class="border border-neutral-300 bg-white px-3 py-2">
									<p class="text-[10px] font-bold uppercase tracking-wide text-neutral-600 font-sans">
										Teams
									</p>
									<p class="mt-1 text-lg font-bold font-serif text-neutral-950">
										{currentSeason.teamCount}
									</p>
								</div>
								<div class="border border-neutral-300 bg-white px-3 py-2">
									<p class="text-[10px] font-bold uppercase tracking-wide text-neutral-600 font-sans">
										Players
									</p>
									<p class="mt-1 text-lg font-bold font-serif text-neutral-950">
										{currentSeason.playerCount}
									</p>
								</div>
								<div class="border border-neutral-300 bg-white px-3 py-2">
									<p class="text-[10px] font-bold uppercase tracking-wide text-neutral-600 font-sans">
										Leagues
									</p>
									<p class="mt-1 text-lg font-bold font-serif text-neutral-950">
										{currentSeason.leagueCount}
									</p>
								</div>
								<div class="border border-neutral-300 bg-white px-3 py-2">
									<p class="text-[10px] font-bold uppercase tracking-wide text-neutral-600 font-sans">
										Divisions
									</p>
									<p class="mt-1 text-lg font-bold font-serif text-neutral-950">
										{currentSeason.divisionCount}
									</p>
								</div>
							</div>
						</div>
					{:else}
						<div class="min-w-0">
							<p class="text-2xl font-bold font-serif text-neutral-950">No Current Season</p>
							<p class="mt-1 text-sm text-neutral-700 font-sans">
								Choose which season should be current or create a new one to get started.
							</p>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		{#if !hasAnyData && !currentSeason}
			<div class="border-2 border-neutral-950 bg-neutral-100 p-4 flex items-center gap-4">
				<div class="bg-neutral-950 text-white p-2 shrink-0" aria-hidden="true">
					<IconTrophy class="w-5 h-5" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-bold text-neutral-950 font-sans">Welcome to PlayIMs</p>
					<p class="text-xs text-neutral-950 font-sans">
						Create your first season and add offerings to get started.
					</p>
				</div>
				<a
					href="/dashboard/offerings"
					class="border border-neutral-950 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-950 shrink-0 cursor-pointer inline-flex items-center gap-1.5 hover:bg-neutral-100"
				>
					Get Started
					<IconArrowRight class="w-3.5 h-3.5" />
				</a>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<section class="border-2 border-neutral-950 bg-neutral">
			<div
				class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-2"
			>
				<h2 class="text-sm font-bold font-serif text-neutral-950">Today's Games</h2>
				<div class="flex items-center gap-1" role="radiogroup" aria-label="Filter games">
					{#each [{ id: 'all', label: 'All' }, { id: 'in_progress', label: 'Live' }, { id: 'scheduled', label: 'Sched' }, { id: 'completed', label: 'Final' }] as opt}
						<button
							type="button"
							role="radio"
							aria-checked={scheduleFilter === opt.id}
							class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide cursor-pointer {scheduleFilter ===
							opt.id
								? opt.id === 'in_progress'
									? 'bg-primary-500 text-white'
									: 'bg-secondary-500 text-white'
								: 'text-neutral-700 hover:text-neutral-950'}"
							onclick={() => {
								scheduleFilter = opt.id as typeof scheduleFilter;
							}}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
			{#if filteredEvents.length > 0}
				<div class="divide-y divide-neutral-300 max-h-[260px] overflow-y-auto">
					{#each filteredEvents as game}
						<div class="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-white/50">
							<span class="w-16 shrink-0 font-semibold text-neutral-950 font-sans tabular-nums">
								{game.time}
							</span>
							<span class="flex-1 min-w-0 truncate text-neutral-950 font-sans">
								{game.matchup}
							</span>
							{#if game.score}
								<span class="shrink-0 font-bold text-neutral-950 font-sans tabular-nums">
									{game.score}
								</span>
							{/if}
							{#if game.status === 'in_progress'}
								<span
									class="bg-primary-500 text-white px-1.5 py-px text-[10px] font-bold shrink-0 inline-flex items-center gap-1"
								>
									<span class="w-1.5 h-1.5 bg-white animate-pulse" style="border-radius:50%"
									></span>
									LIVE
								</span>
							{:else if game.status === 'completed'}
								<span
									class="border border-secondary-300 text-neutral-700 px-1.5 py-px text-[10px] font-bold shrink-0"
								>
									FINAL
								</span>
							{:else}
								<span
									class="border border-secondary-400 text-secondary-600 px-1.5 py-px text-[10px] font-bold shrink-0"
								>
									{game.time === 'TBD' ? 'TBD' : 'SCHED'}
								</span>
							{/if}
						</div>
					{/each}
				</div>
				<a
					href="/dashboard/schedule"
					class="block px-3 py-1.5 border-t border-neutral-950 bg-neutral-600/33 text-[10px] font-bold uppercase tracking-wide text-secondary-700 hover:text-secondary-900 text-right"
				>
					Full Schedule &rarr;
				</a>
			{:else}
				<div class="px-3 py-4 text-xs text-neutral-600 font-sans text-center">
					{scheduleFilter === 'all'
						? 'No games today.'
						: `No ${scheduleFilter === 'in_progress' ? 'live' : scheduleFilter} games.`}
					<a
						href="/dashboard/schedule"
						class="text-secondary-700 hover:text-secondary-900 font-bold ml-1"
					>
						View schedule
					</a>
				</div>
			{/if}
			</section>

			<section class="border-2 border-neutral-950 bg-neutral">
				<div
					class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
				>
					<h2 class="text-sm font-bold font-serif text-neutral-950">Recent Activity</h2>
					<span class="text-[10px] uppercase tracking-wider font-bold text-neutral-700 font-sans">
						Latest
					</span>
				</div>
				{#if data.recentActivity && data.recentActivity.length > 0}
					<div class="divide-y divide-neutral-300 max-h-[260px] overflow-y-auto">
						{#each data.recentActivity as activity}
							<div class="px-3 py-2 flex items-start gap-2 text-xs hover:bg-white/50">
								<div class="text-secondary-500 shrink-0" aria-hidden="true">
									<IconPlayerPlay class="w-3.5 h-3.5" />
								</div>
								<div class="flex-1 min-w-0 text-neutral-950 font-sans leading-5">
									{#if activity.type === 'team_registered'}
										<span>
											{#if activity.creator}
												<a href={activity.creator.href} class={activityLinkClass}>
													{activity.creator.label}
												</a>
											{:else}
												Someone
											{/if}
											{' '}registered team{' '}
											{#if activity.team}
												<a href={activity.team.href} class={activityLinkClass}>
													{activity.team.label}
												</a>
											{:else}
												a team
											{/if}
											{' '}for{' '}
											{#if activity.league}
												<a href={activity.league.href} class={activityLinkClass}>
													{activity.league.label}
												</a>
											{:else}
												a league
											{/if}
											{' '}
											{#if activity.offering}
												<a href={activity.offering.href} class={activityLinkClass}>
													{activity.offering.label}
												</a>
											{:else}
												an offering
											{/if}
											{' '}in{' '}
											{#if activity.division}
												<a href={activity.division.href} class={activityLinkClass}>
													{activity.division.label}
												</a>
											{:else}
												a division
											{/if}
											.
										</span>
									{/if}
								</div>
								<span class="text-[10px] text-neutral-700 font-sans font-medium shrink-0">
									<DateHoverText
										display={activity.time}
										value={activity.timeValue ?? activity.time}
										includeTime={true}
									/>
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="px-3 py-3 text-xs text-neutral-600 font-sans text-center">
						No recent activity.
					</div>
				{/if}
			</section>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
			<section class="border-2 border-neutral-950 bg-neutral">
				<div
					class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
				>
					<h2 class="text-sm font-bold font-serif text-neutral-950">This Week</h2>
					<span class="text-[10px] uppercase tracking-wider font-bold text-neutral-700 font-sans">
						Next 7 Days
					</span>
				</div>
				{#if upcomingEvents.length > 0}
					<div class="divide-y divide-neutral-300 max-h-[200px] overflow-y-auto">
						{#each upcomingEvents as game}
							<div class="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-white/50">
								<span class="w-20 shrink-0 text-neutral-700 font-sans">
									<DateHoverText
										display={game.date}
										value={game.scheduledStartAt ?? game.date}
										includeTime={false}
									/>
								</span>
								<span class="w-14 shrink-0 font-semibold text-neutral-950 font-sans tabular-nums">
									{game.time}
								</span>
								<span class="flex-1 min-w-0 truncate text-neutral-950 font-sans">
									{game.matchup}
								</span>
								<span class="shrink-0 text-neutral-500 font-sans hidden sm:inline truncate max-w-20">
									{game.sport}
								</span>
							</div>
						{/each}
					</div>
					<a
						href="/dashboard/schedule"
						class="block px-3 py-1.5 border-t border-neutral-950 bg-neutral-600/33 text-[10px] font-bold uppercase tracking-wide text-secondary-700 hover:text-secondary-900 text-right"
					>
						Full Schedule &rarr;
					</a>
				{:else}
					<div class="px-3 py-4 text-xs text-neutral-600 font-sans text-center">
						No upcoming games.
						<a
							href="/dashboard/offerings"
							class="text-secondary-700 hover:text-secondary-900 font-bold ml-1"
						>
							Set up leagues
						</a>
					</div>
				{/if}
			</section>

			<div class="space-y-3">
				{#if pendingActions > 0}
					<section class="border-2 border-neutral-950 bg-neutral-100">
						<div class="px-3 py-2 flex items-center justify-between gap-3">
							<div class="flex items-center gap-2">
								<div
									class="bg-neutral-950 text-white w-7 h-7 flex items-center justify-center font-bold text-sm font-serif shrink-0"
								>
									{pendingActions}
								</div>
								<div>
									<p class="text-xs font-bold text-neutral-950 font-sans">Pending Actions</p>
									<p class="text-[10px] text-neutral-700 font-sans">Roster requests need review</p>
								</div>
							</div>
							<a
								href="/dashboard/members"
								class="border border-neutral-950 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-950 shrink-0 cursor-pointer hover:bg-neutral-100"
							>
								Review
							</a>
						</div>
					</section>
				{/if}

				{#if registrationDeadlines.length > 0}
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="text-sm font-bold font-serif text-neutral-950">Reg. Deadlines</h2>
							<span class="text-[10px] uppercase tracking-wider font-bold text-neutral-700 font-sans">
								Closing Soon
							</span>
						</div>
						<div class="divide-y divide-neutral-300">
							{#each registrationDeadlines as deadline}
								<div class="px-3 py-2 flex items-center justify-between gap-2">
									<div class="min-w-0">
										<p class="text-xs font-semibold text-neutral-950 font-sans truncate">
											{deadline.leagueName}
										</p>
										<p class="text-[10px] text-neutral-600 font-sans">
											{deadline.offeringName}
										</p>
									</div>
									<span
										class="text-[10px] font-bold text-neutral-700 font-sans uppercase tracking-wide shrink-0"
									>
										{deadline.regEndLabel}
									</span>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if !currentSeason && registrationDeadlines.length === 0 && pendingActions === 0 && !canManageOfferings}
					<section class="border-2 border-neutral-950 bg-neutral">
						<div class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66">
							<h2 class="text-sm font-bold font-serif text-neutral-950">Season & Actions</h2>
						</div>
						<div class="px-3 py-4 text-xs text-neutral-600 font-sans text-center">
							No active season.
							<a
								href="/dashboard/offerings"
								class="text-secondary-700 hover:text-secondary-900 font-bold ml-1"
							>
								Create one
							</a>
						</div>
					</section>
				{/if}
			</div>

			<div class="space-y-3">
				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="text-sm font-bold font-serif text-neutral-950">Announcements</h2>
							{#if alerts.length > 0}
								<span class="bg-primary text-white text-[10px] font-bold px-1.5 py-px">
									{alerts.length}
								</span>
							{/if}
						</div>
						{#if alerts.length > 0}
							<div class="divide-y divide-neutral-300 max-h-[180px] overflow-y-auto">
								{#each alerts as alert}
									<div class="px-3 py-2">
										<div class="flex items-start gap-2">
											<div
												class="mt-0.5 shrink-0 {alert.priority === 'high'
													? 'text-primary-600'
													: 'text-secondary-500'}"
												aria-hidden="true"
											>
												{#if alert.priority === 'high'}
													<IconPin class="w-3.5 h-3.5" />
												{:else}
													<IconSpeakerphone class="w-3.5 h-3.5" />
												{/if}
											</div>
											<div class="min-w-0 flex-1">
												<p class="text-xs font-bold text-neutral-950 font-sans leading-tight">
													{alert.title ?? 'Announcement'}
												</p>
												{#if alert.message}
													<p class="text-[10px] text-neutral-600 font-sans mt-0.5 line-clamp-1">
														{alert.message}
													</p>
												{/if}
											</div>
											<span class="text-[10px] text-neutral-500 font-sans shrink-0">
												{alert.date}
											</span>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="px-3 py-3 text-xs text-neutral-600 font-sans text-center">
								No announcements.
							</div>
						{/if}
					</section>

				</div>
			</div>
		</div>
	</div>
</div>

<DashboardCreateSeasonWizard
	open={isCreateSeasonModalOpen}
	seasons={seasonHistory}
	on:close={closeCreateSeasonWizard}
	on:saved={(event) => {
		void handleCreateSeasonSaved(event);
	}}
/>

<ManageSeasonWizard
	open={isManageSeasonModalOpen}
	seasons={seasonHistory}
	selectedSeasonId={selectedManageSeasonId}
	canDuplicate={false}
	on:close={closeManageSeasonWizard}
	on:saved={(event) => {
		void handleManageSeasonSaved(event);
	}}
/>
