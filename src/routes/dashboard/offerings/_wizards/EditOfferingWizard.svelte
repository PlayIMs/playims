<script lang="ts">
	import type { Snippet } from 'svelte';
	import { WizardModal, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';

	interface Props {
		open: boolean;
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

	let lastToastSignature = $state('');

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${message}`;
		if (signature === lastToastSignature) {
			return;
		}

		lastToastSignature = signature;
		toast.error(message, {
			id: 'edit-offering-error',
			title: 'Offering editor'
		});
	});
</script>

<WizardModal
	{open}
	title="Edit Offering"
	step={1}
	stepCount={1}
	stepTitle="Offering Details"
	progressPercent={100}
	closeAriaLabel="Close edit offering modal"
	saveShortcutEnabled
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
	maxWidthClass="max-w-5xl"
>
	{@render children?.()}
	{@render footer?.()}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Offering Changes?"
	message="You have unsaved changes for this offering. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
