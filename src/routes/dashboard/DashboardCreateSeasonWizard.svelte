<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		WizardStepFooter,
		createWizardDirtyState,
		applyLiveSlugInput,
		slugifyFinal,
		toServerFieldErrorMap
	} from '$lib/components/wizard';
	import { resolveAcademicSeasonEndDate, inferAcademicSeasonRangeFromName } from '$lib/utils/academic-season.js';
	import CreateSeasonWizard from './offerings/_wizards/CreateSeasonWizard.svelte';
	import { toast } from '$lib/toasts';

	interface SeasonHistoryEntry {
		id: string;
		name: string;
		isCurrent: boolean;
		isActive: boolean;
	}

	interface SeasonFormState {
		name: string;
		slug: string;
		startDate: string;
		endDate: string;
		isCurrent: boolean;
		isActive: boolean;
	}

	interface CreateSeasonApiResponse {
		success: boolean;
		data?: {
			season: {
				id: string;
				name: string;
			};
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface Props {
		open: boolean;
		seasons: SeasonHistoryEntry[];
	}

	let { open, seasons }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		saved: { selectedSeasonId: string };
	}>();
	const dirtyState = createWizardDirtyState<{
		form: SeasonFormState;
		deactivateExistingCurrent: boolean;
	}>();

	const STEP_TITLE = 'Season Details';

	let form = $state(createEmptySeasonForm(false));
	let deactivateExistingCurrent = $state(false);
	let unsavedConfirmOpen = $state(false);
	let isSubmitting = $state(false);
	let formError = $state('');
	let clientFieldErrors = $state<Record<string, string>>({});
	let serverFieldErrors = $state<Record<string, string>>({});
	let slugTouched = $state(false);
	let startDateTouched = $state(false);
	let endDateTouched = $state(false);
	let wasOpen = $state(false);

	const existingCurrentSeason = $derived.by(() => seasons.find((season) => season.isCurrent) ?? null);
	const combinedFieldErrors = $derived.by(() => ({
		...clientFieldErrors,
		...serverFieldErrors
	}));

	$effect(() => {
		if (open && !wasOpen) {
			resetWizard();
			wasOpen = true;
			return;
		}

		if (!open && wasOpen) {
			wasOpen = false;
			unsavedConfirmOpen = false;
		}
	});

	function todayDateString(): string {
		return new Date().toISOString().slice(0, 10);
	}

	function createEmptySeasonForm(defaultCurrent: boolean): SeasonFormState {
		const startDate = todayDateString();
		return {
			name: '',
			slug: '',
			startDate,
			endDate: resolveAcademicSeasonEndDate('', startDate),
			isCurrent: defaultCurrent,
			isActive: true
		};
	}

	function resetWizard(): void {
		const baseForm = createEmptySeasonForm(seasons.length === 0);
		form = { ...baseForm };
		deactivateExistingCurrent = false;
		unsavedConfirmOpen = false;
		isSubmitting = false;
		formError = '';
		clientFieldErrors = {};
		serverFieldErrors = {};
		slugTouched = false;
		startDateTouched = false;
		endDateTouched = false;
		dirtyState.captureBaseline({
			form: baseForm,
			deactivateExistingCurrent: false
		});
	}

	function currentSnapshot() {
		return {
			form,
			deactivateExistingCurrent
		};
	}

	function clearFieldError(fieldKey: string): void {
		if (clientFieldErrors[fieldKey]) {
			const next = { ...clientFieldErrors };
			delete next[fieldKey];
			clientFieldErrors = next;
		}
		if (serverFieldErrors[fieldKey]) {
			const next = { ...serverFieldErrors };
			delete next[fieldKey];
			serverFieldErrors = next;
		}
		if (formError) {
			formError = '';
		}
	}

	function validateForm(): Record<string, string> {
		const nextErrors: Record<string, string> = {};

		if (!form.name.trim()) nextErrors['season.name'] = 'Season name is required.';
		if (!form.slug.trim()) nextErrors['season.slug'] = 'Season slug is required.';
		if (!form.startDate.trim()) nextErrors['season.startDate'] = 'Season start date is required.';
		if (form.endDate.trim() && form.endDate < form.startDate) {
			nextErrors['season.endDate'] = 'Season end date must be on or after season start date.';
		}

		return nextErrors;
	}

	function requestClose(): void {
		if (isSubmitting) return;
		if (dirtyState.isDirty(currentSnapshot())) {
			unsavedConfirmOpen = true;
			return;
		}
		dispatch('close');
	}

	function handleNameInput(value: string): void {
		form.name = value;
		clearFieldError('season.name');
		if (!slugTouched) {
			form.slug = slugifyFinal(value);
			clearFieldError('season.slug');
		}

		const inferredRange = inferAcademicSeasonRangeFromName(value);
		if (inferredRange) {
			if (!startDateTouched) {
				form.startDate = inferredRange.startDate;
				clearFieldError('season.startDate');
			}
			if (!endDateTouched) {
				form.endDate = inferredRange.endDate;
				clearFieldError('season.endDate');
			}
			return;
		}

		if (!endDateTouched) {
			form.endDate = resolveAcademicSeasonEndDate(value, form.startDate);
			clearFieldError('season.endDate');
		}
	}

	function handleStartDateInput(value: string): void {
		startDateTouched = true;
		form.startDate = value;
		clearFieldError('season.startDate');
		if (!endDateTouched) {
			form.endDate = resolveAcademicSeasonEndDate(form.name, value);
			clearFieldError('season.endDate');
		}
	}

	async function submit(): Promise<void> {
		if (isSubmitting) return;

		clientFieldErrors = validateForm();
		serverFieldErrors = {};
		if (Object.keys(clientFieldErrors).length > 0) {
			formError = 'Fix the highlighted season fields and try again.';
			return;
		}

		isSubmitting = true;
		formError = '';

		try {
			const response = await fetch('/api/intramural-sports/seasons', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					season: {
						name: form.name.trim(),
						slug: slugifyFinal(form.slug),
						startDate: form.startDate,
						endDate: form.endDate.trim() || null,
						isCurrent: form.isCurrent,
						isActive: form.isActive
					},
					currentSeasonTransition:
						form.isCurrent && existingCurrentSeason
							? {
									clearExistingCurrent: true,
									deactivateExistingCurrent
								}
							: undefined
				})
			});

			let body: CreateSeasonApiResponse | null = null;
			try {
				body = (await response.json()) as CreateSeasonApiResponse;
			} catch {
				body = null;
			}

			if (!response.ok || !body?.success || !body.data?.season?.id) {
				serverFieldErrors = toServerFieldErrorMap(body?.fieldErrors);
				formError = body?.error ?? 'Unable to create the season right now.';
				isSubmitting = false;
				return;
			}

			toast.success(`Created ${body.data.season.name}.`, {
				title: 'Season created'
			});
			dispatch('saved', {
				selectedSeasonId: body.data.season.id
			});
		} catch (error) {
			console.error('Failed to create season from dashboard:', error);
			formError = 'Unable to create the season right now.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<CreateSeasonWizard
	{open}
	step={1}
	stepCount={1}
	stepTitle={STEP_TITLE}
	stepProgress={100}
	{formError}
	{unsavedConfirmOpen}
	onRequestClose={requestClose}
	onSubmit={() => {
		void submit();
	}}
	onInput={() => {
		formError = '';
	}}
	onUnsavedConfirm={() => {
		unsavedConfirmOpen = false;
		dispatch('close');
	}}
	onUnsavedCancel={() => {
		unsavedConfirmOpen = false;
	}}
>
	<div class="space-y-4">
		<div class="grid gap-4 md:grid-cols-2">
			<div class="md:col-span-2">
				<label class="mb-1 block text-sm font-sans text-neutral-950" for="dashboard-season-name">
					Season Name <span class="text-error-700">*</span>
				</label>
				<input
					id="dashboard-season-name"
					class="input-secondary"
					type="text"
					placeholder="Spring 2027"
					value={form.name}
					oninput={(event) => {
						handleNameInput(event.currentTarget.value);
					}}
				/>
				{#if combinedFieldErrors['season.name']}
					<p class="mt-1 text-xs text-error-700">{combinedFieldErrors['season.name']}</p>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-sm font-sans text-neutral-950" for="dashboard-season-slug">
					Season Slug <span class="text-error-700">*</span>
				</label>
				<input
					id="dashboard-season-slug"
					class="input-secondary"
					type="text"
					placeholder="spring-2027"
					value={form.slug}
					oninput={(event) => {
						slugTouched = true;
						form.slug = applyLiveSlugInput(event.currentTarget);
						clearFieldError('season.slug');
					}}
				/>
				{#if combinedFieldErrors['season.slug']}
					<p class="mt-1 text-xs text-error-700">{combinedFieldErrors['season.slug']}</p>
				{/if}
			</div>

			<div class="rounded border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700">
				<p class="font-semibold text-neutral-950">Slug preview</p>
				<p class="mt-1 break-all">{slugifyFinal(form.slug || form.name) || 'season-slug'}</p>
			</div>

			<div>
				<label class="mb-1 block text-sm font-sans text-neutral-950" for="dashboard-season-start">
					Start Date <span class="text-error-700">*</span>
				</label>
				<input
					id="dashboard-season-start"
					class="input-secondary"
					type="date"
					value={form.startDate}
					oninput={(event) => {
						handleStartDateInput(event.currentTarget.value);
					}}
				/>
				{#if combinedFieldErrors['season.startDate']}
					<p class="mt-1 text-xs text-error-700">{combinedFieldErrors['season.startDate']}</p>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-sm font-sans text-neutral-950" for="dashboard-season-end">
					End Date
				</label>
				<input
					id="dashboard-season-end"
					class="input-secondary"
					type="date"
					value={form.endDate}
					oninput={(event) => {
						endDateTouched = true;
						form.endDate = event.currentTarget.value;
						clearFieldError('season.endDate');
					}}
				/>
				{#if combinedFieldErrors['season.endDate']}
					<p class="mt-1 text-xs text-error-700">{combinedFieldErrors['season.endDate']}</p>
				{/if}
			</div>
		</div>

		<div class="grid gap-3 md:grid-cols-2">
			<label class="flex items-start gap-2 rounded border border-neutral-300 bg-white px-3 py-3">
				<input
					class="checkbox-secondary mt-0.5"
					type="checkbox"
					bind:checked={form.isCurrent}
					onchange={() => {
						formError = '';
					}}
				/>
				<span class="text-sm text-neutral-950">
					<span class="block font-semibold">Set as Current Season</span>
					<span class="block text-xs text-neutral-700">
						New registrations and dashboard defaults will use this season.
					</span>
				</span>
			</label>

			<label class="flex items-start gap-2 rounded border border-neutral-300 bg-white px-3 py-3">
				<input
					class="checkbox-secondary mt-0.5"
					type="checkbox"
					bind:checked={form.isActive}
					onchange={() => {
						formError = '';
					}}
				/>
				<span class="text-sm text-neutral-950">
					<span class="block font-semibold">Keep Season Active</span>
					<span class="block text-xs text-neutral-700">
						Inactive seasons stay in history but are treated as archived.
					</span>
				</span>
			</label>
		</div>

		{#if form.isCurrent && existingCurrentSeason}
			<div class="space-y-3 rounded border border-neutral-950 bg-white p-4">
				<div>
					<p class="text-sm font-semibold text-neutral-950">Current Season Transition</p>
					<p class="mt-1 text-xs text-neutral-700">
						"{existingCurrentSeason.name}" will stop being the current season when this one is created.
					</p>
				</div>

				<label class="flex items-start gap-2 text-sm text-neutral-950">
					<input class="checkbox-secondary mt-0.5" type="checkbox" bind:checked={deactivateExistingCurrent} />
					<span>Also mark "{existingCurrentSeason.name}" as inactive.</span>
				</label>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<WizardStepFooter
			step={1}
			lastStep={1}
			showBack={false}
			canGoNext={false}
			canSubmit={!isSubmitting}
			nextLabel="Next"
			submitLabel="Create Season"
			submittingLabel="Creating..."
			{isSubmitting}
		/>
	{/snippet}
</CreateSeasonWizard>
