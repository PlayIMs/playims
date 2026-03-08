<script lang="ts">
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import type { MemberSex } from '$lib/members/types.js';
	import { toast } from '$lib/toasts';

	export interface MemberEditFormState {
		email: string;
		firstName: string;
		lastName: string;
		studentId: string;
		sex: MemberSex | '';
	}

	interface Props {
		open: boolean;
		form: MemberEditFormState;
		submitting?: boolean;
		error?: string;
		fieldErrors?: Record<string, string>;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		form,
		submitting = false,
		error = '',
		fieldErrors = {},
		onClose,
		onSubmit
	}: Props = $props();

	const sexOptions = [
		{ value: 'M', label: 'M' },
		{ value: 'F', label: 'F' }
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
			id: 'member-edit-error',
			title: 'Edit member'
		});
	});
</script>

<ModalShell
	{open}
	panelClass="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden border-4 border-secondary bg-neutral-400 lg:max-h-[calc(100vh-3rem)]"
	on:requestClose={onClose}
>
	<div class="border-b border-secondary px-4 py-3">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">Edit Member</h3>
	</div>
	<form
		class="flex flex-1 flex-col overflow-hidden bg-neutral-400"
		onsubmit={(event) => {
			event.preventDefault();
			onSubmit();
		}}
	>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			<div class="grid gap-4 lg:grid-cols-2">
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-first-name">First Name</label>
					<input id="member-edit-first-name" class="input-secondary" type="text" bind:value={form.firstName} />
					{#if fieldErrors.firstName}<p class="text-xs text-secondary-900">{fieldErrors.firstName}</p>{/if}
				</div>
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-last-name">Last Name</label>
					<input id="member-edit-last-name" class="input-secondary" type="text" bind:value={form.lastName} />
					{#if fieldErrors.lastName}<p class="text-xs text-secondary-900">{fieldErrors.lastName}</p>{/if}
				</div>
				<div class="space-y-1 lg:col-span-2">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-email">Email</label>
					<input id="member-edit-email" class="input-secondary" type="email" bind:value={form.email} />
					{#if fieldErrors.email}<p class="text-xs text-secondary-900">{fieldErrors.email}</p>{/if}
				</div>
				<div class="space-y-1">
					<label class="block text-sm font-semibold text-neutral-950" for="member-edit-student-id">Student ID</label>
					<input id="member-edit-student-id" class="input-secondary" type="text" bind:value={form.studentId} />
					{#if fieldErrors.studentId}<p class="text-xs text-secondary-900">{fieldErrors.studentId}</p>{/if}
				</div>
				<div class="space-y-1">
					<p class="block text-sm font-semibold text-neutral-950">Sex</p>
					<ListboxDropdown
						options={sexOptions}
						value={form.sex}
						placeholder="Select sex"
						ariaLabel="Select member sex"
						buttonClass="w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)]"
						on:change={(event) => {
							form.sex = event.detail.value as MemberSex;
						}}
					/>
					{#if fieldErrors.sex}<p class="text-xs text-secondary-900">{fieldErrors.sex}</p>{/if}
				</div>
			</div>
		</div>
		<div class="flex flex-col-reverse gap-2 border-t border-neutral-950 p-4 sm:flex-row sm:justify-end">
			<button type="button" class="button-secondary-outlined w-full cursor-pointer sm:w-auto" onclick={onClose}>Cancel</button>
			<button type="submit" class="button-secondary w-full cursor-pointer sm:w-auto" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	</form>
</ModalShell>

