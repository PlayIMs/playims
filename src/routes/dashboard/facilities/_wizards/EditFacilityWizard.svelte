<script lang="ts">
	import { IconRestore } from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { WizardModal, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import { applyLiveSlugInput, slugifyFinal } from '$lib/components/wizard/slug-utils';

	interface EditFacilityForm {
		id: string;
		name: string;
		slug: string;
		description: string;
		addressLine1: string;
		addressLine2: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		timezone: string;
		capacity: string;
	}

	interface Props {
		open: boolean;
		form: EditFacilityForm;
		formError: string;
		fieldErrors: Record<string, string>;
		canSubmit: boolean;
		submitting: boolean;
		slugTouched: boolean;
		unsavedConfirmOpen: boolean;
		onSlugTouchedChange: (value: boolean) => void;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
	}

	let {
		open,
		form,
		formError,
		fieldErrors,
		canSubmit,
		submitting,
		slugTouched,
		unsavedConfirmOpen,
		onSlugTouchedChange,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel
	}: Props = $props();

	let lastToastSignature = $state('');

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${message}`;
		if (signature === lastToastSignature) return;

		lastToastSignature = signature;
		toast.error(message, {
			id: 'edit-facility-error',
			title: 'Facility editor'
		});
	});
</script>

<WizardModal
	{open}
	title="Edit Facility"
	step={1}
	stepCount={1}
	stepTitle="Facility Details"
	progressPercent={100}
	closeAriaLabel="Close edit facility wizard"
	saveShortcutEnabled
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	<div class="space-y-4">
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<label for="edit-facility-name" class="block text-sm font-sans text-neutral-950 mb-1"
					>Name <span class="text-error-700">*</span></label
				>
				<input
					id="edit-facility-name"
					type="text"
					class="input-secondary"
					placeholder="Turner Center"
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
				<label for="edit-facility-slug" class="block text-sm font-sans text-neutral-950 mb-1"
					>Slug <span class="text-error-700">*</span></label
				>
				<div class="relative">
					<input
						id="edit-facility-slug"
						type="text"
						class="input-secondary pr-10"
						placeholder="turner-center"
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
							aria-label="Revert facility slug to default"
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
				<label for="edit-facility-capacity" class="block text-sm font-sans text-neutral-950 mb-1"
					>Capacity</label
				>
				<input
					id="edit-facility-capacity"
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

			<div class="lg:col-span-2">
				<label for="edit-facility-timezone" class="block text-sm font-sans text-neutral-950 mb-1"
					>Timezone</label
				>
				<input
					id="edit-facility-timezone"
					type="text"
					list="timezone-options"
					class="input-secondary"
					bind:value={form.timezone}
					autocomplete="off"
				/>
			</div>
		</div>

		<div>
			<label for="edit-facility-description" class="block text-sm font-sans text-neutral-950 mb-1"
				>Description (optional)</label
			>
			<textarea
				id="edit-facility-description"
				class="textarea-secondary min-h-24"
				bind:value={form.description}
				placeholder="Add notes for staff and schedulers."
			></textarea>
		</div>

		<div class="space-y-3">
			<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">Address</h3>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<label
						for="edit-facility-address-line1"
						class="block text-sm font-sans text-neutral-950 mb-1">Address line 1</label
					>
					<input
						id="edit-facility-address-line1"
						type="text"
						class="input-secondary"
						bind:value={form.addressLine1}
						autocomplete="off"
					/>
				</div>
				<div>
					<label
						for="edit-facility-address-line2"
						class="block text-sm font-sans text-neutral-950 mb-1">Address line 2</label
					>
					<input
						id="edit-facility-address-line2"
						type="text"
						class="input-secondary"
						bind:value={form.addressLine2}
						autocomplete="off"
					/>
				</div>
			</div>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
				<div class="lg:col-span-2">
					<label for="edit-facility-city" class="block text-sm font-sans text-neutral-950 mb-1"
						>City</label
					>
					<input
						id="edit-facility-city"
						type="text"
						class="input-secondary"
						bind:value={form.city}
						autocomplete="off"
					/>
				</div>
				<div>
					<label for="edit-facility-state" class="block text-sm font-sans text-neutral-950 mb-1"
						>State</label
					>
					<input
						id="edit-facility-state"
						type="text"
						class="input-secondary"
						bind:value={form.state}
						autocomplete="off"
					/>
				</div>
				<div>
					<label
						for="edit-facility-postal-code"
						class="block text-sm font-sans text-neutral-950 mb-1">ZIP / Postal Code</label
					>
					<input
						id="edit-facility-postal-code"
						type="text"
						class="input-secondary"
						bind:value={form.postalCode}
						autocomplete="off"
					/>
				</div>
			</div>
			<div>
				<label for="edit-facility-country" class="block text-sm font-sans text-neutral-950 mb-1"
					>Country</label
				>
				<input
					id="edit-facility-country"
					type="text"
					class="input-secondary"
					bind:value={form.country}
					autocomplete="off"
				/>
			</div>
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
					{submitting ? 'Saving...' : 'Save Facility'}
				</button>
			</div>
		</div>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Facility Changes?"
	message="You have unsaved changes for this facility. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
