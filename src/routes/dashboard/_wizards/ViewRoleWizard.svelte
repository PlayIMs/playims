<script lang="ts">
	import { tick } from 'svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { WizardModal } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import {
		buildViewRoleSwitcherOptions,
		filterViewRoleSwitcherOptions,
		type ViewSwitcherRole
	} from '$lib/utils/view-role-switcher';

	type AuthRole = ViewSwitcherRole;

	interface Props {
		open: boolean;
		formError: string;
		submitting: boolean;
		effectiveRole: AuthRole;
		assignedRole: AuthRole;
		allowedRoles: AuthRole[];
		onRequestClose: () => void;
		onSelectRole: (role: AuthRole | null) => void;
	}

	let {
		open,
		formError,
		submitting,
		effectiveRole,
		assignedRole,
		allowedRoles,
		onRequestClose,
		onSelectRole
	}: Props = $props();

	let roleSearchTerm = $state('');
	let highlightedIndex = $state(0);
	let roleSearchInput = $state<HTMLInputElement | null>(null);
	let lastToastSignature = $state('');

	const roleOptions = $derived.by(() =>
		buildViewRoleSwitcherOptions(effectiveRole, allowedRoles, assignedRole)
	);
	const visibleRoleOptions = $derived.by(() =>
		filterViewRoleSwitcherOptions(roleOptions, roleSearchTerm)
	);

	function moveHighlight(direction: 1 | -1): void {
		if (visibleRoleOptions.length === 0) {
			return;
		}
		const nextIndex =
			(highlightedIndex + direction + visibleRoleOptions.length) % visibleRoleOptions.length;
		highlightedIndex = nextIndex;
		void tick().then(() => {
			const optionButton = document.querySelector<HTMLButtonElement>(
				`[data-view-role-option-index="${nextIndex}"]`
			);
			optionButton?.focus();
		});
	}

	function submitRoleSelection(role: AuthRole): void {
		if (submitting || role === effectiveRole) {
			return;
		}
		onSelectRole(role);
	}

	function submitHighlightedOption(): void {
		if (submitting || visibleRoleOptions.length === 0) {
			return;
		}
		const option = visibleRoleOptions[highlightedIndex];
		if (!option || option.role === effectiveRole) {
			return;
		}
		onSelectRole(option.role);
	}

	$effect(() => {
		const message = formError.trim();
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
			id: 'view-role-error',
			title: 'Role switch'
		});
	});

	$effect(() => {
		if (!open) {
			roleSearchTerm = '';
			highlightedIndex = 0;
			return;
		}

		highlightedIndex = 0;
		void tick().then(() => {
			roleSearchInput?.focus();
		});
	});

	$effect(() => {
		if (visibleRoleOptions.length === 0) {
			highlightedIndex = 0;
			return;
		}

		if (highlightedIndex >= visibleRoleOptions.length) {
			highlightedIndex = 0;
		}
	});

	$effect(() => {
		if (!open || typeof window === 'undefined') {
			return;
		}

		const handleWindowKeydown = (event: KeyboardEvent): void => {
			if (submitting) {
				return;
			}
			if (event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}

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
			if (event.key === 'Enter' && visibleRoleOptions.length > 0) {
				event.preventDefault();
				submitHighlightedOption();
				return;
			}

			const quickKey = event.key.toUpperCase();
			const matchingOption = visibleRoleOptions.find((option) => option.quickKey === quickKey);
			if (!matchingOption) {
				return;
			}

			event.preventDefault();
			submitRoleSelection(matchingOption.role);
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<WizardModal
	{open}
	title="View As Another Role"
	step={1}
	stepCount={1}
	stepTitle="Role Picker"
	progressPercent={100}
	closeAriaLabel="Close view role wizard"
	maxWidthClass="max-w-lg"
	formClass="p-4 space-y-4"
	on:requestClose={onRequestClose}
>
	<div class="space-y-4">
		<SearchInput
			id="switch-view-role-search"
			label="Search roles"
			value={roleSearchTerm}
			disabled={submitting}
			placeholder="Search roles"
			autocomplete="off"
			wrapperClass="relative w-full"
			inputClass="w-full input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed"
			clearAriaLabel="Clear role search"
			bind:inputElement={roleSearchInput}
			data-wizard-autofocus
			on:input={(event) => {
				roleSearchTerm = event.detail.value;
			}}
		/>

		{#if visibleRoleOptions.length === 0}
			<div class="border border-neutral-950 bg-white p-2.5">
				<p class="text-xs font-sans text-neutral-950">
					{roleSearchTerm.trim() ? 'No roles match your search.' : 'No roles available.'}
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-2">
				{#each visibleRoleOptions as option, optionIndex}
					<button
						type="button"
						data-view-role-option-index={optionIndex}
						tabindex={highlightedIndex === optionIndex ? 0 : -1}
						onfocus={() => {
							highlightedIndex = optionIndex;
						}}
						class={`group relative border p-2.5 pr-14 text-left cursor-pointer focus-visible:outline-none focus-visible:border-primary-700 disabled:cursor-wait disabled:opacity-70 ${
							highlightedIndex === optionIndex
								? 'border-primary-500 bg-primary-100 text-primary-900'
								: 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'
						}`}
						disabled={submitting}
						onclick={() => {
							submitRoleSelection(option.role);
						}}
					>
						<div class="flex items-center gap-2">
							<p class="font-semibold">{option.title}</p>
							{#if option.isCurrent}
								<span class="text-[10px] font-bold uppercase tracking-wide">Current</span>
							{/if}
						</div>
						<p class="mt-0.5 text-xs">{option.description}</p>
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
	</div>
</WizardModal>
