<script lang="ts">
	import 'virtual:pwa-assets/head';

	import '../app.css';

	let { children } = $props();
</script>

<div class="app">
	<main>
		{@render children()}
	</main>
</div>
