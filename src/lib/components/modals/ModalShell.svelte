<script lang="ts" module>
let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock: string | null = null;

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

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		dispatch('requestClose');
	}
</script>

{#if open}
	<div
		class={`fixed inset-0 ${backdropClass} z-50 flex ${alignmentClass} justify-center ${paddingClass} overflow-hidden`}
		onpointerdown={handlePointerDown}
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="button"
		tabindex="0"
		aria-label={closeAriaLabel}
	>
		<div class={panelClass} onclick={(event) => event.stopPropagation()} role="presentation">
			{@render children?.()}
		</div>
	</div>
{/if}
