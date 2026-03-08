<script lang="ts">
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import {
		WizardModal,
		WizardStepFooter,
		WizardUnsavedConfirm,
		slugifyFinal,
		applyLiveSlugInput
	} from '$lib/components/wizard';
	import { toast } from '$lib/toasts';
	import { IconRestore } from '@tabler/icons-svelte';

	interface TeamWizardForm {
		name: string;
		slug: string;
		divisionId: string;
		description: string;
		placement: 'active' | 'waitlist';
		teamColor: string;
	}

	interface DropdownOption {
		value: string;
		label: string;
		statusLabel?: string;
		disabled?: boolean;
	}

	interface Props {
		open: boolean;
		form: TeamWizardForm;
		fieldErrors: Record<string, string>;
		formError: string;
		submitting: boolean;
		canSubmit: boolean;
		slugTouched: boolean;
		divisionOptions: DropdownOption[];
		placementOptions: DropdownOption[];
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
		fieldErrors,
		formError,
		submitting,
		canSubmit,
		slugTouched,
		divisionOptions,
		placementOptions,
		unsavedConfirmOpen,
		onSlugTouchedChange,
		onRequestClose,
		onSubmit,
		onInput,
		onUnsavedConfirm,
		onUnsavedCancel
	}: Props = $props();

	const dropdownButtonClass =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';

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
			id: 'create-team-wizard-error',
			title: 'Create team'
		});
	});
</script>

<WizardModal
	{open}
	title="New Team"
	step={1}
	stepCount={1}
	stepTitle="Team Details"
	progressPercent={100}
	closeAriaLabel="Close create team wizard"
	maxWidthClass="max-w-3xl"
	on:requestClose={onRequestClose}
	on:submit={onSubmit}
	on:input={onInput}
>
	<div class="space-y-4">
		<div class="border border-secondary-300 bg-white p-3 text-sm leading-6 text-neutral-950">
			Create the team, choose where it starts, and decide whether it should enter the league
			directly or wait for an open spot.
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<div class="mb-1 flex min-h-6 items-center gap-1.5">
					<label for="create-team-name" class="text-sm leading-6 text-neutral-950">
						Team Name <span class="text-error-700">*</span>
					</label>
					<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Team name help">
						<div class="space-y-2">
							<p>Use the team name exactly how members should see it on standings and schedules.</p>
						</div>
					</InfoPopover>
				</div>
				<input
					id="create-team-name"
					type="text"
					class="input-secondary"
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
				{#if fieldErrors['name']}
					<p class="mt-1 text-xs text-error-700">{fieldErrors['name']}</p>
				{/if}
			</div>

			<div>
				<div class="mb-1 flex min-h-6 items-center gap-1.5">
					<label for="create-team-slug" class="text-sm leading-6 text-neutral-950">
						Slug <span class="text-error-700">*</span>
					</label>
					<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Team slug help">
						<div class="space-y-2">
							<p>The slug keeps registration and roster links readable.</p>
						</div>
					</InfoPopover>
				</div>
				<div class="relative">
					<input
						id="create-team-slug"
						type="text"
						class="input-secondary pr-10"
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
							aria-label="Revert team slug to default"
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
				<div class="mb-1 flex min-h-6 items-center gap-1.5">
					<p class="text-sm leading-6 text-neutral-950">
						Division <span class="text-error-700">*</span>
					</p>
					<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Division placement help">
						<div class="space-y-2">
							<p>Choose the division this team should target first.</p>
						</div>
					</InfoPopover>
				</div>
				<ListboxDropdown
					options={divisionOptions}
					value={form.divisionId}
					ariaLabel="Select team division"
					buttonClass={dropdownButtonClass}
					on:change={(event) => {
						form.divisionId = event.detail.value;
					}}
				/>
				{#if fieldErrors['divisionId']}
					<p class="mt-1 text-xs text-error-700">{fieldErrors['divisionId']}</p>
				{/if}
			</div>

			<div>
				<div class="mb-1 flex min-h-6 items-center gap-1.5">
					<p class="text-sm leading-6 text-neutral-950">
						Placement <span class="text-error-700">*</span>
					</p>
					<InfoPopover buttonVariant="label-inline" buttonAriaLabel="Placement help">
						<div class="space-y-2">
							<p>Division means the team counts against division capacity immediately.</p>
							<p>Waitlist keeps the team attached to the division but out of the active count.</p>
						</div>
					</InfoPopover>
				</div>
				<ListboxDropdown
					options={placementOptions}
					value={form.placement}
					ariaLabel="Select team placement"
					buttonClass={dropdownButtonClass}
					on:change={(event) => {
						form.placement = event.detail.value as 'active' | 'waitlist';
					}}
				/>
				{#if fieldErrors['placement']}
					<p class="mt-1 text-xs text-error-700">{fieldErrors['placement']}</p>
				{/if}
			</div>
		</div>

		<div>
			<label for="create-team-color" class="mb-1 block text-sm text-neutral-950">Team Color</label>
			<input
				id="create-team-color"
				type="text"
				class="input-secondary"
				bind:value={form.teamColor}
				autocomplete="off"
			/>
		</div>

		<div>
			<label for="create-team-description" class="mb-1 block text-sm text-neutral-950">
				Description
			</label>
			<textarea
				id="create-team-description"
				class="textarea-secondary min-h-28"
				bind:value={form.description}
			></textarea>
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
			submitLabel="Create Team"
			submittingLabel="Creating..."
			isSubmitting={submitting}
		/>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard Wizard Changes?"
	message="You have unsaved team changes. Close without saving?"
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={onUnsavedConfirm}
	on:cancel={onUnsavedCancel}
/>
