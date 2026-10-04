<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';

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
		if (typeof window === 'undefined') return;
		const overlayRect = { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };

		let centerX = overlayRect.width / 2;
		let centerY = overlayRect.height / 2;
		const anchor = resolveAnchorPanel();
		if (anchor) {
			const rect = anchor.getBoundingClientRect();
			centerX = rect.left + rect.width / 2 - overlayRect.left;
			centerY = rect.top + rect.height / 2 - overlayRect.top;
		}

		if (panelElement) {
			const rect = (panelElement.closest('.modal-panel') ?? panelElement).getBoundingClientRect();
			const halfWidth = Math.max(1, rect.width / 2);
			const halfHeight = Math.max(1, rect.height / 2);
			const padding = 16;
			centerX = clamp(centerX, padding + halfWidth, overlayRect.width - padding - halfWidth);
			centerY = clamp(centerY, padding + halfHeight, overlayRect.height - padding - halfHeight);
		}

		panelCenterX = centerX;
		panelCenterY = centerY;
	}

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

<ModalShell
	{open}
	title={resolvedTitle}
	ariaLabel={resolvedTitle}
	closeAriaLabel="Keep editing"
	backdropClass="bg-black/55 z-[60]"
	panelClass="max-w-xl"
	{panelStyle}
	on:requestClose={() => dispatch('cancel')}
>
	<div bind:this={panelElement}>
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
</ModalShell>
