<script lang="ts">
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { WizardModal, WizardStepFooter } from '$lib/components/wizard';
	import type { MemberInviteMode, MemberSex } from '$lib/members/types.js';
	import { toast } from '$lib/toasts';

	export interface MemberAddFormState {
		mode: MemberInviteMode;
		email: string;
		role: 'participant' | 'manager' | 'admin';
		firstName: string;
		lastName: string;
		studentId: string;
		sex: MemberSex | '';
	}

	interface Props {
		open: boolean;
		step: 1 | 2;
		form: MemberAddFormState;
		submitting?: boolean;
		error?: string;
		fieldErrors?: Record<string, string>;
		onClose: () => void;
		onSubmit: () => void;
		onBack: () => void;
		onNext: () => void;
	}

	let {
		open,
		step,
		form,
		submitting = false,
		error = '',
		fieldErrors = {},
		onClose,
		onSubmit,
		onBack,
		onNext
	}: Props = $props();

	const roleOptions = [
		{ value: 'participant', label: 'Participant' },
		{ value: 'manager', label: 'Manager' },
		{ value: 'admin', label: 'Admin' }
	];
	const sexOptions = [
		{ value: 'M', label: 'M' },
		{ value: 'F', label: 'F' }
	];
	const canSubmit = $derived.by(() => {
		if (form.email.trim().length === 0) return false;
		if (form.mode !== 'preprovision') return true;
		return (
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

		const signature = `${open ? 'open' : 'closed'}:${step}:${message}`;
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
	open={open}
	title="Add Member"
	step={step}
	stepCount={2}
	stepTitle={step === 1 ? 'Choose Add Mode' : 'Member Details'}
	progressPercent={step === 1 ? 50 : 100}
	closeAriaLabel="Close add member wizard"
	maxWidthClass="max-w-3xl"
	on:requestClose={onClose}
	on:submit={onSubmit}
>
	{#if step === 1}
		<div class="space-y-4">
			<p class="text-sm text-neutral-950">Choose whether you are sending a simple invite or pre-filling required member data before the person finishes setup.</p>
			<div class="grid gap-3 lg:grid-cols-2">
				<button
					type="button"
					class={`border-2 p-4 text-left cursor-pointer ${form.mode === 'invite' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
					onclick={() => (form.mode = 'invite')}
				>
					<p class="font-semibold">Invite Member</p>
					<p class="mt-1 text-sm">Capture email and role, then share an invite link.</p>
				</button>
				<button
					type="button"
					class={`border-2 p-4 text-left cursor-pointer ${form.mode === 'preprovision' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
					onclick={() => (form.mode = 'preprovision')}
				>
					<p class="font-semibold">Pre-Provision Member</p>
					<p class="mt-1 text-sm">Capture the full required record now, then let the member finish account creation later.</p>
				</button>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="space-y-1">
				<label class="block text-sm font-semibold text-neutral-950" for="add-member-email">Email</label>
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
					buttonClass="w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)]"
					on:change={(event) => {
						form.role = event.detail.value as 'participant' | 'manager' | 'admin';
					}}
				/>
			</div>
			{#if form.mode === 'preprovision'}
				<div class="grid gap-4 lg:grid-cols-2">
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="add-member-first-name">First Name</label>
						<input id="add-member-first-name" class="input-secondary" type="text" bind:value={form.firstName} />
						{#if fieldErrors.firstName}<p class="text-xs text-secondary-900">{fieldErrors.firstName}</p>{/if}
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="add-member-last-name">Last Name</label>
						<input id="add-member-last-name" class="input-secondary" type="text" bind:value={form.lastName} />
						{#if fieldErrors.lastName}<p class="text-xs text-secondary-900">{fieldErrors.lastName}</p>{/if}
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="add-member-student-id">Student ID</label>
						<input id="add-member-student-id" class="input-secondary" type="text" bind:value={form.studentId} />
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
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={step}
			lastStep={2}
			showBack={step > 1}
			canGoNext={true}
			canSubmit={canSubmit && !submitting}
			nextLabel="Next"
			submitLabel="Create Invite"
			submittingLabel="Saving..."
			isSubmitting={submitting}
			on:back={onBack}
			on:next={onNext}
		/>
	{/snippet}
</WizardModal>
