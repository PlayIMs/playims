<script lang="ts">
	import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle';
	import IconPencil from '@tabler/icons-svelte/icons/pencil';
	import IconRestore from '@tabler/icons-svelte/icons/restore';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import {
		WizardDraftCollection,
		WizardModal,
		WizardStepFooter,
		WizardUnsavedConfirm
	} from '$lib/components/wizard';
	import { applyLiveSlugInput, slugifyFinal } from '$lib/components/wizard/slug-utils';

	type FacilityCreateStep = 1 | 2 | 3 | 4 | 5;

	interface FacilityAreaDraft {
		draftId: string;
		name: string;
		slug: string;
		description: string;
		isSlugManual: boolean;
		isActive: boolean;
		capacity: number;
	}

	interface FacilityWizardForm {
		facility: {
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
			isActive: boolean;
			capacity: number;
		};
		areaDraft: FacilityAreaDraft;
		areas: FacilityAreaDraft[];
	}

	interface ConflictMeta {
		duplicateType?: 'archived';
		archivedFacilityId?: string;
		archivedAreaId?: string;
		archivedAreaFacilityId?: string;
	}

	interface Props {
		open: boolean;
		step: FacilityCreateStep;
		formError: string;
		fieldErrors: Record<string, string>;
		conflictMeta: ConflictMeta;
		form: FacilityWizardForm;
		facilitySlugTouched: boolean;
		wizardAreaSlugTouched: boolean;
		areaDraftActive: boolean;
		areaEditingIndex: number | null;
		stepProgress: number;
		canGoNext: boolean;
		canSubmit: boolean;
		submitting: boolean;
		unsavedConfirmOpen: boolean;
		stepTitle: (step: FacilityCreateStep) => string;
		onFacilitySlugTouchedChange: (value: boolean) => void;
		onWizardAreaSlugTouchedChange: (value: boolean) => void;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onNext: () => void;
		onBack: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
		onStartAreaDraft: () => void;
		onStartEditArea: (index: number) => void;
		onDuplicateArea: (index: number) => void;
		onRemoveArea: (index: number) => void;
		onMoveArea: (index: number, direction: -1 | 1) => void;
		onStartEditFacility: () => void;
		onStartEditAreas: () => void;
		onSubmitAction: (action: string, formDataObj: Record<string, string>) => void;
		onOpenArchivedFacilityDelete: (facilityId: string) => void;
		onOpenArchivedAreaDelete: (areaId: string) => void;
	}

	let {
		open,
		step,
		formError,
		fieldErrors,
		conflictMeta,
		form,
		facilitySlugTouched,
		wizardAreaSlugTouched,
		areaDraftActive,
		areaEditingIndex,
		stepProgress,
		canGoNext,
		canSubmit,
		submitting,
		unsavedConfirmOpen,
		stepTitle,
		onFacilitySlugTouchedChange,
		onWizardAreaSlugTouchedChange,
		onRequestClose,
		onSubmit,
		onInput,
		onNext,
		onBack,
		onUnsavedConfirm,
		onUnsavedCancel,
		onStartAreaDraft,
		onStartEditArea,
		onDuplicateArea,
		onRemoveArea,
		onMoveArea,
		onStartEditFacility,
		onStartEditAreas,
		onSubmitAction,
		onOpenArchivedFacilityDelete,
		onOpenArchivedAreaDelete
	}: Props = $props();

	function autofocus(node: HTMLElement) {
		if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) node.focus();
		return {};
	}

	const nextLabel = $derived.by(() => {
		if (step === 3 && !areaDraftActive) {
			return form.areas.length === 0 ? 'Skip to Review' : 'Review';
		}
		if (step === 4 && areaDraftActive) {
			return areaEditingIndex === null ? 'Add Area' : 'Update Area';
		}
		return 'Next';
	});

	const draftNoticeText = $derived.by(
		() =>
			`Area draft is open. Continue to Step 4 to ${areaEditingIndex === null ? 'add this area' : 'update this area'}.`
	);
</script>

