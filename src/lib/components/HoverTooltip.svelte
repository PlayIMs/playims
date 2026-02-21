<script lang="ts" module>
	let tooltipIdSequence = 0;

	function nextTooltipId(prefix: string): string {
		tooltipIdSequence += 1;
		return `${prefix}-${tooltipIdSequence}`;
	}
</script>

<script lang="ts">
	import { onDestroy, tick, type Snippet } from 'svelte';
	import {
		resolveCursorFloatingPosition,
		toFixedStyle
	} from '$lib/components/floating-position.js';

	interface Props {
		text: string;
		cursorOffsetXPx?: number;
		cursorOffsetYPx?: number;
		paddingPx?: number;
		minWidthPx?: number;
		panelClass?: string;
		maxWidthClass?: string;
		wrapperClass?: string;
		children?: Snippet;
	}

	let {
		text,
		cursorOffsetXPx = 20,
		cursorOffsetYPx = 18,
		paddingPx = 8,
		minWidthPx = 180,
		panelClass = 'border border-secondary-300 bg-neutral px-2 py-1 text-[11px] text-neutral-950 shadow-sm',
		maxWidthClass = 'max-w-72',
		wrapperClass = 'relative inline-flex shrink-0',
		children
	}: Props = $props();

	let root = $state<HTMLDivElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let panelStyle = $state('position: fixed; left: 0px; top: 0px; visibility: hidden;');
	let focusInside = $state(false);
	let pointerX = $state<number | null>(null);
	let pointerY = $state<number | null>(null);
	let frameId: number | null = null;
	const tooltipId = nextTooltipId('hover-tooltip');
	const normalizedText = $derived.by(() => String(text ?? '').trim());

	function clearScheduledFrame(): void {
		if (typeof window === 'undefined' || frameId === null) return;
		window.cancelAnimationFrame(frameId);
		frameId = null;
	}

	function schedulePositionUpdate(): void {
		if (typeof window === 'undefined' || !open) return;
		if (frameId !== null) return;
		frameId = window.requestAnimationFrame(() => {
			frameId = null;
			updatePosition();
		});
	}

	function fallbackAnchor(): { x: number; y: number } | null {
		if (!root) return null;
		const rect = root.getBoundingClientRect();
		return { x: rect.right, y: rect.bottom };
	}

	function updatePosition(): void {
		if (typeof window === 'undefined' || !panel || !open) return;
		const anchor = pointerX !== null && pointerY !== null ? { x: pointerX, y: pointerY } : fallbackAnchor();
		if (!anchor) return;
		const panelRect = panel.getBoundingClientRect();
		const viewportLeft = paddingPx;
		const viewportRight = Math.max(viewportLeft, window.innerWidth - paddingPx);
		const availableWidth = Math.max(0, viewportRight - viewportLeft);
		const measuredWidth = Math.min(panelRect.width, availableWidth);
		const isWrapped = panel.scrollWidth > panel.clientWidth + 1;
		const position = resolveCursorFloatingPosition({
			cursorX: anchor.x,
			cursorY: anchor.y,
			panelWidth: panelRect.width,
			panelHeight: panelRect.height,
			offsetX: cursorOffsetXPx,
			offsetY: cursorOffsetYPx,
			paddingPx,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight
		});
		const resolvedMinWidth = Math.round(Math.min(Math.max(0, minWidthPx), position.maxWidth));
		const isNarrowerThanMinimum = measuredWidth + 1 < resolvedMinWidth;
		const requiresEdgeProtection = isWrapped && isNarrowerThanMinimum;
		const minWidthStyle =
			requiresEdgeProtection && resolvedMinWidth > 0 ? `min-width: ${resolvedMinWidth}px;` : '';
		const maxWidthStyle =
			panelRect.width > position.maxWidth ? `max-width: ${Math.round(position.maxWidth)}px;` : '';
		panelStyle = toFixedStyle(position, `${minWidthStyle} ${maxWidthStyle}`.trim());
	}

	function show(): void {
		if (!normalizedText) return;
		open = true;
		panelStyle = 'position: fixed; left: 0px; top: 0px; visibility: hidden;';
		schedulePositionUpdate();
	}

	function hide(): void {
		open = false;
		panelStyle = 'position: fixed; left: 0px; top: 0px; visibility: hidden;';
		clearScheduledFrame();
	}

	function setPointerFromEvent(event: MouseEvent | PointerEvent): void {
		pointerX = event.clientX;
		pointerY = event.clientY;
	}

	function handleRootPointerEnter(event: MouseEvent | PointerEvent): void {
		setPointerFromEvent(event);
		show();
	}

	function handleRootPointerMove(event: MouseEvent | PointerEvent): void {
		setPointerFromEvent(event);
		schedulePositionUpdate();
	}

	function handleRootPointerLeave(): void {
		pointerX = null;
		pointerY = null;
		if (!focusInside) hide();
	}

	function handleFocusOut(event: FocusEvent): void {
		const nextTarget = event.relatedTarget;
		if (!(nextTarget instanceof Node)) {
			focusInside = false;
			hide();
			return;
		}
		if (root?.contains(nextTarget)) return;
		focusInside = false;
		hide();
	}

	onDestroy(() => {
		clearScheduledFrame();
	});

	$effect(() => {
		if (!open || typeof window === 'undefined') return;
		void tick().then(updatePosition);
		window.addEventListener('resize', schedulePositionUpdate);
		window.addEventListener('scroll', schedulePositionUpdate, true);
		return () => {
			window.removeEventListener('resize', schedulePositionUpdate);
			window.removeEventListener('scroll', schedulePositionUpdate, true);
			clearScheduledFrame();
		};
	});

	$effect(() => {
		if (normalizedText.length > 0 || !open) return;
		hide();
	});
</script>

<div
	class={wrapperClass}
	role="presentation"
	bind:this={root}
	onpointerenter={handleRootPointerEnter}
	onpointermove={handleRootPointerMove}
	onpointerleave={handleRootPointerLeave}
	onmouseenter={handleRootPointerEnter}
	onmousemove={handleRootPointerMove}
	onmouseleave={handleRootPointerLeave}
	onfocusin={() => {
		focusInside = true;
		show();
	}}
	onfocusout={handleFocusOut}
>
	{@render children?.()}
	{#if open}
		<div
			id={tooltipId}
			role="tooltip"
			aria-live="polite"
			class={`pointer-events-none z-[200] whitespace-normal break-words ${maxWidthClass} ${panelClass}`}
			style={panelStyle}
			bind:this={panel}
		>
			{normalizedText}
		</div>
	{/if}
</div>
