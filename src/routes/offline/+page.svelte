<script lang="ts">
	import IconWifiOff from '@tabler/icons-svelte/icons/wifi-off';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconHome from '@tabler/icons-svelte/icons/home';
	import IconCheck from '@tabler/icons-svelte/icons/check';
</script>

<svelte:head>
	<title>Offline - PlayIMs</title>
	<meta name="description" content="You are currently offline. Some features may be unavailable." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen bg-secondary-500 flex items-center justify-center px-4 sm:px-6 lg:px-8">
	<div class="max-w-lg w-full text-center">
		<!-- Offline Icon -->
		<div class="mb-8">
			<div class="bg-secondary-400 border-2 border-secondary-300 w-24 h-24 mx-auto flex items-center justify-center">
				<IconWifiOff class="w-12 h-12 text-secondary-100" />
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
				class="border-2 border-primary-500 bg-primary-500 text-white hover:bg-primary-600 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200"
			>
				<IconRefresh class="w-5 h-5" />
				Try Again
			</button>
			<a
				href="/"
				class="border-2 border-secondary-300 bg-secondary-400 text-secondary-25 hover:bg-secondary-300 px-8 py-3 text-base font-medium inline-flex items-center justify-center gap-2 transition-colors duration-200"
			>
				<IconHome class="w-5 h-5" />
				Go Home
			</a>
		</div>

		<!-- Cached Content Info -->
		<div class="mt-12 pt-8 border-t-2 border-secondary-400">
			<div class="flex items-center justify-center gap-2 text-sm text-secondary-100">
				<IconCheck class="w-4 h-4" />
				<span>Certain pages are available offline</span>
			</div>
		</div>
	</div>
</div>
