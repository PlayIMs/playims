<script lang="ts">
	import IconInfoCircle from '@tabler/icons-svelte/icons/info-circle';
	import { tick, type Snippet } from 'svelte';

	interface Props {
		buttonAriaLabel?: string;
		buttonVariant?: 'default' | 'label-inline';
		align?: 'left' | 'right';
		panelWidthClass?: string;
		buttonClass?: string;
		panelClass?: string;
		iconClass?: string;
		children?: Snippet;
	}

	let {
		buttonAriaLabel = 'More information',
		buttonVariant = 'default',
		align = 'right',
		panelWidthClass = 'w-72',
		buttonClass,
		panelClass = 'z-10 border border-secondary-300 bg-white p-2 text-xs text-neutral-950 shadow-md',
		iconClass,
		children
	}: Props = $props();

	const DEFAULT_BUTTON_CLASS =
		'cursor-pointer p-1.5 border border-secondary-300 bg-neutral text-secondary-900 hover:bg-secondary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-600';
	const LABEL_INLINE_BUTTON_CLASS =
		'cursor-pointer inline-flex h-4 w-4 items-center justify-center p-0 text-secondary-900 hover:text-secondary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-600';
	const DEFAULT_ICON_CLASS = 'w-4 h-4';
	const LABEL_INLINE_ICON_CLASS = 'w-3.5 h-3.5';
	const resolvedButtonClass = $derived.by(() =>
		buttonClass ??
		(buttonVariant === 'label-inline' ? LABEL_INLINE_BUTTON_CLASS : DEFAULT_BUTTON_CLASS)
	);
	const resolvedIconClass = $derived.by(() =>
		iconClass ?? (buttonVariant === 'label-inline' ? LABEL_INLINE_ICON_CLASS : DEFAULT_ICON_CLASS)
	);

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let panelStyle = $state('position: fixed; left: 0px; top: 0px; visibility: hidden;');

	const EDGE_PADDING_PX = 8;
	const TRIGGER_GAP_PX = 8;

	function updatePanelPosition(): void {
		if (typeof window === 'undefined' || !root || !panel) return;

		const rootRect = root.getBoundingClientRect();
		const panelRect = panel.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const availableWidth = Math.max(0, viewportWidth - EDGE_PADDING_PX * 2);
		const panelWidth = Math.min(panelRect.width, availableWidth);

		let left = align === 'right' ? rootRect.right - panelWidth : rootRect.left;
		left = Math.max(EDGE_PADDING_PX, Math.min(left, viewportWidth - EDGE_PADDING_PX - panelWidth));

		let top = rootRect.bottom + TRIGGER_GAP_PX;
		const bottomOverflow = top + panelRect.height > viewportHeight - EDGE_PADDING_PX;
		if (bottomOverflow) {
			const aboveTop = rootRect.top - TRIGGER_GAP_PX - panelRect.height;
			if (aboveTop >= EDGE_PADDING_PX) {
				top = aboveTop;
			} else {
				top = Math.max(EDGE_PADDING_PX, viewportHeight - EDGE_PADDING_PX - panelRect.height);
			}
		}

		panelStyle = `position: fixed; left: ${Math.round(left)}px; top: ${Math.round(top)}px; max-width: ${availableWidth}px; visibility: visible;`;
	}

	function toggleOpen(): void {
		if (!open) {
			panelStyle = 'position: fixed; left: 0px; top: 0px; visibility: hidden;';
		}
		open = !open;
	}

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;
		let frameId: number | null = null;

		const schedulePositionUpdate = () => {
			if (frameId !== null) return;
			frameId = window.requestAnimationFrame(() => {
				frameId = null;
				updatePanelPosition();
			});
		};

		void tick().then(() => {
			updatePanelPosition();
		});

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

		const handleWindowResize = () => {
			schedulePositionUpdate();
		};

		const handleWindowScroll = () => {
			schedulePositionUpdate();
		};

		window.addEventListener('pointerdown', handleWindowPointerDown);
		window.addEventListener('keydown', handleWindowKeydown, true);
		window.addEventListener('resize', handleWindowResize);
		window.addEventListener('scroll', handleWindowScroll, true);

		return () => {
			window.removeEventListener('pointerdown', handleWindowPointerDown);
			window.removeEventListener('keydown', handleWindowKeydown, true);
			window.removeEventListener('resize', handleWindowResize);
			window.removeEventListener('scroll', handleWindowScroll, true);
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
		};
	});
</script>

<div class="relative shrink-0" bind:this={root}>
	<button
		type="button"
		class={resolvedButtonClass}
		aria-label={buttonAriaLabel}
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={toggleOpen}
	>
		<IconInfoCircle class={resolvedIconClass} />
	</button>
	{#if open}
		<div bind:this={panel} class={`${panelWidthClass} ${panelClass}`} style={panelStyle}>
			{@render children?.()}
		</div>
	{/if}
</div>
