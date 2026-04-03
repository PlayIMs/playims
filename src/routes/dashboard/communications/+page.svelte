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
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import CommunicationRichEditor from '$lib/components/communications/CommunicationRichEditor.svelte';
	import RecipientBuilderWizard from './_wizards/RecipientBuilderWizard.svelte';
	import {
		type CommunicationBatchDraft,
		type CommunicationBatchMode,
		type CommunicationFilterOptions,
		type CommunicationMessageDetail,
		type CommunicationMessageSummary,
		type CommunicationRecipientPreview
	} from '$lib/communications/types.js';
	import type { PageData } from './$types';

	type ComposerView = 'editor' | 'preview';

	const HEADER_SPLIT_SEND_BUTTON_CLASS =
		'button-primary h-[2.375rem] px-3 text-xs font-bold uppercase tracking-wide cursor-pointer';
	const HEADER_SPLIT_SEND_MENU_BUTTON_CLASS =
		'button-primary -ml-[2px] h-[2.375rem] px-1 cursor-pointer';

	const PAGE_DESCRIPTION =
		'Build recipient batches, draft messages, and review communication history for your organization.';

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
	let preview = $state<CommunicationRecipientPreview>({ totalCount: 0, rows: [] });
	let composerView = $state<ComposerView>('editor');
	let saveLoading = $state(false);
	let sendLoading = $state(false);
	let duplicationLoadingId = $state('');
	let recipientBuilderOpen = $state(false);

	const loadedMessageSignature = $derived.by(() =>
		data.selectedMessage
			? `${data.selectedMessage.id}:${data.selectedMessage.updatedAt ?? ''}:${data.selectedMessage.status}`
			: 'new'
	);

	const filterOptions = $derived.by<CommunicationFilterOptions>(() => data.filterOptions);

	const isReadOnlyMessage = $derived.by(() => Boolean(selectedMessage && selectedMessage.status !== 'draft'));
	const recipientSummaryText = $derived.by(() =>
		preview.totalCount > 0
			? `${preview.totalCount} recipient${preview.totalCount === 1 ? '' : 's'} selected`
			: 'Choose recipients'
	);
	const sendActionOptions = $derived.by(() => [
		{
			value: 'send-later',
			label: 'Send Later',
			description: 'Schedule sending is coming soon.',
			disabled: true,
			disabledTooltip: 'Send later is coming soon.'
		}
	]);

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
		recipientBuilderOpen = false;
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

	function updateEditorContent(payload: {
		html: string;
		json: Record<string, unknown> | null;
		text: string;
	}): void {
		editorHtml = payload.html;
		editorJson = payload.json;
	}

	async function requestPreview(
		nextBatches: Array<{
			id: string;
			mode: CommunicationBatchMode;
			filters: CommunicationBatchDraft['filters'];
		}>
	): Promise<{
		batches: CommunicationBatchDraft[];
		preview: CommunicationRecipientPreview;
	}> {
		const response = await fetch('/api/communications/preview', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ batches: nextBatches })
		});
		const payload = await response.json();
		if (!response.ok || payload.success === false) {
			throw new Error(payload.error ?? 'Unable to preview the selected audience.');
		}
		return {
			batches: payload.data.batches as CommunicationBatchDraft[],
			preview: payload.data.messagePreview as CommunicationRecipientPreview
		};
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

	function applyRecipientBuilder(payload: {
		batches: CommunicationBatchDraft[];
		preview: CommunicationRecipientPreview;
	}): void {
		batches = payload.batches;
		preview = payload.preview;
		recipientBuilderOpen = false;
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
				<div>
					<h2 class="dashboard-section-title text-neutral-950">
						{selectedMessage ? (selectedMessage.status === 'draft' ? 'Draft Composer' : 'Message Detail') : 'New Message'}
					</h2>
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
					<SplitAddAction
						label={sendLoading ? 'Sending...' : 'Send Now'}
						options={sendActionOptions}
						ariaLabel="Open send options"
						buttonClass={HEADER_SPLIT_SEND_BUTTON_CLASS}
						menuButtonClass={HEADER_SPLIT_SEND_MENU_BUTTON_CLASS}
						disabled={sendLoading || isReadOnlyMessage || !selectedMessage?.id}
						on:click={() => void sendMessageNow()}
						on:action={() => {
							toast.info('Send later is coming soon.');
						}}
					/>
				</div>
			</div>

		</section>

		<section class="section-shell min-w-0">
			<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
				<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 class="dashboard-section-title text-neutral-950">Composer</h2>
					</div>
					<div class="flex items-center gap-2">
						<button type="button" class={`button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer ${composerView === 'editor' ? 'bg-secondary-100 border-secondary-700' : ''}`} onclick={() => (composerView = 'editor')} disabled={isReadOnlyMessage}>Editor</button>
						<button type="button" class={`button-neutral-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer ${composerView === 'preview' ? 'bg-secondary-100 border-secondary-700' : ''}`} onclick={() => (composerView = 'preview')}>Preview</button>
					</div>
				</div>
			</div>
			<div class="p-4 space-y-4">
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

				<div class="space-y-2">
					<div class="mb-1 flex min-h-6 items-center gap-1.5">
						<label class="block text-sm font-sans text-neutral-950" for="communication-recipient-trigger">To</label>
						<InfoPopover buttonVariant="label-inline" title="Recipient builder" content="Open the recipient builder to add include and exclude batches. Apply saves that working selection back to this draft." />
					</div>
					<button
						id="communication-recipient-trigger"
						type="button"
						class="button-secondary-outlined min-h-12 w-full justify-between px-4 py-3 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
						onclick={() => {
							recipientBuilderOpen = true;
						}}
						disabled={isReadOnlyMessage}
					>
						<span class="flex min-w-0 flex-col">
							<span class="text-sm font-semibold text-neutral-950">{recipientSummaryText}</span>
							<span class="text-xs text-neutral-700">
								{batches.length > 0
									? `${batches.length} saved batch${batches.length === 1 ? '' : 'es'}`
									: 'Open Recipient Builder'}
							</span>
						</span>
						<span class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">
							Recipient Builder
						</span>
					</button>
				</div>

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
								<div class="border-b border-neutral-200 pb-4 space-y-2">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">To</p>
									<p class="text-sm text-neutral-950">{recipientSummaryText}</p>
									<p class="text-[11px] uppercase tracking-wide text-neutral-700">{batches.length} batch{batches.length === 1 ? '' : 'es'}</p>
								</div>
								<div class="border-b border-neutral-200 pb-4">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">Subject</p>
									<p class="mt-2 text-2xl font-serif font-bold text-neutral-950">{subject || 'Untitled draft'}</p>
								</div>
								<div class="communication-preview-content prose prose-neutral max-w-none">
									{@html editorHtml || '<p class="text-neutral-700">No message body yet.</p>'}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>

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

		<RecipientBuilderWizard
			open={recipientBuilderOpen && !isReadOnlyMessage}
			{filterOptions}
			initialBatches={batches}
			initialPreview={preview}
			onPreviewRequest={requestPreview}
			onApply={applyRecipientBuilder}
			onRequestClose={() => {
				recipientBuilderOpen = false;
			}}
		/>
	</div>
</div>

<style>
	.communication-preview-content :global(ul) {
		list-style: disc outside;
		margin: 0 0 0.85rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-preview-content :global(ol) {
		list-style: decimal outside;
		margin: 0 0 0.85rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-preview-content :global(li) {
		margin: 0.2rem 0;
	}
	
	.communication-preview-content :global(li > p) {
		margin: 0;
	}
</style>
