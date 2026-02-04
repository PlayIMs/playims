<script lang="ts">
	import { page } from '$app/stores';
	import ErrorView from '$lib/components/ErrorView.svelte';

	let statusText = $derived($page.status === 404 ? '404' : String($page.status ?? 'Error'));
	let titleText = $derived($page.status === 404 ? 'Page Not Found' : 'Something Went Wrong');
	let messageText = $derived(
		$page.status === 404
			? "Sorry, we couldn't find the page you're looking for."
			: $page.error?.message || 'An unexpected error occurred. Please try again later.'
	);
	let detailText = $derived(
		$page.status !== 404 && $page.error?.message ? $page.error.message : null
	);
</script>

<svelte:head>
	<title>{$page.status === 404 ? 'Page Not Found' : 'Error'} - PlayIMs</title>
	<meta
		name="description"
		content="The page you're looking for doesn't exist. Return to PlayIMs home."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<ErrorView {statusText} {titleText} {messageText} {detailText} />
