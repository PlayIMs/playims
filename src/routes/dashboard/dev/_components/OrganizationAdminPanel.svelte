<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		IconBuildingCommunity,
		IconPencil,
		IconPlus,
		IconRestore
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import {
		WizardStepFooter,
		applyLiveSlugInput,
		createWizardDirtyState,
		slugifyFinal
	} from '$lib/components/wizard';
	import CreateOrganizationWizard from '../../account/_wizards/CreateOrganizationWizard.svelte';
	import ManageOrganizationWizard from '../../account/_wizards/ManageOrganizationWizard.svelte';

	type OrganizationMembership = {
		clientId: string;
		clientName: string;
		clientSlug: string | null;
		role: string;
		isDefault: boolean;
		isCurrent: boolean;
		selfJoinEnabled: boolean;
		metadata: string | null;
		status: string;
	};

	type FormState = {
		action?: string;
		error?: string;
		success?: string;
		fieldErrors?: Record<string, string>;
	};

	type CreateOrganizationStep = 1 | 2 | 3 | 4;

	type CreateOrganizationForm = {
		organizationName: string;
		organizationSlug: string;
		selfJoinEnabled: boolean;
		membershipRole: 'participant' | 'admin' | 'manager';
		switchToOrganization: boolean;
		setDefaultOrganization: boolean;
		metadata: string;
	};

	let {
		organizations,
		form
	}: {
		organizations: OrganizationMembership[];
		form?: FormState;
	} = $props();

	let createOrganizationOpen = $state(false);
	let manageOrganizationOpen = $state(false);
	let manageOrganizationSelectedClientId = $state('');
	let createOrganizationUnsavedConfirmOpen = $state(false);
	let createOrganizationSubmitting = $state(false);
	let createOrganizationSlugTouched = $state(false);
	let createOrganizationSubmissionCount = $state(0);
	let createOrganizationStep = $state<CreateOrganizationStep>(1);
	let createOrganizationSubmitForm = $state<HTMLFormElement | null>(null);
	let createOrganizationClientError = $state('');
	let createOrganizationFieldErrors = $state<Record<string, string>>({});

	const CREATE_ORGANIZATION_STEP_TITLES: Record<CreateOrganizationStep, string> = {
		1: 'Organization Basics',
		2: 'Access Settings',
		3: 'Defaults',
		4: 'Review'
	};

	const createEmptyOrganizationForm = (): CreateOrganizationForm => ({
		organizationName: '',
		organizationSlug: '',
		selfJoinEnabled: false,
		membershipRole: 'manager',
		switchToOrganization: true,
		setDefaultOrganization: true,
		metadata: ''
	});

	const normalizeOrganizationForm = (value: CreateOrganizationForm): CreateOrganizationForm => ({
		organizationName: value.organizationName.trim(),
		organizationSlug: slugifyFinal(value.organizationSlug),
		selfJoinEnabled: value.selfJoinEnabled,
		membershipRole: value.membershipRole,
		switchToOrganization: value.switchToOrganization,
		setDefaultOrganization: value.setDefaultOrganization,
		metadata: value.metadata.trim()
	});

	let createOrganizationForm = $state<CreateOrganizationForm>(createEmptyOrganizationForm());

	const createOrganizationDirtyState = createWizardDirtyState<CreateOrganizationForm>({
		snapshot: normalizeOrganizationForm
	});
	const createOrganizationDirty = $derived.by(() =>
		createOrganizationDirtyState.isDirty(createOrganizationForm)
	);
	const createOrganizationStepTitle = $derived(
		CREATE_ORGANIZATION_STEP_TITLES[createOrganizationStep]
	);
	const createOrganizationStepProgress = $derived(Math.round((createOrganizationStep / 4) * 100));
	const actionName = $derived(form?.action ?? '');
	const actionError = $derived(form?.error ?? '');
	const currentOrganizationId = $derived.by(
		() => organizations.find((organization) => organization.isCurrent)?.clientId ?? ''
	);
	const createOrganizationActionError = $derived.by(() =>
		createOrganizationOpen &&
		createOrganizationSubmissionCount > 0 &&
		actionName === 'createOrganization'
			? actionError
			: ''
	);
	const createOrganizationFormError = $derived.by(
		() => createOrganizationClientError || createOrganizationActionError || ''
	);
	const createOrganizationCanSubmit = $derived.by(() => !createOrganizationSubmitting);
	const createOrganizationCanGoNext = $derived.by(() => !createOrganizationSubmitting);

	function resetCreateOrganizationWizard() {
		createOrganizationStep = 1;
		createOrganizationSubmitting = false;
		createOrganizationSlugTouched = false;
		createOrganizationSubmissionCount = 0;
		createOrganizationUnsavedConfirmOpen = false;
		createOrganizationClientError = '';
		createOrganizationFieldErrors = {};
		createOrganizationForm = createEmptyOrganizationForm();
		createOrganizationDirtyState.clearBaseline();
	}

	function openCreateOrganizationWizard() {
		resetCreateOrganizationWizard();
		createOrganizationDirtyState.captureBaseline(createOrganizationForm);
		createOrganizationOpen = true;
	}

	function openManageOrganizationWizard() {
		manageOrganizationSelectedClientId = currentOrganizationId || organizations[0]?.clientId || '';
		manageOrganizationOpen = true;
	}

	function closeManageOrganizationWizard() {
		manageOrganizationOpen = false;
	}

	async function handleManageOrganizationSaved(selectedOrganizationId?: string | null) {
		await invalidateAll();
		if (selectedOrganizationId) {
			manageOrganizationSelectedClientId = selectedOrganizationId;
		}
	}

	function closeCreateOrganizationWizard() {
		createOrganizationOpen = false;
		createOrganizationUnsavedConfirmOpen = false;
	}

	function requestCloseCreateOrganizationWizard() {
		if (createOrganizationSubmitting) {
			return;
		}

		if (createOrganizationDirty) {
			createOrganizationUnsavedConfirmOpen = true;
			return;
		}

		closeCreateOrganizationWizard();
		resetCreateOrganizationWizard();
	}

	function confirmDiscardCreateOrganizationWizard() {
		closeCreateOrganizationWizard();
		resetCreateOrganizationWizard();
	}

	function cancelDiscardCreateOrganizationWizard() {
		createOrganizationUnsavedConfirmOpen = false;
	}

	function getCreateOrganizationStepErrors(
		values: CreateOrganizationForm,
		step: CreateOrganizationStep
	): Record<string, string> {
		const errors: Record<string, string> = {};

		if (step === 1 || step === 4) {
			if (values.organizationName.trim().length < 2) {
				errors['organizationName'] = 'Organization name must be at least 2 characters.';
			}
			const normalizedSlug = slugifyFinal(values.organizationSlug);
			if (!normalizedSlug) {
				errors['organizationSlug'] = 'Organization slug is required.';
			} else if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
				errors['organizationSlug'] =
					'Organization slug can only include letters, numbers, and dashes.';
			} else if (normalizedSlug.length < 2) {
				errors['organizationSlug'] = 'Organization slug must be at least 2 characters.';
			}
		}

		if (step === 3 || step === 4) {
			if (values.metadata.trim().length > 4000) {
				errors['metadata'] = 'Metadata cannot exceed 4000 characters.';
			}
		}

		return errors;
	}

	function validateCreateOrganizationStep(step: CreateOrganizationStep): boolean {
		const stepErrors = getCreateOrganizationStepErrors(createOrganizationForm, step);
		createOrganizationFieldErrors = stepErrors;
		return Object.keys(stepErrors).length === 0;
	}

	function goToCreateOrganizationNextStep() {
		createOrganizationClientError = '';
		if (!validateCreateOrganizationStep(createOrganizationStep)) {
			return;
		}

		if (createOrganizationStep < 4) {
			createOrganizationStep = (createOrganizationStep + 1) as CreateOrganizationStep;
		}
	}

	function goToCreateOrganizationPreviousStep() {
		createOrganizationClientError = '';
		createOrganizationFieldErrors = {};
		if (createOrganizationStep > 1) {
			createOrganizationStep = (createOrganizationStep - 1) as CreateOrganizationStep;
		}
	}

	function submitCreateOrganizationWizard() {
		createOrganizationClientError = '';
		const reviewErrors = getCreateOrganizationStepErrors(createOrganizationForm, 4);
		createOrganizationFieldErrors = reviewErrors;
		if (Object.keys(reviewErrors).length > 0) {
			createOrganizationStep =
				reviewErrors['organizationName'] || reviewErrors['organizationSlug'] ? 1 : 3;
			return;
		}

		if (!createOrganizationSubmitForm) {
			createOrganizationClientError = 'Unable to submit organization form right now.';
			return;
		}

		createOrganizationSubmitting = true;
		createOrganizationSubmissionCount += 1;
		createOrganizationSubmitForm.requestSubmit();
	}

	const enhanceCreateOrganizationSubmit = () => {
		const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
		const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

		return async ({
			result,
			update
		}: {
			result: ActionResult;
			update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'redirect' || result.type === 'error') {
				createOrganizationSubmitting = false;
				await applyAction(result);
				return;
			}

			await update({ reset: false });
			createOrganizationSubmitting = false;

			if (typeof window !== 'undefined') {
				requestAnimationFrame(() => {
					window.scrollTo(scrollX, scrollY);
				});
			}

			if (result.type === 'success') {
				const payload = result.data as FormState | undefined;
				if (payload?.action === 'createOrganization' && payload.success) {
					closeCreateOrganizationWizard();
					resetCreateOrganizationWizard();
				}
			}
		};
	};
