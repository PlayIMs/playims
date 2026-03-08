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

<ModalShell
	{open}
	panelClass="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border-4 border-secondary bg-neutral-400 lg:max-h-[calc(100vh-3rem)]"
	on:requestClose={onClose}
>
	<div class="border-b border-secondary px-4 py-3">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">Remove Member</h3>
	</div>
	<div class="space-y-4 overflow-y-auto bg-neutral-400 p-4">
		<div class="flex items-start gap-3 border-2 border-neutral-950 bg-white p-4">
			<IconAlertTriangle class="h-6 w-6 text-secondary-900 shrink-0 mt-0.5" />
			<div class="space-y-2 text-sm text-neutral-950">
				<p class="font-semibold">This removes organization access only.</p>
				<p>{memberName} will lose access to this organization, but their global PlayIMs account remains available elsewhere.</p>
			</div>
		</div>
		<div class="flex flex-col-reverse gap-2 border-t border-neutral-950 pt-3 sm:flex-row sm:justify-end">
			<button type="button" class="button-secondary-outlined w-full cursor-pointer sm:w-auto" onclick={onClose}>Cancel</button>
			<button type="button" class="button-secondary w-full cursor-pointer sm:w-auto" disabled={submitting} onclick={onSubmit}>
				{submitting ? 'Removing...' : 'Remove Member'}
			</button>
		</div>
	</div>
</ModalShell>

