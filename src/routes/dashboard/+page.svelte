<script lang="ts">
	import { IconSearch, IconFilter, IconArrowsSort } from '@tabler/icons-svelte';
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

	const stats = [
		{ label: 'Active Players', value: '2,405' },
		{ label: 'Games Today', value: '34' },
		{ label: 'Pending Rosters', value: '12', badge: 'Action Required' },
		{ label: 'Facility Load', value: '85%' }
	];

	const liveGames = [
		{
			time: '7:00 PM',
			sport: 'Flag Football',
			teams: 'Team Alpha vs. Beta Blockers',
			field: 'Field 3'
		},
		{ time: '7:30 PM', sport: 'Basketball', teams: 'Thunder vs. Lightning', field: 'Court 1' },
		{ time: '8:00 PM', sport: 'Soccer', teams: 'Strikers vs. Defenders', field: 'Field 2' }
	];

	// Get unique sports for filter
	const allSports = ['all', ...new Set(liveGames.map((game) => game.sport))];

	// Filter and sort games
	let filteredGames = $derived.by(() => {
		let games = [...liveGames];

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
				// Simple time comparison (assuming PM format)
				const timeA = parseInt(a.time.split(':')[0]);
				const timeB = parseInt(b.time.split(':')[0]);
				return timeA - timeB;
			});
		} else if (sortBy === 'sport') {
			games.sort((a, b) => a.sport.localeCompare(b.sport));
		} else if (sortBy === 'field') {
			games.sort((a, b) => a.field.localeCompare(b.field));
		}

		return games;
	});

	const priorityActions = [
		{
			title: 'Weather Alert: Lightning detected near North Fields',
			action: 'Suspend Play',
			urgent: true
		},
		{
			title: 'Roster verification needed for Team Alpha',
			action: 'Review',
			urgent: false
		},
		{
			title: 'Field 3 maintenance scheduled for tomorrow',
			action: 'View Details',
			urgent: false
		}
	];

	const leagueHealth = [
		{ sport: "Soccer (Men's)", teamCount: 40, progress: 60 },
		{ sport: 'Volleyball (Co-Rec)', teamCount: 24, progress: 30 },
		{ sport: "Basketball (Women's)", teamCount: 18, progress: 75 },
		{ sport: 'Flag Football', teamCount: 32, progress: 45 }
	];
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
					JD
				</div>
				<span class="text-neutral-950 font-sans">John Doe</span>
				<svg class="w-4 h-4 text-neutral-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
					></path>
				</svg>
			</button>
		</div>
	</header>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
					<p class="text-neutral-950 font-sans py-8 text-center">
						No games found matching your criteria.
					</p>
				{:else}
					{#each filteredGames as game}
						<div
							class="flex items-center justify-between py-3 border-b border-secondary last:border-0"
						>
							<div class="flex-1">
								<div class="flex items-center gap-4 mb-1">
									<span class="text-sm font-medium text-neutral-950 font-sans">{game.time}</span>
									<span class="text-sm text-neutral-950 font-sans">{game.sport}</span>
								</div>
								<p class="text-sm text-neutral-950 font-sans">{game.teams}</p>
								<p class="text-xs text-neutral-950 mt-1 font-sans">{game.field}</p>
							</div>
							<span class="badge-accent ml-4">LIVE</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Priority Actions -->
		<div class="bg-neutral border border-secondary p-6">
			<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-4">Priority Actions</h3>
			<div class="space-y-4">
				{#each priorityActions as action}
					<div class="pb-4 border-b border-secondary last:border-0 last:pb-0">
						<p class="text-sm text-neutral-950 mb-3 font-sans">{action.title}</p>
						<button class="button-accent w-full text-sm" type="button">{action.action}</button>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- League Health Table -->
	<div class="bg-neutral border border-secondary p-6">
		<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-6">Season Progress</h3>
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-secondary">
						<th
							scope="col"
							class="text-left py-3 px-4 text-sm font-semibold text-neutral-950 uppercase tracking-wide font-sans"
						>
							Sport
						</th>
						<th
							scope="col"
							class="text-left py-3 px-4 text-sm font-semibold text-neutral-950 uppercase tracking-wide font-sans"
						>
							Team Count
						</th>
						<th
							scope="col"
							class="text-left py-3 px-4 text-sm font-semibold text-neutral-950 uppercase tracking-wide font-sans"
						>
							Progress
						</th>
					</tr>
				</thead>
				<tbody>
					{#each leagueHealth as league}
						<tr class="border-b border-secondary last:border-0 hover:bg-neutral-50">
							<td class="py-4 px-4 text-neutral-950 font-medium font-sans">{league.sport}</td>
							<td class="py-4 px-4 text-neutral-950 font-sans">{league.teamCount} Teams</td>
							<td class="py-4 px-4">
								<div class="flex items-center gap-3">
									<div class="flex-1 bg-neutral-200 h-4 max-w-xs" aria-hidden="true">
										<div class="h-full bg-secondary" style="width: {league.progress}%"></div>
									</div>
									<span class="text-sm text-neutral-950 font-medium font-sans"
										>{league.progress}%</span
									>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
