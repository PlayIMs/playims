<script lang="ts">
	import { tick } from 'svelte';
	import { IconLogout, IconX } from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import { WizardModal } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import {
		filterOrganizationsForSwitcher,
		sortOrganizationsForSwitcher,
		type OrganizationSwitcherOption
	} from '$lib/utils/organization-switcher';

	interface OrganizationActionResult {
		success: boolean;
		error?: string;
	}

	type OrganizationOption = OrganizationSwitcherOption;

	interface VisibleOrganizationOption extends OrganizationOption {
		quickKey: string | null;
	}

	interface Props {
		open: boolean;
		formError: string;
		submitting: boolean;
		organizations: OrganizationOption[];
		selectedOrganizationId: string;
		onRequestClose: () => void;
		onSelectOrganization: (
			clientId: string
		) => Promise<OrganizationActionResult> | OrganizationActionResult;
		onLeaveOrganization: (
			clientId: string,
			confirmSlug: string
		) => Promise<OrganizationActionResult> | OrganizationActionResult;
	}

	const MAX_VISIBLE_ORGANIZATIONS = 9;

	let {
		open,
		formError,
		submitting,
		organizations,
		selectedOrganizationId,
		onRequestClose,
		onSelectOrganization,
		onLeaveOrganization
	}: Props = $props();

	let organizationSearchTerm = $state('');
	let manageOrganizationSearchTerm = $state('');
	let manageOrganizationsOpen = $state(false);
	let leaveConfirmOpen = $state(false);
	let leaveOrganizationId = $state('');
	let leaveConfirmSlug = $state('');
	let highlightedIndex = $state(0);
	let localActionError = $state('');
	let leaveSubmitting = $state(false);
	let organizationSearchInput = $state<HTMLInputElement | null>(null);
	let manageOrganizationSearchInput = $state<HTMLInputElement | null>(null);
	let lastToastSignature = $state('');

	const sortedOrganizations = $derived.by(() =>
		sortOrganizationsForSwitcher(organizations, selectedOrganizationId)
	);
	const filteredOrganizations = $derived.by(() =>
		filterOrganizationsForSwitcher(sortedOrganizations, organizationSearchTerm)
	);
	const visibleOrganizationOptions = $derived.by<VisibleOrganizationOption[]>(() =>
		(() => {
			let quickKeyIndex = 1;
			return filteredOrganizations.slice(0, MAX_VISIBLE_ORGANIZATIONS).map((organization) => {
				if (organization.clientId === selectedOrganizationId || organization.isCurrent) {
					return {
						...organization,
						quickKey: null
					};
				}

				const quickKey = String(quickKeyIndex);
				quickKeyIndex += 1;
				return {
					...organization,
					quickKey
				};
			});
		})()
	);
	const filteredManageOrganizations = $derived.by(() =>
		filterOrganizationsForSwitcher(sortedOrganizations, manageOrganizationSearchTerm)
	);
	const leaveOrganizationTarget = $derived.by(
		() =>
			sortedOrganizations.find((organization) => organization.clientId === leaveOrganizationId) ?? null
	);
	const normalizedExpectedLeaveSlug = $derived.by(() =>
		normalizeSlug(
			leaveOrganizationTarget?.clientSlug || leaveOrganizationTarget?.clientName || ''
		)
	);
	const canConfirmLeave = $derived.by(
		() => normalizeSlug(leaveConfirmSlug) === normalizedExpectedLeaveSlug && !leaveSubmitting
	);

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

	function normalizeActionResult(result: OrganizationActionResult | boolean | void): OrganizationActionResult {
		if (typeof result === 'boolean') {
			return { success: result };
		}
		if (!result || typeof result !== 'object') {
			return { success: false };
		}
		return {
			success: result.success === true,
			error: result.error?.trim() || undefined
		};
	}

	function moveHighlight(direction: 1 | -1): void {
		if (visibleOrganizationOptions.length === 0) return;
		const nextIndex =
			(highlightedIndex + direction + visibleOrganizationOptions.length) %
			visibleOrganizationOptions.length;
		highlightedIndex = nextIndex;
		void tick().then(() => {
			const optionButton = document.querySelector<HTMLButtonElement>(
				`[data-organization-option-index="${nextIndex}"]`
			);
			optionButton?.focus();
		});
	}

	async function submitOrganizationSelection(clientId: string): Promise<void> {
		if (submitting || leaveSubmitting || clientId === selectedOrganizationId) {
			return;
		}

		localActionError = '';
		const result = normalizeActionResult(await onSelectOrganization(clientId));
		if (!result.success && result.error) {
			localActionError = result.error;
		}
	}

	function submitHighlightedOption(): void {
		if (visibleOrganizationOptions.length === 0) return;
		const option = visibleOrganizationOptions[highlightedIndex];
		if (!option) return;
		void submitOrganizationSelection(option.clientId);
	}

	function openManageOrganizations(): void {
		if (submitting || leaveSubmitting) return;
		manageOrganizationSearchTerm = organizationSearchTerm;
		manageOrganizationsOpen = true;
		localActionError = '';
	}

	function closeManageOrganizations(): void {
		if (submitting || leaveSubmitting) return;
		manageOrganizationsOpen = false;
		leaveConfirmOpen = false;
		leaveOrganizationId = '';
		leaveConfirmSlug = '';
	}

	function openLeaveConfirm(clientId: string): void {
		if (submitting || leaveSubmitting) return;
		leaveOrganizationId = clientId;
		leaveConfirmSlug = '';
		leaveConfirmOpen = true;
		localActionError = '';
	}

	function closeLeaveConfirm(): void {
		if (leaveSubmitting) return;
		leaveConfirmOpen = false;
		leaveOrganizationId = '';
		leaveConfirmSlug = '';
	}

	async function confirmLeaveOrganization(): Promise<void> {
		if (!leaveOrganizationId || !canConfirmLeave) return;

		leaveSubmitting = true;
		localActionError = '';
		try {
			const result = normalizeActionResult(
				await onLeaveOrganization(leaveOrganizationId, leaveConfirmSlug)
			);
			if (!result.success) {
				localActionError = result.error ?? 'Unable to leave organization right now.';
				return;
			}

			toast.success('Organization left.', {
				title: 'Organization switch'
			});
			closeLeaveConfirm();
			closeManageOrganizations();
		} finally {
			leaveSubmitting = false;
		}
	}

	$effect(() => {
		const message = formError.trim() || localActionError.trim();
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
			id: 'switch-organization-error',
			title: 'Organization switch'
		});
	});

	$effect(() => {
		if (!open) {
			organizationSearchTerm = '';
			manageOrganizationSearchTerm = '';
			manageOrganizationsOpen = false;
			leaveConfirmOpen = false;
			leaveOrganizationId = '';
			leaveConfirmSlug = '';
			highlightedIndex = 0;
			localActionError = '';
			return;
		}

		highlightedIndex = 0;
		void tick().then(() => {
			organizationSearchInput?.focus();
		});
	});

	$effect(() => {
		if (!manageOrganizationsOpen) {
			return;
		}

		void tick().then(() => {
			manageOrganizationSearchInput?.focus();
		});
	});

	$effect(() => {
		if (visibleOrganizationOptions.length === 0) {
			highlightedIndex = 0;
			return;
		}

		if (highlightedIndex >= visibleOrganizationOptions.length) {
			highlightedIndex = 0;
		}
	});

	$effect(() => {
		if (!open || manageOrganizationsOpen || leaveConfirmOpen || typeof window === 'undefined') {
			return;
		}

		const handleWindowKeydown = (event: KeyboardEvent): void => {
			if (submitting || leaveSubmitting) return;
			if (event.altKey || event.ctrlKey || event.metaKey) return;

			if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
				event.preventDefault();
				moveHighlight(1);
				return;
			}
			if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
				event.preventDefault();
				moveHighlight(-1);
				return;
			}
			if (event.key === 'Enter' && visibleOrganizationOptions.length > 0) {
				event.preventDefault();
				submitHighlightedOption();
				return;
			}

			if (!/^[1-9]$/.test(event.key)) return;

			const matchingOption = visibleOrganizationOptions.find(
				(option) => option.quickKey === event.key
			);
			if (!matchingOption) return;

			event.preventDefault();
			void submitOrganizationSelection(matchingOption.clientId);
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<WizardModal
	open={open && !manageOrganizationsOpen}
	title="Switch Organization"
	step={1}
	stepCount={1}
	stepTitle="Organization Picker"
	progressPercent={100}
	closeAriaLabel="Close switch organization wizard"
	maxWidthClass="max-w-lg"
	formClass="p-4 space-y-4"
	on:requestClose={onRequestClose}
>
	<div class="space-y-4">
		<SearchInput
			id="switch-organization-search"
			label="Search organizations"
			value={organizationSearchTerm}
			disabled={submitting || leaveSubmitting}
			placeholder="Search organizations"
			autocomplete="off"
			wrapperClass="relative w-full"
			inputClass="w-full input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed"
			clearAriaLabel="Clear organization search"
			bind:inputElement={organizationSearchInput}
			data-wizard-autofocus
			on:input={(event) => {
				organizationSearchTerm = event.detail.value;
			}}
		/>

		{#if visibleOrganizationOptions.length === 0}
			<div class="border border-neutral-950 bg-white p-2.5">
				<p class="text-xs font-sans text-neutral-950">
					{organizationSearchTerm.trim()
						? 'No organizations match your search.'
						: 'No organizations available.'}
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-2">
				{#each visibleOrganizationOptions as option, optionIndex}
					<button
						type="button"
						data-organization-option-index={optionIndex}
						tabindex={highlightedIndex === optionIndex ? 0 : -1}
						onfocus={() => {
							highlightedIndex = optionIndex;
						}}
						class={`group relative border p-2.5 pr-14 text-left cursor-pointer focus-visible:outline-none focus-visible:border-primary-700 disabled:cursor-wait disabled:opacity-70 ${
							highlightedIndex === optionIndex
								? 'border-primary-500 bg-primary-100 text-primary-900'
								: 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'
						}`}
						disabled={submitting || leaveSubmitting}
						onclick={() => {
							void submitOrganizationSelection(option.clientId);
						}}
					>
						<div class="flex items-center gap-2">
							<p class="font-semibold">{option.clientName}</p>
							{#if option.clientId === selectedOrganizationId || option.isCurrent}
								<span class="text-[10px] font-bold uppercase tracking-wide">Current</span>
							{/if}
							{#if option.isDefault}
								<span class="text-[10px] font-bold uppercase tracking-wide">Default</span>
							{/if}
						</div>
						<p class="mt-0.5 text-xs">
							{#if option.clientId === selectedOrganizationId || option.isCurrent}
								Current organization. Role: {option.role}.
							{:else}
								Switch to {option.clientName}. Role: {option.role}.
							{/if}
						</p>
						{#if option.quickKey}
							<span
								class="pointer-events-none absolute right-2.5 top-1/2 inline-flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-sm border border-secondary-500 bg-neutral-200 px-1.5 text-[11px] font-mono font-bold text-neutral-950 shadow-[inset_0_-1px_0_rgba(0,0,0,0.14)] transition-transform duration-150 ease-out group-hover:-translate-y-[55%] group-focus-visible:-translate-y-[55%]"
							>
								{option.quickKey}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex justify-end">
			<button
				type="button"
				class="text-xs font-semibold text-secondary-800 underline decoration-secondary-400 underline-offset-2 transition-colors duration-150 hover:text-secondary-950 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
				disabled={submitting || leaveSubmitting}
				onclick={openManageOrganizations}
			>
				Manage Organizations
			</button>
		</div>
	</div>
</WizardModal>

<WizardModal
	open={open && manageOrganizationsOpen}
	title="Manage Organizations"
	step={1}
	stepCount={1}
	stepTitle="Organization Directory"
	progressPercent={100}
	closeAriaLabel="Close manage organizations modal"
	maxWidthClass="max-w-6xl"
	formClass="p-4 space-y-4"
	on:requestClose={closeManageOrganizations}
>
	<div class="space-y-4">
		<SearchInput
			id="manage-organizations-search"
			label="Search all organizations"
			value={manageOrganizationSearchTerm}
			disabled={submitting || leaveSubmitting}
			placeholder="Search all organizations"
			autocomplete="off"
			wrapperClass="relative w-full"
			inputClass="w-full input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed"
			clearAriaLabel="Clear organization management search"
			bind:inputElement={manageOrganizationSearchInput}
			data-wizard-autofocus
			on:input={(event) => {
				manageOrganizationSearchTerm = event.detail.value;
			}}
		/>

		{#if filteredManageOrganizations.length === 0}
			<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
				No organizations match your search.
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each filteredManageOrganizations as organization}
					<div
						role="button"
						tabindex={organization.clientId === selectedOrganizationId ? -1 : 0}
						class={`group relative border p-3 text-left focus-visible:outline-none focus-visible:border-primary-700 ${
							organization.clientId === selectedOrganizationId
								? 'border-primary-500 bg-primary-100 text-primary-900'
								: 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50 cursor-pointer'
						}`}
						aria-disabled={organization.clientId === selectedOrganizationId}
						onclick={() => {
							if (organization.clientId === selectedOrganizationId) return;
							void submitOrganizationSelection(organization.clientId);
						}}
						onkeydown={(event) => {
							if (organization.clientId === selectedOrganizationId) return;
							if (event.key !== 'Enter' && event.key !== ' ') return;
							event.preventDefault();
							void submitOrganizationSelection(organization.clientId);
						}}
					>
						<HoverTooltip
							text="Leave organization"
							maxWidthClass="max-w-60"
							wrapperClass="absolute right-2 top-2 z-10 inline-flex"
						>
							<button
								type="button"
								class="inline-flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-error-700 cursor-pointer hover:text-error-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-700 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label={`Leave ${organization.clientName}`}
								disabled={organizations.length <= 1 || submitting || leaveSubmitting}
								onclick={(event) => {
									event.stopPropagation();
									openLeaveConfirm(organization.clientId);
								}}
							>
								<IconLogout class="h-4 w-4" />
							</button>
						</HoverTooltip>

						<div class="space-y-1">
							<div class="flex items-center gap-2 pr-10">
								<p class="font-semibold">{organization.clientName}</p>
								{#if organization.clientId === selectedOrganizationId}
									<span class="text-[10px] font-bold uppercase tracking-wide">Current</span>
								{/if}
								{#if organization.isDefault}
									<span class="text-[10px] font-bold uppercase tracking-wide">Default</span>
								{/if}
							</div>
							<p class="text-xs">Role: {organization.role}</p>
							<p class="text-[11px] text-neutral-900">/{organization.clientSlug ?? 'organization'}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</WizardModal>

<ModalShell
	open={open && manageOrganizationsOpen && leaveConfirmOpen}
	closeAriaLabel="Close leave organization dialog"
	panelClass="w-full max-w-2xl max-h-[calc(100vh-3rem)] border-4 border-error-700 bg-error-25 overflow-hidden flex flex-col"
	on:requestClose={closeLeaveConfirm}
>
	<div class="p-4 border-b border-error-300 bg-error-50 flex items-start justify-between gap-3">
		<div class="space-y-1">
			<h3 class="text-2xl font-bold font-serif text-error-900">Leave Organization</h3>
		</div>
		<button
			type="button"
			class="p-1 text-error-700 hover:text-error-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-700"
			aria-label="Close leave organization dialog"
			onclick={closeLeaveConfirm}
		>
			<IconX class="w-5 h-5" />
		</button>
	</div>

	<div class="p-4 space-y-3 overflow-y-auto">
		<div class="border-2 border-error-300 bg-error-50 p-3 space-y-2">
			<p class="text-sm text-error-900 font-semibold">
				Leaving this organization removes your membership and access to the organization.
			</p>
			<p class="text-sm text-error-700 font-semibold">
				This action can only be undone by joining again or being re-added by an administrator.
			</p>
		</div>
		<div>
			<label for="switch-organization-leave-slug" class="block text-sm text-neutral-950 mb-1">
				Type
				<code class="font-mono text-xs bg-error-100 text-error-900 px-1 py-0.5 rounded">
					{normalizedExpectedLeaveSlug}
				</code>
				to confirm leaving.
			</label>
			<input
				id="switch-organization-leave-slug"
				type="text"
				class="input-secondary border-error-400 focus:border-error-600"
				bind:value={leaveConfirmSlug}
				disabled={leaveSubmitting}
			/>
		</div>
	</div>

	<div class="p-4 border-t border-neutral-950 flex justify-end gap-2">
		<button
			type="button"
			class="button-secondary-outlined cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
			disabled={leaveSubmitting}
			onclick={closeLeaveConfirm}
		>
			Cancel
		</button>
		<button
			type="button"
			class="button-error cursor-pointer inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={!canConfirmLeave}
			onclick={() => {
				void confirmLeaveOrganization();
			}}
		>
			<IconLogout class="w-4 h-4" />
			Leave Organization
		</button>
	</div>
</ModalShell>
