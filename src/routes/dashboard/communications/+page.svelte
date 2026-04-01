<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		IconBell,
		IconCopy,
		IconDeviceMobileMessage,
		IconEdit,
		IconEye,
		IconMail,
		IconMessageCircle,
		IconPlus,
		IconRefresh,
		IconSend,
		IconTrash
	} from '@tabler/icons-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import CommunicationRichEditor from '$lib/components/communications/CommunicationRichEditor.svelte';
	import {
		EMPTY_COMMUNICATION_BATCH_FILTER,
		type CommunicationBatchDraft,
		type CommunicationBatchFilter,
		type CommunicationMessageDetail,
		type CommunicationMessageSummary,
		type CommunicationRecipientPreview
	} from '$lib/communications/types.js';
	import type { PageData } from './$types';

	type BatchMode = 'include' | 'exclude';
	type ComposerView = 'editor' | 'preview';
	type FilterKey = keyof CommunicationBatchFilter;

	interface BatchFormState {
		id: string | null;
		mode: BatchMode;
		filters: CommunicationBatchFilter;
	}

	const PAGE_DESCRIPTION =
		'Build audience batches, draft messages, and review communication history for your organization.';
	const DROPDOWN_BUTTON_CLASS =
		'button-neutral-outlined min-h-10 w-full px-3 py-2 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2';

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).communicationCenter
	);

	let messages = $state<CommunicationMessageSummary[]>([]);
	let selectedMessage = $state<CommunicationMessageDetail | null>(null);
	let subject = $state('');
	let editorHtml = $state('<p></p>');
	let editorJson = $state<Record<string, unknown> | null>(null);
	let batches = $state<CommunicationBatchDraft[]>([]);
	let batchForm = $state<BatchFormState>({
		id: null,
		mode: 'include',
		filters: { ...EMPTY_COMMUNICATION_BATCH_FILTER }
	});
	let preview = $state<CommunicationRecipientPreview>({ totalCount: 0, rows: [] });
	let previewSearch = $state('');
	let composerView = $state<ComposerView>('editor');
	let previewLoading = $state(false);
	let saveLoading = $state(false);
	let sendLoading = $state(false);
	let duplicationLoadingId = $state('');

	const loadedMessageSignature = $derived.by(() =>
		data.selectedMessage
			? `${data.selectedMessage.id}:${data.selectedMessage.updatedAt ?? ''}:${data.selectedMessage.status}`
			: 'new'
	);

	const memberRoleOptions = $derived.by(() => data.filterOptions.memberRoles ?? []);
	const memberSexOptions = $derived.by(() => data.filterOptions.memberSexes ?? []);
	const rosterRoleOptions = $derived.by(() => data.filterOptions.rosterRoles ?? []);
	const teamStatusOptions = $derived.by(() => data.filterOptions.teamStatuses ?? []);
	const seasonOptions = $derived.by(() => [{ value: '', label: 'All Seasons' }, ...(data.filterOptions.seasons ?? [])]);
	const offeringOptions = $derived.by(() => [
		{ value: '', label: 'All Offerings' },
		...(data.filterOptions.offerings ?? []).filter(
			(offering) => !batchForm.filters.seasonId || offering.seasonId === batchForm.filters.seasonId
		)
	]);
	const leagueOptions = $derived.by(() => [
		{ value: '', label: 'All Leagues' },
		...(data.filterOptions.leagues ?? []).filter(
			(league) =>
				(!batchForm.filters.seasonId || league.seasonId === batchForm.filters.seasonId) &&
				(!batchForm.filters.offeringId || league.offeringId === batchForm.filters.offeringId)
		)
	]);
	const divisionOptions = $derived.by(() => [
		{ value: '', label: 'All Divisions' },
		...(data.filterOptions.divisions ?? []).filter(
			(division) => !batchForm.filters.leagueId || division.leagueId === batchForm.filters.leagueId
		)
	]);
	const teamOptions = $derived.by(() => [
		{ value: '', label: 'All Teams' },
		...(data.filterOptions.teams ?? []).filter(
			(team) => !batchForm.filters.divisionId || team.divisionId === batchForm.filters.divisionId
		)
	]);

	const visiblePreviewRows = $derived.by(() => {
		const query = previewSearch.trim().toLowerCase();
		if (!query) {
			return preview.rows;
		}
		return preview.rows.filter((row) =>
			[row.fullName, row.email, row.teamName ?? '', row.leagueName ?? '', row.offeringName ?? '']
				.join(' ')
				.toLowerCase()
				.includes(query)
		);
	});
	const isReadOnlyMessage = $derived.by(() => Boolean(selectedMessage && selectedMessage.status !== 'draft'));

	function formatDateDisplay(value: string | null | undefined): string {
		const normalized = value?.trim() ?? '';
		if (!normalized) {
			return '--';
		}
		const date = new Date(normalized);
		if (Number.isNaN(date.getTime())) {
			return normalized;
		}
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function createBatchId(): string {
		return crypto.randomUUID();
	}

	function toPreviewRows(message: CommunicationMessageDetail | null) {
		return (message?.recipients ?? []).slice(0, 25).map((recipient) => ({
			userId: recipient.userId ?? '',
			membershipId: '',
			fullName: recipient.fullName,
			email: recipient.email,
			studentId: null,
			memberRole: '',
			memberSex: null,
			teamName: null,
			divisionName: null,
			leagueName: null,
			offeringName: null,
			seasonName: null,
			rosterRole: null,
			teamStatus: null
		}));
	}

	function resetBatchForm(): void {
		batchForm = {
			id: null,
			mode: 'include',
			filters: { ...EMPTY_COMMUNICATION_BATCH_FILTER }
		};
	}

	function loadMessageIntoComposer(message: CommunicationMessageDetail | null): void {
		selectedMessage = message;
		subject = message?.subject ?? '';
		editorHtml = message?.bodyHtml || '<p></p>';
		editorJson = message?.editorJson ?? null;
		batches = message?.batches ? [...message.batches] : [];
		preview = {
			totalCount: message?.recipientCount ?? 0,
			rows: toPreviewRows(message)
		};
		composerView = message?.status === 'draft' ? 'editor' : 'preview';
		previewSearch = '';
		resetBatchForm();
	}

	$effect(() => {
		const signature = loadedMessageSignature;
		if (!signature) return;
		messages = data.messages ?? [];
		loadMessageIntoComposer(data.selectedMessage ?? null);
	});

	onMount(() => {
		if (!data.selectedMessage) loadMessageIntoComposer(null);
	});

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

	function updateEditorContent(payload: {
		html: string;
		json: Record<string, unknown> | null;
		text: string;
	}): void {
		editorHtml = payload.html;
		editorJson = payload.json;
	}

	async function requestPreview(nextBatches: Array<{ id: string; mode: BatchMode; filters: CommunicationBatchFilter }>) {
		previewLoading = true;
		try {
			const response = await fetch('/api/communications/preview', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ batches: nextBatches })
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to preview the selected audience.');
			}
			preview = payload.data.messagePreview as CommunicationRecipientPreview;
			return payload.data.batches as CommunicationBatchDraft[];
		} finally {
			previewLoading = false;
		}
	}

	async function applyBatch(): Promise<void> {
		try {
			const targetId = batchForm.id ?? createBatchId();
			const normalized = await requestPreview([
				...batches
					.filter((batch) => batch.id !== batchForm.id)
					.map((batch) => ({ id: batch.id, mode: batch.mode, filters: batch.filters })),
				{ id: targetId, mode: batchForm.mode, filters: batchForm.filters }
			]);
			if (!normalized) return;
			batches = normalized;
			resetBatchForm();
			toast.success('Audience batch updated.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to update the audience batch.');
		}
	}

	async function removeBatch(batchId: string): Promise<void> {
		try {
			const remaining = batches
				.filter((batch) => batch.id !== batchId)
				.map((batch) => ({ id: batch.id, mode: batch.mode, filters: batch.filters }));
			if (remaining.length === 0) {
				batches = [];
				preview = { totalCount: 0, rows: [] };
				return;
			}
			const normalized = await requestPreview(remaining);
			if (normalized) batches = normalized;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to remove this batch.');
		}
	}

	function startEditingBatch(batch: CommunicationBatchDraft): void {
		batchForm = {
			id: batch.id,
			mode: batch.mode,
			filters: { ...batch.filters }
		};
	}

	async function refreshPreview(): Promise<void> {
		try {
			const normalized = await requestPreview(
				batches.map((batch) => ({ id: batch.id, mode: batch.mode, filters: batch.filters }))
			);
			if (normalized) batches = normalized;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to refresh the preview.');
		}
	}

	async function saveDraftMessage(): Promise<void> {
		saveLoading = true;
		try {
			const endpoint = selectedMessage?.id ? `/api/communications/${selectedMessage.id}` : '/api/communications';
			const method = selectedMessage?.id ? 'PATCH' : 'POST';
			const response = await fetch(endpoint, {
				method,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					subject,
					editorJson,
					bodyHtml: editorHtml,
					batches: batches.map((batch) => ({ id: batch.id, mode: batch.mode, filters: batch.filters }))
				})
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to save this draft.');
			}
			await goto(`/dashboard/communications?messageId=${payload.data.messageId}`);
			await invalidateAll();
			toast.success('Draft saved.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to save this draft.');
		} finally {
			saveLoading = false;
		}
	}

	async function sendMessageNow(): Promise<void> {
		if (!selectedMessage?.id) {
			toast.error('Save the draft before sending.');
			return;
		}
		sendLoading = true;
		try {
			const response = await fetch(`/api/communications/${selectedMessage.id}/send`, { method: 'POST' });
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to send this message.');
			}
			await goto(`/dashboard/communications?messageId=${selectedMessage.id}`);
			await invalidateAll();
			toast.success('Communication sent.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to send this message.');
		} finally {
			sendLoading = false;
		}
	}

	async function openHistoryMessage(messageId: string): Promise<void> {
		await goto(`/dashboard/communications?messageId=${messageId}`);
		await invalidateAll();
	}

	async function duplicateHistoryMessage(messageId: string): Promise<void> {
		duplicationLoadingId = messageId;
		try {
			const response = await fetch(`/api/communications/${messageId}/duplicate`, { method: 'POST' });
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to duplicate this message.');
			}
			await goto(`/dashboard/communications?messageId=${payload.data.messageId}`);
			await invalidateAll();
			toast.success('Message duplicated into a new draft.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to duplicate this message.');
		} finally {
			duplicationLoadingId = '';
		}
	}

	function startNewMessage(): void {
		loadMessageIntoComposer(null);
		void goto('/dashboard/communications');
	}
