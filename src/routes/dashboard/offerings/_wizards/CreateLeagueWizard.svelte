<script lang="ts">
	import type { Snippet } from 'svelte';
	import { WizardModal, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';

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

	let lastToastSignature = $state('');

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${step}:${message}`;
		if (signature === lastToastSignature) {
			return;
		}

		lastToastSignature = signature;
		toast.error(message, {
			id: `create-league-error:${step}`,
			title
		});
	});
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
