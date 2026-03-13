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
		WizardModal,
		WizardStepFooter,
		WizardUnsavedConfirm,
		slugifyFinal,
		applyLiveSlugInput
	} from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import { IconRestore } from '@tabler/icons-svelte';

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

	interface Props {
		open: boolean;
		form: DivisionWizardForm;
		fieldErrors: Record<string, string>;
		formError: string;
		submitting: boolean;
		canSubmit: boolean;
		slugTouched: boolean;
		unsavedConfirmOpen: boolean;
		showLocation?: boolean;
		onSlugTouchedChange: (value: boolean) => void;
		onNameInput?: (value: string) => void;
		onDayOfWeekInput?: (value: string) => void;
		onGameTimeInput?: (value: string) => void;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
		title?: string;
		closeAriaLabel?: string;
		submitLabel?: string;
		submittingLabel?: string;
		errorToastTitle?: string;
	}

	let {
		open,
		form,
		fieldErrors,
		formError,
		submitting,
		canSubmit,
		slugTouched,
		unsavedConfirmOpen,
		showLocation = true,
		onSlugTouchedChange,
		onNameInput,
		onDayOfWeekInput,
		onGameTimeInput,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel,
		title = 'New Division',
		closeAriaLabel = 'Close create division wizard',
		submitLabel = 'Create Division',
		submittingLabel = 'Creating...',
		errorToastTitle = 'Create division'
	}: Props = $props();

	let lastToastSignature = $state('');
	const resolvedSelectedDayValues = $derived.by(() => parseDivisionDays(form.dayOfWeek));
	const selectedDaysSummary = $derived.by(() => formatDivisionDays(resolvedSelectedDayValues));

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
			id: 'create-division-wizard-error',
			title: errorToastTitle
		});
	});
</script>

<WizardModal
	{open}
	{title}
	step={1}
	stepCount={1}
	stepTitle="Division Details"
	progressPercent={100}
	{closeAriaLabel}
	maxWidthClass="max-w-3xl"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
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
						placeholder="monday-6-00-pm"
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
				<label for="create-division-start-date" class="mb-1 block text-sm text-neutral-950">
					Start Date
				</label>
				<input
					id="create-division-start-date"
					type="date"
					class="input-secondary"
					bind:value={form.startDate}
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
			<div class={showLocation ? 'lg:col-span-2' : 'lg:col-span-3'}>
				<div class="mb-1 flex min-h-6 items-center gap-1.5">
					<p class="text-sm leading-6 text-neutral-950">Days</p>
					<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Division days help">
						<div class="space-y-2">
							<p>Select one or more days, or let the division name auto-fill them when possible.</p>
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
				<p class="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700" aria-live="polite">
					{selectedDaysSummary || 'No days selected yet'}
				</p>
			</div>
			<div>
				<label for="create-division-time" class="mb-1 block text-sm text-neutral-950">
					Game Time
				</label>
				<input
					id="create-division-time"
					type="text"
					class="input-secondary"
					placeholder="7:00 PM or 5:30 PM / 6:15 PM"
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
			{#if showLocation}
				<div>
					<label for="create-division-location" class="mb-1 block text-sm text-neutral-950">
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

		<div>
			<label for="create-division-description" class="mb-1 block text-sm text-neutral-950">
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

	{#snippet footer()}
		<WizardStepFooter
			step={1}
			lastStep={1}
			showBack={false}
			canGoNext={false}
			{canSubmit}
			nextLabel="Next"
			{submitLabel}
			{submittingLabel}
			isSubmitting={submitting}
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
