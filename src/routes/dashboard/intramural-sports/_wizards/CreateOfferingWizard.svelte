<script lang="ts">
	import type { Snippet } from 'svelte';
	import { WizardModal, WizardUnsavedConfirm } from '$lib/components/wizard';

	interface Props {
		open: boolean;
		step: number;
		stepTitle: string;
		stepProgress: number;
		formError: string;
		unsavedConfirmOpen: boolean;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		open,
		step,
		stepTitle,
		stepProgress,
		formError,
		unsavedConfirmOpen,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel,
		children,
		footer
	}: Props = $props();
</script>

<WizardModal
	{open}
	title="New Intramural Offering"
	{step}
	stepCount={5}
	{stepTitle}
	progressPercent={stepProgress}
	closeAriaLabel="Close create offering modal"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
	maxWidthClass="max-w-5xl"
>
	{#snippet error()}
		{#if formError}
			<div class="border-2 border-error-300 bg-error-50 p-3">
				<p class="text-error-700 text-sm font-sans">{formError}</p>
			</div>
		{/if}
	{/snippet}

	{@render children?.()}
	{@render footer?.()}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Wizard Changes?"
	message="You have unsaved changes in this wizard. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
