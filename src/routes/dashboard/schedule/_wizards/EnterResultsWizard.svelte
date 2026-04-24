<script lang="ts">
	import { WizardModal, WizardStepFooter, WizardUnsavedConfirm } from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import type { ScheduleEventRecord } from '$lib/utils/schedule-page.js';

	interface Props {
		open: boolean;
		event: ScheduleEventRecord | null;
		form: {
			homeScore: string;
			awayScore: string;
		};
		fieldErrors: Record<string, string>;
		formError: string;
		submitting: boolean;
		canSubmit: boolean;
		unsavedConfirmOpen: boolean;
		onRequestClose: () => void;
		onSubmit: () => void;
		onInput: () => void;
		onUnsavedConfirm: () => void;
		onUnsavedCancel: () => void;
	}

	let {
		open,
		event = null,
		form,
		fieldErrors,
		formError,
		submitting,
		canSubmit,
		unsavedConfirmOpen,
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
			id: 'schedule-results-wizard-error',
			title: 'Enter results'
		});
	});
</script>

<WizardModal
	{open}
	title="Enter Results"
	step={1}
	stepCount={1}
	stepTitle="Game Results"
	progressPercent={100}
	closeAriaLabel="Close results wizard"
	maxWidthClass="max-w-2xl"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	<div class="space-y-4">
		<div class="border border-neutral-950 bg-white p-4 space-y-2">
			<h3 class="text-lg font-bold font-serif text-neutral-950">
				{event?.matchup ?? 'Select a game'}
			</h3>
			<p class="text-sm text-neutral-950">
				Record the final score so the schedule card can show a completed result.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="space-y-1.5">
				<p class="text-sm text-neutral-950">
					Home score <span class="text-error-700">*</span>
				</p>
				<input
					type="number"
					min="0"
					max="999"
					class="input-secondary min-h-10"
					value={form.homeScore}
					oninput={(event) => {
						form.homeScore = (event.currentTarget as HTMLInputElement).value;
						onInput();
					}}
				/>
				{#if fieldErrors.homeScore}
					<p class="text-xs text-error-700">{fieldErrors.homeScore}</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<p class="text-sm text-neutral-950">
					Away score <span class="text-error-700">*</span>
				</p>
				<input
					type="number"
					min="0"
					max="999"
					class="input-secondary min-h-10"
					value={form.awayScore}
					oninput={(event) => {
						form.awayScore = (event.currentTarget as HTMLInputElement).value;
						onInput();
					}}
				/>
				{#if fieldErrors.awayScore}
					<p class="text-xs text-error-700">{fieldErrors.awayScore}</p>
				{/if}
			</div>
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
			submitLabel="Save Results"
			submittingLabel="Saving..."
			isSubmitting={submitting}
		/>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Result Changes?"
	message="You have unsaved score changes in this wizard. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
