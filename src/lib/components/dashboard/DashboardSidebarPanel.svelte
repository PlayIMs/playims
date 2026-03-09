<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		icon?: Snippet<[]>;
		panelClass?: string;
		headerClass?: string;
		titleClass?: string;
		contentClass?: string;
		content: Snippet<[]>;
	}

	let {
		title,
		icon,
		panelClass = 'border-2 border-neutral-950 bg-neutral',
		headerClass = 'flex items-center justify-between gap-3 border-b border-neutral-950 bg-neutral-600/66 p-4',
		titleClass = 'text-xl font-bold font-serif text-neutral-950',
		contentClass = 'p-4',
		content
	}: Props = $props();
</script>

<section class={panelClass}>
	<div class={headerClass}>
		<h2 class={titleClass}>{title}</h2>
		{#if icon}
			<div class="shrink-0 text-secondary-700">
				{@render icon()}
			</div>
		{/if}
	</div>
	<div class={contentClass}>
		{@render content()}
	</div>
</section>
