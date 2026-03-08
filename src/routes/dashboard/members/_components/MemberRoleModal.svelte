<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { toast } from '$lib/toasts';

	interface Props {
		open: boolean;
		memberName: string;
		roleValue: 'participant' | 'manager' | 'admin';
		submitting?: boolean;
		error?: string;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		memberName,
		roleValue = 'participant',
		submitting = false,
		error = '',
		onClose,
		onSubmit
	}: Props = $props();
	const dispatch = createEventDispatcher<{ roleChange: { value: 'participant' | 'manager' | 'admin' } }>();

	const roleOptions = [
		{ value: 'participant', label: 'Participant' },
		{ value: 'manager', label: 'Manager' },
		{ value: 'admin', label: 'Admin' }
	];

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
			id: 'member-role-error',
			title: 'Member permissions'
		});
	});
</script>

<ModalShell
	{open}
	panelClass="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border-4 border-secondary bg-neutral-400 lg:max-h-[calc(100vh-3rem)]"
	on:requestClose={onClose}
>
	<div class="border-b border-secondary px-4 py-3">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">Member Permissions</h3>
	</div>
	<form
		class="flex flex-1 flex-col overflow-hidden bg-neutral-400"
		onsubmit={(event) => {
			event.preventDefault();
			onSubmit();
		}}
	>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			<p class="text-sm text-neutral-950">
				Choose a new organization role for {memberName}. Dev remains manual-only and is not assignable here.
			</p>
			<ListboxDropdown
				options={roleOptions}
				value={roleValue}
				ariaLabel="Select member role"
				buttonClass="w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)]"
				on:change={(event) => {
					roleValue = event.detail.value as 'participant' | 'manager' | 'admin';
					dispatch('roleChange', { value: roleValue });
				}}
			/>
		</div>
		<div class="flex flex-col-reverse gap-2 border-t border-neutral-950 p-4 sm:flex-row sm:justify-end">
			<button type="button" class="button-secondary-outlined w-full cursor-pointer sm:w-auto" onclick={onClose}>Cancel</button>
			<button type="submit" class="button-secondary w-full cursor-pointer sm:w-auto" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save Role'}
			</button>
		</div>
	</form>
</ModalShell>

