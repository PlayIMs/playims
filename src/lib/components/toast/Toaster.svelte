<script lang="ts">
	import { flip } from 'svelte/animate';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import ToastItem from './ToastItem.svelte';
	import {
		TOAST_DESKTOP_PLACEMENTS,
		TOAST_MOBILE_PLACEMENTS,
		TOAST_MOBILE_STACK_LIMIT,
		TOAST_STACK_LIMIT,
		toast,
		toastStore,
		type ToastDesktopPlacement,
		type ToastMobilePlacement
	} from '$lib/toasts';

	const desktopViewportClassByPlacement: Record<ToastDesktopPlacement, string> = {
		'top-left': 'top-4 justify-start',
		'top-center': 'top-4 justify-center',
		'top-right': 'top-4 justify-end',
		'middle-left': 'top-1/2 -translate-y-1/2 justify-start',
		'middle-center': 'top-1/2 -translate-y-1/2 justify-center',
		'middle-right': 'top-1/2 -translate-y-1/2 justify-end',
		'bottom-left': 'bottom-4 justify-start',
		'bottom-center': 'bottom-4 justify-center',
		'bottom-right': 'bottom-4 justify-end'
	};
	const mobileViewportClassByPlacement: Record<ToastMobilePlacement, string> = {
		top: 'top-3 justify-center',
		middle: 'top-1/2 -translate-y-1/2 justify-center',
		bottom: 'bottom-3 justify-center'
	};
	const VIEWPORT_EDGE_GAP_PX = 16;
	const RIGHT_STACK_EXTRA_GAP_PX = 18;

	let scrollbarWidth = $state(0);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let hasMeasuredViewport = $state(false);

	type EnterMotion = {
		x?: number;
		y?: number;
		enabled: boolean;
	};

	function updateScrollbarWidth(): void {
		if (typeof window === 'undefined') {
			return;
		}

		scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;
		hasMeasuredViewport = true;
	}

	function getViewportStyle(placement: ToastDesktopPlacement): string {
		const extraRightGap = placement.endsWith('-right') ? RIGHT_STACK_EXTRA_GAP_PX : 0;
		return `left:${VIEWPORT_EDGE_GAP_PX}px;right:${VIEWPORT_EDGE_GAP_PX + scrollbarWidth + extraRightGap}px;`;
	}

	function getMobileViewportStyle(): string {
		return `left:${VIEWPORT_EDGE_GAP_PX}px;right:${VIEWPORT_EDGE_GAP_PX}px;`;
	}

	function getVisibleToasts<T extends ToastDesktopPlacement | ToastMobilePlacement>(
		placement: T,
		placementToasts: typeof $toastStore,
		limit: number
	) {
		const visible = placementToasts.slice(0, limit);
		const shouldReverse =
			placement.startsWith('top') ||
			placement === 'middle' ||
			placement.startsWith('middle-');

		return shouldReverse ? [...visible].reverse() : visible;
	}

	function shouldPlaceOverflowBefore<T extends ToastDesktopPlacement | ToastMobilePlacement>(
		placement: T
	): boolean {
		return (
			placement.startsWith('top') ||
			placement === 'middle' ||
			placement.startsWith('middle-')
		);
	}

	function getDesktopEnterMotion(placement: ToastDesktopPlacement): EnterMotion {
		if (placement.startsWith('bottom-')) {
			return { y: viewportHeight || 900, enabled: true };
		}
		if (placement.startsWith('top-')) {
			return { y: -(viewportHeight || 900), enabled: true };
		}
		if (placement === 'middle-left') {
			return { x: -(viewportWidth || 1400), enabled: true };
		}
		if (placement === 'middle-right') {
			return { x: viewportWidth || 1400, enabled: true };
		}
		return { enabled: false };
	}

	function getMobileEnterMotion(placement: ToastMobilePlacement): EnterMotion {
		if (placement === 'bottom') {
			return { y: viewportHeight || 900, enabled: true };
		}
		if (placement === 'top') {
			return { y: -(viewportHeight || 900), enabled: true };
		}
		return { enabled: false };
	}

	onMount(() => {
		updateScrollbarWidth();

		const handleResize = () => {
			updateScrollbarWidth();
		};

		const resizeObserver = new ResizeObserver(() => {
			updateScrollbarWidth();
		});

		window.addEventListener('resize', handleResize);
		resizeObserver.observe(document.documentElement);
		if (document.body) {
			resizeObserver.observe(document.body);
		}

		return () => {
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
		};
	});

	const desktopPlacementGroups = $derived.by(() =>
		TOAST_DESKTOP_PLACEMENTS.map((placement) => {
			const placementToasts = $toastStore.filter((item) => item.placement === placement);
			const visible = getVisibleToasts(placement, placementToasts, TOAST_STACK_LIMIT);
			return {
				placement,
				visible,
				placeOverflowBefore: shouldPlaceOverflowBefore(placement),
				overflowCount: Math.max(0, placementToasts.length - visible.length)
			};
		})
	);

	const mobilePlacementGroups = $derived.by(() =>
		TOAST_MOBILE_PLACEMENTS.map((placement) => {
			const placementToasts = $toastStore.filter((item) => item.mobilePlacement === placement);
			const visible = getVisibleToasts(placement, placementToasts, TOAST_MOBILE_STACK_LIMIT);
			return {
				placement,
				visible,
				placeOverflowBefore: shouldPlaceOverflowBefore(placement),
				overflowCount: Math.max(0, placementToasts.length - visible.length)
			};
		})
	);
	const showMobileViewport = $derived(hasMeasuredViewport && viewportWidth < 640);
	const showDesktopViewport = $derived(!showMobileViewport);
