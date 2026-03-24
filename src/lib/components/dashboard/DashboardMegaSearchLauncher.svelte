<script lang="ts">
	import { browser } from '$app/environment';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		megaSearchQuery,
		openMegaSearchPalette,
		resolveMegaSearchShortcutHint,
		setMegaSearchQuery
	} from '$lib/search/controller.js';

	interface Props {
		variant?: 'hero' | 'compact';
		placeholder?: string;
		label?: string;
		wrapperClass?: string;
		inputId?: string;
	}

	let {
		variant = 'hero',
		placeholder = 'Search anything',
		label = 'Open mega search',
		wrapperClass = '',
		inputId = 'dashboard-mega-search-launcher'
	}: Props = $props();

	let shortcutHint = $state('Ctrl + K');

	const maxWidthClass = $derived.by(() =>
		variant === 'compact' ? 'w-full sm:max-w-sm' : 'w-full sm:max-w-md'
	);
	const inputClass = $derived.by(() =>
		variant === 'compact'
			? 'input-secondary min-h-11 border-2 border-neutral-950 pl-10 pr-22 text-sm'
			: 'input-secondary min-h-12 border-2 border-neutral-950 pl-10 pr-24 text-sm'
	);
	const badgeClass = $derived.by(() =>
		variant === 'compact'
			? 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-700'
			: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-700'
	);

	function openFromLauncher(initialQuery?: string): void {
		openMegaSearchPalette('launcher', initialQuery ?? $megaSearchQuery);
	}

	$effect(() => {
		if (!browser) return;
		shortcutHint = resolveMegaSearchShortcutHint(
			`${navigator.platform} ${navigator.userAgent}`.toLowerCase()
		);
	});
</script>

<div class={`${maxWidthClass} ${wrapperClass}`.trim()}>
	<div class="relative">
		<SearchInput
			id={inputId}
			{label}
			value={$megaSearchQuery}
			type="search"
			{placeholder}
			{inputClass}
			iconClass="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-neutral-950"
			clearButtonClass="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
			clearIconClass="h-4 w-4"
			onfocus={() => {
				openFromLauncher();
			}}
			onmousedown={() => {
				if (!$megaSearchQuery.trim()) {
					openFromLauncher();
				}
			}}
			on:input={(event) => {
				const nextValue = event.detail.value;
				setMegaSearchQuery(nextValue);
				openFromLauncher(nextValue);
			}}
		/>
		{#if !$megaSearchQuery.trim()}
			<span class={badgeClass}>{shortcutHint}</span>
		{/if}
	</div>
</div>
