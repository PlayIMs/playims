<script lang="ts">
	import { IconAlertTriangle } from '@tabler/icons-svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import { toast } from '$lib/toasts';

	interface Props {
		open: boolean;
		memberName: string;
		submitting?: boolean;
		error?: string;
		onClose: () => void;
		onSubmit: () => void;
	}

	let { open, memberName, submitting = false, error = '', onClose, onSubmit }: Props = $props();
	let lastErrorToast = $state('');

	$effect(() => {
		const message = error.trim();
		if (!message) {
			lastErrorToast = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${message}`;
		if (signature === lastErrorToast) {
			return;
		}

		lastErrorToast = signature;
		toast.error(message, {
			id: 'member-remove-error',
			title: 'Remove member'
		});
	});
</script>

<ModalShell {open} title="Remove Member" on:requestClose={onClose}>
	<div class="modal-body space-y-4">
		<div class="flex items-start gap-3 border-2 border-neutral-950 bg-white p-4">
			<IconAlertTriangle class="h-6 w-6 text-secondary-900 shrink-0 mt-0.5" />
			<div class="space-y-2 text-sm text-neutral-950">
				<p class="font-semibold">This removes organization access only.</p>
				<p>
					{memberName} will lose access to this organization, but their global PlayIMs account remains
					available elsewhere.
				</p>
			</div>
		</div>
		<div class="modal-footer modal-actions">
			<button
				type="button"
				class="button-secondary-outlined w-full cursor-pointer sm:w-auto"
				onclick={onClose}>Cancel</button
			>
			<button
				type="button"
				class="button-error w-full cursor-pointer sm:w-auto"
				disabled={submitting}
				onclick={onSubmit}
			>
				{submitting ? 'Removing...' : 'Remove Member'}
			</button>
		</div>
	</div>
</ModalShell>
