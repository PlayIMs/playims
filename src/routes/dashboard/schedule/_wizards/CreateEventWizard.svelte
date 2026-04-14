<script lang="ts">
	import DatePicker from '$lib/components/DatePicker.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { WizardModal, WizardStepFooter, WizardUnsavedConfirm } from '$lib/components/wizard';
	import type {
		ScheduleEventWizardCollections,
		ScheduleEventWizardOptions,
		ScheduleEventWizardSelection
	} from '$lib/utils/schedule-event-wizard';
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

	const seasonOptions = $derived.by(() => toDropdownOptions(options.seasons, 'Select season'));
	const offeringOptions = $derived.by(() =>
		toDropdownOptions(collections.offeringOptions, 'Select offering')
	);
	const leagueOptions = $derived.by(() =>
		toDropdownOptions(collections.leagueOptions, 'Select league')
	);
	const divisionOptions = $derived.by(() =>
		toDropdownOptions(collections.divisionOptions, 'Select division')
	);
	const homeTeamOptions = $derived.by(() =>
		toDropdownOptions(collections.homeTeamOptions, 'Select home team')
	);
	const awayTeamOptions = $derived.by(() =>
		toDropdownOptions(collections.awayTeamOptions, 'Select away team')
	);
	const facilityOptions = $derived.by(() =>
		toDropdownOptions(options.facilities, 'Select facility')
	);
	const facilityAreaOptions = $derived.by(() =>
		toDropdownOptions(collections.facilityAreaOptions, 'Select facility area')
	);

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
			id: 'create-event-wizard-error',
			title: 'Create event'
		});
	});
</script>

<WizardModal
	{open}
	title="New Event"
	step={1}
	stepCount={1}
	stepTitle="Game Details"
	progressPercent={100}
	closeAriaLabel="Close create event wizard"
	maxWidthClass="max-w-5xl"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	<div class="space-y-5">
		<div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
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
							searchEnabled={seasonOptions.length > 7}
							searchPlaceholder="Search seasons"
							on:change={(event) => {
								onSelectionChange({ seasonId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.seasonId']}
							<p class="text-xs text-error-700">{fieldErrors['event.seasonId']}</p>
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
							searchEnabled={offeringOptions.length > 7}
							searchPlaceholder="Search offerings"
							disabled={collections.offeringOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ offeringId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.offeringId']}
							<p class="text-xs text-error-700">{fieldErrors['event.offeringId']}</p>
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
							searchEnabled={leagueOptions.length > 7}
							searchPlaceholder="Search leagues"
							disabled={collections.leagueOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ leagueId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.leagueId']}
							<p class="text-xs text-error-700">{fieldErrors['event.leagueId']}</p>
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
							searchEnabled={divisionOptions.length > 7}
							searchPlaceholder="Search divisions"
							disabled={collections.divisionOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ divisionId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.divisionId']}
							<p class="text-xs text-error-700">{fieldErrors['event.divisionId']}</p>
						{/if}
					</div>
				</div>
			</section>

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
						{#if fieldErrors['event.scheduledStartAt']}
							<p class="text-xs text-error-700">{fieldErrors['event.scheduledStartAt']}</p>
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
						{#if fieldErrors['event.scheduledEndAt']}
							<p class="text-xs text-error-700">{fieldErrors['event.scheduledEndAt']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">Facility</p>
						<ListboxDropdown
							options={facilityOptions}
							value={form.facilityId}
							ariaLabel="Select event facility"
							buttonClass={dropdownButtonClass}
							searchEnabled={facilityOptions.length > 7}
							searchPlaceholder="Search facilities"
							on:change={(event) => {
								onSelectionChange({ facilityId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.facilityId']}
							<p class="text-xs text-error-700">{fieldErrors['event.facilityId']}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<p class="text-sm text-neutral-950">Facility Area</p>
						<ListboxDropdown
							options={facilityAreaOptions}
							value={form.facilityAreaId}
							ariaLabel="Select event facility area"
							buttonClass={dropdownButtonClass}
							searchEnabled={facilityAreaOptions.length > 7}
							searchPlaceholder="Search facility areas"
							disabled={!form.facilityId || collections.facilityAreaOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ facilityAreaId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.facilityAreaId']}
							<p class="text-xs text-error-700">{fieldErrors['event.facilityAreaId']}</p>
						{/if}
					</div>
				</div>
			</section>
		</div>

		<div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
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
							searchEnabled={homeTeamOptions.length > 7}
							searchPlaceholder="Search home teams"
							disabled={collections.homeTeamOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ homeTeamId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.homeTeamId']}
							<p class="text-xs text-error-700">{fieldErrors['event.homeTeamId']}</p>
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
							searchEnabled={awayTeamOptions.length > 7}
							searchPlaceholder="Search away teams"
							disabled={collections.awayTeamOptions.length === 0}
							on:change={(event) => {
								onSelectionChange({ awayTeamId: event.detail.value });
								onInput();
							}}
						/>
						{#if fieldErrors['event.awayTeamId']}
							<p class="text-xs text-error-700">{fieldErrors['event.awayTeamId']}</p>
						{/if}
					</div>
				</div>
			</section>

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
		</div>
	</div>

	{#snippet footer()}
		<WizardStepFooter
			step={1}
			lastStep={1}
			showBack={false}
			canGoNext={false}
			{canSubmit}
			nextLabel="Next"
			submitLabel="Create Event"
			submittingLabel="Creating..."
			isSubmitting={submitting}
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
