<script lang="ts">
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconFilter from '@tabler/icons-svelte/icons/filter';
	import IconArrowsSort from '@tabler/icons-svelte/icons/arrows-sort';
	import IconLivePhoto from '@tabler/icons-svelte/icons/live-photo';
	
	let { data } = $props();
	
	let searchQuery = $state('');
	let sortBy = $state('time');
	let filterSport = $state('all');

	// Format date as "Tuesday, October 24th"
	function formatDate(): string {
		const date = new Date();
		const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
		const month = date.toLocaleDateString('en-US', { month: 'long' });
		const day = date.getDate();
		const suffix = getDaySuffix(day);
		return `${weekday}, ${month} ${day}${suffix}`;
	}

	function getDaySuffix(day: number): string {
		if (day > 3 && day < 21) return 'th';
		switch (day % 10) {
			case 1:
				return 'st';
			case 2:
				return 'nd';
			case 3:
				return 'rd';
			default:
				return 'th';
		}
	}

	const currentDate = formatDate();

	// Build stats from real data
	const stats = $derived([
		{ label: 'Active Players', value: data.stats?.activePlayers?.toLocaleString() || '0' },
		{ label: 'Games Today', value: data.stats?.gamesToday?.toString() || '0' },
		{ 
			label: 'Live Games', 
			value: data.stats?.liveGames?.toString() || '0',
			badge: data.stats?.liveGames > 0 ? 'LIVE' : undefined
		},
		{ 
			label: 'Pending Rosters', 
			value: data.stats?.pendingRosters?.toString() || '0',
			badge: data.stats?.pendingRosters > 0 ? 'Action Required' : undefined
		},
		{ label: 'Facility Load', value: `${data.stats?.facilityLoad || 0}%` }
	]);

	// Use real events from data
	const todaysEvents = $derived(data.todaysEvents || []);

	// Get unique sports for filter
	const allSports = $derived(['all', ...new Set(todaysEvents.map((game) => game.sport))]);

	// Filter and sort games
	const filteredGames = $derived.by(() => {
		let games = [...todaysEvents];

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			games = games.filter(
				(game) =>
					game.sport.toLowerCase().includes(query) ||
					game.teams.toLowerCase().includes(query) ||
					game.field.toLowerCase().includes(query) ||
					game.time.toLowerCase().includes(query)
			);
		}

		// Filter by sport
		if (filterSport !== 'all') {
			games = games.filter((game) => game.sport === filterSport);
		}

		// Sort
		if (sortBy === 'time') {
			games.sort((a, b) => {
				// Parse time strings (e.g., "7:00 PM")
				const parseTime = (timeStr: string) => {
					const [time, period] = timeStr.split(' ');
					const [hours, minutes] = time.split(':').map(Number);
					let totalHours = hours;
					if (period === 'PM' && hours !== 12) totalHours += 12;
					if (period === 'AM' && hours === 12) totalHours = 0;
					return totalHours * 60 + minutes;
				};
				return parseTime(a.time) - parseTime(b.time);
			});
		} else if (sortBy === 'sport') {
			games.sort((a, b) => a.sport.localeCompare(b.sport));
		} else if (sortBy === 'field') {
			games.sort((a, b) => a.field.localeCompare(b.field));
		}

		return games;
	});

	// Priority actions from announcements
	const priorityActions = $derived(data.priorityActions || []);

	// League health data
	const leagueHealth = $derived(data.leagueHealth || []);

	// Get status badge for games
	function getStatusBadge(status: string) {
		switch (status) {
			case 'in_progress':
				return { text: 'LIVE', class: 'bg-red-500 text-white animate-pulse' };
			case 'completed':
				return { text: 'FINAL', class: 'bg-gray-500 text-white' };
			case 'scheduled':
			default:
				return { text: 'UPCOMING', class: 'bg-blue-500 text-white' };
		}
	}
</script>

