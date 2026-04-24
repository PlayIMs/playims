<script lang="ts">
	import DatePicker from '$lib/components/DatePicker.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { WizardModal, WizardStepFooter, WizardUnsavedConfirm } from '$lib/components/wizard';
	import type {
		ScheduleEventWizardCollections,
		ScheduleEventWizardOptions,
		ScheduleEventWizardSelection
	} from '$lib/utils/schedule-event-wizard';
	import { resolveScheduleEventWizardEmptyOptionLabels } from '$lib/utils/schedule-event-wizard';
	import {
		buildScheduleEventWizardBlockingFieldErrors,
		buildScheduleEventWizardStepErrors,
		getScheduleEventWizardStepCount,
		getScheduleEventWizardStepTitle,
		type ScheduleEventWizardStep
	} from '$lib/utils/schedule-event-wizard-steps';
	import { toast } from '$lib/toasts';

	type DropdownOption = {
		value: string;
		label: string;
		searchText?: string;
	};

	export type CreateEventWizardForm = ScheduleEventWizardSelection & {
		scheduledStartAt: string;
		scheduledEndAt: string;
		weekNumber: string;
		roundLabel: string;
		notes: string;
		isPostseason: boolean;
	};

	interface Props {
		open: boolean;
		title?: string;
		closeAriaLabel?: string;
		submitLabel?: string;
		submittingLabel?: string;
		form: CreateEventWizardForm;
		fieldErrors: Record<string, string>;
		formError: string;
		submitting: boolean;
		canSubmit: boolean;
		unsavedConfirmOpen: boolean;
		options: ScheduleEventWizardOptions;
		collections: ScheduleEventWizardCollections;
		onSelectionChange: (patch: Partial<ScheduleEventWizardSelection>) => void;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
	}

	let {
		open,
		title = 'New Event',
		closeAriaLabel = 'Close event wizard',
		submitLabel = 'Create Event',
		submittingLabel = 'Creating...',
		form,
		fieldErrors,
		formError,
		submitting,
		canSubmit,
		unsavedConfirmOpen,
		options,
		collections,
		onSelectionChange,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel
	}: Props = $props();

	const WIZARD_STEP_COUNT = getScheduleEventWizardStepCount();
	const dropdownButtonClass =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-sm leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';

	function toDropdownOptions(
		items: Array<{ id: string; name: string }>,
		allLabel: string
	): DropdownOption[] {
		return [
			{ value: '', label: allLabel },
			...items.map((item) => ({
				value: item.id,
				label: item.name,
				searchText: item.name
			}))
		];
	}

	const emptyOptionLabels = $derived.by(() =>
		resolveScheduleEventWizardEmptyOptionLabels(options, form, collections)
	);
	const seasonOptions = $derived.by(() =>
		toDropdownOptions(
			options.seasons,
			options.seasons.length > 0 ? 'Select season' : 'No seasons exist'
		)
	);
	const offeringOptions = $derived.by(() =>
		toDropdownOptions(collections.offeringOptions, emptyOptionLabels.offering)
	);
	const leagueOptions = $derived.by(() =>
		toDropdownOptions(collections.leagueOptions, emptyOptionLabels.league)
	);
	const divisionOptions = $derived.by(() =>
		toDropdownOptions(collections.divisionOptions, emptyOptionLabels.division)
	);
	const homeTeamOptions = $derived.by(() =>
		toDropdownOptions(collections.homeTeamOptions, emptyOptionLabels.homeTeam)
	);
	const awayTeamOptions = $derived.by(() =>
		toDropdownOptions(collections.awayTeamOptions, emptyOptionLabels.awayTeam)
	);
	const facilityOptions = $derived.by(() =>
		toDropdownOptions(
			options.facilities,
			options.facilities.length > 0 ? 'Select facility' : 'No facilities exist'
		)
	);
	const facilityAreaOptions = $derived.by(() =>
		toDropdownOptions(collections.facilityAreaOptions, emptyOptionLabels.facilityArea)
	);
	let currentStep = $state<ScheduleEventWizardStep>(1);
	let validationStep = $state(0);
	let lastOpenState = $state(false);

	let lastToastSignature = $state('');

	const currentStepErrors = $derived.by(() =>
		validationStep >= currentStep
			? buildScheduleEventWizardStepErrors(options, form, currentStep)
			: {}
	);
	const visibleFieldErrors = $derived.by(() => ({
		...currentStepErrors,
		...fieldErrors
	}));
	const currentStepCanAdvance = $derived.by(() => {
		if (currentStep >= WIZARD_STEP_COUNT) {
			return false;
		}

		if (validationStep < currentStep) {
			return true;
		}

		return Object.keys(currentStepErrors).length === 0;
	});
	const finalCanSubmit = $derived.by(
		() =>
			canSubmit &&
			Object.keys(buildScheduleEventWizardBlockingFieldErrors(options, form)).length === 0
	);

	$effect(() => {
		if (open && !lastOpenState) {
			currentStep = 1;
			validationStep = 0;
		}

		if (!open && lastOpenState) {
			currentStep = 1;
			validationStep = 0;
		}

		lastOpenState = open;
	});

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
			id: 'create-event-wizard-error',
			title: 'Create event'
		});
	});

	function goToNextStep(): void {
		validationStep = Math.max(validationStep, currentStep);
		const errors = buildScheduleEventWizardStepErrors(options, form, currentStep);
		if (Object.keys(errors).length > 0) {
			return;
		}

		if (currentStep < WIZARD_STEP_COUNT) {
			currentStep = (currentStep + 1) as ScheduleEventWizardStep;
			validationStep = currentStep;
		}
	}

	function goToPreviousStep(): void {
		if (currentStep <= 1) {
			return;
		}

		currentStep = (currentStep - 1) as ScheduleEventWizardStep;
		validationStep = Math.max(validationStep, currentStep);
	}
