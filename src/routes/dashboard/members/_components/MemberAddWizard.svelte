<script lang="ts">
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { WizardModal, WizardStepFooter } from '$lib/components/wizard';
	import type { MemberAssignableRole, MemberSex } from '$lib/members/types.js';
	import { toast } from '$lib/toasts';

	export interface MemberAddFormState {
		email: string;
		role: MemberAssignableRole;
		firstName: string;
		lastName: string;
		studentId: string;
		sex: MemberSex | '';
	}

	interface Props {
		open: boolean;
		form: MemberAddFormState;
		roleOptions: Array<{ value: MemberAssignableRole; label: string }>;
		submitting?: boolean;
		error?: string;
		fieldErrors?: Record<string, string>;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		open,
		form,
		roleOptions,
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
	const canSubmit = $derived.by(() => {
		return (
			form.email.trim().length > 0 &&
			form.firstName.trim().length > 0 &&
			form.lastName.trim().length > 0 &&
			form.studentId.trim().length > 0 &&
			(form.sex === 'M' || form.sex === 'F')
		);
	});

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
			id: 'member-add-error',
			title: 'Add member'
		});
	});
</script>

<WizardModal
	{open}
	title="Add Member"
	step={1}
	stepCount={1}
	stepTitle="Account details"
	progressPercent={100}
	closeAriaLabel="Close add member wizard"
	maxWidthClass="max-w-3xl"
	on:requestClose={onClose}
	on:submit={onSubmit}
>
	<div class="space-y-4">
		<div class="border border-neutral-950 bg-white p-4 text-sm text-neutral-950">
			<p class="font-semibold">Create the membership directly.</p>
			<p class="mt-1">
				If the email already belongs to a PlayIMs account, we will add or reactivate that
				membership. If it is brand new, we will create the account now and give you a one-time
				temporary password.
			</p>
		</div>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="space-y-1 lg:col-span-2">
				<label class="block text-sm font-semibold text-neutral-950" for="add-member-email"
					>Email</label
				>
				<input
					id="add-member-email"
					class="input-secondary"
					type="email"
					bind:value={form.email}
					data-wizard-autofocus
				/>
				{#if fieldErrors.email}<p class="text-xs text-secondary-900">{fieldErrors.email}</p>{/if}
			</div>
			<div class="space-y-1">
				<div class="mb-1 flex min-h-6 items-center gap-1.5">
					<p class="text-sm font-semibold text-neutral-950">Role</p>
					<HoverTooltip text="Dev remains manual-only and cannot be assigned here.">
						<span class="text-xs text-neutral-950">Why?</span>
					</HoverTooltip>
				</div>
				<ListboxDropdown
					options={roleOptions}
					value={form.role}
					ariaLabel="Select member role"
					buttonClass="button-secondary-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
					on:change={(event) => {
						form.role = event.detail.value as MemberAssignableRole;
					}}
				/>
			</div>
			<div class="space-y-1">
				<label class="block text-sm font-semibold text-neutral-950" for="add-member-first-name"
					>First Name</label
				>
				<input
					id="add-member-first-name"
					class="input-secondary"
					type="text"
					bind:value={form.firstName}
				/>
				{#if fieldErrors.firstName}<p class="text-xs text-secondary-900">
						{fieldErrors.firstName}
					</p>{/if}
			</div>
			<div class="space-y-1">
				<label class="block text-sm font-semibold text-neutral-950" for="add-member-last-name"
					>Last Name</label
				>
				<input
					id="add-member-last-name"
					class="input-secondary"
					type="text"
					bind:value={form.lastName}
				/>
				{#if fieldErrors.lastName}<p class="text-xs text-secondary-900">
						{fieldErrors.lastName}
					</p>{/if}
			</div>
			<div class="space-y-1">
				<label class="block text-sm font-semibold text-neutral-950" for="add-member-student-id"
					>Student ID</label
				>
				<input
					id="add-member-student-id"
					class="input-secondary"
					type="text"
					bind:value={form.studentId}
				/>
				{#if fieldErrors.studentId}<p class="text-xs text-secondary-900">
						{fieldErrors.studentId}
					</p>{/if}
			</div>
			<div class="space-y-1">
				<p class="block text-sm font-semibold text-neutral-950">Sex</p>
				<ListboxDropdown
					options={sexOptions}
					value={form.sex}
					placeholder="Select sex"
					ariaLabel="Select member sex"
					buttonClass="button-secondary-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
					on:change={(event) => {
						form.sex = event.detail.value as MemberSex;
					}}
				/>
				{#if fieldErrors.sex}<p class="text-xs text-secondary-900">{fieldErrors.sex}</p>{/if}
			</div>
			<div
				class="border border-neutral-950 bg-neutral p-3 text-xs leading-5 text-neutral-950 lg:col-span-2"
			>
				New accounts are created with an active login and a required password reset at first
				sign-in. You will be shown the temporary password one time after creation.
			</div>
		</div>
	</div>

	{#snippet footer()}
		<WizardStepFooter
			step={1}
			lastStep={1}
			showBack={false}
			canGoNext={false}
			canSubmit={canSubmit && !submitting}
			nextLabel="Next"
			submitLabel="Create Member"
			submittingLabel="Saving..."
			isSubmitting={submitting}
		/>
	{/snippet}
</WizardModal>
