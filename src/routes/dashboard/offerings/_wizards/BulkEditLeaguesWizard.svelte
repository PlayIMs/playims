<script lang="ts">
	import type { Snippet } from 'svelte';
	import { WizardModal, WizardStepFooter, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';

	interface Props {
		open: boolean;
		title: string;
		step: number;
		stepTitle: string;
		stepProgress: number;
		formError: string;
		unsavedConfirmOpen: boolean;
		canGoNext: boolean;
		canSubmit: boolean;
		isSubmitting: boolean;
		nextLabel?: string;
		submitLabel?: string;
		submittingLabel?: string;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onNext: () => void;
		onBack: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
		children?: Snippet;
	}

	let {
		open,
		title,
		step,
		stepTitle,
		stepProgress,
		formError,
		unsavedConfirmOpen,
		canGoNext,
		canSubmit,
		isSubmitting,
		nextLabel = 'Next',
		submitLabel = 'Save Changes',
		submittingLabel = 'Saving...',
		onRequestClose,
		onSubmit,
		onInput,
		onNext,
		onBack,
		onUnsavedConfirm,
		onUnsavedCancel,
		children
	}: Props = $props();

	let lastToastSignature = $state('');

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${step}:${message}`;
		if (signature === lastToastSignature) return;

		lastToastSignature = signature;
		toast.error(message, {
			id: `bulk-edit-leagues-error:${step}`,
			title
		});
	});
</script>

<WizardModal
	{open}
	{title}
	{step}
	stepCount={3}
	{stepTitle}
	progressPercent={stepProgress}
	closeAriaLabel="Close bulk edit leagues wizard"
	saveShortcutEnabled
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
	maxWidthClass="max-w-5xl"
	formClass="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-4"
>
	<div class="min-h-0 flex-1 overflow-y-auto">
		{@render children?.()}
	</div>

	<WizardStepFooter
		{step}
		lastStep={3}
		showBack={step > 1}
		{canGoNext}
		{canSubmit}
		{isSubmitting}
		{nextLabel}
		{submitLabel}
		{submittingLabel}
		on:back={onBack}
		on:next={onNext}
	/>
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Bulk Edit Changes?"
	message="You have unsaved bulk edit changes. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
