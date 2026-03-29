<script lang="ts">
	import type { ComponentType } from 'svelte';
	import type { SvelteComponent } from 'svelte';

	type IconComponent = ComponentType<SvelteComponent<{ class?: string }>>;

	interface Props {
		label: string;
		href?: string | null;
		icon: IconComponent;
		containerClass?: string;
		iconTileClass?: string;
		iconClass?: string;
		labelClass?: string;
	}

	let {
		label,
		href = null,
		icon: Icon,
		containerClass = 'inline-flex w-fit max-w-full items-center gap-2',
		iconTileClass = 'flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white transition-colors group-hover/link:bg-primary-700 group-focus-visible/link:bg-primary-700',
		iconClass = 'h-6 w-6',
		labelClass = 'font-sans text-sm font-bold text-neutral-950 group-hover/link:underline group-focus-visible/link:underline'
	}: Props = $props();

	const plainIconTileClass = $derived.by(() =>
		iconTileClass
			.replace(/\bgroup-hover\/link:[^\s]+/g, '')
			.replace(/\bgroup-focus-visible\/link:[^\s]+/g, '')
			.replace(/\s+/g, ' ')
			.trim()
	);
	const plainLabelClass = $derived.by(() =>
		labelClass
			.replace(/\bgroup-hover\/link:[^\s]+/g, '')
			.replace(/\bgroup-focus-visible\/link:[^\s]+/g, '')
			.replace(/\s+/g, ' ')
			.trim()
	);
</script>

{#if href}
	<a href={href} class={`group/link ${containerClass}`.trim()}>
		<div class={iconTileClass} aria-hidden="true">
			<Icon class={iconClass} />
		</div>
		<div class="min-w-0">
			<span class={labelClass}>{label}</span>
		</div>
	</a>
{:else}
	<div class={containerClass}>
		<div class={plainIconTileClass} aria-hidden="true">
			<Icon class={iconClass} />
		</div>
		<div class="min-w-0">
			<p class={plainLabelClass}>{label}</p>
		</div>
	</div>
{/if}
