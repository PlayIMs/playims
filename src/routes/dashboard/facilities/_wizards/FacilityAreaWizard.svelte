<script lang="ts">
	import { IconRestore } from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { WizardModal, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import { applyLiveSlugInput, slugifyFinal } from '$lib/components/wizard/slug-utils';

	interface DropdownOption {
		value: string;
		label: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	interface FacilityAreaWizardForm {
		id: string;
		facilityId: string;
		name: string;
		slug: string;
		description: string;
		capacity: string;
	}

	interface Props {
		open: boolean;
		mode: 'create' | 'edit';
		form: FacilityAreaWizardForm;
		formError: string;
		fieldErrors: Record<string, string>;
		canSubmit: boolean;
		submitting: boolean;
		slugTouched: boolean;
		unsavedConfirmOpen: boolean;
		facilityOptions: DropdownOption[];
		selectedFacilityName: string;
		onSlugTouchedChange: (value: boolean) => void;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
	}

	let {
		open,
		mode,
		form,
		formError,
		fieldErrors,
		canSubmit,
		submitting,
		slugTouched,
		unsavedConfirmOpen,
		facilityOptions,
		selectedFacilityName,
		onSlugTouchedChange,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel
	}: Props = $props();

	const title = $derived.by(() => (mode === 'create' ? 'New Area' : 'Edit Area'));
	const submitLabel = $derived.by(() =>
		submitting ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create Area' : 'Save Area'
	);

	let lastToastSignature = $state('');

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${mode}:${message}`;
		if (signature === lastToastSignature) return;

		lastToastSignature = signature;
		toast.error(message, {
			id: 'facility-area-wizard-error',
			title: mode === 'create' ? 'Area creator' : 'Area editor'
		});
	});
</script>

<WizardModal
	{open}
	{title}
	step={1}
	stepCount={1}
	stepTitle="Area Details"
	progressPercent={100}
	closeAriaLabel={mode === 'create' ? 'Close create area wizard' : 'Close edit area wizard'}
	saveShortcutEnabled={mode === 'edit'}
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
	maxWidthClass="max-w-3xl"
>
	<div class="space-y-4">
		{#if mode === 'create'}
			<div>
				<p class="block text-sm font-sans text-neutral-950 mb-1">
					Facility <span class="text-error-700">*</span>
				</p>
				<ListboxDropdown
					options={facilityOptions}
					value={form.facilityId}
					ariaLabel="Choose a facility"
					buttonClass="button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2"
					listClass="w-[min(24rem,calc(100vw-3rem))]"
					on:change={(event) => {
						form.facilityId = event.detail.value;
					}}
				/>
				{#if fieldErrors.facilityId}
					<p class="mt-1 text-xs text-error-700">{fieldErrors.facilityId}</p>
				{/if}
			</div>
		{:else}
			<div class="border border-neutral-950 bg-white px-3 py-2">
				<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Facility</p>
				<p class="mt-1 text-sm text-neutral-950">{selectedFacilityName}</p>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<label for="facility-area-name" class="block text-sm font-sans text-neutral-950 mb-1"
					>Name <span class="text-error-700">*</span></label
				>
				<input
					id="facility-area-name"
					type="text"
					class="input-secondary"
					placeholder="Court 1"
					value={form.name}
					data-wizard-autofocus
					oninput={(event) => {
						const value = (event.currentTarget as HTMLInputElement).value;
						form.name = value;
						if (!slugTouched) {
							form.slug = slugifyFinal(value);
						}
					}}
					autocomplete="off"
				/>
				{#if fieldErrors.name}
					<p class="mt-1 text-xs text-error-700">{fieldErrors.name}</p>
				{/if}
			</div>

			<div>
				<label for="facility-area-slug" class="block text-sm font-sans text-neutral-950 mb-1"
					>Slug <span class="text-error-700">*</span></label
				>
				<div class="relative">
					<input
						id="facility-area-slug"
						type="text"
						class="input-secondary pr-10"
						placeholder="court-1"
						value={form.slug}
						oninput={(event) => {
							onSlugTouchedChange(true);
							form.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
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
							aria-label="Revert area slug to default"
							onclick={() => {
								onSlugTouchedChange(false);
								form.slug = slugifyFinal(form.name);
							}}
						>
							<IconRestore class="h-4 w-4" />
						</button>
					</HoverTooltip>
				</div>
				<p class="mt-1 text-xs font-sans text-neutral-950">Auto-formats to lowercase with dashes.</p>
				{#if fieldErrors.slug}
					<p class="mt-1 text-xs text-error-700">{fieldErrors.slug}</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div>
				<label for="facility-area-capacity" class="block text-sm font-sans text-neutral-950 mb-1"
					>Capacity</label
				>
				<input
					id="facility-area-capacity"
					type="number"
					min="1"
					step="1"
					class="input-secondary"
					bind:value={form.capacity}
					autocomplete="off"
				/>
				{#if fieldErrors.capacity}
					<p class="mt-1 text-xs text-error-700">{fieldErrors.capacity}</p>
				{/if}
			</div>
		</div>

		<div>
			<label for="facility-area-description" class="block text-sm font-sans text-neutral-950 mb-1"
				>Description (optional)</label
			>
			<textarea
				id="facility-area-description"
				class="textarea-secondary min-h-24"
				bind:value={form.description}
				placeholder="Add setup notes, markings, or scheduling details."
			></textarea>
		</div>
	</div>

	{#snippet footer()}
		<div class="pt-2 border-t border-neutral-950 flex justify-end">
			<div class="flex items-center gap-2 justify-end">
				<button type="button" class="button-secondary-outlined cursor-pointer" onclick={onRequestClose}>
					Cancel
				</button>
				<button
					type="submit"
					class="button-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!canSubmit || submitting}
				>
					{submitLabel}
				</button>
			</div>
		</div>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title={mode === 'create' ? 'Discard New Area?' : 'Discard Area Changes?'}
	message={mode === 'create'
		? 'You have unsaved changes for this new area. Close without saving?'
		: 'You have unsaved changes for this area. Close without saving?'}
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
