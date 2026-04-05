<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import {
		IconEdit,
		IconPlus,
		IconTrash,
		IconUsers
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		buildRecipientBuilderPreviewRequestGroups,
		buildRecipientBuilderPreviewSignature,
		RECIPIENT_BUILDER_ADDITIONAL_FILTERS
	} from '$lib/communications/recipient-builder.js';
	import {
		WizardModal,
		WizardUnsavedConfirm,
		createWizardDirtyState
	} from '$lib/components/wizard';
	import {
		EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
		type CommunicationFilterOptions,
		type CommunicationRecipientGroupDraft,
		type CommunicationRecipientGroupFilter,
		type CommunicationRecipientGroupMode,
		type CommunicationRecipientPreview
	} from '$lib/communications/types.js';
	import { toast } from '$lib/toasts';

	type FilterKey = keyof CommunicationRecipientGroupFilter;

	interface RecipientGroupFormState {
		id: string | null;
		mode: CommunicationRecipientGroupMode;
		filters: CommunicationRecipientGroupFilter;
	}

	interface RecipientBuilderSnapshot {
		recipientGroups: CommunicationRecipientGroupDraft[];
		recipientGroupForm: RecipientGroupFormState;
	}

	interface Props {
		open: boolean;
		filterOptions: CommunicationFilterOptions;
		initialRecipientGroups: CommunicationRecipientGroupDraft[];
		initialPreview: CommunicationRecipientPreview;
		onPreviewRequest: (nextRecipientGroups: Array<{
			id: string;
			mode: CommunicationRecipientGroupMode;
			filters: CommunicationRecipientGroupFilter;
		}>) => Promise<{
			recipientGroups: CommunicationRecipientGroupDraft[];
			preview: CommunicationRecipientPreview;
		}>;
		onApply: (payload: {
			recipientGroups: CommunicationRecipientGroupDraft[];
			preview: CommunicationRecipientPreview;
		}) => void;
		onRequestClose: () => void;
	}

	let {
		open,
		filterOptions,
		initialRecipientGroups,
		initialPreview,
		onPreviewRequest,
		onApply,
		onRequestClose
	}: Props = $props();

	const DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2';

	const dirtyState = createWizardDirtyState<RecipientBuilderSnapshot>();

	let draftRecipientGroups = $state<CommunicationRecipientGroupDraft[]>([]);
	let recipientGroupForm = $state<RecipientGroupFormState>({
		id: null,
		mode: 'include',
		filters: { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER }
	});
	let preview = $state<CommunicationRecipientPreview>({ totalCount: 0, rows: [] });
	let previewSearch = $state('');
	let previewLoading = $state(false);
	let unsavedConfirmOpen = $state(false);
	let previewSyncSignature = $state('');
	let previewRequestNonce = 0;

	const modalSignature = $derived.by(() =>
		JSON.stringify({
			open,
			initialRecipientGroups,
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
				!recipientGroupForm.filters.seasonId ||
				offering.seasonId === recipientGroupForm.filters.seasonId
		)
	]);
	const leagueOptions = $derived.by(() => [
		{ value: '', label: 'All Leagues' },
		...(filterOptions.leagues ?? []).filter(
			(league) =>
				(!recipientGroupForm.filters.seasonId ||
					league.seasonId === recipientGroupForm.filters.seasonId) &&
				(!recipientGroupForm.filters.offeringId ||
					league.offeringId === recipientGroupForm.filters.offeringId)
		)
	]);
	const divisionOptions = $derived.by(() => [
		{ value: '', label: 'All Divisions' },
		...(filterOptions.divisions ?? []).filter(
			(division) =>
				!recipientGroupForm.filters.leagueId ||
				division.leagueId === recipientGroupForm.filters.leagueId
		)
	]);
	const teamOptions = $derived.by(() => [
		{ value: '', label: 'All Teams' },
		...(filterOptions.teams ?? []).filter(
			(team) =>
				!recipientGroupForm.filters.divisionId ||
				team.divisionId === recipientGroupForm.filters.divisionId
		)
	]);

	const snapshot = $derived.by<RecipientBuilderSnapshot>(() => ({
		recipientGroups: draftRecipientGroups.map((recipientGroup) => ({
			...recipientGroup,
			filters: { ...recipientGroup.filters }
		})),
		recipientGroupForm: {
			id: recipientGroupForm.id,
			mode: recipientGroupForm.mode,
			filters: { ...recipientGroupForm.filters }
		}
	}));

	const isDirty = $derived.by(() => open && dirtyState.isDirty(snapshot));
	const livePreviewRequestGroups = $derived.by(() =>
		buildRecipientBuilderPreviewRequestGroups({
			draftRecipientGroups,
			recipientGroupForm
		})
	);
	const livePreviewSignature = $derived.by(() =>
		buildRecipientBuilderPreviewSignature(livePreviewRequestGroups)
	);
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

	const cloneRecipientGroups = (
		recipientGroups: CommunicationRecipientGroupDraft[]
	): CommunicationRecipientGroupDraft[] =>
		recipientGroups.map((recipientGroup) => ({
			...recipientGroup,
			filters: { ...recipientGroup.filters }
		}));

	const clonePreview = (
		nextPreview: CommunicationRecipientPreview
	): CommunicationRecipientPreview => ({
		totalCount: nextPreview.totalCount,
		rows: nextPreview.rows.map((row) => ({ ...row }))
	});

	function createRecipientGroupId(): string {
		return crypto.randomUUID();
	}

	function resetRecipientGroupForm(): void {
		recipientGroupForm = {
			id: null,
			mode: 'include',
			filters: { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER }
		};
	}

	function beginSession(): void {
		draftRecipientGroups = cloneRecipientGroups(initialRecipientGroups ?? []);
		preview = clonePreview(initialPreview ?? { totalCount: 0, rows: [] });
		previewSearch = '';
		previewLoading = false;
		unsavedConfirmOpen = false;
		previewRequestNonce += 1;
		resetRecipientGroupForm();
		previewSyncSignature = buildRecipientBuilderPreviewSignature(
			buildRecipientBuilderPreviewRequestGroups({
				draftRecipientGroups: initialRecipientGroups ?? [],
				recipientGroupForm: {
					id: null,
					mode: 'include',
					filters: { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER }
				}
			})
		);
		dirtyState.captureBaseline({
			recipientGroups: cloneRecipientGroups(initialRecipientGroups ?? []),
			recipientGroupForm: {
				id: null,
				mode: 'include',
				filters: { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER }
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
			previewRequestNonce += 1;
		}
	});

	$effect(() => {
		if (!open) return;
		const nextSignature = livePreviewSignature;
		if (nextSignature === previewSyncSignature) {
			return;
		}

		const nextGroups = livePreviewRequestGroups.map((recipientGroup) => ({
			id: recipientGroup.id,
			mode: recipientGroup.mode,
			filters: { ...recipientGroup.filters }
		}));
		const requestNonce = previewRequestNonce + 1;
		previewRequestNonce = requestNonce;

		const timeoutId = setTimeout(async () => {
			previewLoading = true;
			try {
				const result = await onPreviewRequest(nextGroups);
				if (!open || previewRequestNonce !== requestNonce) return;
				preview = clonePreview(result.preview);
				previewSyncSignature = nextSignature;
			} catch (error) {
				if (previewRequestNonce !== requestNonce) return;
				toast.error(
					error instanceof Error ? error.message : 'Unable to refresh the preview.',
					{ id: 'recipient-builder-preview-error' }
				);
			} finally {
				if (previewRequestNonce === requestNonce) {
					previewLoading = false;
				}
			}
		}, 250);

		return () => {
			clearTimeout(timeoutId);
		};
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
		recipientGroupForm = {
			...recipientGroupForm,
			filters: {
				...recipientGroupForm.filters,
				[key]: value,
				...(key === 'seasonId' ? { offeringId: '', leagueId: '', divisionId: '', teamId: '' } : {}),
				...(key === 'offeringId' ? { leagueId: '', divisionId: '', teamId: '' } : {}),
				...(key === 'leagueId' ? { divisionId: '', teamId: '' } : {}),
				...(key === 'divisionId' ? { teamId: '' } : {})
			}
		};
	}

	async function requestPreview(
		nextRecipientGroups: Array<{
			id: string;
			mode: CommunicationRecipientGroupMode;
			filters: CommunicationRecipientGroupFilter;
		}>
	): Promise<CommunicationRecipientGroupDraft[] | null> {
		previewLoading = true;
		try {
			const result = await onPreviewRequest(nextRecipientGroups);
			preview = clonePreview(result.preview);
			return cloneRecipientGroups(result.recipientGroups);
		} finally {
			previewLoading = false;
		}
	}

	async function applyRecipientGroup(): Promise<void> {
		try {
			previewRequestNonce += 1;
			const targetId = recipientGroupForm.id ?? createRecipientGroupId();
			const normalized = await requestPreview([
				...draftRecipientGroups
					.filter((recipientGroup) => recipientGroup.id !== recipientGroupForm.id)
					.map((recipientGroup) => ({
						id: recipientGroup.id,
						mode: recipientGroup.mode,
						filters: recipientGroup.filters
					})),
				{
					id: targetId,
					mode: recipientGroupForm.mode,
					filters: recipientGroupForm.filters
				}
			]);
			if (!normalized) return;
			const nextFormState: RecipientGroupFormState = {
				id: null,
				mode: 'include',
				filters: { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER }
			};
			draftRecipientGroups = normalized;
			recipientGroupForm = nextFormState;
			previewSyncSignature = buildRecipientBuilderPreviewSignature(
				buildRecipientBuilderPreviewRequestGroups({
					draftRecipientGroups: normalized,
					recipientGroupForm: nextFormState
				})
			);
			toast.success('Recipient group updated.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to update the recipient group.');
		}
	}

	async function removeRecipientGroup(recipientGroupId: string): Promise<void> {
		try {
			previewRequestNonce += 1;
			const nextFormState: RecipientGroupFormState =
				recipientGroupForm.id === recipientGroupId
					? {
							id: null,
							mode: 'include',
							filters: { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER }
						}
					: recipientGroupForm;
			const remaining = draftRecipientGroups
				.filter((recipientGroup) => recipientGroup.id !== recipientGroupId)
				.map((recipientGroup) => ({
					id: recipientGroup.id,
					mode: recipientGroup.mode,
					filters: recipientGroup.filters
				}));
			if (remaining.length === 0) {
				draftRecipientGroups = [];
				preview = { totalCount: 0, rows: [] };
				recipientGroupForm = nextFormState;
				previewSyncSignature = buildRecipientBuilderPreviewSignature(
					buildRecipientBuilderPreviewRequestGroups({
						draftRecipientGroups: [],
						recipientGroupForm: nextFormState
					})
				);
				return;
			}
			const normalized = await requestPreview(remaining);
			if (normalized) {
				draftRecipientGroups = normalized;
				recipientGroupForm = nextFormState;
				previewSyncSignature = buildRecipientBuilderPreviewSignature(
					buildRecipientBuilderPreviewRequestGroups({
						draftRecipientGroups: normalized,
						recipientGroupForm: nextFormState
					})
				);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to remove this recipient group.');
		}
	}

	function startEditingRecipientGroup(recipientGroup: CommunicationRecipientGroupDraft): void {
		recipientGroupForm = {
			id: recipientGroup.id,
			mode: recipientGroup.mode,
			filters: { ...recipientGroup.filters }
		};
	}

	function submitBuilder(): void {
		onApply({
			recipientGroups: cloneRecipientGroups(draftRecipientGroups),
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
	maxWidthClass="max-w-[96rem]"
	formClass="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4"
	on:requestClose={requestClose}
	on:submit={submitBuilder}
>
	<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
		<div class="min-h-0">
			<div class="flex h-full min-h-0 flex-col border border-neutral-950 bg-white p-4">
				<div class="min-h-0 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Recipient group mode
							</p>
							<ListboxDropdown
								options={[
									{ value: 'include', label: 'Include recipients' },
									{ value: 'exclude', label: 'Exclude recipients' }
								]}
								value={recipientGroupForm.mode}
								ariaLabel="Recipient group mode"
								buttonClass={DROPDOWN_BUTTON_CLASS}
								on:change={(event) => {
									recipientGroupForm = {
										...recipientGroupForm,
										mode: event.detail.value as CommunicationRecipientGroupMode
									};
								}}
							/>
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Member Search
							</p>
							<SearchInput
								id="communication-recipient-member-search"
								label="Search members"
								value={recipientGroupForm.filters.memberQuery}
								placeholder="Search by name, email, or student ID"
								inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm"
								clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
								on:input={(event) => updateFilter('memberQuery', event.detail.value)}
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Member Role</p>
							<ListboxDropdown options={memberRoleOptions} value={recipientGroupForm.filters.memberRole} ariaLabel="Filter by member role" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('memberRole', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Gender</p>
							<ListboxDropdown options={memberSexOptions.map((option) => option.value === '' ? { ...option, label: 'All Genders' } : option)} value={recipientGroupForm.filters.memberSex} ariaLabel="Filter by gender" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('memberSex', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Season</p>
							<ListboxDropdown options={seasonOptions} value={recipientGroupForm.filters.seasonId} ariaLabel="Filter by season" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('seasonId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Offering</p>
							<ListboxDropdown options={offeringOptions} value={recipientGroupForm.filters.offeringId} ariaLabel="Filter by offering" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('offeringId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">League</p>
							<ListboxDropdown options={leagueOptions} value={recipientGroupForm.filters.leagueId} ariaLabel="Filter by league" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('leagueId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Division</p>
							<ListboxDropdown options={divisionOptions} value={recipientGroupForm.filters.divisionId} ariaLabel="Filter by division" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('divisionId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Team</p>
							<ListboxDropdown options={teamOptions} value={recipientGroupForm.filters.teamId} ariaLabel="Filter by team" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('teamId', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Roster Role
							</p>
							<ListboxDropdown options={rosterRoleOptions} value={recipientGroupForm.filters.rosterRole} ariaLabel="Filter by roster role" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('rosterRole', event.detail.value)} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
								Team Status
							</p>
							<ListboxDropdown options={teamStatusOptions} value={recipientGroupForm.filters.teamStatus} ariaLabel="Filter by team status" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('teamStatus', event.detail.value)} />
						</div>
					</div>

					<div class="space-y-3">
						<div class="flex items-center justify-between gap-3">
							<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">
								Additional Filters
							</h3>
							<p class="text-xs text-neutral-700">
								Unavailable filters are shown but disabled until they are wired up.
							</p>
						</div>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
							{#each RECIPIENT_BUILDER_ADDITIONAL_FILTERS as additionalFilter}
								<div class="space-y-2">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										{additionalFilter.label}
									</p>
									<ListboxDropdown
										options={additionalFilter.options}
										value=""
										ariaLabel={additionalFilter.label}
										buttonClass={DROPDOWN_BUTTON_CLASS}
										disabled={additionalFilter.disabled}
									/>
								</div>
							{/each}
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<button type="button" class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={applyRecipientGroup}>
							<IconPlus class="h-4 w-4" />
							<span>{recipientGroupForm.id ? 'Update Recipient Group' : 'Add Recipient Group'}</span>
						</button>
						{#if recipientGroupForm.id}
							<button type="button" class="button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={resetRecipientGroupForm}>
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
							Saved Recipient Groups
						</h3>
						<IconUsers class="h-4 w-4 text-neutral-700" />
					</div>
					<div class="mt-3 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
						{#if draftRecipientGroups.length === 0}
							<div class="border border-neutral-950 bg-neutral-50 p-4 text-sm text-neutral-700">
								No recipient groups yet.
							</div>
						{:else}
							<div class="space-y-3">
								{#each draftRecipientGroups as recipientGroup}
									<div class="section-card p-3 space-y-3">
										<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
											<div class="space-y-2">
												<div class="flex flex-wrap items-center gap-2">
													<span class={`border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${recipientGroup.mode === 'include' ? 'border-primary-700 bg-primary text-primary-foreground' : 'border-warning-700 bg-warning-100 text-neutral-950'}`}>
														{recipientGroup.mode}
													</span>
													<span class="border border-secondary-300 px-2 py-1 text-[11px] font-bold uppercase tracking-wide">
														{recipientGroup.resolvedRecipientCount} recipients
													</span>
												</div>
												<p class="text-sm text-neutral-950">{recipientGroup.summaryText}</p>
											</div>
											<div class="flex items-center gap-2">
												<HoverTooltip text="Edit recipient group">
													<button type="button" class="button-secondary-outlined dashboard-icon-button cursor-pointer" aria-label="Edit recipient group" onclick={() => startEditingRecipientGroup(recipientGroup)}>
														<IconEdit class="h-4 w-4" />
													</button>
												</HoverTooltip>
												<HoverTooltip text="Remove recipient group">
													<button type="button" class="button-neutral-outlined dashboard-icon-button cursor-pointer" aria-label="Remove recipient group" onclick={() => void removeRecipientGroup(recipientGroup.id)}>
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
				<div class="flex shrink-0 flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
					<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">
						Recipient Preview
					</h3>
					<div class="w-full md:max-w-xs">
						<SearchInput
							id="communication-recipient-preview-search"
							label="Search previewed recipients"
							value={previewSearch}
							placeholder="Search preview list"
							inputClass="input-neutral min-h-9 pl-9 pr-9 py-1.5 text-sm"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer"
							on:input={(event) => {
								previewSearch = event.detail.value;
							}}
						/>
					</div>
				</div>
				<div class="mt-2 min-h-0 flex-1 overflow-auto border border-neutral-950 bg-white">
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
				<p class="pt-2 text-right text-sm text-neutral-700">
					{preview.totalCount} recipients
				</p>
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="pt-2 border-t border-neutral-950 flex justify-end">
			<div class="flex flex-wrap items-center justify-end gap-2">
				<button
					type="submit"
					class="button-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={draftRecipientGroups.length === 0 || previewLoading}
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
