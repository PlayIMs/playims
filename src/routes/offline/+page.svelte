<script lang="ts">
	import ErrorView from '$lib/components/ErrorView.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

	const statusText = 'OFFLINE';
	const titleText = 'You Are Offline';
	const messageText = "We can't reach PlayIMs right now.";
	const detailText = 'Check your connection and try again.';
</script>

<PageTitle pageTitle="Offline" />

<svelte:head>
	<meta name="description" content="You are currently offline. Some features may be unavailable." />
	<meta name="robots" content="noindex" />
</svelte:head>

<ErrorView {statusText} {titleText} {messageText} {detailText} />
