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

<div class="min-h-screen bg-secondary-500">
	<!-- Hero Section -->
	<section class="bg-primary-600 text-white">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
			<div class="text-center">
				<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
					Play<span class="text-primary-200">IMs</span>
				</h1>
				<p class="text-xl sm:text-2xl mb-4 text-primary-100 font-medium">
					The next-generation platform for managing intramural sports leagues
				</p>
				<p class="text-lg sm:text-xl mb-8 text-primary-200 max-w-3xl mx-auto">
					Built from the ground up to be more intuitive, easier to use, and more powerful than
					existing solutions. Designed for both administrators and players who deserve better.
				</p>
				<div class="flex flex-col sm:flex-row gap-4 justify-center">
					<button
						class="bg-white text-primary-950 px-8 py-3 font-bold text-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled
					>
						Get Started
					</button>
					<button
						class="bg-transparent border-2 border-white text-white px-8 py-3 font-bold text-lg hover:bg-white hover:text-primary-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled
					>
						Learn More
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="bg-secondary-500 py-16 sm:py-24">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-12">
				<h2 class="text-3xl sm:text-4xl font-bold text-secondary-950 mb-4">
					Everything you need, designed the right way
				</h2>
				<p class="text-lg text-secondary-900 max-w-2xl mx-auto">
					All the features you expect, reimagined for simplicity and ease of use. Built for
					administrators who want control without complexity, and players who want clarity without
					confusion.
				</p>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Feature 1 -->
				<div
					class="bg-white border-l-4 border-primary-500 p-6 hover:border-primary-600 transition-colors"
				>
					<div class="bg-primary-500 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-primary-950 mb-2">Intuitive Team Management</h3>
					<p class="text-secondary-900">
						Streamlined team registration and roster management that actually makes sense. No more
						confusing workflows—just simple, clear processes that work the way you think.
					</p>
				</div>

				<!-- Feature 2 -->
				<div
					class="bg-white border-l-4 border-accent-500 p-6 hover:border-accent-600 transition-colors"
				>
					<div class="bg-accent-500 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-primary-950 mb-2">Smart Scheduling</h3>
					<p class="text-secondary-900">
						Automated scheduling that handles conflicts intelligently, so you don't have to. Venue
						management that's straightforward and visual, not buried in menus.
					</p>
				</div>

				<!-- Feature 3 -->
				<div
					class="bg-white border-l-4 border-tertiary-500 p-6 hover:border-tertiary-600 transition-colors"
				>
					<div class="bg-tertiary-500 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-tertiary-950 mb-2">Clear Standings & Stats</h3>
					<p class="text-secondary-900">
						Real-time standings and statistics presented in a way that's easy to understand at a
						glance. No more hunting through confusing interfaces to find what you need.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- What We're Building Section -->
	<section class="bg-tertiary-800 py-16 sm:py-24">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="text-center mb-12">
				<h2 class="text-3xl sm:text-4xl font-bold text-tertiary-50 mb-4">Built for Everyone</h2>
				<p class="text-lg text-tertiary-100">
					Designed with both administrators and players in mind—because great software shouldn't
					require a manual
				</p>
			</div>

			<!-- Key Benefits -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
				<div class="bg-tertiary-900 border-2 border-tertiary-700 p-6">
					<div class="bg-primary-600 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-tertiary-50 mb-2">Admin-Friendly</h3>
					<p class="text-tertiary-200">
						Powerful administrative tools that don't require a computer science degree. Manage
						leagues, divisions, teams, and schedules with an interface that makes sense from day
						one.
					</p>
				</div>

				<div class="bg-tertiary-900 border-2 border-tertiary-700 p-6">
					<div class="bg-accent-600 w-16 h-16 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
							></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-tertiary-50 mb-2">Player-Friendly</h3>
					<p class="text-tertiary-200">
						Clear schedules, easy registration, and straightforward team management. Find your
						games, check standings, and manage your participation without getting lost in the
						interface.
					</p>
				</div>
			</div>

			<!-- Additional Features -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div class="bg-tertiary-900 border-2 border-tertiary-700 p-6">
					<h3 class="text-lg font-bold text-tertiary-50 mb-2">Division & League Management</h3>
					<p class="text-sm text-tertiary-200">
						Organize multiple leagues and divisions with clear hierarchies. Set up seasons, manage
						rosters, and handle registrations all in one intuitive system.
					</p>
				</div>
				<div class="bg-tertiary-900 border-2 border-tertiary-700 p-6">
					<h3 class="text-lg font-bold text-tertiary-50 mb-2">Event & Game Management</h3>
					<p class="text-sm text-tertiary-200">
						Schedule games, track results, and manage events with tools that make sense. View
						everything in a calendar format that's actually usable.
					</p>
				</div>
				<div class="bg-tertiary-900 border-2 border-tertiary-700 p-6">
					<h3 class="text-lg font-bold text-tertiary-50 mb-2">Comprehensive Statistics</h3>
					<p class="text-sm text-tertiary-200">
						Track team and player performance with detailed statistics. View standings, game
						history, and performance metrics in formats that are easy to understand.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="bg-primary-600 py-16 sm:py-24">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
			<h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-50 mb-4">
				Ready for Something Better?
			</h2>
			<p class="text-lg sm:text-xl text-primary-200 mb-8 max-w-2xl mx-auto">
				We're building the intramural sports management platform you've been waiting for. One that's
				actually intuitive, genuinely easy to use, and designed for real people—not just feature
				checklists.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center mb-6">
				<button
					class="bg-white text-primary-950 px-8 py-3 font-bold text-lg hover:bg-secondary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					disabled
				>
					Get Early Access
				</button>
				<button
					class="bg-transparent border-2 border-white text-white px-8 py-3 font-bold text-lg hover:bg-white hover:text-primary-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					disabled
				>
					Contact Sales
				</button>
			</div>
			<p class="text-base text-primary-300">Currently in development. Coming soon.</p>
		</div>
	</section>

	<!-- Footer -->
	<footer class="bg-tertiary-950 py-8">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
			<p class="text-tertiary-200 mb-2">
				&copy; {new Date().getFullYear()} PlayIMs. All rights reserved.
			</p>
			<p class="text-sm text-tertiary-300">Environment: {data.environment}</p>
		</div>
	</footer>
</div>
