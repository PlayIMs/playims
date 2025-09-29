<script lang="ts">
	import { onMount } from 'svelte';
	import type { Client, User } from '$lib/database';

	export let data: {
		clients: Client[];
		users: User[];
		isDevelopment: boolean;
		environment: string;
		error?: string;
	};

	onMount(() => {
		console.log('=== D1 Database Query Results ===');
		console.log('Environment:', data.environment);
		console.log('Development mode:', data.isDevelopment);

		if (data.error) {
			console.error('Database error:', data.error);
		} else {
			console.log('Clients:', data.clients);
			console.log('Users:', data.users);
			console.log('Total clients:', data.clients.length);
			console.log('Total users:', data.users.length);
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

<!-- Hero Section -->
<section class="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center">
	<div class="container mx-auto px-4 py-16">
		<div class="max-w-4xl mx-auto text-center">
			<!-- Logo/Title -->
			<h1 class="text-5xl md:text-7xl font-bold text-slate-900 mb-6">
				Play<span class="text-purple-700">IMs</span>
			</h1>

			<!-- Subtitle -->
			<p class="text-xl md:text-2xl text-slate-600 mb-8 max-w-2xl mx-auto">
				The ultimate platform for managing intramural sports leagues
			</p>

			<!-- Description -->
			<p class="text-lg text-slate-500 mb-12 max-w-3xl mx-auto">
				Streamline your league management with easy team registration, automated scheduling,
				real-time standings, and comprehensive statistics tracking.
			</p>

			<!-- Coming Soon -->
			<div class="flex justify-center">
				<div
					class="bg-purple-100 text-purple-800 font-semibold py-3 px-8 rounded-lg border border-purple-200"
				>
					Coming Soon
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-20 bg-slate-50">
	<div class="container mx-auto px-4">
		<div class="max-w-6xl mx-auto">
			<h2 class="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-16">
				Everything you need to run successful leagues
			</h2>

			<div class="grid md:grid-cols-3 gap-8">
				<!-- Feature 1 -->
				<div class="text-center p-6">
					<div
						class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<svg
							class="w-8 h-8 text-purple-700"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-slate-900 mb-2">Team Management</h3>
					<p class="text-slate-600">
						Easy team registration, player rosters, and captain management tools.
					</p>
				</div>

				<!-- Feature 2 -->
				<div class="text-center p-6">
					<div
						class="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<svg
							class="w-8 h-8 text-slate-700"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-slate-900 mb-2">Smart Scheduling</h3>
					<p class="text-slate-600">
						Automated game scheduling with conflict resolution and venue management.
					</p>
				</div>

				<!-- Feature 3 -->
				<div class="text-center p-6">
					<div
						class="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<svg
							class="w-8 h-8 text-purple-800"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-slate-900 mb-2">Live Standings</h3>
					<p class="text-slate-600">
						Real-time standings, statistics, and league performance tracking.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="py-20 bg-gradient-to-r from-purple-700 to-purple-800">
	<div class="container mx-auto px-4 text-center">
		<div class="max-w-3xl mx-auto">
			<h2 class="text-3xl md:text-4xl font-bold text-white mb-6">Coming Soon</h2>
			<p class="text-xl text-purple-100">
				We're working hard to bring you the ultimate intramural sports league management platform.
			</p>
		</div>
	</div>
</section>