<WizardModal
	{open}
	title="New Facility"
	{step}
	stepCount={5}
	stepTitle={stepTitle(step)}
	progressPercent={stepProgress}
	closeAriaLabel="Close create facility wizard"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	{#snippet error()}
		{#if formError}
			<div class="border-2 border-error-300 bg-error-50 p-3 flex items-start gap-3">
				<IconAlertCircle class="w-5 h-5 text-error-700 mt-0.5" />
				<div class="flex-1">
					<p class="text-error-700 font-sans">{formError}</p>
					{#if conflictMeta.duplicateType === 'archived' && conflictMeta.archivedFacilityId}
						<div class="flex items-center gap-2 mt-2">
							<button
								type="button"
								class="button-secondary text-sm flex items-center gap-1"
								onclick={() =>
									onSubmitAction('setFacilityArchived', {
										facilityId: String(conflictMeta.archivedFacilityId),
										isActive: '1'
									})}
							>
								<IconRestore class="w-4 h-4" />
								Restore Facility
							</button>
							<button
								type="button"
								class="button-secondary-outlined text-sm flex items-center gap-1 border-error-700 text-error-700"
								onclick={() => {
									if (conflictMeta.archivedFacilityId) {
										onOpenArchivedFacilityDelete(String(conflictMeta.archivedFacilityId));
									}
								}}
							>
								<IconTrash class="w-4 h-4 text-error-700" />
								Delete Facility
							</button>
						</div>
					{/if}
					{#if conflictMeta.duplicateType === 'archived' && conflictMeta.archivedAreaId}
						<div class="flex items-center gap-2 mt-2">
							<button
								type="button"
								class="button-secondary text-sm flex items-center gap-1"
								onclick={() =>
									onSubmitAction('setFacilityAreaArchived', {
										facilityAreaId: String(conflictMeta.archivedAreaId),
										isActive: '1'
									})}
							>
								<IconRestore class="w-4 h-4" />
								Restore Area
							</button>
							<button
								type="button"
								class="button-secondary-outlined text-sm flex items-center gap-1 border-error-700 text-error-700"
								onclick={() => {
									if (conflictMeta.archivedAreaId) {
										onOpenArchivedAreaDelete(String(conflictMeta.archivedAreaId));
									}
								}}
							>
								<IconTrash class="w-4 h-4 text-error-700" />
								Delete Area
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/snippet}

	{#if step === 1}
		<div class="space-y-4">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div>
					<label for="wizard-facility-name" class="block text-sm font-sans text-neutral-950 mb-1"
						>Name <span class="text-error-700">*</span></label
					>
					<input
						id="wizard-facility-name"
						type="text"
						use:autofocus
						class="input-secondary"
						placeholder="Intramural Fields"
						value={form.facility.name}
						oninput={(event) => {
							const value = (event.currentTarget as HTMLInputElement).value;
							form.facility.name = value;
							if (!facilitySlugTouched) {
								form.facility.slug = slugifyFinal(value);
							}
						}}
						autocomplete="off"
					/>
					{#if fieldErrors['facility.name']}
						<p class="text-xs text-error-700 mt-1">{fieldErrors['facility.name']}</p>
					{/if}
				</div>
				<div>
					<label for="wizard-facility-slug" class="block text-sm font-sans text-neutral-950 mb-1"
						>Slug <span class="text-error-700">*</span></label
					>
					<div class="relative">
						<input
							id="wizard-facility-slug"
							type="text"
							class="input-secondary pr-10"
							placeholder="intramural-fields"
							value={form.facility.slug}
							oninput={(event) => {
								onFacilitySlugTouchedChange(true);
								form.facility.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
							}}
							autocomplete="off"
						/>
						<HoverTooltip
							text="Revert to default"
							wrapperClass="absolute right-2 top-1/2 -translate-y-1/2 inline-flex shrink-0 z-10"
						>
							<button
								type="button"
								tabindex="-1"
								class="inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none"
								aria-label="Revert facility slug to default"
								onclick={() => {
									onFacilitySlugTouchedChange(false);
									form.facility.slug = slugifyFinal(form.facility.name);
								}}
							>
								<IconRestore class="h-4 w-4" />
							</button>
						</HoverTooltip>
					</div>
					<p class="text-xs font-sans text-neutral-950 mt-1">Auto-formats to lowercase with dashes.</p>
					{#if fieldErrors['facility.slug']}
						<p class="text-xs text-error-700 mt-1">{fieldErrors['facility.slug']}</p>
					{/if}
				</div>
			</div>
			<div>
				<label for="wizard-facility-description" class="block text-sm font-sans text-neutral-950 mb-1"
					>Description (optional)</label
				>
				<textarea
					id="wizard-facility-description"
					class="textarea-secondary min-h-28"
					bind:value={form.facility.description}
					placeholder="Add notes about this facility for staff and coordinators."
				></textarea>
			</div>
		</div>
	{/if}

	{#if step === 2}
		<div class="space-y-4">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div>
					<label for="wizard-facility-address-line1" class="block text-sm font-sans text-neutral-950 mb-1"
						>Address line 1</label
					>
					<input
						id="wizard-facility-address-line1"
						type="text"
						class="input-secondary"
						bind:value={form.facility.addressLine1}
						autocomplete="off"
					/>
				</div>
				<div>
					<label for="wizard-facility-address-line2" class="block text-sm font-sans text-neutral-950 mb-1"
						>Address line 2</label
					>
					<input
						id="wizard-facility-address-line2"
						type="text"
						class="input-secondary"
						bind:value={form.facility.addressLine2}
						autocomplete="off"
					/>
				</div>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
				<div class="lg:col-span-2">
					<label for="wizard-facility-city" class="block text-sm font-sans text-neutral-950 mb-1"
						>City</label
					>
					<input
						id="wizard-facility-city"
						type="text"
						class="input-secondary"
						bind:value={form.facility.city}
						autocomplete="off"
					/>
				</div>
				<div>
					<label for="wizard-facility-state" class="block text-sm font-sans text-neutral-950 mb-1">State</label>
					<input
						id="wizard-facility-state"
						type="text"
						class="input-secondary"
						bind:value={form.facility.state}
						autocomplete="off"
					/>
				</div>
				<div>
					<label for="wizard-facility-postal-code" class="block text-sm font-sans text-neutral-950 mb-1"
						>Postal code</label
					>
					<input
						id="wizard-facility-postal-code"
						type="text"
						class="input-secondary"
						bind:value={form.facility.postalCode}
						autocomplete="off"
					/>
				</div>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div>
					<label for="wizard-facility-country" class="block text-sm font-sans text-neutral-950 mb-1"
						>Country</label
					>
					<input
						id="wizard-facility-country"
						type="text"
						class="input-secondary"
						bind:value={form.facility.country}
						autocomplete="off"
					/>
				</div>
				<div>
					<label for="wizard-facility-timezone" class="block text-sm font-sans text-neutral-950 mb-1"
						>Timezone</label
					>
					<input
						id="wizard-facility-timezone"
						type="text"
						class="input-secondary"
						list="timezone-options"
						placeholder="America/New_York"
						bind:value={form.facility.timezone}
						autocomplete="off"
					/>
				</div>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div>
					<label for="wizard-facility-capacity" class="block text-sm font-sans text-neutral-950 mb-1"
						>Capacity</label
					>
					<input
						id="wizard-facility-capacity"
						type="number"
						class="input-secondary"
						min="1"
						step="1"
						value={form.facility.capacity > 0 ? String(form.facility.capacity) : ''}
						oninput={(event) => {
							const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
							form.facility.capacity = Number.isNaN(parsed) ? 0 : parsed;
						}}
						autocomplete="off"
					/>
					{#if fieldErrors['facility.capacity']}
						<p class="text-xs text-error-700 mt-1">{fieldErrors['facility.capacity']}</p>
					{/if}
				</div>
				<div class="border border-secondary-300 bg-white p-3 flex items-center">
					<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
						<input type="checkbox" class="toggle-secondary" bind:checked={form.facility.isActive} />
						Active
					</label>
				</div>
			</div>
		</div>
	{/if}

	{#if step === 3}
		<div class="space-y-4">
			<WizardDraftCollection
				title="Facility Areas"
				itemSingular="area"
				itemPlural="areas"
				items={form.areas}
				draftActive={areaDraftActive}
				emptyMessage="No areas added yet. Use the plus button to add one, or continue without areas."
				onAdd={onStartAreaDraft}
				onEdit={onStartEditArea}
				onCopy={onDuplicateArea}
				onMoveUp={(index) => onMoveArea(index, -1)}
				onMoveDown={(index) => onMoveArea(index, 1)}
				onRemove={onRemoveArea}
				getItemName={(item) => (item as FacilityAreaDraft).name}
				getItemSlug={(item) => (item as FacilityAreaDraft).slug}
				showDraftNotice={areaDraftActive}
				draftNoticeText={draftNoticeText}
			>
				{#snippet itemBody(item)}
					{@const area = item as FacilityAreaDraft}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950">
						<p>
							<span class="font-semibold">Capacity:</span>
							{area.capacity > 0 ? area.capacity : 'N/A'}
						</p>
						<p>
							<span class="font-semibold">Status:</span>
							{area.isActive ? 'Active' : 'Inactive'}
						</p>
					</div>
					{#if area.description.trim()}
						<p class="text-xs text-neutral-950">
							<span class="font-semibold">Description:</span>
							{area.description.trim()}
						</p>
					{/if}
				{/snippet}
			</WizardDraftCollection>
		</div>
	{/if}

	{#if step === 4}
		<div class="space-y-4">
			{#if !areaDraftActive}
				<div class="border border-secondary-300 bg-white p-4">
					<p class="text-sm font-sans text-neutral-950">
						No area draft is open. Go back to Facility Areas and click the plus button to add one.
					</p>
				</div>
			{:else}
				<div class="border border-secondary-300 bg-white p-3 space-y-4">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div>
							<label for="wizard-area-name" class="block text-sm font-sans text-neutral-950 mb-1"
								>Name <span class="text-error-700">*</span></label
							>
							<input
								id="wizard-area-name"
								type="text"
								use:autofocus
								class="input-secondary"
								value={form.areaDraft.name}
								placeholder="Field 1"
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									form.areaDraft.name = value;
									if (!wizardAreaSlugTouched) {
										form.areaDraft.slug = slugifyFinal(value);
										form.areaDraft.isSlugManual = false;
									}
								}}
								autocomplete="off"
							/>
							{#if fieldErrors['areaDraft.name']}
								<p class="text-xs text-error-700 mt-1">{fieldErrors['areaDraft.name']}</p>
							{/if}
						</div>
						<div>
							<label for="wizard-area-slug" class="block text-sm font-sans text-neutral-950 mb-1"
								>Slug <span class="text-error-700">*</span></label
							>
							<div class="relative">
								<input
									id="wizard-area-slug"
									type="text"
									class="input-secondary pr-10"
									value={form.areaDraft.slug}
									placeholder="field-1"
									oninput={(event) => {
										onWizardAreaSlugTouchedChange(true);
										form.areaDraft.isSlugManual = true;
										form.areaDraft.slug = applyLiveSlugInput(event.currentTarget as HTMLInputElement);
									}}
									autocomplete="off"
								/>
								<HoverTooltip
									text="Revert to default"
									wrapperClass="absolute right-2 top-1/2 -translate-y-1/2 inline-flex shrink-0 z-10"
								>
									<button
										type="button"
										tabindex="-1"
										class="inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none"
										aria-label="Revert area slug to default"
										onclick={() => {
											onWizardAreaSlugTouchedChange(false);
											form.areaDraft.isSlugManual = false;
											form.areaDraft.slug = slugifyFinal(form.areaDraft.name);
										}}
									>
										<IconRestore class="h-4 w-4" />
									</button>
								</HoverTooltip>
							</div>
							{#if fieldErrors['areaDraft.slug']}
								<p class="text-xs text-error-700 mt-1">{fieldErrors['areaDraft.slug']}</p>
							{/if}
						</div>
						<div class="lg:col-span-2">
							<label for="wizard-area-description" class="block text-sm font-sans text-neutral-950 mb-1"
								>Description</label
							>
							<textarea
								id="wizard-area-description"
								class="textarea-secondary min-h-28"
								bind:value={form.areaDraft.description}
								placeholder="Optional notes about this area."
							></textarea>
						</div>
					</div>

					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div class="border border-secondary-300 bg-white p-3">
							<label class="inline-flex items-center gap-2 text-sm font-sans text-neutral-950">
								<input type="checkbox" class="toggle-secondary" bind:checked={form.areaDraft.isActive} />
								Active
							</label>
						</div>
						<div>
							<label for="wizard-area-capacity" class="block text-sm font-sans text-neutral-950 mb-1"
								>Capacity</label
							>
							<input
								id="wizard-area-capacity"
								type="number"
								class="input-secondary"
								min="1"
								step="1"
								value={form.areaDraft.capacity > 0 ? String(form.areaDraft.capacity) : ''}
								oninput={(event) => {
									const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
									form.areaDraft.capacity = Number.isNaN(parsed) ? 0 : parsed;
								}}
								autocomplete="off"
							/>
							{#if fieldErrors['areaDraft.capacity']}
								<p class="text-xs text-error-700 mt-1">{fieldErrors['areaDraft.capacity']}</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if step === 5}
		<div class="space-y-4">
			<div class="border-2 border-secondary-300 bg-white p-4 space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Facility</h3>
					<HoverTooltip text="Edit facility">
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label="Edit facility"
							onclick={onStartEditFacility}
						>
							<IconPencil class="w-4 h-4" />
						</button>
					</HoverTooltip>
				</div>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Name:</span>
					{form.facility.name || 'TBD'}
					<span class="ml-3 font-semibold">Slug:</span>
					{slugifyFinal(form.facility.slug) || 'TBD'}
				</p>
				<p class="text-sm text-neutral-950">
					<span class="font-semibold">Status:</span>
					{form.facility.isActive ? 'Active' : 'Inactive'}
					<span class="ml-3 font-semibold">Capacity:</span>
					{form.facility.capacity > 0 ? form.facility.capacity : 'N/A'}
				</p>
				{#if form.facility.description.trim()}
					<p class="text-sm text-neutral-950">
						<span class="font-semibold">Description:</span>
						{form.facility.description.trim()}
					</p>
				{/if}
				{#if form.facility.addressLine1 || form.facility.city || form.facility.state || form.facility.postalCode || form.facility.country}
					<p class="text-sm text-neutral-950">
						<span class="font-semibold">Address:</span>
						{[
							form.facility.addressLine1,
							form.facility.addressLine2,
							form.facility.city,
							form.facility.state,
							form.facility.postalCode,
							form.facility.country
						]
							.filter((part) => part.trim().length > 0)
							.join(', ')}
					</p>
				{/if}
				{#if form.facility.timezone.trim()}
					<p class="text-sm text-neutral-950">
						<span class="font-semibold">Timezone:</span>
						{form.facility.timezone.trim()}
					</p>
				{/if}
			</div>

			<div class="border-2 border-secondary-300 bg-white p-4 space-y-3">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Facility Areas</h3>
					<HoverTooltip text="Edit areas">
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label="Edit areas"
							onclick={onStartEditAreas}
						>
							<IconPencil class="w-4 h-4" />
						</button>
					</HoverTooltip>
				</div>
				{#if form.areas.length === 0}
					<p class="text-sm text-neutral-950 font-sans">No areas will be created.</p>
				{:else}
					<div class="space-y-3 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400 scrollbar-corner-secondary-500 hover:scrollbar-thumb-secondary-700 active:scrollbar-thumb-secondary-700 scrollbar-hover:scrollbar-thumb-secondary-800 scrollbar-active:scrollbar-thumb-secondary-700">
						{#each form.areas as area (area.draftId)}
							<div class="border border-secondary-300 bg-neutral p-3 space-y-1">
								<p class="text-sm font-semibold text-neutral-950">{area.name || 'Untitled Area'}</p>
								<p class="text-xs text-neutral-900">Slug: {slugifyFinal(area.slug) || 'TBD'}</p>
								<p class="text-xs text-neutral-950">
									<span class="font-semibold">Status:</span>
									{area.isActive ? 'Active' : 'Inactive'}
									<span class="ml-2 font-semibold">Capacity:</span>
									{area.capacity > 0 ? area.capacity : 'N/A'}
								</p>
								{#if area.description.trim()}
									<p class="text-xs text-neutral-950">
										<span class="font-semibold">Description:</span>
										{area.description.trim()}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<WizardStepFooter
			{step}
			lastStep={5}
			showBack={step > 1}
			{canGoNext}
			{canSubmit}
			nextLabel={nextLabel}
			submitLabel="Create Facility"
			submittingLabel="Creating..."
			isSubmitting={submitting}
			on:back={onBack}
			on:next={onNext}
		/>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Wizard Changes?"
	message="You have unsaved changes in this wizard. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
