<script lang="ts">
	export const prerender = true;

	import ErrorView from '$lib/components/ErrorView.svelte';

	const statusText = 'OFFLINE';
	const titleText = 'You Are Offline';
	const messageText = "We can't reach PlayIMs right now.";
	const detailText = 'Check your connection and try again.';
</script>

<svelte:head>
	<title>Offline - PlayIMs</title>
	<meta name="description" content="You are currently offline. Some features may be unavailable." />
	<meta name="robots" content="noindex" />
</svelte:head>

<ErrorView {statusText} {titleText} {messageText} {detailText} />
