<script lang="ts" module>
	let bodyScrollLockCount = 0;
	let bodyOverflowBeforeLock: string | null = null;
	const openModalStack: symbol[] = [];

	function acquireBodyScrollLock() {
		if (typeof document === 'undefined') return;

		if (bodyScrollLockCount === 0) {
			bodyOverflowBeforeLock = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
		}

		bodyScrollLockCount += 1;
	}

	function releaseBodyScrollLock() {
		if (typeof document === 'undefined') return;
		if (bodyScrollLockCount <= 0) return;

		bodyScrollLockCount -= 1;
		if (bodyScrollLockCount > 0) return;

		document.body.style.overflow = bodyOverflowBeforeLock ?? '';
		bodyOverflowBeforeLock = null;
	}

	function registerOpenModal(modalId: symbol) {
		if (openModalStack.includes(modalId)) return;
		openModalStack.push(modalId);
	}

	function unregisterOpenModal(modalId: symbol) {
		const index = openModalStack.lastIndexOf(modalId);
		if (index < 0) return;
		openModalStack.splice(index, 1);
	}

	function isTopModal(modalId: symbol): boolean {
		return openModalStack[openModalStack.length - 1] === modalId;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		closeAriaLabel?: string;
		backdropClass?: string;
		panelClass?: string;
		alignmentClass?: string;
		paddingClass?: string;
		lockBodyScroll?: boolean;
		draggable?: boolean;
		dragHandleSelector?: string;
		children?: Snippet;
	}

	let {
		open = false,
		closeAriaLabel = 'Close modal',
		backdropClass = 'bg-black/55',
		panelClass = 'w-full max-w-5xl max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-3rem)] border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col',
		alignmentClass = 'items-center',
		paddingClass = 'p-4 lg:p-6',
		lockBodyScroll = true,
		draggable = false,
		dragHandleSelector = '',
		children
	}: Props = $props();

	const dispatch = createEventDispatcher<{ requestClose: void }>();
	const modalId = Symbol('modal-shell');
	let pointerDownStartedInside = $state(false);
	let hasBodyScrollLock = $state(false);
	let backdropElement = $state<HTMLDivElement | null>(null);
	let panelElement = $state<HTMLDivElement | null>(null);
	let panelTranslateX = $state(0);
	let panelTranslateY = $state(0);
	let dragPointerId = $state<number | null>(null);
	let dragStartPointerX = $state(0);
	let dragStartPointerY = $state(0);
	let dragStartTranslateX = $state(0);
	let dragStartTranslateY = $state(0);
	let bodyUserSelectBeforeDrag = $state<string | null>(null);

	const panelStyle = $derived.by(() =>
		draggable
			? `position: relative; left: ${panelTranslateX}px; top: ${panelTranslateY}px;`
			: undefined
	);

	$effect(() => {
		if (typeof document === 'undefined' || !open || !lockBodyScroll) return;
		acquireBodyScrollLock();
		hasBodyScrollLock = true;

		return () => {
			if (!hasBodyScrollLock) return;
			releaseBodyScrollLock();
			hasBodyScrollLock = false;
		};
	});

	$effect(() => {
		if (!open) return;
		registerOpenModal(modalId);

		return () => {
			unregisterOpenModal(modalId);
		};
	});

	$effect(() => {
		if (open) return;
		stopDragging();
		pointerDownStartedInside = false;
		panelTranslateX = 0;
		panelTranslateY = 0;
	});

	$effect(() => {
		if (typeof window === 'undefined' || !open || !draggable) return;

		const handleResize = () => {
			const clamped = clampTranslate(panelTranslateX, panelTranslateY);
			panelTranslateX = clamped.x;
			panelTranslateY = clamped.y;
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	$effect(() => {
		if (typeof ResizeObserver === 'undefined' || !open || !draggable || !panelElement) return;

		const resizeObserver = new ResizeObserver(() => {
			const clamped = clampTranslate(panelTranslateX, panelTranslateY);
			panelTranslateX = clamped.x;
			panelTranslateY = clamped.y;
		});

		resizeObserver.observe(panelElement);
		return () => {
			resizeObserver.disconnect();
		};
	});

	function viewportPaddingPx(): number {
		if (typeof window === 'undefined') return 0;
		return window.matchMedia('(min-width: 1024px)').matches ? 24 : 16;
	}

	function clampTranslate(nextX: number, nextY: number): { x: number; y: number } {
		if (!panelElement) {
			return { x: nextX, y: nextY };
		}

		const rect = panelElement.getBoundingClientRect();
		const padding = viewportPaddingPx();
		const backdropRect = backdropElement?.getBoundingClientRect();
		const minLeft = (backdropRect?.left ?? 0) + padding;
		const maxRight = (backdropRect?.right ?? window.innerWidth) - padding;
		const minTop = (backdropRect?.top ?? 0) + padding;
		const maxBottom = (backdropRect?.bottom ?? window.innerHeight) - padding;

		let deltaX = nextX - panelTranslateX;
		let deltaY = nextY - panelTranslateY;
		let projectedLeft = rect.left + deltaX;
		let projectedRight = rect.right + deltaX;
		let projectedTop = rect.top + deltaY;
		let projectedBottom = rect.bottom + deltaY;

		if (projectedLeft < minLeft) {
			deltaX += minLeft - projectedLeft;
			projectedRight = rect.right + deltaX;
		}
		if (projectedRight > maxRight) {
			deltaX -= projectedRight - maxRight;
		}
		if (projectedTop < minTop) {
			deltaY += minTop - projectedTop;
			projectedBottom = rect.bottom + deltaY;
		}
		if (projectedBottom > maxBottom) {
			deltaY -= projectedBottom - maxBottom;
		}

		return {
			x: panelTranslateX + deltaX,
			y: panelTranslateY + deltaY
		};
	}

	function isDragHandleTarget(target: EventTarget | null): boolean {
		if (!dragHandleSelector) return false;
		if (!(target instanceof Element)) return false;
		if (!target.closest(dragHandleSelector)) return false;
		if (
			target.closest('button, a, input, textarea, select, option, label, [data-modal-drag-ignore]')
		)
			return false;
		return true;
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (dragPointerId === null || event.pointerId !== dragPointerId) return;
		const nextX = dragStartTranslateX + (event.clientX - dragStartPointerX);
		const nextY = dragStartTranslateY + (event.clientY - dragStartPointerY);
		const clamped = clampTranslate(nextX, nextY);
		panelTranslateX = clamped.x;
		panelTranslateY = clamped.y;
	}

	function stopDragging(): void {
		if (typeof window !== 'undefined') {
			window.removeEventListener('pointermove', handleWindowPointerMove);
			window.removeEventListener('pointerup', handleWindowPointerUp);
			window.removeEventListener('pointercancel', handleWindowPointerUp);
		}

		if (typeof document !== 'undefined' && bodyUserSelectBeforeDrag !== null) {
			document.body.style.userSelect = bodyUserSelectBeforeDrag;
		}
		bodyUserSelectBeforeDrag = null;
		dragPointerId = null;
	}

	function handleWindowPointerUp(event: PointerEvent): void {
		if (dragPointerId === null || event.pointerId !== dragPointerId) return;
		stopDragging();
	}

	function handlePointerDown(event: PointerEvent): void {
		pointerDownStartedInside = event.target !== event.currentTarget;
	}

	function handlePanelPointerDown(event: PointerEvent): void {
		if (!draggable || !open) return;
		if (event.button !== 0) return;
		if (!isDragHandleTarget(event.target)) return;

		event.preventDefault();
		dragPointerId = event.pointerId;
		dragStartPointerX = event.clientX;
		dragStartPointerY = event.clientY;
		dragStartTranslateX = panelTranslateX;
		dragStartTranslateY = panelTranslateY;

		if (typeof document !== 'undefined') {
			bodyUserSelectBeforeDrag = document.body.style.userSelect;
			document.body.style.userSelect = 'none';
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('pointermove', handleWindowPointerMove);
			window.addEventListener('pointerup', handleWindowPointerUp);
			window.addEventListener('pointercancel', handleWindowPointerUp);
		}
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target !== event.currentTarget) return;
		if (pointerDownStartedInside) {
			pointerDownStartedInside = false;
			return;
		}
		dispatch('requestClose');
	}

	function handleBackdropKeydown(event: KeyboardEvent): void {
		if (event.target !== event.currentTarget) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		dispatch('requestClose');
	}

	$effect(() => {
		if (typeof window === 'undefined' || !open) return;

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			if (!isTopModal(modalId)) return;
			dispatch('requestClose');
		};

		window.addEventListener('keydown', handleWindowKeydown);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown);
		};
	});
</script>

{#if open}
	<div
		bind:this={backdropElement}
		class={`fixed top-0 left-0 w-screen h-screen ${backdropClass} z-50 flex ${alignmentClass} justify-center ${paddingClass} overflow-hidden`}
		onpointerdown={handlePointerDown}
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		role="button"
		tabindex="0"
		aria-label={closeAriaLabel}
	>
		<div
			bind:this={panelElement}
			class={panelClass}
			style={panelStyle}
			onpointerdown={handlePanelPointerDown}
			onclick={(event) => event.stopPropagation()}
			role="presentation"
		>
			{@render children?.()}
		</div>
	</div>
{/if}
