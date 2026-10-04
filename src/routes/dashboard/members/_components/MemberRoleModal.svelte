<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { toast } from '$lib/toasts';
	import type { MemberAssignableRole } from '$lib/members/types.js';

	interface Props {
		open: boolean;
		memberName: string;
		roleValue: MemberAssignableRole;
		roleOptions: Array<{ value: MemberAssignableRole; label: string }>;
		submitting?: boolean;
		error?: string;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		memberName,
		roleValue = 'participant',
		roleOptions,
		submitting = false,
		error = '',
		onClose,
		onSubmit
	}: Props = $props();
	const dispatch = createEventDispatcher<{ roleChange: { value: MemberAssignableRole } }>();
	let formElement = $state<HTMLFormElement | null>(null);

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
	title="Member Permissions"
	saveShortcutEnabled
	on:requestClose={onClose}
	on:saveShortcut={() => formElement?.requestSubmit()}
>
	<form
		bind:this={formElement}
		class="modal-form"
		onsubmit={(event) => {
			event.preventDefault();
			onSubmit();
		}}
	>
		<div class="modal-body space-y-4">
			<p class="text-sm text-neutral-950">
				Choose a new organization role for {memberName}. Dev remains manual-only and is not
				assignable here.
			</p>
			<ListboxDropdown
				options={roleOptions}
				value={roleValue}
				ariaLabel="Select member role"
				variant="field"
				on:change={(event) => {
					roleValue = event.detail.value as MemberAssignableRole;
					dispatch('roleChange', { value: roleValue });
				}}
			/>
		</div>
		<div class="modal-footer modal-actions">
			<button
				type="button"
				class="button-secondary-outlined w-full cursor-pointer sm:w-auto"
				onclick={onClose}>Cancel</button
			>
			<button
				type="submit"
				class="button-primary w-full cursor-pointer sm:w-auto"
				disabled={submitting}
			>
				{submitting ? 'Saving...' : 'Save Role'}
			</button>
		</div>
	</form>
</ModalShell>
