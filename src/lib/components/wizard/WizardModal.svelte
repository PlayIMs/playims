<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import ModalHeader from '$lib/components/modals/ModalHeader.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import {
		findWizardFocusTarget,
		shouldSubmitWizardForm,
		shouldAdvanceWizardOnEnter
	} from './wizard-form-behavior.js';

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
		formClass = 'space-y-5',
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

	const panelClass = $derived.by(() => `wizard-modal-panel ${maxWidthClass}`);
	const showStepMeta = $derived.by(() => stepCount > 1);
	let formElement = $state<HTMLFormElement | null>(null);

	function focusFirstWizardField(): void {
		if (!formElement) return;

		findWizardFocusTarget(formElement)?.focus({ preventScroll: true });
	}

	$effect(() => {
		if (!open || !autoFocusFirstField) return;
		const activeStep = step;

		void tick().then(() => {
			if (!open || step !== activeStep) return;
			focusFirstWizardField();
		});
	});

	$effect(() => {
		if (!open || !formElement) return;
		const form = formElement;
		// Delegate text-input Enter without replacing nested controls' keyboard behavior.
		const handleKeydown = (event: KeyboardEvent) => {
			if (!(event.target instanceof HTMLInputElement)) return;
			if (!shouldAdvanceWizardOnEnter(event, event.target.type)) return;
			if (!form.querySelector('[data-wizard-next]')) return;
			event.preventDefault();
			shouldSubmitWizardForm(form);
		};
		form.addEventListener('keydown', handleKeydown);
		return () => form.removeEventListener('keydown', handleKeydown);
	});
</script>

<ModalShell
	{open}
	{closeAriaLabel}
	{panelClass}
	ariaLabel={title}
	{saveShortcutEnabled}
	showCloseButton={false}
	draggable
	dragHandleSelector="[data-wizard-modal-drag-handle]"
	on:requestClose={() => dispatch('requestClose')}
	on:saveShortcut={() => formElement?.requestSubmit()}
>
	<ModalHeader {title} {closeAriaLabel} draggable onClose={() => dispatch('requestClose')}>
		{#if showStepMeta}
			<p class="text-sm font-sans text-neutral-800">Step {step} of {stepCount}: {stepTitle}</p>
		{/if}
		{#if showStepMeta}
			<div
				class="mt-1 border border-neutral-950 bg-white h-3"
				role="progressbar"
				aria-label="Wizard progress"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.max(0, Math.min(100, progressPercent))}
			>
				<div
					class="h-full bg-primary"
					style={`width: ${Math.max(0, Math.min(100, progressPercent))}%`}
				></div>
			</div>
		{/if}
	</ModalHeader>

	<form
		bind:this={formElement}
		class="modal-form"
		onsubmit={(event) => {
			event.preventDefault();
			if (!shouldSubmitWizardForm(event.currentTarget)) return;
			dispatch('submit', event);
		}}
		oninput={(event) => dispatch('input', event)}
	>
		<div class={`modal-body ${formClass}`}>
			{@render error?.()}
			{@render children?.()}
		</div>
		{#if footer}
			<div class="modal-footer">{@render footer()}</div>
		{/if}
	</form>
</ModalShell>