</script>

<WizardModal
	{open}
	{title}
	step={currentStep}
	stepCount={WIZARD_STEP_COUNT}
	stepTitle={getScheduleEventWizardStepTitle(currentStep)}
	progressPercent={(currentStep / WIZARD_STEP_COUNT) * 100}
	{closeAriaLabel}
	maxWidthClass="max-w-5xl"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	<div class="space-y-5">
		{#if currentStep === 1}
			<section class="space-y-4 border border-neutral-950 bg-white p-4">
				<div class="space-y-1">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Competition</h3>
					<p class="text-sm text-neutral-950">
						Choose the season path this game belongs to so the matchup and schedule stay in sync.
					</p>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							Season <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={seasonOptions}
							value={form.seasonId}
							ariaLabel="Select event season"
							buttonClass={dropdownButtonClass}
							disabled={options.seasons.length === 0}
							on:change={(event) => {
								onSelectionChange({ seasonId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.seasonId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.seasonId']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							Offering <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={offeringOptions}
							value={form.offeringId}
							ariaLabel="Select event offering"
							buttonClass={dropdownButtonClass}
							disabled={!form.seasonId || collections.offeringOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ offeringId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.offeringId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.offeringId']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							League <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={leagueOptions}
							value={form.leagueId}
							ariaLabel="Select event league"
							buttonClass={dropdownButtonClass}
							disabled={!form.offeringId || collections.leagueOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ leagueId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.leagueId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.leagueId']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							Division <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={divisionOptions}
							value={form.divisionId}
							ariaLabel="Select event division"
							buttonClass={dropdownButtonClass}
							disabled={!form.leagueId || collections.divisionOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ divisionId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.divisionId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.divisionId']}</p>
						{/if}
					</div>
				</div>
			</section>
		{:else if currentStep === 2}
			<section class="space-y-4 border border-neutral-950 bg-white p-4">
				<div class="space-y-1">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Schedule</h3>
					<p class="text-sm text-neutral-950">
						Set when and where this game should appear on the schedule page.
					</p>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							Start <span class="text-error-700">*</span>
						</p>
						<DatePicker
							type="datetime-local"
							value={form.scheduledStartAt}
							ariaLabel="Choose event start time"
							inputClass="input-secondary min-h-10 pr-10 py-2 text-sm"
							on:change={(event) => {
								form.scheduledStartAt = event.detail.value;
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.scheduledStartAt']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.scheduledStartAt']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							End <span class="text-error-700">*</span>
						</p>
						<DatePicker
							type="datetime-local"
							value={form.scheduledEndAt}
							ariaLabel="Choose event end time"
							inputClass="input-secondary min-h-10 pr-10 py-2 text-sm"
							on:change={(event) => {
								form.scheduledEndAt = event.detail.value;
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.scheduledEndAt']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.scheduledEndAt']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">Facility</p>
						<ListboxDropdown
							options={facilityOptions}
							value={form.facilityId}
							ariaLabel="Select event facility"
							buttonClass={dropdownButtonClass}
							disabled={options.facilities.length === 0}
							on:change={(event) => {
								onSelectionChange({ facilityId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.facilityId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.facilityId']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">Facility Area</p>
						<ListboxDropdown
							options={facilityAreaOptions}
							value={form.facilityAreaId}
							ariaLabel="Select event facility area"
							buttonClass={dropdownButtonClass}
							disabled={!form.facilityId || collections.facilityAreaOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ facilityAreaId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.facilityAreaId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.facilityAreaId']}</p>
						{/if}
					</div>
				</div>
			</section>
		{:else if currentStep === 3}
			<section class="space-y-4 border border-neutral-950 bg-white p-4">
				<div class="space-y-1">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Matchup</h3>
					<p class="text-sm text-neutral-950">
						Pick the two teams that should appear on the schedule card.
					</p>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							Home Team <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={homeTeamOptions}
							value={form.homeTeamId}
							ariaLabel="Select home team"
							buttonClass={dropdownButtonClass}
							disabled={!form.divisionId || collections.homeTeamOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ homeTeamId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.homeTeamId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.homeTeamId']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">
							Away Team <span class="text-error-700">*</span>
						</p>
						<ListboxDropdown
							options={awayTeamOptions}
							value={form.awayTeamId}
							ariaLabel="Select away team"
							buttonClass={dropdownButtonClass}
							disabled={!form.divisionId || collections.awayTeamOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ awayTeamId: event.detail.value });
								onInput();
							}}
						/>
						{#if visibleFieldErrors['event.awayTeamId']}
							<p class="text-xs text-error-700">{visibleFieldErrors['event.awayTeamId']}</p>
						{/if}
					</div>
				</div>
			</section>
		{:else}
			<section class="space-y-4 border border-neutral-950 bg-white p-4">
				<div class="space-y-1">
					<h3 class="text-lg font-bold font-serif text-neutral-950">Details</h3>
					<p class="text-sm text-neutral-950">
						Add optional context like week, round, postseason status, and notes.
					</p>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-1.5">
						<label for="create-event-week-number" class="text-sm text-neutral-950"
							>Week Number</label
						>
						<input
							id="create-event-week-number"
							type="number"
							class="input-secondary min-h-10"
							min="1"
							max="999"
							value={form.weekNumber}
							oninput={(event) => {
								form.weekNumber = (event.currentTarget as HTMLInputElement).value;
							}}
						/>
					</div>

					<div class="space-y-1.5">
						<label for="create-event-round-label" class="text-sm text-neutral-950"
							>Round Label</label
						>
						<input
							id="create-event-round-label"
							type="text"
							class="input-secondary min-h-10"
							value={form.roundLabel}
							placeholder="Regular Season"
							oninput={(event) => {
								form.roundLabel = (event.currentTarget as HTMLInputElement).value;
							}}
						/>
					</div>
				</div>

				<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
					<input type="checkbox" class="toggle-secondary" bind:checked={form.isPostseason} />
					Postseason game
				</label>

				<div class="space-y-1.5">
					<label for="create-event-notes" class="text-sm text-neutral-950">Notes</label>
					<textarea
						id="create-event-notes"
						class="textarea-secondary min-h-32"
						placeholder="Optional notes for coordinators or game-day staff."
						bind:value={form.notes}
					></textarea>
				</div>
			</section>
		{/if}
	</div>

	{#snippet footer()}
		<WizardStepFooter
			step={currentStep}
			lastStep={WIZARD_STEP_COUNT}
			showBack={currentStep > 1}
			canGoNext={currentStepCanAdvance}
			canSubmit={finalCanSubmit}
			nextLabel="Next"
			{submitLabel}
			{submittingLabel}
			isSubmitting={submitting}
			on:back={goToPreviousStep}
			on:next={goToNextStep}
		/>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Event Changes?"
	message="You have unsaved event details in this wizard. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
