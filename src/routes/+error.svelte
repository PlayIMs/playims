<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Page Not Found - PlayIMs</title>
	<meta name="description" content="The page you're looking for doesn't exist. Return to PlayIMs home." />
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="min-h-screen bg-secondary flex items-center justify-center px-4 sm:px-6 lg:px-8">
	<div class="max-w-lg w-full text-center">
		<!-- Error Code -->
		<div class="mb-8">
			<h1 class="text-8xl sm:text-9xl font-bold text-primary-500 tracking-tight">404</h1>
		</div>

		<!-- Error Message -->
		<div class="mb-8">
			<h2 class="text-2xl sm:text-3xl font-bold text-secondary-25 mb-4">Page Not Found</h2>
			<p class="text-lg text-secondary-50 mb-2">
				Sorry, we couldn't find the page you're looking for.
			</p>
			{#if $page.error?.message}
				<p class="text-sm text-secondary-100 mt-2">{$page.error.message}</p>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<a
				href="/"
				class="border-2 border-primary-500 bg-primary-500 text-white hover:bg-primary-600 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 transition-colors duration-200"
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
			<a
				href="/dashboard"
				class="border-2 border-secondary-300 bg-secondary-400 text-secondary-25 hover:bg-secondary-300 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 transition-colors duration-200"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
					/>
				</svg>
				Dashboard
			</a>
		</div>

		<!-- Help Text -->
		<div class="mt-12 pt-8 border-t-2 border-secondary-400">
			<p class="text-sm text-secondary-100">
				If you believe this is an error, please contact support.
			</p>
		</div>
	</div>
</div>