</script>

<PageTitle pageTitle={pageLabel} />

<svelte:head>
	<meta name="description" content={PAGE_DESCRIPTION} />
</svelte:head>

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex items-center gap-3">
					<div class="bg-primary text-primary-foreground border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center">
						<IconMessageCircle class="h-6 w-6 lg:h-7 lg:w-7" />
					</div>
					<h1 class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950">{pageLabel}</h1>
				</div>
				<DashboardSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-4">
		<section class="section-shell p-4 space-y-4">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<h2 class="dashboard-section-title text-neutral-950">
							{selectedMessage ? (selectedMessage.status === 'draft' ? 'Draft Composer' : 'Message Detail') : 'New Message'}
						</h2>
						<InfoPopover buttonVariant="label-inline" title="Communication center workflow" content="Build include and exclude audience batches, review the final recipient preview, draft the email, then save or send it." />
					</div>
					<div class="flex flex-wrap gap-2 text-xs text-neutral-950">
						<span class="border border-secondary-300 px-2 py-1">{preview.totalCount} recipients</span>
						<span class="border border-secondary-300 px-2 py-1 uppercase tracking-wide">
							{selectedMessage ? selectedMessage.status : 'unsaved'}
						</span>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<button type="button" class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={startNewMessage}>
						<IconPlus class="h-4 w-4" />
						<span>New Message</span>
					</button>
					<button type="button" class="button-secondary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={saveDraftMessage} disabled={saveLoading || isReadOnlyMessage}>
						<IconRefresh class="h-4 w-4" />
						<span>{saveLoading ? 'Saving...' : 'Save Draft'}</span>
					</button>
					<button type="button" class="button-primary px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={sendMessageNow} disabled={sendLoading || isReadOnlyMessage || !selectedMessage?.id}>
						<IconSend class="h-4 w-4" />
						<span>{sendLoading ? 'Sending...' : 'Send Now'}</span>
					</button>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each [
					{ label: 'Email', icon: IconMail, active: true },
					{ label: 'SMS', icon: IconDeviceMobileMessage, active: false },
					{ label: 'In-app', icon: IconBell, active: false }
				] as chip}
					<div class={`inline-flex items-center gap-2 border px-3 py-2 text-sm ${chip.active ? 'border-primary-700 bg-primary text-primary-foreground' : 'border-secondary-300 bg-white text-neutral-700'}`}>
						<chip.icon class="h-4 w-4" />
						<span>{chip.label}</span>
						{#if !chip.active}
							<span class="text-[11px] uppercase tracking-wide">Coming soon</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<div class="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
			<section class="section-shell min-w-0">
				<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
					<div class="flex items-center gap-2">
						<h2 class="dashboard-section-title text-neutral-950">Audience Builder</h2>
						<InfoPopover buttonVariant="label-inline" title="Audience batches" content="Add include batches to grow the audience and exclude batches to remove overlapping recipients. The final list is deduped automatically." />
					</div>
				</div>
				<div class="p-4 space-y-4">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Batch mode</p>
							<ListboxDropdown options={[{ value: 'include', label: 'Include recipients' }, { value: 'exclude', label: 'Exclude recipients' }]} value={batchForm.mode} ariaLabel="Batch mode" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => { batchForm = { ...batchForm, mode: event.detail.value as BatchMode }; }} />
						</div>
						<div class="space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Member search</p>
							<SearchInput id="communication-member-search" label="Search members" value={batchForm.filters.memberQuery} placeholder="Search by name, email, or student ID" inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm" clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer" on:input={(event) => updateFilter('memberQuery', event.detail.value)} />
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Member role</p><ListboxDropdown options={memberRoleOptions} value={batchForm.filters.memberRole} ariaLabel="Filter by member role" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('memberRole', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Sex</p><ListboxDropdown options={memberSexOptions} value={batchForm.filters.memberSex} ariaLabel="Filter by sex" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('memberSex', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Season</p><ListboxDropdown options={seasonOptions} value={batchForm.filters.seasonId} ariaLabel="Filter by season" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('seasonId', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Offering</p><ListboxDropdown options={offeringOptions} value={batchForm.filters.offeringId} ariaLabel="Filter by offering" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('offeringId', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">League</p><ListboxDropdown options={leagueOptions} value={batchForm.filters.leagueId} ariaLabel="Filter by league" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('leagueId', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Division</p><ListboxDropdown options={divisionOptions} value={batchForm.filters.divisionId} ariaLabel="Filter by division" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('divisionId', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Team</p><ListboxDropdown options={teamOptions} value={batchForm.filters.teamId} ariaLabel="Filter by team" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('teamId', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Roster role</p><ListboxDropdown options={rosterRoleOptions} value={batchForm.filters.rosterRole} ariaLabel="Filter by roster role" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('rosterRole', event.detail.value)} /></div>
						<div class="space-y-2"><p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Team status</p><ListboxDropdown options={teamStatusOptions} value={batchForm.filters.teamStatus} ariaLabel="Filter by team status" buttonClass={DROPDOWN_BUTTON_CLASS} on:change={(event) => updateFilter('teamStatus', event.detail.value)} /></div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<button type="button" class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={applyBatch}>
							<IconPlus class="h-4 w-4" />
							<span>{batchForm.id ? 'Update Batch' : 'Add Batch'}</span>
						</button>
						<button type="button" class="button-secondary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={refreshPreview} disabled={previewLoading || batches.length === 0}>
							<IconRefresh class="h-4 w-4" />
							<span>{previewLoading ? 'Refreshing...' : 'Refresh Preview'}</span>
						</button>
						{#if batchForm.id}
							<button type="button" class="button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer" onclick={resetBatchForm}>Cancel Edit</button>
						{/if}
					</div>

					<div class="space-y-3">
						<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">Saved batches</h3>
						{#if batches.length === 0}
							<div class="border border-neutral-950 bg-white p-4 text-sm text-neutral-700">No audience batches yet.</div>
						{:else}
							{#each batches as batch}
								<div class="section-card p-3 space-y-3">
									<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
										<div class="space-y-2">
											<div class="flex flex-wrap items-center gap-2">
												<span class={`border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${batch.mode === 'include' ? 'border-primary-700 bg-primary text-primary-foreground' : 'border-warning-700 bg-warning-100 text-neutral-950'}`}>{batch.mode}</span>
												<span class="border border-secondary-300 px-2 py-1 text-[11px] font-bold uppercase tracking-wide">{batch.resolvedRecipientCount} recipients</span>
											</div>
											<p class="text-sm text-neutral-950">{batch.summaryText}</p>
										</div>
										<div class="flex items-center gap-2">
											<HoverTooltip text="Edit batch"><button type="button" class="button-secondary-outlined dashboard-icon-button cursor-pointer" aria-label="Edit audience batch" onclick={() => startEditingBatch(batch)}><IconEdit class="h-4 w-4" /></button></HoverTooltip>
											<HoverTooltip text="Remove batch"><button type="button" class="button-neutral-outlined dashboard-icon-button cursor-pointer" aria-label="Remove audience batch" onclick={() => void removeBatch(batch.id)}><IconTrash class="h-4 w-4" /></button></HoverTooltip>
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>

					<div class="space-y-3">
						<div class="space-y-1">
							<h3 class="text-sm font-bold uppercase tracking-wide text-neutral-950">Recipient preview</h3>
							<p class="text-sm text-neutral-700">{preview.totalCount} final recipients after all include and exclude batches.</p>
						</div>
						<SearchInput id="communication-preview-search" label="Search previewed recipients" value={previewSearch} placeholder="Search preview list" inputClass="input-neutral min-h-10 pl-10 pr-10 py-2 text-sm" clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-950 cursor-pointer" on:input={(event) => { previewSearch = event.detail.value; }} />
						<div class="border border-neutral-950 bg-white overflow-x-auto">
							<table class="min-w-full border-collapse">
								<thead class="bg-neutral-100">
									<tr>
										<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Recipient</th>
										<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Email</th>
										<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Context</th>
									</tr>
								</thead>
								<tbody>
									{#if visiblePreviewRows.length === 0}
										<tr><td colspan="3" class="px-3 py-6 text-sm text-neutral-700">No preview recipients match the current search.</td></tr>
									{:else}
										{#each visiblePreviewRows as row}
											<tr class="border-b border-neutral-200 last:border-b-0">
												<td class="px-3 py-2 text-sm text-neutral-950">{row.fullName}</td>
												<td class="px-3 py-2 text-sm text-neutral-950">{row.email}</td>
												<td class="px-3 py-2 text-sm text-neutral-700">{row.teamName ?? row.leagueName ?? row.offeringName ?? 'Member filter only'}</td>
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</section>

			<section class="section-shell min-w-0">
				<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
					<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<h2 class="dashboard-section-title text-neutral-950">Composer</h2>
								<InfoPopover buttonVariant="label-inline" title="Simple rich editor" content="Use the formatting toolbar to write the message without touching HTML. Preview mode shows the email the way recipients will read it." />
							</div>
							<p class="text-sm text-neutral-700">{isReadOnlyMessage ? 'Viewing a sent or failed message.' : 'Draft in a simple docs-style editor.'}</p>
						</div>
						<div class="flex items-center gap-2">
							<button type="button" class={`button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer ${composerView === 'editor' ? 'bg-secondary-100 border-secondary-700' : ''}`} onclick={() => (composerView = 'editor')} disabled={isReadOnlyMessage}>Editor</button>
							<button type="button" class={`button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer ${composerView === 'preview' ? 'bg-secondary-100 border-secondary-700' : ''}`} onclick={() => (composerView = 'preview')}>Preview</button>
						</div>
					</div>
				</div>
				<div class="p-4 space-y-4">
					<div class="space-y-2">
						<label class="block text-sm font-sans text-neutral-950 mb-1" for="communication-subject">Email subject</label>
						<input id="communication-subject" class="input-secondary min-h-10" type="text" placeholder="Season kickoff update" bind:value={subject} disabled={isReadOnlyMessage} />
					</div>

					{#if composerView === 'editor' && !isReadOnlyMessage}
						<CommunicationRichEditor initialHtml={editorHtml} initialJson={editorJson} editable={!isReadOnlyMessage} onChange={updateEditorContent} />
					{:else}
						<div class="section-card p-4 space-y-4">
							<div class="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
								<span class="border border-secondary-300 px-2 py-1 uppercase tracking-wide">Preview</span>
								{#if selectedMessage?.sentAt}
									<span class="border border-secondary-300 px-2 py-1 uppercase tracking-wide">Sent <DateHoverText display={formatDateDisplay(selectedMessage.sentAt)} value={selectedMessage.sentAt} includeTime /></span>
								{/if}
							</div>
							<div class="border border-neutral-950 bg-white p-4 min-h-[22rem]">
								<div class="mx-auto max-w-3xl space-y-4">
									<div class="border-b border-neutral-200 pb-4">
										<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">Subject</p>
										<p class="mt-2 text-2xl font-serif font-bold text-neutral-950">{subject || 'Untitled draft'}</p>
									</div>
									<div class="prose prose-neutral max-w-none">
										{@html editorHtml || '<p class="text-neutral-700">No message body yet.</p>'}
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</section>
		</div>

		<section class="section-shell min-w-0">
			<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
				<div class="flex items-center gap-2">
					<h2 class="dashboard-section-title text-neutral-950">Message History</h2>
					<InfoPopover buttonVariant="label-inline" title="History" content="Drafts can be reopened and edited. Sent or failed messages are read-only and can be duplicated into a fresh draft." />
				</div>
			</div>
			<div class="p-4 space-y-3">
				{#if messages.length === 0}
					<div class="border border-neutral-950 bg-white p-4 text-sm text-neutral-700">No communication history yet.</div>
				{:else}
					<div class="border border-neutral-950 bg-white overflow-x-auto">
						<table class="min-w-full border-collapse">
							<thead class="bg-neutral-100">
								<tr>
									<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Message</th>
									<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Status</th>
									<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Recipients</th>
									<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Updated</th>
									<th class="border-b border-neutral-950 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each messages as message}
									<tr class="border-b border-neutral-200 last:border-b-0">
										<td class="px-3 py-3 align-top">
											<div class="space-y-1">
												<p class="font-semibold text-neutral-950">{message.subject}</p>
												<p class="text-sm text-neutral-700">{message.batchSummary}</p>
												<p class="text-xs text-neutral-700">By {message.createdByName}</p>
											</div>
										</td>
										<td class="px-3 py-3 align-top">
											<div class="space-y-1">
												<span class="inline-flex border border-secondary-300 px-2 py-1 text-[11px] font-bold uppercase tracking-wide">{message.status}</span>
												<p class="text-xs text-neutral-700">Email</p>
												{#if message.failureMessage}<p class="text-xs text-error-700">{message.failureMessage}</p>{/if}
											</div>
										</td>
										<td class="px-3 py-3 align-top text-sm text-neutral-950">{message.recipientCount}</td>
										<td class="px-3 py-3 align-top text-sm text-neutral-700">
											<p><DateHoverText display={formatDateDisplay(message.updatedAt)} value={message.updatedAt} includeTime /></p>
											{#if message.sentAt}<p class="text-xs text-neutral-700">Sent <DateHoverText display={formatDateDisplay(message.sentAt)} value={message.sentAt} includeTime /></p>{/if}
										</td>
										<td class="px-3 py-3 align-top">
											<div class="flex flex-wrap items-center gap-2">
												<HoverTooltip text={message.status === 'draft' ? 'Open draft' : 'View message'}>
													<button type="button" class="button-secondary-outlined dashboard-icon-button cursor-pointer" aria-label={message.status === 'draft' ? 'Open draft' : 'View message'} onclick={() => void openHistoryMessage(message.id)}>
														{#if message.status === 'draft'}
															<IconEdit class="h-4 w-4" />
														{:else}
															<IconEye class="h-4 w-4" />
														{/if}
													</button>
												</HoverTooltip>
												<HoverTooltip text="Duplicate into a new draft">
													<button type="button" class="button-neutral-outlined dashboard-icon-button cursor-pointer" aria-label="Duplicate message" onclick={() => void duplicateHistoryMessage(message.id)} disabled={duplicationLoadingId === message.id}>
														<IconCopy class="h-4 w-4" />
													</button>
												</HoverTooltip>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>
