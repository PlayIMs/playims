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
	
	let { data } = $props();
	
	// Get current date
	const today = new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	
	// Quick action buttons
	const quickActions = [
		{ label: 'New Game', icon: IconPlus, href: '/dashboard/events/new', color: 'bg-blue-600 hover:bg-blue-700' },
		{ label: 'Add Team', icon: IconUsers, href: '/dashboard/teams/new', color: 'bg-green-600 hover:bg-green-700' },
		{ label: 'Find Player', icon: IconSearch, href: '/dashboard/users', color: 'bg-purple-600 hover:bg-purple-700' },
	];
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 px-8 py-6">
		<div class="flex justify-between items-center">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
				<p class="text-gray-500 mt-1">{today}</p>
			</div>
			<div class="flex items-center gap-4">
				<div class="flex gap-3">
					{#each quickActions as action}
						<a 
							href={action.href}
							class="{action.color} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm hover:shadow-md"
						>
							<action.icon class="w-4 h-4" />
							<span class="text-sm font-medium">{action.label}</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</header>

	<main class="p-8 max-w-7xl mx-auto">
		{#if data.error}
			<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
				<div class="flex items-center gap-3">
					<IconAlertTriangle class="w-5 h-5 text-red-500" />
					<p class="text-red-700">{data.error}</p>
				</div>
			</div>
		{/if}

		<!-- Stats Grid -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
			<!-- Total Users -->
			<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Total Players</p>
						<p class="text-3xl font-bold text-gray-900 mt-1">{data.stats?.totalUsers || 0}</p>
					</div>
					<div class="bg-blue-100 p-3 rounded-lg">
						<IconUsers class="w-6 h-6 text-blue-600" />
					</div>
				</div>
			</div>

			<!-- Total Teams -->
			<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Active Teams</p>
						<p class="text-3xl font-bold text-gray-900 mt-1">{data.stats?.totalTeams || 0}</p>
					</div>
					<div class="bg-green-100 p-3 rounded-lg">
						<IconTrophy class="w-6 h-6 text-green-600" />
					</div>
				</div>
			</div>

			<!-- Total Leagues -->
			<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Active Leagues</p>
						<p class="text-3xl font-bold text-gray-900 mt-1">{data.stats?.totalLeagues || 0}</p>
					</div>
					<div class="bg-purple-100 p-3 rounded-lg">
						<IconCalendar class="w-6 h-6 text-purple-600" />
					</div>
				</div>
			</div>

			<!-- Facilities -->
			<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Facilities</p>
						<p class="text-3xl font-bold text-gray-900 mt-1">{data.stats?.totalFacilities || 0}</p>
					</div>
					<div class="bg-orange-100 p-3 rounded-lg">
						<IconBuilding class="w-6 h-6 text-orange-600" />
					</div>
				</div>
			</div>
		</div>

		<!-- Today's Games Status -->
		<div class="grid grid-cols-3 gap-6 mb-8">
			<div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
				<div class="flex items-center gap-3">
					<div class="bg-white/20 p-2 rounded-lg">
						<IconCalendar class="w-5 h-5" />
					</div>
					<div>
						<p class="text-blue-100 text-sm">Games Today</p>
						<p class="text-3xl font-bold">{data.stats?.gamesToday || 0}</p>
					</div>
				</div>
			</div>

			<div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
				<div class="flex items-center gap-3">
					<div class="bg-white/20 p-2 rounded-lg">
						<IconCheck class="w-5 h-5" />
					</div>
					<div>
						<p class="text-green-100 text-sm">Completed</p>
						<p class="text-3xl font-bold">{data.stats?.completedToday || 0}</p>
					</div>
				</div>
			</div>

			<div class="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
				<div class="flex items-center gap-3">
					<div class="bg-white/20 p-2 rounded-lg animate-pulse">
						<IconLivePhoto class="w-5 h-5" />
					</div>
					<div>
						<p class="text-red-100 text-sm">Live Now</p>
						<p class="text-3xl font-bold">{data.stats?.liveGames || 0}</p>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Today's Schedule -->
			<div class="lg:col-span-2">
				<div class="bg-white rounded-xl shadow-sm border border-gray-100">
					<div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
						<h2 class="text-lg font-semibold text-gray-900">Today's Schedule</h2>
						<a href="/dashboard/events" class="text-sm text-blue-600 hover:text-blue-700 font-medium">
							View All →
						</a>
					</div>
					
					{#if data.todaysEvents && data.todaysEvents.length > 0}
						<div class="divide-y divide-gray-100">
							{#each data.todaysEvents as game}
								<div class="px-6 py-4 hover:bg-gray-50 transition-colors">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-4">
											<div class="text-center min-w-[60px]">
												<p class="text-lg font-semibold text-gray-900">{game.time}</p>
											</div>
											<div class="h-8 w-px bg-gray-200"></div>
											<div>
												<p class="font-medium text-gray-900">{game.matchup}</p>
												<p class="text-sm text-gray-500">{game.sport} • {game.location}</p>
											</div>
										</div>
										<div class="flex items-center gap-3">
											{#if game.score}
												<span class="bg-gray-100 px-3 py-1 rounded-full text-sm font-bold text-gray-700">
													{game.score}
												</span>
											{/if}
											{#if game.status === 'in_progress'}
												<span class="flex items-center gap-1.5 text-red-600 text-sm font-medium">
													<span class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
													LIVE
												</span>
											{:else if game.status === 'completed'}
												<span class="text-gray-500 text-sm font-medium">FINAL</span>
											{:else}
												<span class="text-blue-600 text-sm font-medium">UPCOMING</span>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="px-6 py-12 text-center">
							<div class="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
								<IconCalendar class="w-8 h-8 text-gray-400" />
							</div>
							<p class="text-gray-500 font-medium">No games scheduled for today</p>
							<p class="text-gray-400 text-sm mt-1">Check back later for upcoming events</p>
						</div>
					{/if}
				</div>

				<!-- Upcoming Events -->
				{#if data.upcomingEvents && data.upcomingEvents.length > 0}
					<div class="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
						<div class="px-6 py-4 border-b border-gray-100">
							<h2 class="text-lg font-semibold text-gray-900">This Week</h2>
						</div>
						<div class="divide-y divide-gray-100">
							{#each data.upcomingEvents as game}
								<div class="px-6 py-3 hover:bg-gray-50 transition-colors">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<span class="text-sm text-gray-500 min-w-[80px]">{game.date}</span>
											<span class="text-sm font-medium text-gray-900">{game.time}</span>
											<span class="text-gray-300">|</span>
											<span class="text-sm text-gray-700">{game.matchup}</span>
										</div>
										<span class="text-xs text-gray-400">{game.sport}</span>
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
					<div class="bg-white rounded-xl shadow-sm border border-gray-100">
						<div class="px-6 py-4 border-b border-gray-100">
							<h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
								<IconAlertTriangle class="w-5 h-5 text-amber-500" />
								Alerts
							</h2>
						</div>
						<div class="divide-y divide-gray-100">
							{#each data.alerts as alert}
								<div class="px-6 py-4 hover:bg-gray-50 transition-colors">
									<div class="flex items-start gap-3">
										{#if alert.priority === 'high'}
											<div class="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
										{:else}
											<div class="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></div>
										{/if}
										<div class="flex-1">
											<p class="font-medium text-gray-900">{alert.title}</p>
											<p class="text-sm text-gray-500 mt-0.5">{alert.message}</p>
											<p class="text-xs text-gray-400 mt-2">{alert.date}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recent Activity -->
				<div class="bg-white rounded-xl shadow-sm border border-gray-100">
					<div class="px-6 py-4 border-b border-gray-100">
						<h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
					</div>
					{#if data.recentActivity && data.recentActivity.length > 0}
						<div class="divide-y divide-gray-100">
							{#each data.recentActivity as activity}
								<div class="px-6 py-3 hover:bg-gray-50 transition-colors">
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
											<IconPlayerPlay class="w-4 h-4 text-blue-600" />
										</div>
										<div class="flex-1 min-w-0">
											<p class="text-sm text-gray-900 truncate">{activity.message}</p>
											<p class="text-xs text-gray-400">{activity.time}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="px-6 py-8 text-center">
							<p class="text-gray-400 text-sm">No recent activity</p>
						</div>
					{/if}
				</div>

				<!-- Pending Actions -->
				{#if data.stats?.pendingActions > 0}
					<div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
						<div class="flex items-center gap-3">
							<div class="bg-amber-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
								{data.stats.pendingActions}
							</div>
							<div>
								<p class="font-semibold text-gray-900">Pending Actions</p>
								<p class="text-sm text-gray-600">Items requiring your attention</p>
							</div>
						</div>
						<a href="/dashboard/rosters" class="mt-4 block w-full text-center bg-white border border-amber-300 text-amber-700 py-2 rounded-lg hover:bg-amber-50 transition-colors text-sm font-medium">
							Review Now
						</a>
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>
