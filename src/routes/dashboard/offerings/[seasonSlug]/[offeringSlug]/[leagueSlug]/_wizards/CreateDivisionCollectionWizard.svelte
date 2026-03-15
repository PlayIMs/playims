<script lang="ts">
	import DayOfWeekButtonGroup from '$lib/components/DayOfWeekButtonGroup.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ToggleField from '$lib/components/ToggleField.svelte';
	import {
		formatDivisionDays,
		parseDivisionDays
	} from '$lib/utils/division-schedule-inference.js';
	import {
		WizardDraftCollection,
		WizardModal,
		WizardStepFooter,
		WizardUnsavedConfirm,
		applyLiveSlugInput,
		slugifyFinal
	} from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import { IconPencil, IconRestore } from '@tabler/icons-svelte';

	interface DivisionWizardForm {
		name: string;
		slug: string;
		maxTeams: string;
		description: string;
		dayOfWeek: string;
		gameTime: string;
		location: string;
		startDate: string;
		isLocked: boolean;
	}

	interface DivisionWizardDraft extends DivisionWizardForm {
		draftId: string;
	}

	interface ContextRow {
		label: string;
		value: string;
	}

	type CreateDivisionWizardStep = 1 | 2 | 3;

	interface Props {
		open: boolean;
		step: CreateDivisionWizardStep;
		form: DivisionWizardForm;
		drafts: DivisionWizardDraft[];
		fieldErrors: Record<string, string>;
		collectionError?: string;
		formError: string;
		submitting: boolean;
		canGoNext: boolean;
		canSubmit: boolean;
		draftActive: boolean;
		editingIndex: number | null;
		slugTouched: boolean;
		unsavedConfirmOpen: boolean;
		contextRows: ContextRow[];
		showLocation?: boolean;
		showStartDate?: boolean;
		onSlugTouchedChange: (value: boolean) => void;
		onNameInput?: (value: string) => void;
		onDayOfWeekInput?: (value: string) => void;
		onGameTimeInput?: (value: string) => void;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onNext: () => void;
		onBack: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
		onAddDraft: () => void;
		onEditDraft: (index: number) => void;
		onCopyDraft: (index: number) => void;
		onMoveDraftUp: (index: number) => void;
		onMoveDraftDown: (index: number) => void;
		onRemoveDraft: (index: number) => void;
		onEditDraftsStep: () => void;
		title?: string;
		closeAriaLabel?: string;
		submitLabel?: string;
		submittingLabel?: string;
		errorToastTitle?: string;
	}

	let {
		open,
		step,
		form,
		drafts,
		fieldErrors,
		collectionError = '',
		formError,
		submitting,
		canGoNext,
		canSubmit,
		draftActive,
		editingIndex,
		slugTouched,
		unsavedConfirmOpen,
		contextRows,
		showLocation = true,
		showStartDate = true,
		onSlugTouchedChange,
		onNameInput,
		onDayOfWeekInput,
		onGameTimeInput,
		onRequestClose,
		onSubmit,
		onInput,
		onNext,
		onBack,
		onUnsavedConfirm,
		onUnsavedCancel,
		onAddDraft,
		onEditDraft,
		onCopyDraft,
		onMoveDraftUp,
		onMoveDraftDown,
		onRemoveDraft,
		onEditDraftsStep,
		title = 'New Division',
		closeAriaLabel = 'Close create division wizard',
		submitLabel = 'Create Divisions',
		submittingLabel = 'Creating...',
		errorToastTitle = 'Create division'
	}: Props = $props();

	let lastToastSignature = $state('');
	const resolvedSelectedDayValues = $derived.by(() => parseDivisionDays(form.dayOfWeek));
	const selectedDaysSummary = $derived.by(() => formatDivisionDays(resolvedSelectedDayValues));
	const stepTitle = $derived.by(() => {
		if (step === 1) return 'League Context';
		if (step === 2) return draftActive ? 'Division Details' : 'Divisions';
		return 'Review & Create';
	});
	const nextLabel = $derived.by(() => {
		if (step === 2 && draftActive) {
			return editingIndex === null ? 'Add Division' : 'Update Division';
		}
		if (step === 2) {
			return 'Review';
		}
		return 'Next';
	});
	const formClass = $derived.by(() =>
		step === 2 && !draftActive
			? 'p-4 space-y-5 flex-1 min-h-0 overflow-hidden'
			: 'p-4 space-y-5 flex-1 min-h-0 overflow-y-auto'
	);

	function divisionStatusLabel(division: DivisionWizardDraft): string {
		return division.isLocked ? 'Locked' : 'Unlocked';
	}

	$effect(() => {
		const message = formError.trim();
		if (!message) {
			lastToastSignature = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${step}:${message}`;
		if (signature === lastToastSignature) return;
		lastToastSignature = signature;
		toast.error(message, {
			id: 'create-division-collection-wizard-error',
			title: errorToastTitle
		});
	});
</script>

<WizardModal
	{open}
	{title}
	{step}
	stepCount={3}
	{stepTitle}
	progressPercent={Math.round((step / 3) * 100)}
	{closeAriaLabel}
	maxWidthClass="max-w-4xl"
	{formClass}
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	{#if step === 1}
		<div class="space-y-4">
			<div class="space-y-2 border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
				{#each contextRows as row}
					<p><span class="font-semibold">{row.label}:</span> {row.value}</p>
				{/each}
			</div>
			<div class="border border-secondary-200 bg-neutral p-4 text-sm text-neutral-950">
				Build one or more divisions for this league. You can add, duplicate, edit, and reorder them
				before creating anything.
			</div>
		</div>
	{/if}

	{#if step === 2}
		<div class="space-y-4">
			<div class="border border-neutral-950 bg-white p-3 text-sm text-neutral-950">
				Adding to <span class="font-semibold">{contextRows[0]?.value ?? 'League'}</span>
			</div>

			{#if !draftActive}
				<div class="space-y-2">
					{#if collectionError.trim()}
						<p class="text-xs text-error-700">{collectionError}</p>
					{/if}
					<WizardDraftCollection
						title="Divisions"
						itemSingular="division"
						itemPlural="divisions"
						items={drafts}
						draftActive={draftActive}
						emptyMessage="No divisions added yet. Use the plus button to add one."
						onAdd={onAddDraft}
						onEdit={onEditDraft}
						onCopy={onCopyDraft}
						onMoveUp={onMoveDraftUp}
						onMoveDown={onMoveDraftDown}
						onRemove={onRemoveDraft}
						getItemName={(item) => (item as DivisionWizardDraft).name}
						getItemSlug={(item) => (item as DivisionWizardDraft).slug}
						listClass="space-y-2 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
					>
						{#snippet itemBody(item)}
							{@const division = item as DivisionWizardDraft}
							<div class="grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-neutral-950 sm:grid-cols-2">
								<p><span class="font-semibold">Day(s):</span> {division.dayOfWeek || 'TBD'}</p>
								<p>
									<span class="font-semibold">Game Time(s):</span>
									{division.gameTime || 'TBD'}
								</p>
								<p><span class="font-semibold">Max Teams:</span> {division.maxTeams || 'TBD'}</p>
								<p>
									<span class="font-semibold">Status:</span>
									{divisionStatusLabel(division)}
								</p>
								{#if showStartDate && division.startDate.trim()}
									<p><span class="font-semibold">Start Date:</span> {division.startDate.trim()}</p>
								{/if}
								{#if showLocation && division.location.trim()}
									<p><span class="font-semibold">Location:</span> {division.location.trim()}</p>
								{/if}
							</div>
							{#if division.description.trim()}
								<p class="text-xs text-neutral-950">
									<span class="font-semibold">Description:</span>
									{division.description.trim()}
								</p>
							{/if}
						{/snippet}
					</WizardDraftCollection>
				</div>
			{:else}
				<div class="space-y-4">
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div>
							<div class="mb-1 flex min-h-6 items-center gap-1.5">
								<label for="create-division-name" class="text-sm leading-6 text-neutral-950">
									Name <span class="text-error-700">*</span>
								</label>
								<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Division name help">
									<div class="space-y-2">
										<p>Use the division name teams will recognize when registering.</p>
									</div>
								</InfoPopover>
							</div>
							<input
								id="create-division-name"
								type="text"
								class="input-secondary"
								placeholder="Monday 6:00 PM"
								value={form.name}
								data-wizard-autofocus
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									if (onNameInput) {
										onNameInput(value);
										return;
									}

									form.name = value;
									if (!slugTouched) {
										form.slug = slugifyFinal(value);
									}
								}}
								autocomplete="off"
							/>
							{#if fieldErrors['name']}
								<p class="mt-1 text-xs text-error-700">{fieldErrors['name']}</p>
							{/if}
						</div>

						<div>
							<div class="mb-1 flex min-h-6 items-center gap-1.5">
								<label for="create-division-slug" class="text-sm leading-6 text-neutral-950">
									Slug <span class="text-error-700">*</span>
								</label>
								<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Division slug help">
									<div class="space-y-2">
										<p>The slug keeps division URLs and records readable.</p>
									</div>
								</InfoPopover>
							</div>
							<div class="relative">
								<input
									id="create-division-slug"
									type="text"
									class="input-secondary pr-10"
									placeholder="monday-600-pm"
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
										aria-label="Revert division slug to default"
										onclick={() => {
											onSlugTouchedChange(false);
											form.slug = slugifyFinal(form.name);
										}}
									>
										<IconRestore class="h-4 w-4" />
									</button>
								</HoverTooltip>
							</div>
							{#if fieldErrors['slug']}
								<p class="mt-1 text-xs text-error-700">{fieldErrors['slug']}</p>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div>
							<label for="create-division-max-teams" class="mb-1 block text-sm text-neutral-950">
								Max Teams <span class="text-error-700">*</span>
							</label>
							<input
								id="create-division-max-teams"
								type="number"
								min="1"
								step="1"
								class="input-secondary"
								bind:value={form.maxTeams}
							/>
							{#if fieldErrors['maxTeams']}
								<p class="mt-1 text-xs text-error-700">{fieldErrors['maxTeams']}</p>
							{/if}
						</div>
						<div>
							<label for="create-division-time" class="mb-1 block text-sm text-neutral-950">
								Game Time(s)
							</label>
							<input
								id="create-division-time"
								type="text"
								class="input-secondary"
								placeholder="6:00 PM"
								value={form.gameTime}
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									if (onGameTimeInput) {
										onGameTimeInput(value);
										return;
									}

									form.gameTime = value;
								}}
								autocomplete="off"
							/>
						</div>
					</div>

					<div>
						<div class="mb-1 flex min-h-6 items-center gap-1.5">
							<p class="text-sm leading-6 text-neutral-950">Day(s)</p>
							<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Division days help">
								<div class="space-y-2">
									<p>
										Select one or more days, or let the division name auto-fill them when
										possible.
									</p>
								</div>
							</InfoPopover>
						</div>
						{#key form.dayOfWeek}
							<DayOfWeekButtonGroup
								selectedValues={resolvedSelectedDayValues}
								on:change={(event) => {
									const value = event.detail.value;
									if (onDayOfWeekInput) {
										onDayOfWeekInput(value);
										return;
									}

									form.dayOfWeek = value;
								}}
							/>
						{/key}
						<p
							class="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700"
							aria-live="polite"
						>
							{selectedDaysSummary || 'No days selected yet'}
						</p>
					</div>

					{#if showLocation || showStartDate}
						<div
							class={`grid grid-cols-1 gap-4 ${showLocation && showStartDate ? 'lg:grid-cols-2' : ''}`}
						>
							{#if showStartDate}
								<div>
									<label
										for="create-division-start-date"
										class="mb-1 block text-sm text-neutral-950"
									>
										Start Date
									</label>
									<input
										id="create-division-start-date"
										type="date"
										class="input-secondary"
										bind:value={form.startDate}
									/>
								</div>
							{/if}
							{#if showLocation}
								<div>
									<label
										for="create-division-location"
										class="mb-1 block text-sm text-neutral-950"
									>
										Location
									</label>
									<input
										id="create-division-location"
										type="text"
										class="input-secondary"
										bind:value={form.location}
										autocomplete="off"
									/>
								</div>
							{/if}
						</div>
					{/if}

					<div>
						<label
							for="create-division-description"
							class="mb-1 block text-sm text-neutral-950"
						>
							Description
						</label>
						<textarea
							id="create-division-description"
							class="textarea-secondary min-h-28"
							bind:value={form.description}
						></textarea>
					</div>

					<ToggleField
						id="create-division-locked"
						label="Start this division locked"
						checked={form.isLocked}
						labelClass="text-base leading-6 font-normal text-neutral-950"
						on:change={(event) => {
							form.isLocked = event.detail.checked;
						}}
					/>
				</div>
			{/if}
		</div>
	{/if}

	{#if step === 3}
		<div class="space-y-4">
			<div class="space-y-2 border-2 border-neutral-950 bg-white p-4">
				<h3 class="text-lg font-bold font-serif text-neutral-950">Target League</h3>
				{#each contextRows as row}
					<p class="text-sm leading-5 text-neutral-950">
						<span class="font-semibold">{row.label}:</span>
						{row.value}
					</p>
				{/each}
			</div>

			<div class="space-y-3 border-2 border-neutral-950 bg-white p-4">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Divisions</h3>
					<HoverTooltip text="Edit divisions">
						<button
							type="button"
							class="button-secondary-outlined p-1.5 cursor-pointer"
							aria-label="Edit divisions"
							onclick={onEditDraftsStep}
						>
							<IconPencil class="h-4 w-4" />
						</button>
					</HoverTooltip>
				</div>
				{#if collectionError.trim()}
					<p class="text-xs text-error-700">{collectionError}</p>
				{/if}
				{#if drafts.length === 0}
					<p class="text-sm font-sans text-neutral-950">No divisions will be created.</p>
				{:else}
					<div
						class="max-h-[45vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400"
					>
						{#each drafts as division}
							<div class="space-y-2 border border-neutral-950 bg-neutral p-3">
								<div>
									<p class="text-sm font-semibold text-neutral-950">
										{division.name.trim() || 'Untitled Division'}
									</p>
									<p class="text-xs text-neutral-900">Slug: {division.slug || 'TBD'}</p>
								</div>
								<div class="grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-neutral-950 sm:grid-cols-2">
									<p><span class="font-semibold">Day(s):</span> {division.dayOfWeek || 'TBD'}</p>
									<p>
										<span class="font-semibold">Game Time(s):</span>
										{division.gameTime || 'TBD'}
									</p>
									<p><span class="font-semibold">Max Teams:</span> {division.maxTeams || 'TBD'}</p>
									<p>
										<span class="font-semibold">Status:</span>
										{divisionStatusLabel(division)}
									</p>
									{#if showStartDate && division.startDate.trim()}
										<p><span class="font-semibold">Start Date:</span> {division.startDate.trim()}</p>
									{/if}
									{#if showLocation && division.location.trim()}
										<p><span class="font-semibold">Location:</span> {division.location.trim()}</p>
									{/if}
								</div>
								{#if division.description.trim()}
									<p class="text-xs text-neutral-950">
										<span class="font-semibold">Description:</span>
										{division.description.trim()}
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
			step={step}
			lastStep={3}
			showBack={step > 1}
			{canGoNext}
			{canSubmit}
			{nextLabel}
			{submitLabel}
			{submittingLabel}
			isSubmitting={submitting}
			on:back={onBack}
			on:next={onNext}
		/>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Wizard Changes?"
	message="You have unsaved division changes. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
