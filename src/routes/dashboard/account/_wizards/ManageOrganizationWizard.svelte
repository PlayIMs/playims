<script lang="ts">
	import IconDeviceFloppy from '@tabler/icons-svelte/icons/device-floppy';
	import IconLogout from '@tabler/icons-svelte/icons/logout';
	import IconRestore from '@tabler/icons-svelte/icons/restore';
	import IconTarget from '@tabler/icons-svelte/icons/target';
	import IconX from '@tabler/icons-svelte/icons/x';
	import { createEventDispatcher, tick } from 'svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { WizardModal } from '$lib/components/wizard';

	interface OrganizationOption {
		clientId: string;
		clientName: string;
		clientSlug: string | null;
		role: string;
		isDefault: boolean;
		isCurrent: boolean;
		selfJoinEnabled: boolean;
		status: string;
	}

	interface ManageOrganizationResponse {
		success: boolean;
		data?: {
			clientId?: string | null;
			activeClientId?: string | null;
			defaultClientId?: string | null;
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface Props {
		open: boolean;
		organizations: OrganizationOption[];
		selectedOrganizationId: string;
	}

	let { open, organizations, selectedOrganizationId }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		saved: {
			activeClientId?: string | null;
			defaultClientId?: string | null;
			selectedOrganizationId?: string | null;
		};
	}>();

	let organizationId = $state('');
	let organizationName = $state('');
	let organizationSlug = $state('');
	let selfJoinEnabled = $state(false);
	let leaveConfirmSlug = $state('');
	let formError = $state('');
	let formSuccess = $state('');
	let fieldErrors = $state<Record<string, string>>({});
	let isSubmitting = $state(false);
	let isLeaveModalOpen = $state(false);
	let hasInitializedForOpen = $state(false);
	let organizationSearchTerm = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);

	const sortedOrganizations = $derived.by(() =>
		[...organizations].sort((a, b) => {
			if (a.isCurrent && !b.isCurrent) return -1;
			if (!a.isCurrent && b.isCurrent) return 1;
			return a.clientName.localeCompare(b.clientName, 'en', { sensitivity: 'base' });
		})
	);
	const filteredOrganizations = $derived.by(() => {
		const term = organizationSearchTerm.trim().toLowerCase();
		if (!term) return sortedOrganizations;
		return sortedOrganizations.filter((organization) => {
			const searchable =
				`${organization.clientName} ${organization.clientSlug ?? ''} ${organization.role}`.toLowerCase();
			return searchable.includes(term);
		});
	});
	const selectedOrganization = $derived.by(
		() => sortedOrganizations.find((organization) => organization.clientId === organizationId) ?? null
	);
	const selectedRole = $derived.by(
		() => selectedOrganization?.role?.trim().toLowerCase() ?? 'participant'
	);
	const canEditDetails = $derived.by(() => selectedRole === 'admin' || selectedRole === 'dev');
	const canSetDefault = $derived.by(() => Boolean(selectedOrganization && !selectedOrganization.isDefault));
	const canLeave = $derived.by(() => sortedOrganizations.length > 1);
	const normalizedExpectedLeaveSlug = $derived.by(() =>
		normalizeSlug(selectedOrganization?.clientSlug || selectedOrganization?.clientName || '')
	);
	const canLeaveSelected = $derived.by(
		() => normalizeSlug(leaveConfirmSlug) === normalizedExpectedLeaveSlug
	);
	const hasDetailChanges = $derived.by(() => {
		if (!selectedOrganization) return false;
		const normalizedCurrentSlug = normalizeSlug(
			selectedOrganization.clientSlug || selectedOrganization.clientName || ''
		);
		return (
			organizationName.trim() !== (selectedOrganization.clientName || '').trim() ||
			normalizeSlug(organizationSlug) !== normalizedCurrentSlug ||
			selfJoinEnabled !== selectedOrganization.selfJoinEnabled
		);
	});
	const selectedStatusLabel = $derived.by(() => {
		if (!selectedOrganization) return '';
		const flags: string[] = [];
		if (selectedOrganization.isCurrent) flags.push('Current');
		if (selectedOrganization.isDefault) flags.push('Default');
		return flags.length > 0 ? flags.join(' / ') : '';
	});

	function normalizeSlug(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function hydrateFromOrganization(nextOrganization: OrganizationOption | null): void {
		organizationName = nextOrganization?.clientName ?? '';
		organizationSlug = normalizeSlug(nextOrganization?.clientSlug || nextOrganization?.clientName || '');
		selfJoinEnabled = nextOrganization?.selfJoinEnabled ?? false;
		leaveConfirmSlug = '';
		fieldErrors = {};
		formError = '';
		formSuccess = '';
	}

	$effect(() => {
		if (!open) {
			hasInitializedForOpen = false;
			isLeaveModalOpen = false;
			organizationSearchTerm = '';
			return;
		}

		if (!hasInitializedForOpen) {
			const preferred =
				sortedOrganizations.find((organization) => organization.clientId === selectedOrganizationId) ??
				sortedOrganizations[0] ??
				null;
			organizationId = preferred?.clientId ?? '';
			hydrateFromOrganization(preferred);
			hasInitializedForOpen = true;
			return;
		}

		if (
			organizationId &&
			sortedOrganizations.some((organization) => organization.clientId === organizationId)
		) {
			return;
		}

		const fallback = sortedOrganizations[0] ?? null;
		organizationId = fallback?.clientId ?? '';
		hydrateFromOrganization(fallback);
	});

	function selectOrganization(nextOrganizationId: string): void {
		if (isSubmitting || nextOrganizationId === organizationId) return;
		const nextOrganization =
			sortedOrganizations.find((organization) => organization.clientId === nextOrganizationId) ?? null;
		if (!nextOrganization) return;
		organizationId = nextOrganizationId;
		isLeaveModalOpen = false;
		hydrateFromOrganization(nextOrganization);
		void tick().then(() => {
			nameInput?.focus();
		});
	}

	function close(): void {
		if (isSubmitting) return;
		isLeaveModalOpen = false;
		dispatch('close');
	}

	function openLeaveModal(): void {
		if (!selectedOrganization || isSubmitting || !canLeave) return;
		leaveConfirmSlug = '';
		fieldErrors = {};
		formError = '';
		formSuccess = '';
		isLeaveModalOpen = true;
	}

	function closeLeaveModal(): void {
		if (isSubmitting) return;
		isLeaveModalOpen = false;
		leaveConfirmSlug = '';
	}

	function revertDetails(): void {
		if (!selectedOrganization || isSubmitting || !hasDetailChanges) return;
		hydrateFromOrganization(selectedOrganization);
	}

	function applyFieldErrors(source: Record<string, string[] | undefined> | undefined): void {
		const nextErrors: Record<string, string> = {};
		if (!source) {
			fieldErrors = nextErrors;
			return;
		}
		for (const [key, value] of Object.entries(source)) {
			if (!value || value.length === 0) continue;
			nextErrors[key] = value[0] as string;
		}
		fieldErrors = nextErrors;
	}

	async function submitPatch(payload: {
		action: 'update-details' | 'set-default';
		clientId: string;
		organizationName?: string;
		organizationSlug?: string;
		selfJoinEnabled?: boolean;
	}): Promise<boolean> {
		formError = '';
		formSuccess = '';
		applyFieldErrors(undefined);
		isSubmitting = true;
		try {
			const response = await fetch('/api/auth/organizations', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as ManageOrganizationResponse;
			if (!response.ok || !body.success) {
				applyFieldErrors(body.fieldErrors);
				formError = body.error || 'Unable to update organization right now.';
				return false;
			}

			formSuccess =
				payload.action === 'set-default' ? 'Default organization updated.' : 'Organization updated.';
			dispatch('saved', {
				activeClientId: body.data?.activeClientId ?? null,
				defaultClientId: body.data?.defaultClientId ?? null,
				selectedOrganizationId:
					body.data?.clientId ?? body.data?.activeClientId ?? body.data?.defaultClientId ?? payload.clientId
			});
			return true;
		} catch {
			formError = 'Unable to update organization right now.';
			return false;
		} finally {
			isSubmitting = false;
		}
	}

	async function saveDetails(): Promise<void> {
		if (!selectedOrganization || !canEditDetails || !hasDetailChanges || isSubmitting) return;
		await submitPatch({
			action: 'update-details',
			clientId: selectedOrganization.clientId,
			organizationName: organizationName.trim(),
			organizationSlug: normalizeSlug(organizationSlug),
			selfJoinEnabled
		});
	}

	async function setDefault(): Promise<void> {
		if (!selectedOrganization || !canSetDefault || isSubmitting) return;
		await submitPatch({
			action: 'set-default',
			clientId: selectedOrganization.clientId
		});
	}

	async function leaveOrganization(): Promise<void> {
		if (!selectedOrganization || !canLeave || !canLeaveSelected || isSubmitting) return;
		formError = '';
		formSuccess = '';
		applyFieldErrors(undefined);
		isSubmitting = true;
		try {
			const response = await fetch('/api/auth/organizations', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clientId: selectedOrganization.clientId,
					confirmSlug: leaveConfirmSlug
				})
			});
			const body = (await response.json()) as ManageOrganizationResponse;
			if (!response.ok || !body.success) {
				applyFieldErrors(body.fieldErrors);
				formError = body.error || 'Unable to leave organization right now.';
				return;
			}

			isLeaveModalOpen = false;
			dispatch('saved', {
				activeClientId: body.data?.activeClientId ?? null,
				defaultClientId: body.data?.defaultClientId ?? null,
				selectedOrganizationId:
					body.data?.activeClientId ?? body.data?.defaultClientId ?? body.data?.clientId ?? null
			});
			dispatch('close');
		} catch {
			formError = 'Unable to leave organization right now.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<WizardModal
	{open}
	title="Manage Organizations"
	step={1}
	stepCount={1}
	stepTitle="Organization Administration"
	progressPercent={100}
	closeAriaLabel="Close manage organizations modal"
	on:requestClose={close}
	on:submit={(event) => {
		event.preventDefault();
	}}
	on:input={() => {
		formError = '';
		formSuccess = '';
	}}
	maxWidthClass="max-w-6xl"
>
	{#snippet error()}
		{#if formError}
			<div class="border-2 border-error-300 bg-error-50 p-3">
				<p class="text-error-700 text-sm font-sans">{formError}</p>
			</div>
		{/if}
		{#if formSuccess}
			<div class="border-2 border-primary-300 bg-primary-100 p-3">
				<p class="text-primary-900 text-sm font-sans">{formSuccess}</p>
			</div>
		{/if}
	{/snippet}

	<div class="grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] gap-4 min-h-0">
		<section class="border-2 border-secondary-300 bg-white min-h-0 flex flex-col">
			<div class="px-3 py-2 border-b border-secondary-200 flex items-center gap-2">
				<p
					class="h-6 inline-flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-950 shrink-0"
				>
					Organizations
				</p>
				<SearchInput
					id="manage-organization-search"
					label="Search organizations"
					value={organizationSearchTerm}
					disabled={isSubmitting}
					placeholder="Search organizations"
					autocomplete="off"
					wrapperClass="relative ml-2 flex-1 min-w-0"
					iconClass="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-950"
					inputClass="input-secondary h-6 min-h-0 w-full pl-7 pr-7 py-0 text-xs leading-5 disabled:cursor-not-allowed"
					clearButtonClass="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer"
					clearIconClass="w-3.5 h-3.5"
					clearAriaLabel="Clear organization search"
					on:input={(event) => {
						organizationSearchTerm = event.detail.value;
					}}
				/>
			</div>
			<div class="max-h-[52vh] overflow-y-auto p-2 space-y-2">
				{#if filteredOrganizations.length === 0}
					<p class="text-sm text-neutral-900 px-1 py-2">
						{organizationSearchTerm.trim()
							? 'No organizations match your search.'
							: 'No organizations available.'}
					</p>
				{:else}
					{#each filteredOrganizations as organization}
						<button
							type="button"
							aria-label={`Select ${organization.clientName}`}
							class={`w-full text-left border-2 px-2 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
								organization.clientId === organizationId
									? 'border-primary-500 bg-primary-100'
									: 'border-secondary-300 bg-neutral hover:bg-neutral-100'
							}`}
							onclick={() => {
								selectOrganization(organization.clientId);
							}}
						>
							<p class="text-lg font-bold font-serif text-neutral-950 truncate">
								{organization.clientName}
							</p>
							<p class="text-xs text-neutral-900">/{organization.clientSlug ?? 'organization'}</p>
							<p class="text-[10px] uppercase tracking-wide text-neutral-950 mt-1">
								Role: {organization.role}
								{#if organization.isCurrent}
									{' - Current'}
								{/if}
								{#if organization.isDefault}
									{' - Default'}
								{/if}
							</p>
						</button>
					{/each}
				{/if}
			</div>
		</section>

		{#if selectedOrganization}
			<section class="border-2 border-secondary-300 bg-white p-4 space-y-4">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div class="space-y-1">
						<h3 class="text-3xl font-bold font-serif text-neutral-950">
							{selectedOrganization.clientName}
						</h3>
						<p class="text-xs uppercase tracking-wide text-neutral-950">
							Role: {selectedRole}
							{#if selectedStatusLabel}
								{' - '}
								{selectedStatusLabel}
							{/if}
						</p>
					</div>

					<div class="flex items-center flex-wrap gap-2">
						{#if canEditDetails && hasDetailChanges}
							<HoverTooltip text="Revert unsaved changes">
								<button
									type="button"
									class="button-secondary-outlined w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
									aria-label="Revert unsaved organization changes"
									disabled={isSubmitting}
									onclick={revertDetails}
								>
									<IconRestore class="w-5 h-5" />
								</button>
							</HoverTooltip>
						{/if}

						<HoverTooltip text="Save details">
							<button
								type="button"
								class="button-secondary-outlined w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Save organization details"
								disabled={!canEditDetails || !hasDetailChanges || isSubmitting}
								onclick={() => {
									void saveDetails();
								}}
							>
								<IconDeviceFloppy class="w-5 h-5" />
							</button>
						</HoverTooltip>

						<HoverTooltip text="Set as default organization">
							<button
								type="button"
								class="button-secondary-outlined border-green-600 text-green-700 hover:bg-green-50 w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Set as default organization"
								disabled={!canSetDefault || isSubmitting}
								onclick={() => {
									void setDefault();
								}}
							>
								<IconTarget class="w-5 h-5" />
							</button>
						</HoverTooltip>

						<HoverTooltip text="Leave organization (opens confirmation)" maxWidthClass="max-w-72">
							<button
								type="button"
								class="button-secondary-outlined border-error-700 text-error-700 hover:bg-error-50 w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Open leave organization dialog"
								disabled={!canLeave || isSubmitting}
								onclick={openLeaveModal}
							>
								<IconLogout class="w-5 h-5" />
							</button>
						</HoverTooltip>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label for="manage-organization-name" class="block text-sm text-neutral-950 mb-1">
							Name
						</label>
						<input
							id="manage-organization-name"
							type="text"
							class="input-secondary"
							bind:value={organizationName}
							bind:this={nameInput}
							disabled={!canEditDetails || isSubmitting}
						/>
						{#if fieldErrors['organizationName']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['organizationName']}</p>
						{/if}
					</div>
					<div>
						<div class="mb-1 flex h-5 items-center gap-1.5 leading-none">
							<label for="manage-organization-slug" class="text-sm leading-5 text-neutral-950">
								Slug
							</label>
							<InfoPopover
								buttonAriaLabel="Organization slug help"
								buttonVariant="label-inline"
								align="left"
								panelWidthClass="w-80"
							>
								<div class="space-y-2">
									<p>A slug is the URL-friendly identifier used in links and join flows.</p>
									<p>Leave the default slug if you are unsure.</p>
								</div>
							</InfoPopover>
						</div>
						<div class="relative">
							<input
								id="manage-organization-slug"
								type="text"
								class="input-secondary pr-10"
								value={organizationSlug}
								oninput={(event) => {
									organizationSlug = normalizeSlug((event.currentTarget as HTMLInputElement).value);
								}}
								disabled={!canEditDetails || isSubmitting}
							/>
							<HoverTooltip
								text="Revert to default"
								wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
							>
								<button
									type="button"
									tabindex="-1"
									class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none disabled:cursor-not-allowed disabled:text-secondary-400"
									aria-label="Revert organization slug to default"
									onclick={() => {
										organizationSlug = normalizeSlug(organizationName);
									}}
									disabled={!canEditDetails || isSubmitting}
								>
									<IconRestore class="h-4 w-4" />
								</button>
							</HoverTooltip>
						</div>
						{#if fieldErrors['organizationSlug']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['organizationSlug']}</p>
						{/if}
					</div>
					<div class="md:col-span-2 border border-secondary-300 bg-neutral p-3">
						<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
							<input
								type="checkbox"
								class="toggle-secondary"
								checked={selfJoinEnabled}
								onchange={(event) => {
									selfJoinEnabled = (event.currentTarget as HTMLInputElement).checked;
								}}
								disabled={!canEditDetails || isSubmitting}
							/>
							Allow open self-join for `/{organizationSlug || 'organization-slug'}`
						</label>
						{#if fieldErrors['selfJoinEnabled']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['selfJoinEnabled']}</p>
						{/if}
					</div>
				</div>
			</section>
		{/if}
	</div>

	{#snippet footer()}
		<div class="pt-2 border-t border-secondary-300 flex justify-end">
			<button
				type="button"
				class="button-secondary-outlined cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
				disabled={isSubmitting}
				onclick={close}
			>
				Close
			</button>
		</div>
	{/snippet}
</WizardModal>

<ModalShell
	open={open && isLeaveModalOpen}
	closeAriaLabel="Close leave organization dialog"
	panelClass="w-full max-w-2xl max-h-[calc(100vh-3rem)] border-4 border-error-700 bg-error-25 overflow-hidden flex flex-col"
	on:requestClose={closeLeaveModal}
>
	<div class="p-4 border-b border-error-300 bg-error-50 flex items-start justify-between gap-3">
		<div class="space-y-1">
			<h3 class="text-2xl font-bold font-serif text-error-900">Leave Organization</h3>
		</div>
		<button
			type="button"
			class="p-1 text-error-700 hover:text-error-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-700"
			aria-label="Close leave organization dialog"
			onclick={closeLeaveModal}
		>
			<IconX class="w-5 h-5" />
		</button>
	</div>

	<div class="p-4 space-y-3 overflow-y-auto">
		<div class="border-2 border-error-300 bg-error-50 p-3 space-y-2">
			<p class="text-sm text-error-900 font-semibold">
				Leaving this organization removes your membership and access to this organization's dashboard.
			</p>
			<p class="text-sm text-error-700 font-semibold">
				This action can only be undone by joining again or being re-added by an administrator.
			</p>
		</div>
		<div>
			<label for="manage-organization-leave-slug" class="block text-sm text-neutral-950 mb-1">
				Type
				<code class="font-mono text-xs bg-error-100 text-error-900 px-1 py-0.5 rounded">
					{normalizedExpectedLeaveSlug}
				</code>
				to confirm leaving.
			</label>
			<input
				id="manage-organization-leave-slug"
				type="text"
				class="input-secondary border-error-400 focus:border-error-600"
				bind:value={leaveConfirmSlug}
				disabled={isSubmitting}
			/>
			{#if fieldErrors['confirmSlug']}
				<p class="text-xs text-error-700 mt-1">{fieldErrors['confirmSlug']}</p>
			{/if}
		</div>
	</div>

	<div class="p-4 border-t border-secondary-300 flex justify-end gap-2">
		<button
			type="button"
			class="button-secondary-outlined cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
			disabled={isSubmitting}
			onclick={closeLeaveModal}
		>
			Cancel
		</button>
		<button
			type="button"
			class="button-error cursor-pointer inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={!canLeaveSelected || isSubmitting}
			onclick={() => {
				void leaveOrganization();
			}}
		>
			<IconLogout class="w-4 h-4" />
			Leave Organization
		</button>
	</div>
</ModalShell>
