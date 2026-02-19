<script lang="ts">
	import IconArchive from '@tabler/icons-svelte/icons/archive';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconDeviceFloppy from '@tabler/icons-svelte/icons/device-floppy';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconRestore from '@tabler/icons-svelte/icons/restore';
	import IconTarget from '@tabler/icons-svelte/icons/target';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconX from '@tabler/icons-svelte/icons/x';
	import { createEventDispatcher, tick } from 'svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { WizardModal } from '$lib/components/wizard';

	interface SeasonOption {
		id: string;
		name: string;
		slug: string;
		startDate: string;
		endDate: string | null;
		isCurrent: boolean;
		isActive: boolean;
	}

	interface ManageSeasonResponse {
		success: boolean;
		data?: {
			currentSeasonId?: string | null;
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface DeleteSeasonResponse {
		success: boolean;
		data?: {
			currentSeasonId?: string | null;
		};
		error?: string;
		fieldErrors?: Record<string, string[] | undefined>;
	}

	interface Props {
		open: boolean;
		seasons: SeasonOption[];
		selectedSeasonId: string;
	}

	let { open, seasons, selectedSeasonId }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		saved: { selectedSeasonId?: string | null };
		duplicate: { sourceSeasonId: string };
	}>();

	let seasonId = $state('');
	let name = $state('');
	let slug = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let deleteConfirmSlug = $state('');
	let deleteReason = $state('');
	let formError = $state('');
	let formSuccess = $state('');
	let fieldErrors = $state<Record<string, string>>({});
	let isSubmitting = $state(false);
	let isDeleteModalOpen = $state(false);
	let hasInitializedForOpen = $state(false);
	let seasonSearchTerm = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);

	const sortedSeasons = $derived.by(() =>
		[...seasons].sort((a, b) => b.startDate.localeCompare(a.startDate))
	);
	const filteredSeasons = $derived.by(() => {
		const term = seasonSearchTerm.trim().toLowerCase();
		if (!term) return sortedSeasons;
		return sortedSeasons.filter((season) => {
			const searchable =
				`${season.name} ${season.slug} ${season.startDate} ${season.endDate ?? ''}`.toLowerCase();
			return searchable.includes(term);
		});
	});
	const selectedSeason = $derived.by(
		() => sortedSeasons.find((season) => season.id === seasonId) ?? null
	);
	const normalizedExpectedDeleteSlug = $derived.by(() =>
		normalizeSlug(selectedSeason?.slug || selectedSeason?.name || '')
	);
	const canDelete = $derived.by(
		() => normalizeSlug(deleteConfirmSlug) === normalizedExpectedDeleteSlug
	);
	const hasDetailChanges = $derived.by(() => {
		if (!selectedSeason) return false;
		return (
			name.trim() !== (selectedSeason.name || '').trim() ||
			slug.trim() !== (selectedSeason.slug || '').trim() ||
			startDate.trim() !== (selectedSeason.startDate || '').trim() ||
			endDate.trim() !== (selectedSeason.endDate || '').trim()
		);
	});
	const archiveActionLabel = $derived.by(() =>
		selectedSeason?.isActive ? 'Archive season' : 'Reactivate season'
	);
	const archiveHintText = $derived.by(() =>
		selectedSeason?.isActive
			? 'Mark this season inactive and hide it from public season history.'
			: 'Restore this season to active status.'
	);

	function normalizeSlug(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function hydrateFromSeason(nextSeason: SeasonOption | null): void {
		name = nextSeason?.name ?? '';
		slug = nextSeason?.slug ?? '';
		startDate = nextSeason?.startDate ?? '';
		endDate = nextSeason?.endDate ?? '';
		deleteConfirmSlug = '';
		deleteReason = '';
		fieldErrors = {};
		formError = '';
		formSuccess = '';
	}

	$effect(() => {
		if (!open) {
			hasInitializedForOpen = false;
			isDeleteModalOpen = false;
			seasonSearchTerm = '';
			return;
		}

		if (!hasInitializedForOpen) {
			const preferred =
				sortedSeasons.find((season) => season.id === selectedSeasonId) ?? sortedSeasons[0] ?? null;
			seasonId = preferred?.id ?? '';
			hydrateFromSeason(preferred);
			hasInitializedForOpen = true;
			return;
		}

		if (seasonId && sortedSeasons.some((season) => season.id === seasonId)) return;
		const fallback = sortedSeasons[0] ?? null;
		seasonId = fallback?.id ?? '';
		hydrateFromSeason(fallback);
	});

	function selectSeason(nextSeasonId: string): void {
		if (isSubmitting || nextSeasonId === seasonId) return;
		const nextSeason = sortedSeasons.find((season) => season.id === nextSeasonId) ?? null;
		if (!nextSeason) return;
		seasonId = nextSeasonId;
		isDeleteModalOpen = false;
		hydrateFromSeason(nextSeason);
		void tick().then(() => {
			nameInput?.focus();
		});
	}

	function close(): void {
		if (isSubmitting) return;
		isDeleteModalOpen = false;
		dispatch('close');
	}

	function openDeleteModal(): void {
		if (!selectedSeason || isSubmitting) return;
		deleteConfirmSlug = '';
		deleteReason = '';
		fieldErrors = {};
		formError = '';
		formSuccess = '';
		isDeleteModalOpen = true;
	}

	function closeDeleteModal(): void {
		if (isSubmitting) return;
		isDeleteModalOpen = false;
		deleteConfirmSlug = '';
		deleteReason = '';
	}

	function duplicateSeason(): void {
		if (!selectedSeason?.id || isSubmitting) return;
		dispatch('duplicate', { sourceSeasonId: selectedSeason.id });
	}

	function revertDetails(): void {
		if (!selectedSeason || isSubmitting || !hasDetailChanges) return;
		hydrateFromSeason(selectedSeason);
	}

	function dateRangeText(start: string, end: string | null): string {
		const startDisplay = formatDateForDisplay(start);
		const endDisplay = formatDateForDisplay(end);
		if (endDisplay) return `${startDisplay} to ${endDisplay}`;
		return startDisplay;
	}

	function getTodayIsoDate(): string {
		return new Date().toISOString().slice(0, 10);
	}

	function getTemporalSeasonLabel(season: SeasonOption): 'Current' | 'Past' | 'Future' {
		if (season.isCurrent) return 'Current';
		const seasonStart = (season.startDate || '').trim();
		if (!seasonStart) return 'Past';
		return seasonStart > getTodayIsoDate() ? 'Future' : 'Past';
	}

	function formatDateForDisplay(value: string | null | undefined): string {
		const normalized = value?.trim() ?? '';
		if (!normalized) return '';
		const parsed = new Date(`${normalized}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) return normalized;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: '2-digit',
			year: 'numeric'
		}).format(parsed);
	}

	function applyFieldErrors(source: Record<string, string[] | undefined> | undefined): void {
		const nextErrors: Record<string, string> = {};
		if (!source) {
			fieldErrors = nextErrors;
			return;
		}
		for (const [key, value] of Object.entries(source)) {
			if (!value || value.length === 0) continue;
			nextErrors[key] = value[0] as string;
		}
		fieldErrors = nextErrors;
	}

	async function submitPatch(payload: {
		action: 'update-details' | 'set-current' | 'set-active';
		seasonId: string;
		name?: string;
		slug?: string;
		startDate?: string;
		endDate?: string | null;
		isActive?: boolean;
	}): Promise<void> {
		formError = '';
		formSuccess = '';
		applyFieldErrors(undefined);
		isSubmitting = true;
		try {
			const response = await fetch('/api/intramural-sports/seasons', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as ManageSeasonResponse;
			if (!response.ok || !body.success) {
				applyFieldErrors(body.fieldErrors);
				formError = body.error || 'Unable to update season right now.';
				return;
			}

			formSuccess = 'Season updated.';
			dispatch('saved', {
				selectedSeasonId: body.data?.currentSeasonId ?? payload.seasonId
			});
		} catch {
			formError = 'Unable to update season right now.';
		} finally {
			isSubmitting = false;
		}
	}

	async function saveDetails(): Promise<void> {
		if (!selectedSeason || !hasDetailChanges || isSubmitting) return;
		await submitPatch({
			action: 'update-details',
			seasonId: selectedSeason.id,
			name: name.trim(),
			slug: normalizeSlug(slug),
			startDate: startDate.trim(),
			endDate: endDate.trim() || null
		});
	}

	async function makeCurrent(): Promise<void> {
		if (!selectedSeason || selectedSeason.isCurrent || isSubmitting) return;
		await submitPatch({
			action: 'set-current',
			seasonId: selectedSeason.id
		});
	}

	async function setActive(isActive: boolean): Promise<void> {
		if (!selectedSeason || selectedSeason.isActive === isActive || isSubmitting) return;
		await submitPatch({
			action: 'set-active',
			seasonId: selectedSeason.id,
			isActive
		});
	}

	async function deleteSeason(): Promise<void> {
		if (!selectedSeason || !canDelete || isSubmitting) return;
		formError = '';
		formSuccess = '';
		applyFieldErrors(undefined);
		isSubmitting = true;
		try {
			const response = await fetch('/api/intramural-sports/seasons', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seasonId: selectedSeason.id,
					confirmSlug: deleteConfirmSlug,
					reason: deleteReason.trim() || undefined
				})
			});
			const body = (await response.json()) as DeleteSeasonResponse;
			if (!response.ok || !body.success) {
				applyFieldErrors(body.fieldErrors);
				formError = body.error || 'Unable to delete season right now.';
				return;
			}

			isDeleteModalOpen = false;
			formSuccess = 'Season deleted.';
			dispatch('saved', {
				selectedSeasonId: body.data?.currentSeasonId ?? null
			});
		} catch {
			formError = 'Unable to delete season right now.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<WizardModal
	{open}
	title="Manage Seasons"
	step={1}
	stepCount={1}
	stepTitle="Season Administration"
	progressPercent={100}
	closeAriaLabel="Close manage seasons modal"
	on:requestClose={close}
	on:submit={(event) => {
		event.preventDefault();
	}}
	on:input={() => {
		formError = '';
		formSuccess = '';
	}}
	maxWidthClass="max-w-6xl"
>
	{#snippet error()}
		{#if formError}
			<div class="border-2 border-error-300 bg-error-50 p-3">
				<p class="text-error-800 text-sm font-sans">{formError}</p>
			</div>
		{/if}
		{#if formSuccess}
			<div class="border-2 border-primary-300 bg-primary-100 p-3">
				<p class="text-primary-900 text-sm font-sans">{formSuccess}</p>
			</div>
		{/if}
	{/snippet}

	<div class="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-4 min-h-0">
		<section class="border-2 border-secondary-300 bg-white min-h-0 flex flex-col">
			<div class="px-3 py-2 border-b border-secondary-200 flex items-center gap-2">
				<p
					class="h-6 inline-flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-950 shrink-0"
				>
					Seasons
				</p>
				<SearchInput
					id="manage-season-search"
					label="Search seasons"
					value={seasonSearchTerm}
					disabled={isSubmitting}
					placeholder="Search seasons"
					autocomplete="off"
					wrapperClass="relative ml-2 flex-1 min-w-0"
					iconClass="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-950"
					inputClass="input-secondary h-6 min-h-0 w-full pl-7 pr-7 py-0 text-xs leading-5 disabled:cursor-not-allowed"
					clearButtonClass="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer"
					clearIconClass="w-3.5 h-3.5"
					clearAriaLabel="Clear season search"
					on:input={(event) => {
						seasonSearchTerm = event.detail.value;
					}}
				/>
			</div>
			<div class="max-h-[52vh] overflow-y-auto p-2 space-y-2">
				{#if filteredSeasons.length === 0}
					<p class="text-sm text-neutral-900 px-1 py-2">
						{seasonSearchTerm.trim() ? 'No seasons match your search.' : 'No seasons available.'}
					</p>
				{:else}
					{#each filteredSeasons as season}
						<button
							type="button"
							aria-label={`Select ${season.name}`}
							class={`w-full text-left border-2 px-2 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
								season.id === seasonId
									? 'border-primary-500 bg-primary-100'
									: 'border-secondary-300 bg-neutral hover:bg-neutral-100'
							}`}
							onclick={() => {
								selectSeason(season.id);
							}}
						>
							<p class="text-lg font-bold font-serif text-neutral-950 truncate">{season.name}</p>
							<p class="text-xs text-neutral-900">
								{dateRangeText(season.startDate, season.endDate)}
							</p>
							<p class="text-[10px] uppercase tracking-wide text-neutral-950 mt-1">
								{getTemporalSeasonLabel(season)}
								{#if !season.isActive}
									{' - Archived'}
								{/if}
							</p>
						</button>
					{/each}
				{/if}
			</div>
		</section>

		{#if selectedSeason}
			<section class="border-2 border-secondary-300 bg-white p-4 space-y-4">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div class="space-y-1">
						<h3 class="text-3xl font-bold font-serif text-neutral-950">{selectedSeason.name}</h3>
						<p class="text-sm text-neutral-900">
							{dateRangeText(selectedSeason.startDate, selectedSeason.endDate)}
						</p>
						<p class="text-xs uppercase tracking-wide text-neutral-950">
							{getTemporalSeasonLabel(selectedSeason)} season
							{#if !selectedSeason.isActive}
								{' - Archived'}
							{/if}
						</p>
					</div>

					<div class="flex items-center flex-wrap gap-2">
						{#if hasDetailChanges}
							<HoverTooltip text="Revert unsaved changes">
								<button
									type="button"
									class="button-secondary-outlined w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
									aria-label="Revert unsaved season changes"
									disabled={isSubmitting}
									onclick={revertDetails}
								>
									<IconRestore class="w-5 h-5" />
								</button>
							</HoverTooltip>
						{/if}

						<HoverTooltip text="Save details">
							<button
								type="button"
								class="button-secondary-outlined w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Save season details"
								disabled={!hasDetailChanges || isSubmitting}
								onclick={() => {
									void saveDetails();
								}}
							>
								<IconDeviceFloppy class="w-5 h-5" />
							</button>
						</HoverTooltip>

						<HoverTooltip text="Create new season by copying this season">
							<button
								type="button"
								class="button-secondary-outlined w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Duplicate this season into a new season"
								disabled={isSubmitting}
								onclick={duplicateSeason}
							>
								<IconCopy class="w-5 h-5" />
							</button>
						</HoverTooltip>

						<HoverTooltip text="Set as current season">
							<button
								type="button"
								class="button-secondary-outlined border-green-600 text-green-700 hover:bg-green-50 w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Make this season current"
								disabled={selectedSeason.isCurrent || isSubmitting}
								onclick={() => {
									void makeCurrent();
								}}
							>
								<IconTarget class="w-5 h-5" />
							</button>
						</HoverTooltip>

						<HoverTooltip text={archiveHintText} maxWidthClass="max-w-72">
							<button
								type="button"
								class="button-secondary-outlined border-warning-500 text-warning-700 hover:bg-warning-50 w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label={archiveActionLabel}
								disabled={isSubmitting}
								onclick={() => {
									void setActive(!selectedSeason.isActive);
								}}
							>
								{#if selectedSeason.isActive}
									<IconArchive class="w-5 h-5" />
								{:else}
									<IconRefresh class="w-5 h-5" />
								{/if}
							</button>
						</HoverTooltip>

						<HoverTooltip text="Delete season (opens confirmation)" maxWidthClass="max-w-72">
							<button
								type="button"
								class="button-secondary-outlined border-error-500 text-error-700 hover:bg-error-50 w-11 h-11 p-0 inline-flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
								aria-label="Open delete season dialog"
								disabled={isSubmitting}
								onclick={openDeleteModal}
							>
								<IconTrash class="w-5 h-5" />
							</button>
						</HoverTooltip>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label for="manage-season-name" class="block text-sm text-neutral-950 mb-1">Name</label>
						<input
							id="manage-season-name"
							type="text"
							class="input-secondary"
							bind:value={name}
							bind:this={nameInput}
							disabled={isSubmitting}
						/>
						{#if fieldErrors['name']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['name']}</p>
						{/if}
					</div>
					<div>
						<label for="manage-season-slug" class="block text-sm text-neutral-950 mb-1">Slug</label>
						<input
							id="manage-season-slug"
							type="text"
							class="input-secondary"
							value={slug}
							oninput={(event) => {
								slug = normalizeSlug((event.currentTarget as HTMLInputElement).value);
							}}
							disabled={isSubmitting}
						/>
						{#if fieldErrors['slug']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['slug']}</p>
						{/if}
					</div>
					<div>
						<label for="manage-season-start" class="block text-sm text-neutral-950 mb-1"
							>Start Date</label
						>
						<input
							id="manage-season-start"
							type="date"
							class="input-secondary"
							bind:value={startDate}
							disabled={isSubmitting}
						/>
						{#if fieldErrors['startDate']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['startDate']}</p>
						{/if}
					</div>
					<div>
						<label for="manage-season-end" class="block text-sm text-neutral-950 mb-1"
							>End Date</label
						>
						<input
							id="manage-season-end"
							type="date"
							class="input-secondary"
							bind:value={endDate}
							disabled={isSubmitting}
						/>
						{#if fieldErrors['endDate']}
							<p class="text-xs text-error-700 mt-1">{fieldErrors['endDate']}</p>
						{/if}
					</div>
				</div>
			</section>
		{/if}
	</div>

	{#snippet footer()}
		<div class="pt-2 border-t border-secondary-300 flex justify-end">
			<button
				type="button"
				class="button-secondary-outlined cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
				disabled={isSubmitting}
				onclick={close}
			>
				Close
			</button>
		</div>
	{/snippet}
</WizardModal>

<ModalShell
	open={open && isDeleteModalOpen}
	closeAriaLabel="Close delete season dialog"
	panelClass="w-full max-w-2xl max-h-[calc(100vh-3rem)] border-4 border-error-500 bg-error-25 overflow-hidden flex flex-col"
	on:requestClose={closeDeleteModal}
>
	<div class="p-4 border-b border-error-300 bg-error-50 flex items-start justify-between gap-3">
		<div class="space-y-1">
			<h3 class="text-2xl font-bold font-serif text-error-900">Delete Season</h3>
		</div>
		<button
			type="button"
			class="p-1 text-error-800 hover:text-error-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
			aria-label="Close delete season dialog"
			onclick={closeDeleteModal}
		>
			<IconX class="w-5 h-5" />
		</button>
	</div>

	<div class="p-4 space-y-3 overflow-y-auto">
		<div class="border-2 border-error-300 bg-error-50 p-3 space-y-2">
			<p class="text-sm text-error-900 font-semibold">
				Deleting this season permanently removes season-linked offerings, leagues/groups, divisions,
				teams, rosters, events, announcements, standings, and brackets.
			</p>
			<p class="text-sm text-error-800 font-semibold">
				This action cannot be undone, so proceed with caution.
			</p>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<div>
				<label for="manage-season-delete-slug" class="block text-sm text-neutral-950 mb-1">
					Type slug to confirm
					<code class="font-mono text-xs bg-error-100 text-error-900 px-1 py-0.5 rounded">
						{normalizedExpectedDeleteSlug}
					</code>
				</label>
				<input
					id="manage-season-delete-slug"
					type="text"
					class="input-secondary border-error-400 focus:border-error-600"
					bind:value={deleteConfirmSlug}
					disabled={isSubmitting}
				/>
				{#if fieldErrors['confirmSlug']}
					<p class="text-xs text-error-700 mt-1">{fieldErrors['confirmSlug']}</p>
				{/if}
			</div>
			<div>
				<label for="manage-season-delete-reason" class="block text-sm text-neutral-950 mb-1">
					Reason (optional)
				</label>
				<input
					id="manage-season-delete-reason"
					type="text"
					class="input-secondary border-error-400 focus:border-error-600"
					bind:value={deleteReason}
					disabled={isSubmitting}
				/>
			</div>
		</div>
	</div>

	<div class="p-4 border-t border-secondary-300 flex justify-end gap-2">
		<button
			type="button"
			class="button-secondary-outlined cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
			disabled={isSubmitting}
			onclick={closeDeleteModal}
		>
			Cancel
		</button>
		<button
			type="button"
			class="button-error cursor-pointer inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
			disabled={!canDelete || isSubmitting}
			onclick={() => {
				void deleteSeason();
			}}
		>
			<IconTrash class="w-4 h-4" />
			Delete Season
		</button>
	</div>
</ModalShell>
