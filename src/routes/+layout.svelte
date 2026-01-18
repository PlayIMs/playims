<script lang="ts">
	import { onMount } from 'svelte';
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';
	import * as theme from '$lib/theme';
	import { selectArrow } from '$lib/actions';

	let { children } = $props();
	// injectSpeedInsights();

	onMount(() => {
		theme.init();

		// Automatically apply selectArrow action to all themed select elements
		function applySelectArrowToAll() {
			const selects = document.querySelectorAll<HTMLSelectElement>(
				'select.select-primary, select.select-secondary, select.select-accent'
			);
			selects.forEach((select) => {
				// Only apply if not already applied (check for a data attribute)
				if (!select.dataset.selectArrowApplied) {
					select.dataset.selectArrowApplied = 'true';
					selectArrow(select);
				}
			});
		}

		// Apply immediately
		applySelectArrowToAll();

		// Watch for new selects added dynamically
		const observer = new MutationObserver(() => {
			applySelectArrowToAll();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		return () => {
			observer.disconnect();
		};
	});
</script>

<div class="app">
	<main>
		{@render children()}
	</main>
</div>
