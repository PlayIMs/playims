<script lang="ts">
	import IconCalendar from '@tabler/icons-svelte/icons/calendar';
	import IconClock from '@tabler/icons-svelte/icons/clock';
	import IconLivePhoto from '@tabler/icons-svelte/icons/live-photo';
	import IconUsers from '@tabler/icons-svelte/icons/users';
	import IconTrophy from '@tabler/icons-svelte/icons/trophy';
	import IconBuilding from '@tabler/icons-svelte/icons/building';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconCheck from '@tabler/icons-svelte/icons/check';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	
	let { data } = $props();
	
	// Get current date
	const today = new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
</script>

<svelte:head>
	<title>Dashboard - PlayIMs</title>
	<meta name="description" content="Manage your intramural sports leagues, view today's schedule, track live games, and monitor team standings." />
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<header class="mb-8">
		<div class="flex justify-between items-start">
			<div>
				<h1 class="text-4xl font-bold font-serif text-neutral-950">Dashboard</h1>
				<p class="text-neutral-950 mt-2 font-sans">{today}</p>
			</div>
			<div class="flex gap-3">
				<a 
					href="/dashboard/events/new" 
					class="button-accent flex items-center gap-2"
				>
					<IconPlus class="w-5 h-5" />
					<span>New Game</span>
				</a>
				<a 
					href="/dashboard/teams/new" 
					class="button-secondary flex items-center gap-2"
				>
					<IconUsers class="w-5 h-5" />
					<span>Add Team</span>
				</a>
			</div>
		</div>
	</header>

	{#if data.error}
		<div class="bg-accent-100 border-2 border-accent text-accent-800 p-4 mb-8">
			<div class="flex items-center gap-3">
				<IconAlertTriangle class="w-6 h-6 text-accent" />
				<p class="font-sans">{data.error}</p>
			</div>
		</div>
	{/if}

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<!-- Total Players -->
		<div class="bg-neutral border-2 border-secondary p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-neutral-950 uppercase tracking-wide font-sans">Total Players</p>
					<p class="text-4xl font-bold text-neutral-950 mt-2 font-serif">{data.stats?.totalUsers || 0}</p>
				</div>
				<div class="bg-secondary p-3">
					<IconUsers class="w-8 h-8 text-white" />
				</div>
			</div>
		</div>

		<!-- Active Teams -->
		<div class="bg-neutral border-2 border-secondary p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-neutral-950 uppercase tracking-wide font-sans">Active Teams</p>
					<p class="text-4xl font-bold text-neutral-950 mt-2 font-serif">{data.stats?.totalTeams || 0}</p>
				</div>
				<div class="bg-secondary p-3">
					<IconTrophy class="w-8 h-8 text-white" />
				</div>
			</div>
		</div>

		<!-- Active Leagues -->
		<div class="bg-neutral border-2 border-secondary p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-neutral-950 uppercase tracking-wide font-sans">Active Leagues</p>
					<p class="text-4xl font-bold text-neutral-950 mt-2 font-serif">{data.stats?.totalLeagues || 0}</p>
				</div>
				<div class="bg-secondary p-3">
					<IconCalendar class="w-8 h-8 text-white" />
				</div>
			</div>
		</div>

		<!-- Facilities -->
		<div class="bg-neutral border-2 border-secondary p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-neutral-950 uppercase tracking-wide font-sans">Facilities</p>
					<p class="text-4xl font-bold text-neutral-950 mt-2 font-serif">{data.stats?.totalFacilities || 0}</p>
				</div>
				<div class="bg-secondary p-3">
					<IconBuilding class="w-8 h-8 text-white" />
				</div>
			</div>
		</div>
	</div>

	<!-- Today's Games Status -->
	<div class="grid grid-cols-3 gap-6 mb-8">
		<div class="bg-neutral border-2 border-secondary p-6">
			<div class="flex items-center gap-4">
				<div class="bg-secondary p-3">
					<IconCalendar class="w-6 h-6 text-white" />
				</div>
				<div>
					<p class="text-sm text-neutral-950 uppercase tracking-wide font-sans">Games Today</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">{data.stats?.gamesToday || 0}</p>
				</div>
			</div>
		</div>

		<div class="bg-neutral border-2 border-secondary p-6">
			<div class="flex items-center gap-4">
				<div class="bg-secondary p-3">
					<IconCheck class="w-6 h-6 text-white" />
				</div>
				<div>
					<p class="text-sm text-neutral-950 uppercase tracking-wide font-sans">Completed</p>
					<p class="text-3xl font-bold text-neutral-950 font-serif">{data.stats?.completedToday || 0}</p>
				</div>
			</div>
		</div>

		<div class="bg-neutral border-2 border-primary p-6">
			<div class="flex items-center gap-4">
				<div class="bg-primary p-3">
					<IconLivePhoto class="w-6 h-6 text-white animate-pulse" />
				</div>
				<div>
					<p class="text-sm text-primary uppercase tracking-wide font-sans font-semibold">Live Now</p>
					<p class="text-3xl font-bold text-primary font-serif">{data.stats?.liveGames || 0}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
		<!-- Today's Schedule -->
		<div class="lg:col-span-2">
			<div class="bg-neutral border-2 border-secondary">
				<div class="p-6 border-b-2 border-secondary flex justify-between items-center">
					<h2 class="text-2xl font-bold font-serif text-neutral-950">Today's Schedule</h2>
					<a href="/dashboard/events" class="text-accent hover:text-accent-700 font-medium font-sans flex items-center gap-1">
						View All
						<IconArrowRight class="w-4 h-4" />
					</a>
				</div>
				
				{#if data.todaysEvents && data.todaysEvents.length > 0}
					<div class="divide-y divide-secondary">
						{#each data.todaysEvents as game}
							<div class="p-6 hover:bg-neutral-100 transition-colors">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-6">
										<div class="text-center min-w-[80px]">
											<p class="text-xl font-bold text-neutral-950 font-serif">{game.time}</p>
										</div>
										<div class="w-px h-12 bg-secondary"></div>
										<div>
											<p class="text-lg font-medium text-neutral-950 font-sans">{game.matchup}</p>
											<p class="text-sm text-neutral-950 font-sans mt-1">{game.sport} • {game.location}</p>
										</div>
									</div>
									<div class="flex items-center gap-4">
										{#if game.score}
											<span class="bg-secondary text-white px-3 py-1 text-sm font-bold font-sans">
												{game.score}
											</span>
										{/if}
										{#if game.status === 'in_progress'}
											<span class="flex items-center gap-2 text-primary font-bold text-sm font-sans">
												<span class="w-2 h-2 bg-primary animate-pulse"></span>
												LIVE
											</span>
										{:else if game.status === 'completed'}
											<span class="text-neutral-950 font-medium text-sm font-sans">FINAL</span>
										{:else}
											<span class="text-accent font-medium text-sm font-sans">UPCOMING</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="p-12 text-center">
						<div class="bg-neutral-100 border-2 border-secondary w-20 h-20 flex items-center justify-center mx-auto mb-4">
							<IconCalendar class="w-10 h-10 text-neutral-600" />
						</div>
						<p class="text-neutral-950 font-medium font-sans">No games scheduled for today</p>
						<p class="text-neutral-950 text-sm mt-1 font-sans">Check back later for upcoming events</p>
					</div>
				{/if}
			</div>

			<!-- Upcoming Events -->
			{#if data.upcomingEvents && data.upcomingEvents.length > 0}
				<div class="bg-neutral border-2 border-secondary mt-6">
					<div class="p-6 border-b-2 border-secondary">
						<h2 class="text-xl font-bold font-serif text-neutral-950">This Week</h2>
					</div>
					<div class="divide-y divide-secondary">
						{#each data.upcomingEvents as game}
							<div class="p-4 hover:bg-neutral-100 transition-colors">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-4">
										<span class="text-sm text-neutral-950 font-sans min-w-[100px]">{game.date}</span>
										<span class="text-sm font-semibold text-neutral-950 font-sans">{game.time}</span>
										<span class="text-secondary">|</span>
										<span class="text-sm text-neutral-950 font-sans">{game.matchup}</span>
									</div>
									<span class="text-xs text-neutral-950 font-sans">{game.sport}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Alerts -->
			{#if data.alerts && data.alerts.length > 0}
				<div class="bg-neutral border-2 border-secondary">
					<div class="p-6 border-b-2 border-secondary flex items-center gap-3">
						<IconAlertTriangle class="w-6 h-6 text-accent" />
						<h2 class="text-xl font-bold font-serif text-neutral-950">Alerts</h2>
					</div>
					<div class="divide-y divide-secondary">
						{#each data.alerts as alert}
							<div class="p-6 hover:bg-neutral-100 transition-colors">
								<div class="flex items-start gap-4">
									{#if alert.priority === 'high'}
										<div class="w-3 h-3 bg-primary mt-1 flex-shrink-0"></div>
									{:else}
										<div class="w-3 h-3 bg-accent mt-1 flex-shrink-0"></div>
									{/if}
									<div class="flex-1">
										<p class="font-semibold text-neutral-950 font-sans">{alert.title}</p>
										<p class="text-sm text-neutral-950 mt-1 font-sans">{alert.message}</p>
										<p class="text-xs text-neutral-950 mt-2 font-sans">{alert.date}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Recent Activity -->
			<div class="bg-neutral border-2 border-secondary">
				<div class="p-6 border-b-2 border-secondary">
					<h2 class="text-xl font-bold font-serif text-neutral-950">Recent Activity</h2>
				</div>
				{#if data.recentActivity && data.recentActivity.length > 0}
					<div class="divide-y divide-secondary">
						{#each data.recentActivity as activity}
							<div class="p-4 hover:bg-neutral-100 transition-colors">
								<div class="flex items-center gap-4">
									<div class="w-10 h-10 bg-secondary flex items-center justify-center flex-shrink-0">
										<IconPlayerPlay class="w-5 h-5 text-white" />
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm text-neutral-950 font-sans truncate">{activity.message}</p>
										<p class="text-xs text-neutral-950 font-sans">{activity.time}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="p-8 text-center">
						<p class="text-neutral-950 text-sm font-sans">No recent activity</p>
					</div>
				{/if}
			</div>

			<!-- Pending Actions -->
			{#if data.stats?.pendingActions > 0}
				<div class="bg-accent-100 border-2 border-accent p-6">
					<div class="flex items-center gap-4">
						<div class="bg-accent text-white w-12 h-12 flex items-center justify-center font-bold text-xl font-serif">
							{data.stats.pendingActions}
						</div>
						<div>
							<p class="font-bold text-neutral-950 font-sans">Pending Actions</p>
							<p class="text-sm text-neutral-950 font-sans">Items requiring attention</p>
						</div>
					</div>
					<a href="/dashboard/rosters" class="mt-4 block w-full text-center bg-white border-2 border-accent text-accent py-2 hover:bg-accent-50 transition-colors text-sm font-bold font-sans">
						Review Now
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