</script>

<section class="border-2 border-neutral-950 bg-neutral">
	<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
		<div class="flex items-start gap-3">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-primary-700 bg-primary text-white"
				aria-hidden="true"
			>
				<IconBuildingCommunity class="h-6 w-6" />
			</div>
			<div class="space-y-2">
				<p class="text-xs font-bold uppercase tracking-[0.16em] text-secondary-700">
					Temporary Location
				</p>
				<h2 class="font-serif text-3xl leading-none text-secondary-900">Organization Admin</h2>
				<p class="max-w-3xl text-sm leading-6 text-secondary-800">
					The organization create and manage tools are temporarily parked here while the
					account page is simplified.
				</p>
			</div>
		</div>
	</div>

	<div class="space-y-4 p-4">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
			<p class="max-w-3xl text-sm text-neutral-950">
				Use these controls to create a new organization or manage organizations you already
				belong to.
			</p>
			<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="button-secondary inline-flex items-center justify-center gap-2 cursor-pointer"
					onclick={openCreateOrganizationWizard}
				>
					<IconPlus class="w-4 h-4" />
					<span>New Organization</span>
				</button>
				<button
					type="button"
					class="button-secondary-outlined inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
					disabled={organizations.length === 0}
					onclick={openManageOrganizationWizard}
				>
					<IconPencil class="w-4 h-4" />
					<span>Manage Organizations</span>
				</button>
			</div>
		</div>

		{#if organizations.length === 0}
			<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
				No active organization memberships were found yet. You can still create a new
				organization from this page.
			</div>
		{/if}
	</div>
</section>

<form
	class="hidden"
	method="POST"
	action="?/createOrganization"
	use:enhance={enhanceCreateOrganizationSubmit}
	bind:this={createOrganizationSubmitForm}
>
	<input type="hidden" name="organizationName" value={createOrganizationForm.organizationName} />
	<input type="hidden" name="organizationSlug" value={createOrganizationForm.organizationSlug} />
	<input
		type="hidden"
		name="selfJoinEnabled"
		value={createOrganizationForm.selfJoinEnabled ? '1' : '0'}
	/>
	<input type="hidden" name="membershipRole" value={createOrganizationForm.membershipRole} />
	<input
		type="hidden"
		name="switchToOrganization"
		value={createOrganizationForm.switchToOrganization ? '1' : '0'}
	/>
	<input
		type="hidden"
		name="setDefaultOrganization"
		value={createOrganizationForm.setDefaultOrganization ? '1' : '0'}
	/>
	<input type="hidden" name="metadata" value={createOrganizationForm.metadata} />
</form>

<CreateOrganizationWizard
	open={createOrganizationOpen}
	step={createOrganizationStep}
	stepTitle={createOrganizationStepTitle}
	stepProgress={createOrganizationStepProgress}
	formError={createOrganizationFormError}
	unsavedConfirmOpen={createOrganizationUnsavedConfirmOpen}
	onRequestClose={requestCloseCreateOrganizationWizard}
	onSubmit={submitCreateOrganizationWizard}
	onInput={() => {
		createOrganizationClientError = '';
	}}
	onUnsavedConfirm={confirmDiscardCreateOrganizationWizard}
	onUnsavedCancel={cancelDiscardCreateOrganizationWizard}
>
	{#if createOrganizationStep === 1}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-3">
				<p class="text-xs font-bold uppercase tracking-wide text-neutral-950">Action Required</p>
				<p class="mt-1 text-sm text-neutral-950">Set the organization name and URL slug.</p>
			</div>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label
							for="organization-wizard-name"
							class="text-sm leading-6 font-sans text-neutral-950"
						>
							Organization Name <span class="text-error-700">*</span>
						</label>
					</div>
					<input
						id="organization-wizard-name"
						type="text"
						class="input-secondary"
						placeholder="PlayIMs Campus"
						value={createOrganizationForm.organizationName}
						data-wizard-autofocus
						oninput={(event) => {
							const value = (event.currentTarget as HTMLInputElement).value;
							createOrganizationForm.organizationName = value;
							if (!createOrganizationSlugTouched) {
								createOrganizationForm.organizationSlug = slugifyFinal(value);
							}
						}}
						autocomplete="off"
					/>
					{#if createOrganizationFieldErrors['organizationName']}
						<p class="mt-1 text-xs text-error-700">
							{createOrganizationFieldErrors['organizationName']}
						</p>
					{/if}
				</div>
				<div>
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label
							for="organization-wizard-slug"
							class="text-sm leading-6 font-sans text-neutral-950"
						>
							Organization Slug <span class="text-error-700">*</span>
						</label>
						<InfoPopover
							buttonAriaLabel="Organization slug help"
							buttonVariant="label-inline"
							align="left"
							panelWidthClass="w-80"
						>
							<div class="space-y-2">
								<p>A slug is the URL-friendly identifier used in links and join flows.</p>
								<p>Used for the join page URL, such as `/your-slug`.</p>
							</div>
						</InfoPopover>
					</div>
					<div class="relative">
						<input
							id="organization-wizard-slug"
							type="text"
							class="input-secondary pr-10"
							placeholder="playims-campus"
							value={createOrganizationForm.organizationSlug}
							oninput={(event) => {
								createOrganizationSlugTouched = true;
								createOrganizationForm.organizationSlug = applyLiveSlugInput(
									event.currentTarget as HTMLInputElement
								);
							}}
							autocomplete="off"
						/>
						<HoverTooltip
							text="Revert to default"
							wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
						>
							<button
								type="button"
								tabindex="-1"
								class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none"
								aria-label="Revert organization slug to default"
								onclick={() => {
									createOrganizationSlugTouched = false;
									createOrganizationForm.organizationSlug = slugifyFinal(
										createOrganizationForm.organizationName
									);
								}}
							>
								<IconRestore class="h-4 w-4" />
							</button>
						</HoverTooltip>
					</div>
					{#if createOrganizationFieldErrors['organizationSlug']}
						<p class="mt-1 text-xs text-error-700">
							{createOrganizationFieldErrors['organizationSlug']}
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if createOrganizationStep === 2}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-3">
				<p class="text-xs font-bold uppercase tracking-wide text-neutral-950">Access Settings</p>
				<p class="mt-1 text-sm text-neutral-950">
					Define your membership role and decide if this org should allow self-join.
				</p>
			</div>
			<div class="space-y-3">
				<p class="text-sm font-semibold text-neutral-950">Your role in this organization</p>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<button
						type="button"
						class={`border p-3 text-left cursor-pointer ${createOrganizationForm.membershipRole === 'participant' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
						onclick={() => {
							createOrganizationForm.membershipRole = 'participant';
						}}
					>
						<p class="font-semibold">Participant</p>
						<p class="mt-1 text-xs">Basic member access for low-privilege testing.</p>
					</button>
					<button
						type="button"
						class={`border p-3 text-left cursor-pointer ${createOrganizationForm.membershipRole === 'manager' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
						onclick={() => {
							createOrganizationForm.membershipRole = 'manager';
						}}
					>
						<p class="font-semibold">Manager</p>
						<p class="mt-1 text-xs">Can manage operations and dashboard settings.</p>
					</button>
					<button
						type="button"
						class={`border p-3 text-left cursor-pointer ${createOrganizationForm.membershipRole === 'admin' ? 'border-primary-500 bg-primary-100 text-primary-900' : 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'}`}
						onclick={() => {
							createOrganizationForm.membershipRole = 'admin';
						}}
					>
						<p class="font-semibold">Admin</p>
						<p class="mt-1 text-xs">Full administrative control for this organization.</p>
					</button>
				</div>
			</div>
			<div class="border border-neutral-950 bg-white p-3">
				<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
					<input
						type="checkbox"
						class="toggle-secondary"
						checked={createOrganizationForm.selfJoinEnabled}
						onchange={(event) => {
							createOrganizationForm.selfJoinEnabled = (
								event.currentTarget as HTMLInputElement
							).checked;
						}}
					/>
					Allow open self-join for `/<span class="font-semibold"
						>{slugifyFinal(createOrganizationForm.organizationSlug) || 'organization-slug'}</span
					>`
				</label>
			</div>
		</div>
	{/if}

	{#if createOrganizationStep === 3}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-3">
				<p class="text-xs font-bold uppercase tracking-wide text-neutral-950">Defaults</p>
				<p class="mt-1 text-sm text-neutral-950">
					Choose how this new organization should apply to your account right away.
				</p>
			</div>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div class="border border-neutral-950 bg-white p-3">
					<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
						<input
							type="checkbox"
							class="toggle-secondary"
							checked={createOrganizationForm.switchToOrganization}
							onchange={(event) => {
								createOrganizationForm.switchToOrganization = (
									event.currentTarget as HTMLInputElement
								).checked;
							}}
						/>
						Switch to this organization after create
					</label>
				</div>
				<div class="border border-neutral-950 bg-white p-3">
					<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
						<input
							type="checkbox"
							class="toggle-secondary"
							checked={createOrganizationForm.setDefaultOrganization}
							onchange={(event) => {
								createOrganizationForm.setDefaultOrganization = (
									event.currentTarget as HTMLInputElement
								).checked;
							}}
						/>
						Set as my default organization
					</label>
				</div>
			</div>
			<div>
				<label for="organization-wizard-metadata" class="mb-1 block text-sm text-neutral-950">
					Metadata (optional)
				</label>
				<textarea
					id="organization-wizard-metadata"
					class="textarea-secondary min-h-28"
					placeholder="Optional JSON or notes for this organization."
					bind:value={createOrganizationForm.metadata}
				></textarea>
				<p class="mt-1 text-xs text-neutral-950">{createOrganizationForm.metadata.length}/4000</p>
				{#if createOrganizationFieldErrors['metadata']}
					<p class="mt-1 text-xs text-error-700">{createOrganizationFieldErrors['metadata']}</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if createOrganizationStep === 4}
		<div class="space-y-4">
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<p class="text-xs font-bold uppercase tracking-wide text-neutral-950">Organization</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Name:</span>
					{createOrganizationForm.organizationName.trim() || 'TBD'}
				</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Slug:</span>
					{slugifyFinal(createOrganizationForm.organizationSlug) || 'TBD'}
				</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Self-join:</span>
					{createOrganizationForm.selfJoinEnabled ? 'Enabled' : 'Disabled'}
				</p>
			</div>
			<div class="border-2 border-neutral-950 bg-white p-4 space-y-2">
				<p class="text-xs font-bold uppercase tracking-wide text-neutral-950">Membership</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Role:</span>
					{createOrganizationForm.membershipRole}
				</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Switch after create:</span>
					{createOrganizationForm.switchToOrganization ? 'Yes' : 'No'}
				</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Set default:</span>
					{createOrganizationForm.setDefaultOrganization ? 'Yes' : 'No'}
				</p>
				{#if createOrganizationForm.metadata.trim()}
					<p class="text-sm text-neutral-950">
						<span class="font-semibold">Metadata:</span>
						{createOrganizationForm.metadata.trim()}
					</p>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			step={createOrganizationStep}
			lastStep={4}
			showBack={createOrganizationStep > 1}
			canGoNext={createOrganizationCanGoNext}
			canSubmit={createOrganizationCanSubmit}
			nextLabel="Next"
			submitLabel="Create Organization"
			submittingLabel="Creating..."
			isSubmitting={createOrganizationSubmitting}
			on:back={goToCreateOrganizationPreviousStep}
			on:next={goToCreateOrganizationNextStep}
		/>
	{/snippet}
</CreateOrganizationWizard>

<ManageOrganizationWizard
	open={manageOrganizationOpen}
	{organizations}
	selectedOrganizationId={manageOrganizationSelectedClientId || currentOrganizationId}
	on:close={closeManageOrganizationWizard}
	on:saved={(event) => {
		void handleManageOrganizationSaved(event.detail.selectedOrganizationId);
	}}
/>
