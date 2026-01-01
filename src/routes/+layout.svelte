<script lang="ts">
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';

	let { children } = $props();
	// injectSpeedInsights();
</script>

<div class="app">
	<main>
		{@render children()}
	</main>
</div>