</script>

{#snippet overflowNotice(count: number, visibleIds: string[])}
	<div
		class="pointer-events-auto border border-secondary-300 bg-neutral-05/95 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-900 shadow-[0_10px_24px_rgba(20,33,61,0.16)] backdrop-blur"
	>
		{count} more notification{count === 1 ? '' : 's'}
		<button
			type="button"
			class="ml-3 inline-flex cursor-pointer text-secondary-900 underline"
			onclick={() => toast.dismissMany(visibleIds)}
		>
			Clear existing
		</button>
		<button
			type="button"
			class="ml-3 inline-flex cursor-pointer text-secondary-900 underline"
			onclick={() => toast.dismissAll()}
		>
			Clear all toasts
		</button>
	</div>
{/snippet}

{#if showDesktopViewport}
	{#each desktopPlacementGroups as group (group.placement)}
		{@const enterMotion = getDesktopEnterMotion(group.placement)}
		{@const visibleIds = group.visible.map((item) => item.id)}
		<div
			class={`pointer-events-none fixed z-[100] hidden sm:flex ${desktopViewportClassByPlacement[group.placement]}`}
			style={getViewportStyle(group.placement)}
			aria-live="polite"
			aria-atomic="true"
		>
			<div class="w-full max-w-[22rem] space-y-2.5 sm:max-w-[26rem] sm:space-y-3">
				{#if group.overflowCount > 0 && group.placeOverflowBefore}
					{@render overflowNotice(group.overflowCount, visibleIds)}
				{/if}

				{#each group.visible as item, index (item.id)}
					<div
						class="will-change-transform"
						animate:flip={{ duration: 280, easing: cubicOut }}
					>
						<ToastItem
							{item}
							{index}
							enterOffsetX={enterMotion.x}
							enterOffsetY={enterMotion.y}
							animateEntry={enterMotion.enabled}
						/>
					</div>
				{/each}

				{#if group.overflowCount > 0 && !group.placeOverflowBefore}
					{@render overflowNotice(group.overflowCount, visibleIds)}
				{/if}
			</div>
		</div>
	{/each}
{/if}

{#if showMobileViewport}
	{#each mobilePlacementGroups as group (group.placement)}
		{@const enterMotion = getMobileEnterMotion(group.placement)}
		{@const visibleIds = group.visible.map((item) => item.id)}
		<div
			class={`pointer-events-none fixed z-[100] flex sm:hidden ${mobileViewportClassByPlacement[group.placement]}`}
			style={getMobileViewportStyle()}
			aria-live="polite"
			aria-atomic="true"
		>
			<div class="w-full max-w-[26rem] space-y-3">
				{#if group.overflowCount > 0 && group.placeOverflowBefore}
					{@render overflowNotice(group.overflowCount, visibleIds)}
				{/if}

				{#each group.visible as item, index (item.id)}
					<div
						class="will-change-transform"
						animate:flip={{ duration: 280, easing: cubicOut }}
					>
						<ToastItem
							{item}
							{index}
							enterOffsetX={enterMotion.x}
							enterOffsetY={enterMotion.y}
							animateEntry={enterMotion.enabled}
						/>
					</div>
				{/each}

				{#if group.overflowCount > 0 && !group.placeOverflowBefore}
					{@render overflowNotice(group.overflowCount, visibleIds)}
				{/if}
			</div>
		</div>
	{/each}
{/if}
