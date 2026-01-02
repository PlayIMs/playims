<script lang="ts">
	import { onMount } from 'svelte';
	import type { Client, User } from '$lib/database/schema';

	export let data: {
		clients: Client[];
		users: User[];
		isDevelopment: boolean;
		environment: string;
		dbName?: string;
		error?: string;
	};

	onMount(() => {
		console.log('=== D1 Database Query Results ===');
		console.log('Environment:', data.environment);
		if (data.dbName) console.log('Target Database:', data.dbName);
		console.log('Development mode:', data.isDevelopment);

		if (data.error) {
			console.error('Database error:', data.error);
		} else {
			console.log('Clients:', data.clients);
			console.log('Users:', data.users);
			console.log('Total clients:', data.clients.length);
			console.log('Total users:', data.users.length);

			if (data.clients.length === 0 && data.users.length === 0) {
				console.warn(
					'⚠️ No data found. If you expect data, ensure you have seeded the correct database.'
				);
				console.warn(
					`Run "pnpm db:studio" to inspect the ${data.isDevelopment ? 'DEV' : 'PROD'} database content.`
				);
			}
		}

		console.log('===================================');
	});
</script>

<svelte:head>
	<title>PlayIMs - Intramural Sports League Manager</title>
	<meta
		name="description"
		content="Manage your intramural sports leagues with PlayIMs. Easy team management, scheduling, and league administration."
	/>
</svelte:head>

