<script lang="ts">
	import { page } from '$app/stores';
	import { buildDocumentTitle, resolveOrganizationNameFromPageData } from '$lib/utils/page-title';

	type Props = {
		pageTitle: string;
		organizationName?: string | null;
	};

	let { pageTitle, organizationName = null }: Props = $props();

	const resolvedOrganizationName = $derived.by(
		() => organizationName ?? resolveOrganizationNameFromPageData($page.data)
	);
	const documentTitle = $derived(buildDocumentTitle(pageTitle, resolvedOrganizationName));
</script>

<svelte:head>
	<title>{documentTitle}</title>
</svelte:head>
