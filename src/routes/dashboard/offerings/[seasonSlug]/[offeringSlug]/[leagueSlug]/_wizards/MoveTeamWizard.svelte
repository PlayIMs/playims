<script lang="ts">
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import { WizardModal, WizardStepFooter, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';

	type PlacementValue = 'active' | 'waitlist';

	interface DropdownOption {
		value: string;
		label: string;
		description?: string;
		statusLabel?: string;
		disabled?: boolean;
		separatorBefore?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	interface MoveTeamWizardForm {
		divisionId: string;
		placement: PlacementValue;
	}

	interface Props {
		open: boolean;
		teamName: string;
		currentDivisionName: string;
		currentPlacement: PlacementValue;
		form: MoveTeamWizardForm;
		fieldErrors: Record<string, string>;
		formError: string;
		submitting: boolean;
		canSubmit: boolean;
		unsavedConfirmOpen: boolean;
		divisionOptions: DropdownOption[];
		placementOptions: DropdownOption[];
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
	}

	const FORM_DROPDOWN_BUTTON_CLASS =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';

	let {
		open,
		teamName,
		currentDivisionName,
		currentPlacement,
		form,
		fieldErrors,
		formError,
		submitting,
		canSubmit,
		unsavedConfirmOpen,
		divisionOptions,
		placementOptions,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel
	}: Props = $props();

	let lastToastSignature = $state('');

	const currentPlacementLabel = $derived.by(() =>
		currentPlacement === 'waitlist' ? 'Waitlist' : 'Division'
	);

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
			id: 'move-team-wizard-error',
			title: 'Move team'
		});
	});
</script>

<WizardModal
	{open}
	title="Move Team"
	step={1}
	stepCount={1}
	stepTitle="Team Placement"
	progressPercent={100}
	closeAriaLabel="Close move team wizard"
	maxWidthClass="max-w-3xl"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	<div class="space-y-4">
		<div class="border border-neutral-950 bg-white p-3 text-sm leading-6 text-neutral-950">
			Move <span class="font-bold">{teamName || 'this team'}</span> into another division or place
			it on the waitlist without editing the row inline.
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div class="border border-neutral-950 bg-white p-3">
				<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
					Current Division
				</p>
				<p class="mt-2 text-sm font-semibold text-neutral-950">{currentDivisionName || 'Unknown'}</p>
			</div>
			<div class="border border-neutral-950 bg-white p-3">
				<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
					Current Placement
				</p>
				<p class="mt-2 text-sm font-semibold text-neutral-950">{currentPlacementLabel}</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<p class="mb-1 block text-sm text-neutral-950">
					New Division <span class="text-error-700">*</span>
				</p>
				<ListboxDropdown
					options={divisionOptions}
					value={form.divisionId}
					ariaLabel="Select a target division"
					buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
					autoFocus
					on:change={(event) => {
						form.divisionId = event.detail.value;
						onInput();
					}}
				/>
				{#if fieldErrors['divisionId']}
					<p class="mt-1 text-xs text-error-700">{fieldErrors['divisionId']}</p>
				{/if}
			</div>

			<div>
				<p class="mb-1 block text-sm text-neutral-950">
					New Placement <span class="text-error-700">*</span>
				</p>
				<ListboxDropdown
					options={placementOptions}
					value={form.placement}
					ariaLabel="Select a target placement"
					buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
					on:change={(event) => {
						form.placement = event.detail.value as PlacementValue;
						onInput();
					}}
				/>
			</div>
		</div>

		<div class="border border-neutral-950 bg-white p-3 text-sm leading-6 text-neutral-950">
			If you move a team to <span class="font-semibold">Waitlist</span>, it stays tied to its preferred
			division for later placement.
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
			submitLabel="Move Team"
			submittingLabel="Moving..."
			isSubmitting={submitting}
		/>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Wizard Changes?"
	message="You have unsaved move-team changes. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
