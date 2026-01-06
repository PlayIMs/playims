<script lang="ts">
	import { onMount } from 'svelte';
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';
	import * as theme from '$lib/theme';

	let { children } = $props();
	// injectSpeedInsights();

	onMount(() => {
		theme.init();
	});
</script>

<div class="app">
	<main>
		{@render children()}
	</main>
</div>
