<script lang="ts">
	import type { Snippet } from 'svelte';
	import { WizardModal, WizardUnsavedConfirm } from '$lib/components/wizard';

	interface Props {
		open: boolean;
		step: number;
		stepTitle: string;
		stepProgress: number;
		formError: string;
		title: string;
		unsavedConfirmOpen: boolean;
		formClass?: string;
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
		title,
		unsavedConfirmOpen,
		formClass = 'p-4 space-y-5 flex-1 min-h-0 overflow-y-auto',
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
	title={title}
	{step}
	stepCount={4}
	{stepTitle}
	progressPercent={stepProgress}
	closeAriaLabel="Close create league modal"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
	maxWidthClass="max-w-4xl"
	{formClass}
>
	{#snippet error()}
		{#if formError}
			<div class="border-2 border-error-300 bg-error-50 p-3">
				<p class="text-error-800 text-sm font-sans">{formError}</p>
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
