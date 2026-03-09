<script lang="ts">
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
	let alerts = $derived(data.alerts ?? []);
	let currentSeason = $derived(data.currentSeason ?? null);
	let registrationDeadlines = $derived(data.registrationDeadlines ?? []);
	let liveGames = $derived(todaysEvents.filter((g) => g.status === 'in_progress'));

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
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950"
				>
					{pageLabel}
				</h1>
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
					<span
						class="text-[11px] font-bold uppercase tracking-wide text-primary-700 font-sans"
					>
						{liveGames.length} Live
					</span>
				</div>
				{#each liveGames as game}
					<span
						class="text-xs text-primary-800 border-l border-primary-300 pl-3 font-sans"
					>
						{game.matchup}
						{#if game.score}
							<span class="font-bold ml-1">{game.score}</span>
						{/if}
					</span>
				{/each}
			</div>
		{/if}

		<div
			class="border-2 border-neutral-950 bg-white grid grid-cols-3 md:grid-cols-6"
			role="region"
			aria-label="Key statistics"
		>
			<div
				class="px-2 py-2.5 text-center border-r border-neutral-200 {(data.stats?.liveGames ?? 0) > 0 ? 'bg-primary-50' : ''}"
			>
				<p
					class="text-2xl font-bold font-serif {(data.stats?.liveGames ?? 0) > 0 ? 'text-primary-700' : 'text-neutral-950'}"
				>
					{data.stats?.liveGames ?? 0}
				</p>
				<p
					class="text-[10px] uppercase tracking-wider font-bold {(data.stats?.liveGames ?? 0) > 0 ? 'text-primary-600' : 'text-neutral-600'} font-sans"
				>
					Live
				</p>
			</div>
			<div class="px-2 py-2.5 text-center border-r border-neutral-200">
				<p class="text-2xl font-bold font-serif text-neutral-950">
					{data.stats?.gamesToday ?? 0}
				</p>
				<p
					class="text-[10px] uppercase tracking-wider font-bold text-neutral-600 font-sans"
				>
					Today
				</p>
			</div>
			<div
				class="px-2 py-2.5 text-center border-r border-neutral-200 max-md:border-r-0"
			>
				<p class="text-2xl font-bold font-serif text-neutral-950">
					{data.stats?.totalUsers ?? 0}
				</p>
				<p
					class="text-[10px] uppercase tracking-wider font-bold text-neutral-600 font-sans"
				>
					Players
				</p>
			</div>
			<div
				class="px-2 py-2.5 text-center border-r border-neutral-200 max-md:border-t max-md:border-neutral-200"
			>
				<p class="text-2xl font-bold font-serif text-neutral-950">
					{data.stats?.totalTeams ?? 0}
				</p>
				<p
					class="text-[10px] uppercase tracking-wider font-bold text-neutral-600 font-sans"
				>
					Teams
				</p>
			</div>
			<div
				class="px-2 py-2.5 text-center border-r border-neutral-200 max-md:border-t max-md:border-neutral-200"
			>
				<p class="text-2xl font-bold font-serif text-neutral-950">
					{data.stats?.totalLeagues ?? 0}
				</p>
				<p
					class="text-[10px] uppercase tracking-wider font-bold text-neutral-600 font-sans"
				>
					Leagues
				</p>
			</div>
			<div
				class="px-2 py-2.5 text-center max-md:border-t max-md:border-neutral-200"
			>
				<p class="text-2xl font-bold font-serif text-neutral-950">
					{data.stats?.totalFacilities ?? 0}
				</p>
				<p
					class="text-[10px] uppercase tracking-wider font-bold text-neutral-600 font-sans"
				>
					Venues
				</p>
			</div>
		</div>

		{#if !hasAnyData && !currentSeason}
			<div class="border-2 border-accent-500 bg-accent-50 p-4 flex items-center gap-4">
				<div class="bg-accent text-white p-2 shrink-0" aria-hidden="true">
					<IconTrophy class="w-5 h-5" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-bold text-neutral-950 font-sans">
						Welcome to PlayIMs
					</p>
					<p class="text-xs text-neutral-950 font-sans">
						Create your first season and add offerings to get started.
					</p>
				</div>
				<a
					href="/dashboard/offerings"
					class="button-accent px-3 py-2 text-xs font-bold uppercase tracking-wide shrink-0 cursor-pointer inline-flex items-center gap-1.5"
				>
					Get Started
					<IconArrowRight class="w-3.5 h-3.5" />
				</a>
			</div>
		{/if}

		<div
			class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start"
		>
			<div class="space-y-3">
				<section class="border-2 border-neutral-950 bg-neutral">
					<div
						class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between gap-2"
					>
						<h2 class="text-sm font-bold font-serif text-neutral-950">
							Today's Games
						</h2>
						<div class="flex items-center gap-1" role="radiogroup" aria-label="Filter games">
							{#each [{ id: 'all', label: 'All' }, { id: 'in_progress', label: 'Live' }, { id: 'scheduled', label: 'Sched' }, { id: 'completed', label: 'Final' }] as opt}
								<button
									type="button"
									role="radio"
									aria-checked={scheduleFilter === opt.id}
									class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide cursor-pointer {scheduleFilter === opt.id
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
								<div
									class="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-white/50"
								>
									<span
										class="w-16 shrink-0 font-semibold text-neutral-950 font-sans tabular-nums"
									>
										{game.time}
									</span>
									<span
										class="flex-1 min-w-0 truncate text-neutral-950 font-sans"
									>
										{game.matchup}
									</span>
									{#if game.score}
										<span
											class="shrink-0 font-bold text-neutral-950 font-sans tabular-nums"
										>
											{game.score}
										</span>
									{/if}
									{#if game.status === 'in_progress'}
										<span
											class="bg-primary-500 text-white px-1.5 py-px text-[10px] font-bold shrink-0 inline-flex items-center gap-1"
										>
											<span
												class="w-1.5 h-1.5 bg-white animate-pulse"
												style="border-radius:50%"
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
						<h2 class="text-sm font-bold font-serif text-neutral-950">This Week</h2>
						<span
							class="text-[10px] uppercase tracking-wider font-bold text-neutral-700 font-sans"
						>
							Next 7 Days
						</span>
					</div>
					{#if upcomingEvents.length > 0}
						<div class="divide-y divide-neutral-300 max-h-[200px] overflow-y-auto">
							{#each upcomingEvents as game}
								<div
									class="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-white/50"
								>
									<span
										class="w-20 shrink-0 text-neutral-700 font-sans"
									>
										<DateHoverText
											display={game.date}
											value={game.scheduledStartAt ?? game.date}
											includeTime={false}
										/>
									</span>
									<span
										class="w-14 shrink-0 font-semibold text-neutral-950 font-sans tabular-nums"
									>
										{game.time}
									</span>
									<span
										class="flex-1 min-w-0 truncate text-neutral-950 font-sans"
									>
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
			</div>

			<div class="space-y-3">
				{#if currentSeason}
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="text-sm font-bold font-serif text-neutral-950">
								Current Season
							</h2>
							<a
								href="/dashboard/offerings"
								class="text-[10px] font-bold uppercase tracking-wide text-secondary-700 hover:text-secondary-900"
							>
								Offerings &rarr;
							</a>
						</div>
						<div class="p-3">
							<div class="flex items-center gap-2 mb-2">
								<div class="bg-accent text-white p-1.5 shrink-0" aria-hidden="true">
									<IconTrophy class="w-3.5 h-3.5" />
								</div>
								<p class="text-base font-bold font-serif text-neutral-950">
									{currentSeason.name}
								</p>
							</div>
							<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-950 font-sans">
								{#if currentSeason.startLabel}
									<span>
										{currentSeason.startLabel}{currentSeason.endLabel ? ` – ${currentSeason.endLabel}` : ''}
									</span>
								{/if}
								<span class="font-semibold">
									{currentSeason.offeringCount} offering{currentSeason.offeringCount !== 1 ? 's' : ''}
								</span>
								<span class="font-semibold">
									{currentSeason.leagueCount} league{currentSeason.leagueCount !== 1 ? 's' : ''}
								</span>
							</div>
						</div>
					</section>
				{/if}

				{#if pendingActions > 0}
					<section class="border-2 border-accent-500 bg-accent-50">
						<div class="px-3 py-2 flex items-center justify-between gap-3">
							<div class="flex items-center gap-2">
								<div
									class="bg-accent text-white w-7 h-7 flex items-center justify-center font-bold text-sm font-serif shrink-0"
								>
									{pendingActions}
								</div>
								<div>
									<p class="text-xs font-bold text-neutral-950 font-sans">
										Pending Actions
									</p>
									<p class="text-[10px] text-neutral-700 font-sans">
										Roster requests need review
									</p>
								</div>
							</div>
							<a
								href="/dashboard/members"
								class="button-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shrink-0 cursor-pointer"
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
							<h2 class="text-sm font-bold font-serif text-neutral-950">
								Reg. Deadlines
							</h2>
							<span
								class="text-[10px] uppercase tracking-wider font-bold text-neutral-700 font-sans"
							>
								Closing Soon
							</span>
						</div>
						<div class="divide-y divide-neutral-300">
							{#each registrationDeadlines as deadline}
								<div class="px-3 py-2 flex items-center justify-between gap-2">
									<div class="min-w-0">
										<p
											class="text-xs font-semibold text-neutral-950 font-sans truncate"
										>
											{deadline.leagueName}
										</p>
										<p class="text-[10px] text-neutral-600 font-sans">
											{deadline.offeringName}
										</p>
									</div>
									<span
										class="text-[10px] font-bold text-accent-700 font-sans uppercase tracking-wide shrink-0"
									>
										{deadline.regEndLabel}
									</span>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if !currentSeason && registrationDeadlines.length === 0 && pendingActions === 0}
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66"
						>
							<h2 class="text-sm font-bold font-serif text-neutral-950">
								Season & Actions
							</h2>
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

			<div
				class="lg:col-span-2 xl:col-span-1 space-y-3 xl:space-y-3"
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="text-sm font-bold font-serif text-neutral-950">
								Announcements
							</h2>
							{#if alerts.length > 0}
								<span
									class="bg-primary text-white text-[10px] font-bold px-1.5 py-px"
								>
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
												class="mt-0.5 shrink-0 {alert.priority === 'high' ? 'text-primary-600' : 'text-secondary-500'}"
												aria-hidden="true"
											>
												{#if alert.priority === 'high'}
													<IconPin class="w-3.5 h-3.5" />
												{:else}
													<IconSpeakerphone class="w-3.5 h-3.5" />
												{/if}
											</div>
											<div class="min-w-0 flex-1">
												<p
													class="text-xs font-bold text-neutral-950 font-sans leading-tight"
												>
													{alert.title ?? 'Announcement'}
												</p>
												{#if alert.message}
													<p
														class="text-[10px] text-neutral-600 font-sans mt-0.5 line-clamp-1"
													>
														{alert.message}
													</p>
												{/if}
											</div>
											<span
												class="text-[10px] text-neutral-500 font-sans shrink-0"
											>
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

					<section class="border-2 border-neutral-950 bg-neutral">
						<div
							class="px-3 py-2 border-b border-neutral-950 bg-neutral-600/66 flex items-center justify-between"
						>
							<h2 class="text-sm font-bold font-serif text-neutral-950">
								Recent Activity
							</h2>
							<span
								class="text-[10px] uppercase tracking-wider font-bold text-neutral-700 font-sans"
							>
								Latest
							</span>
						</div>
						{#if data.recentActivity && data.recentActivity.length > 0}
							<div
								class="divide-y divide-neutral-300 max-h-[180px] overflow-y-auto"
							>
								{#each data.recentActivity as activity}
									<div class="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-white/50">
										<div
											class="text-secondary-500 shrink-0"
											aria-hidden="true"
										>
											<IconPlayerPlay class="w-3.5 h-3.5" />
										</div>
										<span
											class="flex-1 min-w-0 truncate text-neutral-950 font-sans"
										>
											{activity.message}
										</span>
										<span class="text-[10px] text-neutral-500 font-sans shrink-0">
											<DateHoverText
												display={activity.time}
												value={activity.timeValue ?? activity.time}
												includeTime={false}
											/>
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<div
								class="px-3 py-3 text-xs text-neutral-600 font-sans text-center"
							>
								No recent activity.
							</div>
						{/if}
					</section>
				</div>
			</div>
		</div>
	</div>
</div>