<div class="p-8">
	<!-- Header Section -->
	<header class="flex justify-between items-start mb-8">
		<div>
			<h2 class="text-4xl font-bold font-serif text-neutral-950 mb-2">Dashboard Overview</h2>
			<p class="text-neutral-950 font-sans">{currentDate}</p>
		</div>
		<!-- User Profile (placeholder until auth is wired) -->
		<div class="relative">
			<button
				class="flex items-center gap-2 px-4 py-2 bg-neutral border border-secondary hover:bg-neutral-200 transition-colors font-sans"
				type="button"
				aria-label="User menu"
			>
				<div class="w-8 h-8 bg-secondary flex items-center justify-center text-white font-bold">
					JH
				</div>
				<span class="text-neutral-950 font-sans">Jake Harvanchik</span>
				<svg class="w-4 h-4 text-neutral-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
					></path>
				</svg>
			</button>
		</div>
	</header>

	<!-- Error Message -->
	{#if data.error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
			<strong class="font-bold">Error:</strong>
			<span class="block sm:inline">{data.error}</span>
		</div>
	{/if}

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
		{#each stats as stat}
			<div class="bg-neutral border border-secondary p-6">
				<div class="flex items-center justify-between mb-2">
					<p class="text-xs uppercase tracking-wide text-neutral-950 font-sans">{stat.label}</p>
					{#if stat.badge}
						<span class="badge-accent text-xs">{stat.badge}</span>
					{/if}
				</div>
				<p class="text-3xl font-bold font-serif text-neutral-950">{stat.value}</p>
			</div>
		{/each}
	</div>

	<!-- Live Operations Section -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
		<!-- Today's Schedule -->
		<div class="lg:col-span-2 bg-neutral border border-secondary p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">Today's Schedule</h3>
				{#if data.stats?.liveGames > 0}
					<div class="flex items-center gap-2 text-red-600">
						<IconLivePhoto class="w-5 h-5 animate-pulse" />
						<span class="text-sm font-medium">{data.stats.liveGames} Live</span>
					</div>
				{/if}
			</div>

			<!-- Search, Filter, and Sort Controls -->
			<div class="mb-6 space-y-4">
				<!-- Search -->
				<div class="relative">
					<IconSearch
						class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-950"
					/>
					<label for="dashboard-search" class="sr-only">Search games</label>
					<input
						id="dashboard-search"
						type="text"
						bind:value={searchQuery}
						placeholder="Search games..."
						class="w-full pl-10 pr-4 py-2 border border-secondary bg-neutral text-neutral-950 placeholder-neutral-500 font-sans focus:outline-none focus:border-secondary-600"
					/>
				</div>

				<!-- Filter and Sort Row -->
				<div class="flex flex-wrap gap-4">
					<!-- Sport Filter -->
					<div class="flex items-center gap-2">
						<IconFilter class="w-5 h-5 text-neutral-950" />
						<label for="dashboard-filter-sport" class="sr-only">Filter by sport</label>
						<select
							id="dashboard-filter-sport"
							bind:value={filterSport}
							class="px-3 py-2 border border-secondary bg-neutral text-neutral-950 font-sans focus:outline-none focus:border-secondary-600"
						>
							{#each allSports as sport}
								<option value={sport}>{sport === 'all' ? 'All Sports' : sport}</option>
							{/each}
						</select>
					</div>

					<!-- Sort -->
					<div class="flex items-center gap-2">
						<IconArrowsSort class="w-5 h-5 text-neutral-950" />
						<label for="dashboard-sort" class="sr-only">Sort games</label>
						<select
							id="dashboard-sort"
							bind:value={sortBy}
							class="px-3 py-2 border border-secondary bg-neutral text-neutral-950 font-sans focus:outline-none focus:border-secondary-600"
						>
							<option value="time">Sort by Time</option>
							<option value="sport">Sort by Sport</option>
							<option value="field">Sort by Field</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Games List -->
			<div class="space-y-4">
				{#if filteredGames.length === 0}
					<div class="text-center py-12">
						<p class="text-neutral-600 font-sans text-lg">No games scheduled for today.</p>
						<p class="text-neutral-500 font-sans text-sm mt-2">Check back later for upcoming events!</p>
					</div>
				{:else}
					{#each filteredGames as game}
						{@const status = getStatusBadge(game.status)}
						<div
							class="flex items-center justify-between py-4 border-b border-secondary last:border-0 hover:bg-neutral-50 transition-colors px-2 -mx-2 rounded"
						>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-4 mb-1">
									<span class="text-sm font-medium text-neutral-950 font-sans">{game.time}</span>
									<span class="text-sm text-neutral-700 font-sans">{game.sport}</span>
								</div>
								<p class="text-sm font-medium text-neutral-950 font-sans truncate">{game.teams}</p>
								<p class="text-xs text-neutral-600 mt-1 font-sans">{game.field}</p>
								{#if game.status === 'in_progress' && (game.homeScore !== null || game.awayScore !== null)}
									<p class="text-sm font-bold text-neutral-950 mt-1 font-sans">
										Score: {game.homeScore ?? 0} - {game.awayScore ?? 0}
									</p>
								{/if}
							</div>
							<span class="{status.class} px-2 py-1 text-xs font-bold rounded ml-4 whitespace-nowrap">
								{status.text}
							</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Priority Actions -->
		<div class="bg-neutral border border-secondary p-6">
			<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-4">Priority Actions</h3>
			<div class="space-y-4">
				{#if priorityActions.length === 0}
					<p class="text-neutral-600 font-sans py-4">No pending actions.</p>
				{:else}
					{#each priorityActions as action}
						<div class="pb-4 border-b border-secondary last:border-0 last:pb-0">
							<div class="flex items-start gap-2 mb-2">
								{#if action.urgent}
									<span class="text-red-500 font-bold text-xs">URGENT</span>
								{/if}
								<p class="text-sm font-medium text-neutral-950 font-sans">{action.title}</p>
							</div>
							<p class="text-xs text-neutral-600 mb-3 line-clamp-2">{action.content}</p>
							<button 
								class="button-accent w-full text-sm {action.urgent ? 'bg-red-600 hover:bg-red-700' : ''}" 
								type="button"
							>
								{action.action}
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- League Health Table -->
	<div class="bg-neutral border border-secondary p-6">
		<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-6">Season Progress</h3>
		<div class="overflow-x-auto">
			{#if leagueHealth.length === 0}
				<p class="text-neutral-600 font-sans py-4">No league data available.</p>
			{:else}
				<table class="w-full">
					<thead>
						<tr class="border-b border-secondary">
							<th
								scope="col"
								class="text-left py-3 px-4 text-sm font-semibold text-neutral-950 uppercase tracking-wide font-sans"
							>
								Sport / Division
							</th>
							<th
								scope="col"
								class="text-left py-3 px-4 text-sm font-semibold text-neutral-950 uppercase tracking-wide font-sans"
							>
								Teams
							</th>
							<th
								scope="col"
								class="text-left py-3 px-4 text-sm font-semibold text-neutral-950 uppercase tracking-wide font-sans"
							>
								Season Progress
							</th>
						</tr>
					</thead>
					<tbody>
						{#each leagueHealth as league}
							<tr class="border-b border-secondary last:border-0 hover:bg-neutral-50 transition-colors">
								<td class="py-4 px-4 text-neutral-950 font-medium font-sans">{league.sport}</td>
								<td class="py-4 px-4 text-neutral-950 font-sans">{league.teamCount} Teams</td>
								<td class="py-4 px-4">
									<div class="flex items-center gap-3">
										<div class="flex-1 bg-neutral-200 h-4 max-w-xs rounded-full overflow-hidden" aria-hidden="true">
											<div 
												class="h-full bg-secondary transition-all duration-500" 
												style="width: {Math.min(league.progress, 100)}%"
											></div>
										</div>
										<span class="text-sm text-neutral-950 font-medium font-sans w-12">
											{league.progress}%
										</span>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>
