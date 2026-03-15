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
	import {
		shouldHideHoverTooltipOnVisibilityChange,
		shouldHideHoverTooltipOnWindowMouseOut
	} from '$lib/components/hover-tooltip.js';

	interface Props {
		text: string;
		shortcutKeys?: string[];
		cursorOffsetXPx?: number;
		cursorOffsetYPx?: number;
		paddingPx?: number;
		minWidthPx?: number;
		panelClass?: string;
		maxWidthClass?: string;
		wrapperClass?: string;
		wrapperElement?: 'div' | 'span';
		children?: Snippet;
	}

	let {
		text,
		shortcutKeys = [],
		cursorOffsetXPx = 20,
		cursorOffsetYPx = 18,
		paddingPx = 8,
		minWidthPx = 180,
		panelClass = 'border border-secondary-300 bg-neutral px-2 py-1 text-[11px] text-neutral-950 shadow-sm',
		maxWidthClass = 'max-w-72',
		wrapperClass = 'relative inline-flex shrink-0',
		wrapperElement = 'div',
		children
	}: Props = $props();

	const HOVER_TOOLTIP_Z_INDEX = 2147483647;
	const HIDDEN_PANEL_STYLE = `position: fixed; left: 0px; top: 0px; visibility: hidden; z-index: ${HOVER_TOOLTIP_Z_INDEX};`;

	let root = $state<HTMLElement | null>(null);
	let panel = $state<HTMLElement | null>(null);
	let open = $state(false);
	let panelStyle = $state(HIDDEN_PANEL_STYLE);
	let focusInside = $state(false);
	let pointerX = $state<number | null>(null);
	let pointerY = $state<number | null>(null);
	let frameId: number | null = null;
	const tooltipId = nextTooltipId('hover-tooltip');
	const normalizedText = $derived.by(() => String(text ?? '').trim());
	const normalizedShortcutKeys = $derived.by(() =>
		shortcutKeys.map((key) => String(key ?? '').trim()).filter((key) => key.length > 0)
	);

	function portalToBody(node: HTMLElement): { destroy(): void } | void {
		if (typeof document === 'undefined' || !document.body) return;
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

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
		const anchor =
			pointerX !== null && pointerY !== null ? { x: pointerX, y: pointerY } : fallbackAnchor();
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
		panelStyle = toFixedStyle(
			position,
			`z-index: ${HOVER_TOOLTIP_Z_INDEX}; ${minWidthStyle} ${maxWidthStyle}`.trim()
		);
	}

	function show(): void {
		if (!normalizedText && normalizedShortcutKeys.length === 0) return;
		open = true;
		panelStyle = HIDDEN_PANEL_STYLE;
		schedulePositionUpdate();
	}

	function hide(): void {
		open = false;
		panelStyle = HIDDEN_PANEL_STYLE;
		clearScheduledFrame();
	}

	function dismissForWindowExit(): void {
		pointerX = null;
		pointerY = null;
		hide();
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
		const handleWindowMouseOut = (event: MouseEvent) => {
			if (shouldHideHoverTooltipOnWindowMouseOut(event.relatedTarget)) {
				dismissForWindowExit();
			}
		};
		const handleWindowBlur = () => {
			dismissForWindowExit();
		};
		const handleVisibilityChange = () => {
			if (shouldHideHoverTooltipOnVisibilityChange(document.visibilityState)) {
				dismissForWindowExit();
			}
		};

		window.addEventListener('resize', schedulePositionUpdate);
		window.addEventListener('scroll', schedulePositionUpdate, true);
		window.addEventListener('mouseout', handleWindowMouseOut);
		window.addEventListener('blur', handleWindowBlur);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			window.removeEventListener('resize', schedulePositionUpdate);
			window.removeEventListener('scroll', schedulePositionUpdate, true);
			window.removeEventListener('mouseout', handleWindowMouseOut);
			window.removeEventListener('blur', handleWindowBlur);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			clearScheduledFrame();
		};
	});

	$effect(() => {
		if (!open || typeof window === 'undefined') return;
		cursorOffsetXPx;
		cursorOffsetYPx;
		paddingPx;
		minWidthPx;
		panelClass;
		maxWidthClass;
		normalizedText;
		normalizedShortcutKeys.length;
		void tick().then(updatePosition);
	});

	$effect(() => {
		if (normalizedText.length > 0 || normalizedShortcutKeys.length > 0 || !open) return;
		hide();
	});
</script>

<svelte:element
	this={wrapperElement}
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
		<span
			id={tooltipId}
			role="tooltip"
			aria-live="polite"
			class={`pointer-events-none whitespace-normal wrap-break-word ${maxWidthClass} ${panelClass}`}
			style={panelStyle}
			bind:this={panel}
			use:portalToBody
		>
			<span class="inline-flex flex-wrap items-center gap-1.5 capitalize">
				{#if normalizedText}
					<span>{normalizedText}</span>
				{/if}
				{#if normalizedShortcutKeys.length > 0}
					<span class="inline-flex flex-wrap items-center gap-0.5">
						{#each normalizedShortcutKeys as shortcutKey (shortcutKey)}
							<kbd
								class="inline-flex min-w-3 items-center justify-center border border-secondary-400 bg-neutral-50 px-[3px] py-px font-sans text-[9px] uppercase font-semibold leading-none text-secondary-900"
							>
								{shortcutKey}
							</kbd>
						{/each}
					</span>
				{/if}
			</span>
		</span>
	{/if}
</svelte:element>
