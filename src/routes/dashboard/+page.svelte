<script lang="ts">
	import {
		IconLayoutDashboard,
		IconBallFootball,
		IconTrophy,
		IconUserCog,
		IconBuilding,
		IconShoppingCart,
		IconCreditCard,
		IconFileText,
		IconChartBar,
		IconSettings,
		IconHelpCircle,
		IconMenu2,
		IconX
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';

	let activeMenuItem = $state('Dashboard');
	let sidebarWidth = $state(270); // Default 64 * 4 = 256px (w-64)
	let isSidebarOpen = $state(true);
	let isResizing = $state(false);

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

	const menuItems = [
		{ id: 'Dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
		{ id: 'Intramural Sports', label: 'Intramural Sports', icon: IconBallFootball },
		{ id: 'Club Sports', label: 'Club Sports', icon: IconTrophy },
		{ id: 'Member Management', label: 'Member Management', icon: IconUserCog },
		{ id: 'Facilities', label: 'Facilities', icon: IconBuilding },
		{ id: 'Equipment Checkout', label: 'Equipment Checkout', icon: IconShoppingCart },
		{ id: 'Payments', label: 'Payments', icon: IconCreditCard },
		{ id: 'Forms', label: 'Forms', icon: IconFileText },
		{ id: 'Reports', label: 'Reports', icon: IconChartBar },
		{ id: 'Settings', label: 'Settings', icon: IconSettings },
		{ id: 'Help', label: 'Help', icon: IconHelpCircle }
	];

	function handleResizeStart(e: MouseEvent) {
		isResizing = true;
		e.preventDefault();
	}

	function handleResize(e: MouseEvent) {
		if (!isResizing) return;
		const newWidth = e.clientX;
		if (newWidth >= 200 && newWidth <= 400) {
			sidebarWidth = newWidth;
		}
	}

	function handleResizeEnd() {
		isResizing = false;
	}

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

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

	onMount(() => {
		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', handleResizeEnd);
		return () => {
			document.removeEventListener('mousemove', handleResize);
			document.removeEventListener('mouseup', handleResizeEnd);
		};
	});
</script>

<div class="flex min-h-screen">
	<!-- Sidebar Navigation -->
	{#if isSidebarOpen}
		<aside
			class="bg-primary text-white flex flex-col relative transition-all duration-200"
			style="width: {sidebarWidth}px; min-width: 200px; max-width: 400px;"
		>
			<!-- Logo Area -->
			<div class="p-8 border-b border-primary-600 flex items-center justify-between">
				<h1 class="text-2xl font-bold font-serif">RecAdmin</h1>
				<button
					onclick={toggleSidebar}
					class="p-2 hover:bg-primary-600 transition-colors cursor-pointer"
					aria-label="Close sidebar"
				>
					<IconX class="w-5 h-5" />
				</button>
			</div>

			<!-- Menu -->
			<nav class="flex-1 p-4 overflow-y-auto">
				<ul class="space-y-2">
					{#each menuItems as item}
						<li>
							<button
								onclick={() => (activeMenuItem = item.id)}
								class="w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 cursor-pointer {activeMenuItem ===
								item.id
									? 'bg-primary-600 border-l-4 border-primary-950 text-white'
									: 'text-primary-100 hover:bg-primary-600 hover:text-white border-l-4 border-transparent'}"
							>
								<item.icon class="w-5 h-5 flex-shrink-0" />
								<span>{item.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			</nav>

			<!-- Resize Handle -->
			<button
				type="button"
				class="absolute right-0 top-0 bottom-0 w-1 bg-primary-600 hover:bg-primary-500 cursor-col-resize transition-colors border-0 p-0"
				onmousedown={handleResizeStart}
				aria-label="Resize sidebar"
				tabindex="0"
			></button>
		</aside>
	{/if}

	<!-- Toggle Button (when sidebar is closed) -->
	{#if !isSidebarOpen}
		<button
			onclick={toggleSidebar}
			class="fixed left-4 top-4 z-50 p-2 bg-primary text-white hover:bg-primary-600 transition-colors cursor-pointer"
			aria-label="Open sidebar"
		>
			<IconMenu2 class="w-6 h-6" />
		</button>
	{/if}

	<!-- Main Content Area -->
	<main class="flex-1 bg-neutral min-h-screen">
		<div class="p-8">
			<!-- Header Section -->
			<header class="flex justify-between items-start mb-8">
				<div>
					<h2 class="text-4xl font-bold font-serif text-neutral-950 mb-2">Dashboard Overview</h2>
					<p class="text-neutral-600 font-sans">{currentDate}</p>
				</div>
				<!-- User Profile Dropdown -->
				<div class="relative">
					<button
						class="flex items-center gap-2 px-4 py-2 bg-neutral border border-neutral-300 hover:bg-neutral-200 transition-colors font-sans"
					>
						<div class="w-8 h-8 bg-primary flex items-center justify-center text-white font-bold">
							JD
						</div>
						<span class="text-neutral-950 font-sans">John Doe</span>
						<svg
							class="w-4 h-4 text-neutral-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</button>
				</div>
			</header>

			<!-- Stats Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				{#each stats as stat}
					<div class="bg-neutral border border-neutral-300 p-6">
						<div class="flex items-center justify-between mb-2">
							<p class="text-xs uppercase tracking-wide text-neutral-600 font-sans">{stat.label}</p>
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
				<!-- Live Games Feed -->
				<div class="lg:col-span-2 bg-neutral border border-neutral-300 p-6">
					<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-4">Live Games</h3>
					<div class="space-y-4">
						{#each liveGames as game}
							<div
								class="flex items-center justify-between py-3 border-b border-neutral-200 last:border-0"
							>
								<div class="flex-1">
									<div class="flex items-center gap-4 mb-1">
										<span class="text-sm font-medium text-neutral-600 font-sans">{game.time}</span>
										<span class="text-sm text-neutral-950 font-sans">{game.sport}</span>
									</div>
									<p class="text-sm text-neutral-700 font-sans">{game.teams}</p>
									<p class="text-xs text-neutral-500 mt-1 font-sans">{game.field}</p>
								</div>
								<span class="badge-accent ml-4">LIVE</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- Priority Actions -->
				<div class="bg-neutral border border-neutral-300 p-6">
					<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-4">Priority Actions</h3>
					<div class="space-y-4">
						{#each priorityActions as action}
							<div class="pb-4 border-b border-neutral-200 last:border-0 last:pb-0">
								<p class="text-sm text-neutral-950 mb-3 font-sans">{action.title}</p>
								<button class="button-accent w-full text-sm">{action.action}</button>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- League Health Table -->
			<div class="bg-neutral border border-neutral-300 p-6">
				<h3 class="text-2xl font-bold font-serif text-neutral-950 mb-6">Season Progress</h3>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-neutral-300">
								<th
									class="text-left py-3 px-4 text-sm font-semibold text-neutral-700 uppercase tracking-wide font-sans"
								>
									Sport
								</th>
								<th
									class="text-left py-3 px-4 text-sm font-semibold text-neutral-700 uppercase tracking-wide font-sans"
								>
									Team Count
								</th>
								<th
									class="text-left py-3 px-4 text-sm font-semibold text-neutral-700 uppercase tracking-wide font-sans"
								>
									Progress
								</th>
							</tr>
						</thead>
						<tbody>
							{#each leagueHealth as league}
								<tr class="border-b border-neutral-200 last:border-0 hover:bg-neutral-50">
									<td class="py-4 px-4 text-neutral-950 font-medium font-sans">{league.sport}</td>
									<td class="py-4 px-4 text-neutral-700 font-sans">{league.teamCount} Teams</td>
									<td class="py-4 px-4">
										<div class="flex items-center gap-3">
											<div class="flex-1 bg-neutral-200 h-4 max-w-xs">
												<div class="h-full bg-secondary" style="width: {league.progress}%"></div>
											</div>
											<span class="text-sm text-neutral-600 font-medium font-sans"
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
	</main>
</div>

<style>
	/* Ensure no rounded corners for flat design */
	* {
		border-radius: 0 !important;
	}
</style>
