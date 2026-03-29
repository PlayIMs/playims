<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import { IconX } from '@tabler/icons-svelte';
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
		saveShortcutEnabled?: boolean;
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
		formClass = 'p-4 space-y-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin',
		autoFocusFirstField = true,
		saveShortcutEnabled = false,
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
			`wizard-modal-panel w-full ${maxWidthClass} max-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-3rem)] border-[3px] border-neutral-950 bg-neutral overflow-hidden flex flex-col`
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
	{saveShortcutEnabled}
	draggable
	dragHandleSelector="[data-wizard-modal-drag-handle]"
	on:requestClose={() => dispatch('requestClose')}
	on:saveShortcut={() => formElement?.requestSubmit()}
>
	<div
		class="cursor-move select-none space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4"
		data-wizard-modal-drag-handle
	>
		<div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
			<div>
				<h2 class="text-3xl font-bold font-serif text-neutral-950">{title}</h2>
				{#if showStepMeta}
					<p class="text-sm font-sans text-neutral-800">Step {step} of {stepCount}: {stepTitle}</p>
				{/if}
			</div>
			<button
				type="button"
				class="inline-flex h-9 w-9 items-center justify-center border border-neutral-950 bg-white text-neutral-950 hover:bg-neutral-100 cursor-pointer"
				aria-label={closeAriaLabel}
				data-modal-drag-ignore
				onclick={() => dispatch('requestClose')}
			>
				<IconX class="w-6 h-6" />
			</button>
		</div>
		{#if showStepMeta}
			<div class="border border-neutral-950 bg-white h-3" aria-hidden="true">
				<div class="h-full bg-primary" style={`width: ${progressPercent}%`}></div>
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
