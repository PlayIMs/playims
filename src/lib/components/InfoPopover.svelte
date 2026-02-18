<script lang="ts">
	import IconInfoCircle from '@tabler/icons-svelte/icons/info-circle';
	import type { Snippet } from 'svelte';

	interface Props {
		buttonAriaLabel?: string;
		align?: 'left' | 'right';
		panelWidthClass?: string;
		buttonClass?: string;
		panelClass?: string;
		iconClass?: string;
		children?: Snippet;
	}

	let {
		buttonAriaLabel = 'More information',
		align = 'right',
		panelWidthClass = 'w-72',
		buttonClass = 'cursor-pointer p-1.5 border border-secondary-300 bg-neutral text-secondary-900 hover:bg-secondary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-600',
		panelClass = 'top-8 z-10 border border-secondary-300 bg-white p-2 text-xs text-neutral-950 shadow-sm',
		iconClass = 'w-4 h-4',
		children
	}: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	function toggleOpen(): void {
		open = !open;
	}

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;

		const handleWindowPointerDown = (event: PointerEvent) => {
			if (!root) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (root.contains(target)) return;
			open = false;
		};

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			open = false;
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
		};

		window.addEventListener('pointerdown', handleWindowPointerDown);
		window.addEventListener('keydown', handleWindowKeydown, true);

		return () => {
			window.removeEventListener('pointerdown', handleWindowPointerDown);
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<div class="relative shrink-0" bind:this={root}>
	<button
		type="button"
		class={buttonClass}
		aria-label={buttonAriaLabel}
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={toggleOpen}
	>
		<IconInfoCircle class={iconClass} />
	</button>
	{#if open}
		<div class={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${panelWidthClass} ${panelClass}`}>
			{@render children?.()}
		</div>
	{/if}
</div>
