<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import {
		IconEdit,
		IconPlus,
		IconRefresh,
		IconTrash,
		IconUsers
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		WizardModal,
		WizardUnsavedConfirm,
		createWizardDirtyState
	} from '$lib/components/wizard';
	import {
		EMPTY_COMMUNICATION_BATCH_FILTER,
		type CommunicationBatchDraft,
		type CommunicationBatchFilter,
		type CommunicationBatchMode,
		type CommunicationFilterOptions,
		type CommunicationRecipientPreview
	} from '$lib/communications/types.js';
	import { toast } from '$lib/toasts';

	type FilterKey = keyof CommunicationBatchFilter;

	interface BatchFormState {
		id: string | null;
		mode: CommunicationBatchMode;
		filters: CommunicationBatchFilter;
	}

	interface RecipientBuilderSnapshot {
		batches: CommunicationBatchDraft[];
		batchForm: BatchFormState;
	}

	interface Props {
		open: boolean;
		filterOptions: CommunicationFilterOptions;
		initialBatches: CommunicationBatchDraft[];
		initialPreview: CommunicationRecipientPreview;
		onPreviewRequest: (nextBatches: Array<{
			id: string;
			mode: CommunicationBatchMode;
			filters: CommunicationBatchFilter;
		}>) => Promise<{
			batches: CommunicationBatchDraft[];
			preview: CommunicationRecipientPreview;
		}>;
		onApply: (payload: {
			batches: CommunicationBatchDraft[];
			preview: CommunicationRecipientPreview;
		}) => void;
		onRequestClose: () => void;
	}

	let {
		open,
		filterOptions,
		initialBatches,
		initialPreview,
		onPreviewRequest,
		onApply,
		onRequestClose
	}: Props = $props();

	const DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2';

	const dirtyState = createWizardDirtyState<RecipientBuilderSnapshot>();

	let draftBatches = $state<CommunicationBatchDraft[]>([]);
	let batchForm = $state<BatchFormState>({
		id: null,
		mode: 'include',
		filters: { ...EMPTY_COMMUNICATION_BATCH_FILTER }
	});
	let preview = $state<CommunicationRecipientPreview>({ totalCount: 0, rows: [] });
	let previewSearch = $state('');
	let previewLoading = $state(false);
	let unsavedConfirmOpen = $state(false);
	let openSession = $state(0);

	const modalSignature = $derived.by(() =>
		JSON.stringify({
			open,
			openSession,
			initialBatches,
			initialPreview
		})
	);

	const memberRoleOptions = $derived.by(() => filterOptions.memberRoles ?? []);
	const memberSexOptions = $derived.by(() => filterOptions.memberSexes ?? []);
	const rosterRoleOptions = $derived.by(() => filterOptions.rosterRoles ?? []);
	const teamStatusOptions = $derived.by(() => filterOptions.teamStatuses ?? []);
	const seasonOptions = $derived.by(() => [
		{ value: '', label: 'All Seasons' },
		...(filterOptions.seasons ?? [])
	]);
	const offeringOptions = $derived.by(() => [
		{ value: '', label: 'All Offerings' },
		...(filterOptions.offerings ?? []).filter(
			(offering) =>
				!batchForm.filters.seasonId || offering.seasonId === batchForm.filters.seasonId
		)
	]);
	const leagueOptions = $derived.by(() => [
		{ value: '', label: 'All Leagues' },
		...(filterOptions.leagues ?? []).filter(
			(league) =>
				(!batchForm.filters.seasonId || league.seasonId === batchForm.filters.seasonId) &&
				(!batchForm.filters.offeringId || league.offeringId === batchForm.filters.offeringId)
		)
	]);
	const divisionOptions = $derived.by(() => [
		{ value: '', label: 'All Divisions' },
		...(filterOptions.divisions ?? []).filter(
			(division) => !batchForm.filters.leagueId || division.leagueId === batchForm.filters.leagueId
		)
	]);
	const teamOptions = $derived.by(() => [
		{ value: '', label: 'All Teams' },
		...(filterOptions.teams ?? []).filter(
			(team) => !batchForm.filters.divisionId || team.divisionId === batchForm.filters.divisionId
		)
	]);

	const snapshot = $derived.by<RecipientBuilderSnapshot>(() => ({
		batches: draftBatches.map((batch) => ({
			...batch,
			filters: { ...batch.filters }
		})),
		batchForm: {
			id: batchForm.id,
			mode: batchForm.mode,
			filters: { ...batchForm.filters }
		}
	}));

	const isDirty = $derived.by(() => open && dirtyState.isDirty(snapshot));
	const visiblePreviewRows = $derived.by(() => {
		const query = previewSearch.trim().toLowerCase();
		if (!query) {
			return preview.rows;
		}
		return preview.rows.filter((row) =>
			[
				row.fullName,
				row.email,
				row.teamName ?? '',
				row.divisionName ?? '',
				row.leagueName ?? '',
				row.offeringName ?? '',
				row.seasonName ?? ''
			]
				.join(' ')
				.toLowerCase()
				.includes(query)
		);
	});

	const cloneBatches = (batches: CommunicationBatchDraft[]): CommunicationBatchDraft[] =>
		batches.map((batch) => ({
			...batch,
			filters: { ...batch.filters }
		}));

	const clonePreview = (
		nextPreview: CommunicationRecipientPreview
	): CommunicationRecipientPreview => ({
		totalCount: nextPreview.totalCount,
		rows: nextPreview.rows.map((row) => ({ ...row }))
	});

	function createBatchId(): string {
		return crypto.randomUUID();
	}

	function resetBatchForm(): void {
		batchForm = {
			id: null,
			mode: 'include',
			filters: { ...EMPTY_COMMUNICATION_BATCH_FILTER }
		};
	}

	function beginSession(): void {
		draftBatches = cloneBatches(initialBatches ?? []);
		preview = clonePreview(initialPreview ?? { totalCount: 0, rows: [] });
		previewSearch = '';
		previewLoading = false;
		unsavedConfirmOpen = false;
		resetBatchForm();
		dirtyState.captureBaseline({
			batches: cloneBatches(initialBatches ?? []),
			batchForm: {
				id: null,
				mode: 'include',
				filters: { ...EMPTY_COMMUNICATION_BATCH_FILTER }
			}
		});
	}

	$effect(() => {
		const signature = modalSignature;
		if (!signature || !open) {
			return;
		}
		beginSession();
	});

	$effect(() => {
		if (!open) {
			previewLoading = false;
			unsavedConfirmOpen = false;
		}
	});

	beforeNavigate((navigation) => {
		if (typeof window === 'undefined' || !isDirty || !open || navigation.willUnload) return;
		if (
			window.confirm(
				'You have unsaved recipient builder changes. Leave this page and discard those changes?'
			)
		) {
			return;
		}
		navigation.cancel();
	});

	$effect(() => {
		if (typeof window === 'undefined' || !open || !isDirty) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function requestClose(): void {
		if (isDirty) {
			unsavedConfirmOpen = true;
			return;
		}
		onRequestClose();
	}

	function updateFilter(key: FilterKey, value: string): void {
		batchForm = {
			...batchForm,
			filters: {
				...batchForm.filters,
				[key]: value,
				...(key === 'seasonId' ? { offeringId: '', leagueId: '', divisionId: '', teamId: '' } : {}),
				...(key === 'offeringId' ? { leagueId: '', divisionId: '', teamId: '' } : {}),
				...(key === 'leagueId' ? { divisionId: '', teamId: '' } : {}),
				...(key === 'divisionId' ? { teamId: '' } : {})
			}
		};
	}

	async function requestPreview(
		nextBatches: Array<{ id: string; mode: CommunicationBatchMode; filters: CommunicationBatchFilter }>
	): Promise<CommunicationBatchDraft[] | null> {
		previewLoading = true;
		try {
			const result = await onPreviewRequest(nextBatches);
			preview = clonePreview(result.preview);
			return cloneBatches(result.batches);
		} finally {
			previewLoading = false;
		}
	}

	async function applyBatch(): Promise<void> {
		try {
			const targetId = batchForm.id ?? createBatchId();
			const normalized = await requestPreview([
				...draftBatches
					.filter((batch) => batch.id !== batchForm.id)
					.map((batch) => ({ id: batch.id, mode: batch.mode, filters: batch.filters })),
				{ id: targetId, mode: batchForm.mode, filters: batchForm.filters }
			]);
			if (!normalized) return;
			draftBatches = normalized;
			resetBatchForm();
			toast.success('Recipient batch updated.');
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Unable to update the recipient batch.'
			);
		}
	}

	async function removeBatch(batchId: string): Promise<void> {
		try {
			const remaining = draftBatches
				.filter((batch) => batch.id !== batchId)
				.map((batch) => ({ id: batch.id, mode: batch.mode, filters: batch.filters }));
			if (remaining.length === 0) {
				draftBatches = [];
				preview = { totalCount: 0, rows: [] };
				resetBatchForm();
				return;
			}
			const normalized = await requestPreview(remaining);
			if (normalized) {
				draftBatches = normalized;
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to remove this batch.');
		}
	}

	async function refreshPreview(): Promise<void> {
		try {
			const normalized = await requestPreview(
				draftBatches.map((batch) => ({
					id: batch.id,
					mode: batch.mode,
					filters: batch.filters
				}))
			);
			if (normalized) {
				draftBatches = normalized;
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to refresh the preview.');
		}
	}

	function startEditingBatch(batch: CommunicationBatchDraft): void {
		batchForm = {
			id: batch.id,
			mode: batch.mode,
			filters: { ...batch.filters }
		};
	}

	function submitBuilder(): void {
		onApply({
			batches: cloneBatches(draftBatches),
			preview: clonePreview(preview)
		});
	}
</script>

<WizardModal
	{open}
	title="Recipient Builder"
	step={1}
	stepCount={1}
	stepTitle="Build recipients"
	progressPercent={100}
	closeAriaLabel="Close recipient builder"
	maxWidthClass="max-w-6xl"
	formClass="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4"
	on:requestClose={requestClose}
	on:submit={submitBuilder}
>
	<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
		<div class="min-h-0">
			<div class="flex h-full min-h-0 flex-col border border-neutral-950 bg-white p-4">
				<div class="min-h-0 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Batch mode</p>
							<ListboxDropdown
								options={[
									{ value: 'include', label: 'Include recipients' },
									{ value: 'exclude', label: 'Exclude recipients' }
								]}
								value={batchForm.mode}
								ariaLabel="Batch mode"
								buttonClass={DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									batchForm = {
										...batchForm,
										mode: event.detail.value as CommunicationBatchMode
									};
								}}
							/>
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Member search
							</p>
							<SearchInput
								id="communication-recipient-member-search"
								label="Search members"
								value={batchForm.filters.memberQuery}
								placeholder="Search by name, email, or student ID"
								inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm"
								clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
								on:input={(event) => updateFilter('memberQuery', event.detail.value)}
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Member role</p>
							<ListboxDropdown options={memberRoleOptions} value={batchForm.filters.memberRole} ariaLabel="Filter by member role" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('memberRole', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Sex</p>
							<ListboxDropdown options={memberSexOptions} value={batchForm.filters.memberSex} ariaLabel="Filter by sex" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('memberSex', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Season</p>
							<ListboxDropdown options={seasonOptions} value={batchForm.filters.seasonId} ariaLabel="Filter by season" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('seasonId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Offering</p>
							<ListboxDropdown options={offeringOptions} value={batchForm.filters.offeringId} ariaLabel="Filter by offering" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('offeringId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">League</p>
							<ListboxDropdown options={leagueOptions} value={batchForm.filters.leagueId} ariaLabel="Filter by league" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('leagueId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Division</p>
							<ListboxDropdown options={divisionOptions} value={batchForm.filters.divisionId} ariaLabel="Filter by division" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('divisionId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Team</p>
							<ListboxDropdown options={teamOptions} value={batchForm.filters.teamId} ariaLabel="Filter by team" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('teamId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Roster role
							</p>
							<ListboxDropdown options={rosterRoleOptions} value={batchForm.filters.rosterRole} ariaLabel="Filter by roster role" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('rosterRole', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Team status
							</p>
							<ListboxDropdown options={teamStatusOptions} value={batchForm.filters.teamStatus} ariaLabel="Filter by team status" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('teamStatus', event.detail.value)} />
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<button type="button" class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={applyBatch}>
							<IconPlus class="h-4 w-4" />
							<span>{batchForm.id ? 'Update Batch' : 'Add Batch'}</span>
						</button>
						<button type="button" class="button-secondary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={refreshPreview} disabled={previewLoading || draftBatches.length === 0}>
							<IconRefresh class="h-4 w-4" />
							<span>{previewLoading ? 'Refreshing...' : 'Refresh Preview'}</span>
						</button>
						{#if batchForm.id}
							<button type="button" class="button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={resetBatchForm}>
								Cancel Edit
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class="flex min-h-0 flex-col gap-4">
			<div class="flex max-h-[min(16rem,35vh)] min-h-[10rem] flex-col border border-neutral-950 bg-white p-4">
				<div class="flex items-center gap-2">
					<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">
						Saved Batches
					</h3>
					<IconUsers class="h-4 w-4 text-neutral-700" />
				</div>
				<div class="mt-3 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
					{#if draftBatches.length === 0}
						<div class="border border-neutral-950 bg-neutral-50 p-4 text-sm text-neutral-700">
							No recipient batches yet.
						</div>
					{:else}
						<div class="space-y-3">
							{#each draftBatches as batch}
								<div class="section-card p-3 space-y-3">
									<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
										<div class="space-y-2">
											<div class="flex flex-wrap items-center gap-2">
												<span class={`border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${batch.mode === 'include' ? 'border-primary-700 bg-primary text-primary-foreground' : 'border-warning-700 bg-warning-100 text-neutral-950'}`}>
													{batch.mode}
												</span>
												<span class="border border-secondary-300 px-2 py-1 text-[11px] font-bold uppercase tracking-wide">
													{batch.resolvedRecipientCount} recipients
												</span>
											</div>
											<p class="text-sm text-neutral-950">{batch.summaryText}</p>
										</div>
										<div class="flex items-center gap-2">
											<HoverTooltip text="Edit batch">
												<button type="button" class="button-secondary-outlined dashboard-icon-button cursor-pointer" aria-label="Edit recipient batch" onclick={() => startEditingBatch(batch)}>
													<IconEdit class="h-4 w-4" />
												</button>
											</HoverTooltip>
											<HoverTooltip text="Remove batch">
												<button type="button" class="button-neutral-outlined dashboard-icon-button cursor-pointer" aria-label="Remove recipient batch" onclick={() => void removeBatch(batch.id)}>
													<IconTrash class="h-4 w-4" />
												</button>
											</HoverTooltip>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex min-h-0 flex-1 flex-col border border-neutral-950 bg-white p-4 min-w-0">
				<div class="space-y-1 shrink-0">
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">
							Recipient Preview
						</h3>
						<InfoPopover
							title="Preview recipients"
							buttonAriaLabel="Preview recipients help"
							content="This list shows the final deduplicated audience after every include and exclude batch has been applied."
						/>
					</div>
					<p class="text-sm text-neutral-700">
						{preview.totalCount} final recipients after all include and exclude batches.
					</p>
				</div>
				<SearchInput
					id="communication-recipient-preview-search"
					label="Search previewed recipients"
					value={previewSearch}
					placeholder="Search preview list"
					inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm"
					clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
					on:input={(event) => {
						previewSearch = event.detail.value;
					}}
				/>
				<div class="min-h-0 flex-1 overflow-auto border border-neutral-950 bg-white">
					<table class="min-w-full border-collapse">
						<thead class="bg-neutral-100">
							<tr>
								<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Recipient
								</th>
								<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Email
								</th>
								<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Context
								</th>
							</tr>
						</thead>
						<tbody>
							{#if visiblePreviewRows.length === 0}
								<tr>
									<td colspan="3" class="px-3 py-6 text-sm text-neutral-700">
										No preview recipients match the current search.
									</td>
								</tr>
							{:else}
								{#each visiblePreviewRows as row}
									<tr class="border-b border-neutral-200 last:border-b-0">
										<td class="px-3 py-2 text-sm text-neutral-950">{row.fullName}</td>
										<td class="px-3 py-2 text-sm text-neutral-950">{row.email}</td>
										<td class="px-3 py-2 text-sm text-neutral-700">
											{row.teamName ??
												row.divisionName ??
												row.leagueName ??
												row.offeringName ??
												'Member filter only'}
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="pt-2 border-t border-neutral-950 flex justify-end">
			<div class="flex flex-wrap items-center justify-end gap-2">
				<button
					type="button"
					class="button-secondary-outlined cursor-pointer"
					onclick={refreshPreview}
					disabled={previewLoading || draftBatches.length === 0}
				>
					{previewLoading ? 'Refreshing...' : 'Refresh Preview'}
				</button>
				<button
					type="submit"
					class="button-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={draftBatches.length === 0 || previewLoading}
				>
					Apply Recipients
				</button>
			</div>
		</div>
	{/snippet}
</WizardModal>

<WizardUnsavedConfirm
	open={unsavedConfirmOpen}
	title="Discard recipient builder changes?"
	message="You have unsaved recipient builder changes. Closing now will discard the draft recipient setup."
	confirmLabel="Discard Changes"
	cancelLabel="Keep Editing"
	on:confirm={() => {
		unsavedConfirmOpen = false;
		onRequestClose();
	}}
	on:cancel={() => {
		unsavedConfirmOpen = false;
	}}
/>
