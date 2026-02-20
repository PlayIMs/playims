<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import IconX from '@tabler/icons-svelte/icons/x';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';

	interface Props {
		open: boolean;
		title: string;
		step: number;
		stepCount: number;
		stepTitle: string;
		progressPercent: number;
		closeAriaLabel: string;
		maxWidthClass?: string;
		formClass?: string;
		autoFocusFirstField?: boolean;
		error?: Snippet;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		open,
		title,
		step,
		stepCount,
		stepTitle,
		progressPercent,
		closeAriaLabel,
		maxWidthClass = 'max-w-5xl',
		formClass = 'p-4 space-y-5 flex-1 min-h-0 overflow-y-auto',
		autoFocusFirstField = true,
		error,
		children,
		footer
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		requestClose: void;
		submit: SubmitEvent;
		input: Event;
	}>();

	const panelClass = $derived.by(
		() =>
			`wizard-modal-panel w-full ${maxWidthClass} max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-3rem)] border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col`
	);
	const showStepMeta = $derived.by(() => stepCount > 1);
	let formElement = $state<HTMLFormElement | null>(null);

	function focusFirstWizardField(): void {
		if (!formElement) return;

		const preferred = formElement.querySelector<HTMLElement>('[data-wizard-autofocus]');
		if (preferred) {
			preferred.focus();
			return;
		}

		const firstField = formElement.querySelector<HTMLElement>(
			'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
		);
		firstField?.focus();
	}

	$effect(() => {
		if (!open || !autoFocusFirstField) return;
		const activeStep = step;

		void tick().then(() => {
			if (!open || step !== activeStep) return;
			focusFirstWizardField();
		});
	});
</script>

<ModalShell
	{open}
	{closeAriaLabel}
	{panelClass}
	draggable
	dragHandleSelector="[data-wizard-modal-drag-handle]"
	on:requestClose={() => dispatch('requestClose')}
>
	<div
		class="p-4 border-b border-secondary space-y-3 cursor-move select-none"
		data-wizard-modal-drag-handle
	>
		<div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
			<div>
				<h2 class="text-3xl font-bold font-serif text-neutral-950">{title}</h2>
				{#if showStepMeta}
					<p class="text-sm font-sans text-neutral-950">Step {step} of {stepCount}: {stepTitle}</p>
				{/if}
			</div>
			<button
				type="button"
				class="p-1 text-neutral-950 hover:text-secondary-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
				aria-label={closeAriaLabel}
				data-modal-drag-ignore
				onclick={() => dispatch('requestClose')}
			>
				<IconX class="w-6 h-6" />
			</button>
		</div>
		{#if showStepMeta}
			<div class="border border-secondary-300 bg-white h-3" aria-hidden="true">
				<div class="h-full bg-secondary" style={`width: ${progressPercent}%`}></div>
			</div>
		{/if}
	</div>

	<form
		bind:this={formElement}
		class={formClass}
		onsubmit={(event) => {
			event.preventDefault();
			dispatch('submit', event);
		}}
		oninput={(event) => dispatch('input', event)}
	>
		{@render error?.()}
		{@render children?.()}
		{@render footer?.()}
	</form>
</ModalShell>
