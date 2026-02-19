<script lang="ts" module>
	let tooltipIdSequence = 0;

	function nextTooltipId(prefix: string): string {
		tooltipIdSequence += 1;
		return `${prefix}-${tooltipIdSequence}`;
	}
</script>

<script lang="ts">
	import { onDestroy, tick, type Snippet } from 'svelte';

	interface Props {
		text: string;
		placement?: 'bottom' | 'right';
		preferSide?: 'right' | 'left';
		align?: 'left' | 'center' | 'right';
		offsetPx?: number;
		paddingPx?: number;
		minHorizontalGapPx?: number;
		constrainToAncestorOverflow?: boolean;
		panelClass?: string;
		maxWidthClass?: string;
		wrapperClass?: string;
		children?: Snippet;
	}

	let {
		text,
		placement = 'bottom',
		preferSide = 'right',
		align = 'center',
		offsetPx = 6,
		paddingPx = 8,
		minHorizontalGapPx = 8,
		constrainToAncestorOverflow = true,
		panelClass = 'border border-secondary-300 bg-neutral px-2 py-1 text-[11px] text-neutral-950 shadow-sm',
		maxWidthClass = 'max-w-64',
		wrapperClass = 'relative inline-flex shrink-0',
		children
	}: Props = $props();

	let root = $state<HTMLDivElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let panelStyle = $state('position: fixed; left: 0px; top: 0px; visibility: hidden;');
	let rootPointerInside = $state(false);
	let panelPointerInside = $state(false);
	let focusInside = $state(false);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	const tooltipId = nextTooltipId('hover-tooltip');
	const normalizedText = $derived.by(() => String(text ?? '').trim());

	function clamp(value: number, min: number, max: number): number {
		if (max < min) return min;
		return Math.min(Math.max(value, min), max);
	}

	function isClippingOverflow(value: string): boolean {
		return value === 'hidden' || value === 'scroll' || value === 'auto' || value === 'clip';
	}

	function resolveBoundaryRect(element: HTMLElement): {
		left: number;
		right: number;
		top: number;
		bottom: number;
	} {
		let left = paddingPx;
		let right = window.innerWidth - paddingPx;
		let top = paddingPx;
		let bottom = window.innerHeight - paddingPx;
		if (!constrainToAncestorOverflow) {
			return { left, right, top, bottom };
		}
		let ancestor: HTMLElement | null = element.parentElement;

		while (ancestor) {
			const style = window.getComputedStyle(ancestor);
			const clipsX = isClippingOverflow(style.overflowX);
			const clipsY = isClippingOverflow(style.overflowY);
			if (clipsX || clipsY) {
				const rect = ancestor.getBoundingClientRect();
				if (clipsX) {
					left = Math.max(left, rect.left + paddingPx);
					right = Math.min(right, rect.right - paddingPx);
				}
				if (clipsY) {
					top = Math.max(top, rect.top + paddingPx);
					bottom = Math.min(bottom, rect.bottom - paddingPx);
				}
			}
			ancestor = ancestor.parentElement;
		}

		if (right <= left) {
			left = paddingPx;
			right = window.innerWidth - paddingPx;
		}
		if (bottom <= top) {
			top = paddingPx;
			bottom = window.innerHeight - paddingPx;
		}
		return { left, right, top, bottom };
	}

	function updatePosition(): void {
		if (typeof window === 'undefined' || !root || !panel || !open) return;

		const rootRect = root.getBoundingClientRect();
		const panelRect = panel.getBoundingClientRect();
		const boundary = resolveBoundaryRect(root);
		const availableWidth = Math.max(0, boundary.right - boundary.left);
		const width = Math.min(panelRect.width, availableWidth);
		const height = panelRect.height;
		const horizontalGap = Math.max(offsetPx, minHorizontalGapPx);

		let left = rootRect.left;
		let top = rootRect.bottom + offsetPx;
		if (placement === 'right') {
			const rightLeft = rootRect.right + horizontalGap;
			const leftLeft = rootRect.left - horizontalGap - width;
			const rightFits = rightLeft + width <= boundary.right;
			const leftFits = leftLeft >= boundary.left;
			if (preferSide === 'left') {
				left = leftFits || !rightFits ? leftLeft : rightLeft;
			} else {
				left = rightFits || !leftFits ? rightLeft : leftLeft;
			}
			if (align === 'left') top = rootRect.top;
			if (align === 'center') top = rootRect.top + rootRect.height / 2 - height / 2;
			if (align === 'right') top = rootRect.bottom - height;
			top = clamp(top, boundary.top, boundary.bottom - height);
		} else {
			if (align === 'center') left = rootRect.left + rootRect.width / 2 - width / 2;
			if (align === 'right') left = rootRect.right - width;
			top = rootRect.bottom + offsetPx;
			const wouldOverflowBottom = top + height > boundary.bottom;
			if (wouldOverflowBottom) {
				const aboveTop = rootRect.top - offsetPx - height;
				top = aboveTop >= boundary.top ? aboveTop : boundary.bottom - height;
			}
			top = Math.max(boundary.top, top);
		}
		left = clamp(left, boundary.left, boundary.right - width);

		panelStyle = `position: fixed; left: ${Math.round(left)}px; top: ${Math.round(top)}px; max-width: ${Math.round(availableWidth)}px; visibility: visible;`;
	}

	function show(): void {
		if (!normalizedText) return;
		open = true;
		if (!root) {
			panelStyle = 'position: fixed; left: 0px; top: 0px; visibility: hidden;';
			return;
		}
		const rect = root.getBoundingClientRect();
		const horizontalGap = Math.max(offsetPx, minHorizontalGapPx);
		if (placement === 'right') {
			panelStyle = `position: fixed; left: ${Math.round(rect.right + horizontalGap)}px; top: ${Math.round(rect.top)}px; visibility: visible;`;
			return;
		}
		panelStyle = `position: fixed; left: ${Math.round(rect.left)}px; top: ${Math.round(rect.bottom + offsetPx)}px; visibility: visible;`;
	}

	function hide(): void {
		open = false;
	}

	function clearHideTimer(): void {
		if (hideTimer === null) return;
		clearTimeout(hideTimer);
		hideTimer = null;
	}

	function scheduleHideIfInactive(): void {
		clearHideTimer();
		hideTimer = setTimeout(() => {
			hideTimer = null;
			if (rootPointerInside || panelPointerInside || focusInside) return;
			hide();
		}, 40);
	}

	function handleRootPointerEnter(): void {
		rootPointerInside = true;
		show();
	}

	function handleRootPointerLeave(): void {
		rootPointerInside = false;
		scheduleHideIfInactive();
	}

	function handlePanelPointerEnter(): void {
		panelPointerInside = true;
		show();
	}

	function handlePanelPointerLeave(): void {
		panelPointerInside = false;
		scheduleHideIfInactive();
	}

	function handlePanelPointerUp(): void {
		if (typeof window === 'undefined') return;
		const selectedText = window.getSelection()?.toString().trim() ?? '';
		if (selectedText.length > 0) return;
		panelPointerInside = false;
		scheduleHideIfInactive();
	}

	function handleFocusOut(event: FocusEvent): void {
		const nextTarget = event.relatedTarget;
		if (!(nextTarget instanceof Node)) {
			focusInside = false;
			scheduleHideIfInactive();
			return;
		}
		if (root?.contains(nextTarget) || panel?.contains(nextTarget)) return;
		focusInside = false;
		scheduleHideIfInactive();
	}

	onDestroy(() => {
		clearHideTimer();
	});

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;
		let frameId: number | null = null;

		const schedule = () => {
			if (frameId !== null) return;
			frameId = window.requestAnimationFrame(() => {
				frameId = null;
				updatePosition();
			});
		};

		void tick().then(() => {
			updatePosition();
		});

		window.addEventListener('resize', schedule);
		window.addEventListener('scroll', schedule, true);
		return () => {
			window.removeEventListener('resize', schedule);
			window.removeEventListener('scroll', schedule, true);
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
		};
	});
</script>

<div
	class={wrapperClass}
	role="presentation"
	bind:this={root}
	onpointerenter={handleRootPointerEnter}
	onpointerleave={handleRootPointerLeave}
	onmouseenter={handleRootPointerEnter}
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
			class={`pointer-events-auto z-[200] whitespace-normal break-words select-text ${maxWidthClass} ${panelClass}`}
			style={panelStyle}
			bind:this={panel}
			onpointerenter={handlePanelPointerEnter}
			onpointerleave={handlePanelPointerLeave}
			onpointerup={handlePanelPointerUp}
		>
			{normalizedText}
		</div>
	{/if}
</div>
