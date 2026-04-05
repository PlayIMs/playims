<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		cancelLabel: string;
		confirmVariant?: 'error' | 'primary';
		secondaryLabel?: string | null;
		secondaryVariant?: 'error' | 'primary' | 'secondary';
	}

	let {
		open,
		title,
		message,
		confirmLabel,
		cancelLabel,
		confirmVariant = 'error',
		secondaryLabel = null,
		secondaryVariant = 'secondary'
	}: Props = $props();

	const dispatch = createEventDispatcher<{ confirm: void; cancel: void; secondary: void }>();
	const resolvedTitle = $derived.by(() =>
		title === 'Discard Wizard Changes?' ? 'Discard Changes?' : title
	);
	const resolvedMessage = $derived.by(() =>
		message === 'You have unsaved changes in this wizard. Close without saving?'
			? 'You have unsaved changes. Close without saving?'
			: message
	);

	let pointerDownStartedInside = $state(false);
	let overlayElement = $state<HTMLDivElement | null>(null);
	let panelElement = $state<HTMLDivElement | null>(null);
	let panelCenterX = $state<number | null>(null);
	let panelCenterY = $state<number | null>(null);

	const panelStyle = $derived.by(() => {
		if (panelCenterX === null || panelCenterY === null) return undefined;
		return `position: absolute; left: ${panelCenterX}px; top: ${panelCenterY}px; transform: translate(-50%, -50%);`;
	});

	function clamp(value: number, min: number, max: number): number {
		if (max < min) return min;
		return Math.min(Math.max(value, min), max);
	}

	function resolveAnchorPanel(): HTMLElement | null {
		if (typeof document === 'undefined') return null;
		const panels = Array.from(document.querySelectorAll<HTMLElement>('.wizard-modal-panel')).filter(
			(panel) => panel.getClientRects().length > 0
		);
		return panels[panels.length - 1] ?? null;
	}

	function positionPanel(): void {
		if (!overlayElement) return;
		const overlayRect = overlayElement.getBoundingClientRect();

		let centerX = overlayRect.width / 2;
		let centerY = overlayRect.height / 2;
		const anchor = resolveAnchorPanel();
		if (anchor) {
			const rect = anchor.getBoundingClientRect();
			centerX = rect.left + rect.width / 2 - overlayRect.left;
			centerY = rect.top + rect.height / 2 - overlayRect.top;
		}

		if (panelElement) {
			const rect = panelElement.getBoundingClientRect();
			const halfWidth = Math.max(1, rect.width / 2);
			const halfHeight = Math.max(1, rect.height / 2);
			const padding = 16;
			centerX = clamp(centerX, padding + halfWidth, overlayRect.width - padding - halfWidth);
			centerY = clamp(centerY, padding + halfHeight, overlayRect.height - padding - halfHeight);
		}

		panelCenterX = centerX;
		panelCenterY = centerY;
	}

	function handleBackdropPointerDown(event: PointerEvent): void {
		pointerDownStartedInside = event.target !== event.currentTarget;
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target !== event.currentTarget) return;
		if (pointerDownStartedInside) {
			pointerDownStartedInside = false;
			return;
		}
		dispatch('cancel');
	}

	$effect(() => {
		if (!open || typeof window === 'undefined') return;

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			dispatch('cancel');
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});

	$effect(() => {
		if (!open || typeof window === 'undefined') return;

		positionPanel();
		void tick().then(() => {
			positionPanel();
		});

		const handleResize = () => {
			positionPanel();
		};
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	const secondaryButtonClass = $derived.by(() => {
		switch (secondaryVariant) {
			case 'primary':
				return 'button-primary';
			case 'error':
				return 'button-error';
			default:
				return 'button-secondary-outlined';
		}
	});
</script>

{#if open}
	<div
		bind:this={overlayElement}
		class="fixed top-0 left-0 w-screen h-screen z-[60] bg-black/55 overflow-hidden"
		onpointerdown={handleBackdropPointerDown}
		onclick={handleBackdropClick}
		role="button"
		tabindex="0"
		aria-label="Close unsaved changes confirmation"
		onkeydown={(event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			dispatch('cancel');
		}}
	>
		<div
			bind:this={panelElement}
			class="w-full max-w-xl border-[3px] border-neutral-950 bg-neutral overflow-hidden"
			style={panelStyle}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<div class="border-b border-neutral-950 bg-neutral-600/66 p-5">
				<h3 class="text-2xl font-bold font-serif text-neutral-950">{resolvedTitle}</h3>
			</div>
			<div class="p-5 space-y-4">
				<p class="font-sans text-neutral-950">{resolvedMessage}</p>
				<div class="flex items-center justify-end gap-3 pt-2">
					<button
						type="button"
						class="button-secondary-outlined cursor-pointer"
						onclick={() => dispatch('cancel')}
					>
						{cancelLabel}
					</button>
					{#if secondaryLabel}
						<button
							type="button"
							class={`${secondaryButtonClass} cursor-pointer`}
							onclick={() => dispatch('secondary')}
						>
							{secondaryLabel}
						</button>
					{/if}
					<button
						type="button"
						class={`${confirmVariant === 'primary' ? 'button-primary' : 'button-error'} cursor-pointer`}
						onclick={() => dispatch('confirm')}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