<div class="min-h-screen bg-beige-50">
	<!-- Hero Section -->
	<section class="bg-red-600 text-white">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
			<div class="text-center">
				<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
					Play<span class="text-red-200">IMs</span>
				</h1>
				<p class="text-xl sm:text-2xl mb-4 text-red-100 font-medium">
					The ultimate platform for managing intramural sports leagues
				</p>
				<p class="text-lg sm:text-xl mb-8 text-red-200 max-w-3xl mx-auto">
					Streamline your league management with easy team registration, automated scheduling,
					real-time standings, and comprehensive statistics tracking.
				</p>
				<div class="flex flex-col sm:flex-row gap-4 justify-center">
					<button
						class="bg-white text-red-600 px-8 py-3 font-bold text-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled
					>
						Get Started
					</button>
					<button
						class="bg-transparent border-2 border-white text-white px-8 py-3 font-bold text-lg hover:bg-white hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled
					>
						Learn More
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="bg-beige-100 py-16 sm:py-24">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-12">
				<h2 class="text-3xl sm:text-4xl font-bold text-red-900 mb-4">
					Everything you need to run successful leagues
				</h2>
				<p class="text-lg text-beige-700 max-w-2xl mx-auto">
					Powerful features for administrators, teams, and players
				</p>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Feature 1 -->
				<div class="bg-white border-l-4 border-red-500 p-6 hover:border-red-600 transition-colors">
					<div class="bg-red-500 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-red-900 mb-2">Team Management</h3>
					<p class="text-beige-700">
						Easy team registration, player rosters, and captain management tools all in one place.
					</p>
				</div>

				<!-- Feature 2 -->
				<div
					class="bg-white border-l-4 border-powder-500 p-6 hover:border-powder-600 transition-colors"
				>
					<div class="bg-powder-500 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-red-900 mb-2">Smart Scheduling</h3>
					<p class="text-beige-700">
						Automated game scheduling with conflict resolution and intelligent venue management.
					</p>
				</div>

				<!-- Feature 3 -->
				<div
					class="bg-white border-l-4 border-navy-500 p-6 hover:border-navy-600 transition-colors"
				>
					<div class="bg-navy-500 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-navy-900 mb-2">Live Standings</h3>
					<p class="text-beige-700">
						Real-time standings, statistics, and comprehensive league performance tracking.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Community Stats Section -->
	<section class="bg-navy-800 py-16 sm:py-24">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-12">
				<h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">Our Growing Community</h2>
				<p class="text-lg text-navy-200">Join thousands already using PlayIMs</p>
			</div>

			<!-- Stats Overview -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
				<div class="bg-navy-900 border-2 border-navy-700 p-6 flex items-center gap-6">
					<div class="bg-red-600 w-16 h-16 flex items-center justify-center flex-shrink-0">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							></path>
						</svg>
					</div>
					<div>
						<h3 class="text-sm font-bold text-navy-200 mb-1">Total Users</h3>
						<p class="text-4xl font-bold text-white mb-1">{data.users.length}</p>
						<p class="text-sm text-navy-300">Active platform users</p>
					</div>
				</div>

				<div class="bg-navy-900 border-2 border-navy-700 p-6 flex items-center gap-6">
					<div class="bg-powder-600 w-16 h-16 flex items-center justify-center flex-shrink-0">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
							></path>
						</svg>
					</div>
					<div>
						<h3 class="text-sm font-bold text-navy-200 mb-1">Total Clients</h3>
						<p class="text-4xl font-bold text-white mb-1">{data.clients.length}</p>
						<p class="text-sm text-navy-300">Organizations using PlayIMs</p>
					</div>
				</div>
			</div>

			<!-- Data Lists -->
			{#if data.error}
				<div class="bg-navy-900 border-2 border-navy-600 p-6 text-center">
					<p class="text-navy-200">{data.error}</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Users List -->
					<div class="bg-navy-900 border-2 border-navy-700">
						<div class="bg-red-700 border-b-2 border-red-600 p-4 flex items-center gap-3">
							<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
								></path>
							</svg>
							<h3 class="text-xl font-bold text-white">Recent Users</h3>
						</div>
						<div class="max-h-96 overflow-y-auto">
							{#if data.users.length > 0}
								{#each data.users.slice(0, 10) as user}
									<div
										class="border-b-2 border-navy-800 p-4 flex items-center gap-4 hover:bg-navy-800 transition-colors"
									>
										<div
											class="bg-red-600 w-12 h-12 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
										>
											{(user.firstName || 'U').charAt(0).toUpperCase()}
										</div>
										<div class="min-w-0 flex-1">
											<h4 class="text-base font-bold text-white mb-1 truncate">
												{user.firstName || 'Unknown'}
											</h4>
											<p class="text-sm text-navy-300 truncate">{user.email || 'No email'}</p>
										</div>
									</div>
								{/each}
							{:else}
								<div class="p-8 text-center text-navy-300">No users found</div>
							{/if}
						</div>
					</div>

					<!-- Clients List -->
					<div class="bg-navy-900 border-2 border-navy-700">
						<div class="bg-navy-700 border-b-2 border-navy-600 p-4 flex items-center gap-3">
							<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
								></path>
							</svg>
							<h3 class="text-xl font-bold text-white">Recent Clients</h3>
						</div>
						<div class="max-h-96 overflow-y-auto">
							{#if data.clients.length > 0}
								{#each data.clients.slice(0, 10) as client}
									<div
										class="border-b-2 border-navy-800 p-4 flex items-center gap-4 hover:bg-navy-800 transition-colors"
									>
										<div
											class="bg-powder-600 w-12 h-12 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
										>
											{(client.name || 'C').charAt(0).toUpperCase()}
										</div>
										<div class="min-w-0 flex-1">
											<h4 class="text-base font-bold text-white mb-1 truncate">
												{client.name || 'Unknown'}
											</h4>
											<p class="text-sm text-navy-300 truncate">{client.slug || 'No slug'}</p>
										</div>
									</div>
								{/each}
							{:else}
								<div class="p-8 text-center text-navy-300">No clients found</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- CTA Section -->
	<section class="bg-red-600 py-16 sm:py-24">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
			<h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
				Ready to Transform Your League?
			</h2>
			<p class="text-lg sm:text-xl text-red-100 mb-8 max-w-2xl mx-auto">
				Join the future of intramural sports management. We're launching in the coming years with
				features that will revolutionize how you run your leagues.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center mb-6">
				<button
					class="bg-white text-red-600 px-8 py-3 font-bold text-lg hover:bg-beige-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					disabled
				>
					Get Early Access
				</button>
				<button
					class="bg-transparent border-2 border-white text-white px-8 py-3 font-bold text-lg hover:bg-white hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					disabled
				>
					Contact Sales
				</button>
			</div>
			<p class="text-base text-red-200">Building the future of league management</p>
		</div>
	</section>

	<!-- Footer -->
	<footer class="bg-navy-950 py-8">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
			<p class="text-navy-300 mb-2">
				&copy; {new Date().getFullYear()} PlayIMs. All rights reserved.
			</p>
			<p class="text-sm text-navy-400">Environment: {data.environment}</p>
		</div>
	</footer>
</div>
