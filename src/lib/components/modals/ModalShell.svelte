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
		children?: Snippet;
	}

	let {
		open = false,
		closeAriaLabel = 'Close modal',
		backdropClass = 'bg-black/55',
		panelClass =
			'w-full max-w-5xl max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-3rem)] border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col',
		alignmentClass = 'items-center',
		paddingClass = 'p-4 lg:p-6',
		lockBodyScroll = true,
		children
	}: Props = $props();

	const dispatch = createEventDispatcher<{ requestClose: void }>();
	const modalId = Symbol('modal-shell');
	let pointerDownStartedInside = $state(false);
	let hasBodyScrollLock = $state(false);

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

	function handlePointerDown(event: PointerEvent): void {
		pointerDownStartedInside = event.target !== event.currentTarget;
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
		class={`fixed inset-0 ${backdropClass} z-50 flex ${alignmentClass} justify-center ${paddingClass} overflow-hidden`}
		onpointerdown={handlePointerDown}
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		role="button"
		tabindex="0"
		aria-label={closeAriaLabel}
	>
		<div class={panelClass} onclick={(event) => event.stopPropagation()} role="presentation">
			{@render children?.()}
		</div>
	</div>
{/if}
