<svelte:head>
	<title>Offline - PlayIMs</title>
	<meta name="description" content="You are currently offline. Some features may be unavailable." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen bg-secondary flex items-center justify-center px-4 sm:px-6 lg:px-8">
	<div class="max-w-lg w-full text-center">
		<!-- Offline Icon -->
		<div class="mb-8">
			<div class="bg-secondary-400 border-2 border-secondary-300 w-24 h-24 mx-auto flex items-center justify-center">
				<svg class="w-12 h-12 text-secondary-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
					/>
				</svg>
			</div>
		</div>

		<!-- Offline Message -->
		<div class="mb-8">
			<h1 class="text-3xl sm:text-4xl font-bold text-secondary-25 mb-4">You're Offline</h1>
			<p class="text-lg text-secondary-50 mb-4">
				It looks like you've lost your internet connection. Don't worry—some features are still available.
			</p>
			<p class="text-base text-secondary-100">
				Any previously loaded pages should still work. Try refreshing or check your connection.
			</p>
		</div>

		<!-- Actions -->
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<button
				onclick={() => window.location.reload()}
				class="border-2 border-primary bg-primary text-white hover:bg-primary-600 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Try Again
			</button>
			<a
				href="/"
				class="border-2 border-secondary-300 bg-secondary-400 text-secondary-25 hover:bg-secondary-300 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 transition-colors duration-200"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				Go Home
			</a>
		</div>

		<!-- Cached Content Info -->
		<div class="mt-12 pt-8 border-t-2 border-secondary-400">
			<div class="flex items-center justify-center gap-2 text-sm text-secondary-100">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>Certain pages are available offline</span>
			</div>
		</div>
	</div>
</div>
