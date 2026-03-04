<script lang="ts">
	import { tick } from 'svelte';
	import { WizardModal } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';

	interface OrganizationOption {
		clientId: string;
		clientName: string;
		clientSlug: string | null;
		role: string;
		isCurrent: boolean;
		isDefault: boolean;
	}

	interface Props {
		open: boolean;
		formError: string;
		submitting: boolean;
		organizations: OrganizationOption[];
		selectedOrganizationId: string;
		onRequestClose: () => void;
		onSelectOrganization: (clientId: string) => void;
	}

	let {
		open,
		formError,
		submitting,
		organizations,
		selectedOrganizationId,
		onRequestClose,
		onSelectOrganization
	}: Props = $props();

	const organizationOptions = $derived.by(() =>
		organizations
			.filter((organization) => organization.clientId !== selectedOrganizationId)
			.map((organization, index) => ({
				...organization,
				quickKey: index < 9 ? String(index + 1) : null
			}))
	);
	const currentOrganization = $derived.by(
		() =>
			organizations.find((organization) => organization.clientId === selectedOrganizationId) ?? null
	);
	let highlightedIndex = $state(0);
	let lastToastSignature = $state('');

	function moveHighlight(direction: 1 | -1): void {
		if (organizationOptions.length === 0) {
			return;
		}
		const nextIndex =
			(highlightedIndex + direction + organizationOptions.length) % organizationOptions.length;
		highlightedIndex = nextIndex;
		void tick().then(() => {
			const optionButton = document.querySelector<HTMLButtonElement>(
				`[data-organization-option-index="${nextIndex}"]`
			);
			optionButton?.focus();
		});
	}

	function submitHighlightedOption(): void {
		if (submitting || organizationOptions.length === 0) {
			return;
		}
		const option = organizationOptions[highlightedIndex];
		if (!option || option.clientId === selectedOrganizationId) {
			return;
		}
		onSelectOrganization(option.clientId);
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
			id: 'switch-organization-error',
			title: 'Organization switch'
		});
	});

	$effect(() => {
		if (!open) {
			highlightedIndex = 0;
			return;
		}

		if (organizationOptions.length === 0) {
			highlightedIndex = 0;
			return;
		}

		highlightedIndex = 0;

		void tick().then(() => {
			const optionButton = document.querySelector<HTMLButtonElement>(
				`[data-organization-option-index="${highlightedIndex}"]`
			);
			optionButton?.focus();
		});
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
			if (event.key === 'Enter') {
				event.preventDefault();
				submitHighlightedOption();
				return;
			}

			if (!/^[1-9]$/.test(event.key)) {
				return;
			}

			const matchingOption = organizationOptions.find((option) => option.quickKey === event.key);
			if (!matchingOption) {
				return;
			}

			event.preventDefault();
			onSelectOrganization(matchingOption.clientId);
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<WizardModal
	{open}
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
		<div class="border border-secondary-300 bg-white p-2.5">
			<p class="text-xs font-sans text-neutral-950">
				Current organization:
				<span class="font-semibold">{currentOrganization?.clientName ?? 'None selected'}</span>
			</p>
			<p class="mt-1 text-[11px] font-sans text-neutral-900">
				Use Up/Down arrows, Shift, Enter, or number keys.
			</p>
		</div>

		{#if organizationOptions.length === 0}
			<div class="border border-secondary-300 bg-white p-2.5">
				<p class="text-xs font-sans text-neutral-950">No other organizations available.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-2">
			{#each organizationOptions as option, optionIndex}
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
					disabled={submitting}
					onclick={() => onSelectOrganization(option.clientId)}
				>
					<div class="flex items-center gap-2">
						<p class="font-semibold">{option.clientName}</p>
						{#if option.isDefault}
							<span class="text-[10px] font-bold uppercase tracking-wide">Default</span>
						{/if}
					</div>
					<p class="mt-0.5 text-xs">
						Switch to {option.clientName} organization. Role: {option.role}.
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
	</div>
</WizardModal>
