<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import {
		IconBell,
		IconCopy,
		IconDeviceMobileMessage,
		IconEye,
		IconFilter,
		IconMail,
		IconMessageCircle,
		IconPlus,
		IconRefresh,
		IconTrash,
		IconUserEdit,
		IconUsersGroup
	} from '@tabler/icons-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import {
		buildCommunicationSidebarFeed,
		getCommunicationHistoryAt,
		getCommunicationScheduledAt,
		getCommunicationSidebarViewFromStatus,
		getPreferredCommunicationSidebarView,
		type CommunicationSidebarFeedItem
	} from '$lib/communications/sidebar-feed.js';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import CommunicationRichEditor from '$lib/components/communications/CommunicationRichEditor.svelte';
	import { WizardUnsavedConfirm } from '$lib/components/wizard';
	import RecipientBuilderWizard from './_wizards/RecipientBuilderWizard.svelte';
	import { buildCommunicationDraftStateSignature } from '$lib/communications/editor-content.js';
	import { buildCommunicationPageHydrationSignature } from '$lib/communications/page-hydration.js';
	import {
		filterCommunicationManualRecipientSuggestions,
		mergeCommunicationManualRecipients,
		splitCommunicationManualRecipientInput
	} from '$lib/communications/manual-recipients.js';
	import {
		createEmptyCommunicationFilterOptions,
		type CommunicationFilterOptions,
		type CommunicationManualRecipientDraft,
		type CommunicationManualRecipientSuggestion,
		type CommunicationMessageDetail,
		type CommunicationMessageSummary,
		type CommunicationRecipientGroupDraft,
		type CommunicationRecipientGroupMode,
		type CommunicationRecipientPreview
	} from '$lib/communications/types.js';
	import type { PageData } from './$types';

	type MessageSidebarView = 'drafts' | 'scheduled' | 'history';
	type UnsavedDraftConfirmMode = 'leave' | 'new-message';

	const HEADER_SPLIT_SEND_BUTTON_CLASS =
		'button-primary h-[2.375rem] px-3 text-xs font-bold uppercase tracking-wide cursor-pointer';
	const HEADER_SPLIT_SEND_MENU_BUTTON_CLASS =
		'button-primary -ml-[2px] h-[2.375rem] px-1 cursor-pointer';

	const PAGE_DESCRIPTION =
		'Build recipient groups, draft messages, and review communication history for your organization.';

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).communicationCenter
	);
	const permissions = $derived.by(() => data.permissions ?? {});

	let recipientFilterOptions = $state<CommunicationFilterOptions>(
		createEmptyCommunicationFilterOptions()
	);
	let recipientFilterOptionsLoaded = $state(false);
	let recipientFilterOptionsLoading = $state(false);
	let messages = $state<CommunicationMessageSummary[]>([]);
	let selectedMessage = $state<CommunicationMessageDetail | null>(null);
	let subject = $state('');
	let editorHtml = $state('<p></p>');
	let editorJson = $state<Record<string, unknown> | null>(null);
	let recipientGroups = $state<CommunicationRecipientGroupDraft[]>([]);
	let manualRecipients = $state<CommunicationManualRecipientDraft[]>([]);
	let manualRecipientInput = $state('');
	let manualRecipientLoading = $state(false);
	let manualRecipientSuggestions = $state<CommunicationManualRecipientSuggestion[]>([]);
	let manualRecipientSuggestionQuery = $state('');
	let manualRecipientActiveSuggestionIndex = $state(0);
	let manualRecipientFieldElement = $state<HTMLDivElement | null>(null);
	let manualRecipientInputElement = $state<HTMLInputElement | null>(null);
	let manualRecipientSuggestionsElement = $state<HTMLDivElement | null>(null);
	let preview = $state<CommunicationRecipientPreview>({ totalCount: 0, rows: [] });
	let saveLoading = $state(false);
	let sendLoading = $state(false);
	let deleteLoading = $state(false);
	let duplicationLoadingId = $state('');
	let recipientBuilderOpen = $state(false);
	let draftDeleteConfirmOpen = $state(false);
	let unsavedLeaveConfirmOpen = $state(false);
	let baselineDraftStateSignature = $state('');
	let pendingNavigationHref = $state<string | null>(null);
	let activeMessageView = $state<MessageSidebarView>('drafts');
	let unsavedDraftConfirmMode = $state<UnsavedDraftConfirmMode>('leave');
	let editorResetToken = $state(0);
	let richEditorReady = $state(false);

	let allowNextNavigation = false;
	let lastHydratedServerDataSignature = '';

	const canViewHistory = $derived.by(() => permissions.VIEW_COMMUNICATION_HISTORY === true);
	const canPreviewAudience = $derived.by(() => permissions.PREVIEW_COMMUNICATION_AUDIENCE === true);
	const canCreateDraft = $derived.by(() => permissions.CREATE_COMMUNICATION_DRAFT === true);
	const canEditDraft = $derived.by(() => permissions.EDIT_COMMUNICATION_DRAFT === true);
	const canSendCommunication = $derived.by(() => permissions.SEND_COMMUNICATION === true);
	const canDuplicateCommunication = $derived.by(() => permissions.DUPLICATE_COMMUNICATION === true);
	const canDeleteDraft = $derived.by(() => permissions.DELETE_COMMUNICATION_DRAFT === true);
	const canEditCurrentDraft = $derived.by(() =>
		selectedMessage ? selectedMessage.status === 'draft' && canEditDraft : canCreateDraft
	);
	const canDeleteCurrentDraft = $derived.by(
		() => canDeleteDraft && selectedMessage?.status === 'draft' && Boolean(selectedMessage?.id)
	);
	const currentDraftStateSignature = $derived.by(() =>
		buildCommunicationDraftStateSignature({
			subject,
			html: editorHtml,
			json: editorJson,
			recipientGroups,
			manualRecipients
		})
	);
	const hasUnsavedDraftChanges = $derived.by(
		() => canEditCurrentDraft && currentDraftStateSignature !== baselineDraftStateSignature
	);
	const recipientSummaryText = $derived.by(() =>
		preview.totalCount > 0
			? `${preview.totalCount} recipient${preview.totalCount === 1 ? '' : 's'} selected`
			: 'Choose Recipients'
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
	const sidebarFeedItems = $derived.by(() => buildCommunicationSidebarFeed(messages));
	const draftFeedItems = $derived.by(() =>
		sidebarFeedItems.filter((item) => item.kind === 'draft')
	);
	const scheduledFeedItems = $derived.by(() =>
		sidebarFeedItems.filter((item) => item.kind === 'scheduled')
	);
	const historyFeedItems = $derived.by(() =>
		sidebarFeedItems.filter((item) => item.kind === 'history')
	);
	const draftMessageCount = $derived.by(() => draftFeedItems.length);
	const scheduledMessageCount = $derived.by(() => scheduledFeedItems.length);
	const historyMessageCount = $derived.by(() => historyFeedItems.length);
	const visibleSidebarItems = $derived.by(() => {
		switch (activeMessageView) {
			case 'drafts':
				return draftFeedItems;
			case 'scheduled':
				return scheduledFeedItems;
			default:
				return historyFeedItems;
		}
	});

	function formatDateDisplay(value: string | null | undefined): string {
		const normalized = value?.trim() ?? '';
		if (!normalized) {
			return '--';
		}
		const date = new Date(normalized);
		if (Number.isNaN(date.getTime())) {
			return normalized;
		}
		const datePart = new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(date);
		const timePart = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
		return `${datePart}, ${timePart}`;
	}

	function getSidebarItemDateValue(item: CommunicationSidebarFeedItem): string | null {
		return item.kind === 'scheduled'
			? getCommunicationScheduledAt(item.message)
			: getCommunicationHistoryAt(item.message);
	}

	function getSidebarItemDateLabel(item: CommunicationSidebarFeedItem): string {
		if (item.kind === 'draft') {
			return 'Updated';
		}

		if (item.kind === 'scheduled') {
			return 'Scheduled';
		}

		return item.message.sentAt ? 'Sent' : 'Updated';
	}

	function setActiveSidebarView(nextView: MessageSidebarView): void {
		activeMessageView = nextView;
	}

	function getSidebarViewEmptyMessage(view: MessageSidebarView): string {
		switch (view) {
			case 'drafts':
				return 'No drafts yet.';
			case 'scheduled':
				return 'No scheduled messages yet.';
			default:
				return 'No message history yet.';
		}
	}

	function getSidebarItemBadgeClass(item: CommunicationSidebarFeedItem): string {
		if (item.kind === 'draft') {
			return '';
		}
		if (item.kind === 'scheduled') {
			return 'border-secondary-700 bg-secondary-100 text-neutral-950';
		}
		return getMessageStatusBadgeClass(item.message.status);
	}

	function getSidebarItemBadgeText(item: CommunicationSidebarFeedItem): string {
		return item.kind === 'draft' ? 'Draft' : item.message.status;
	}

	function getMessageStatusBadgeClass(status: CommunicationMessageSummary['status']): string {
		switch (status) {
			case 'sent':
				return 'border-primary-700 bg-primary text-primary-foreground';
			case 'failed':
				return 'border-error-700 bg-error-100 text-error-800';
			case 'sending':
				return 'border-secondary-700 bg-secondary-100 text-neutral-950';
			case 'scheduled':
				return 'border-secondary-700 bg-secondary-100 text-neutral-950';
			default:
				return 'border-neutral-950 bg-white text-neutral-950';
		}
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

	function loadMessageIntoComposer(
		message: CommunicationMessageDetail | null,
		nextActiveView: MessageSidebarView = message
			? getCommunicationSidebarViewFromStatus(message.status)
			: getPreferredCommunicationSidebarView(messages)
	): void {
		selectedMessage = message;
		activeMessageView = nextActiveView;
		if (!message) {
			editorResetToken += 1;
		}
		subject = message?.subject ?? '';
		editorHtml = message?.bodyHtml || '<p></p>';
		editorJson = message?.editorJson ?? null;
		recipientGroups = message?.recipientGroups ? [...message.recipientGroups] : [];
		manualRecipients = message?.manualRecipients ? [...message.manualRecipients] : [];
		manualRecipientInput = '';
		manualRecipientSuggestions = [];
		manualRecipientSuggestionQuery = '';
		manualRecipientActiveSuggestionIndex = 0;
		preview = {
			totalCount: message?.recipientCount ?? 0,
			rows: toPreviewRows(message)
		};
		recipientBuilderOpen = false;
		draftDeleteConfirmOpen = false;
		unsavedLeaveConfirmOpen = false;
		unsavedDraftConfirmMode = 'leave';
		pendingNavigationHref = null;
		baselineDraftStateSignature = buildCommunicationDraftStateSignature({
			subject: message?.subject ?? '',
			html: message?.bodyHtml || '<p></p>',
			json: message?.editorJson ?? null,
			recipientGroups: message?.recipientGroups ? [...message.recipientGroups] : [],
			manualRecipients: message?.manualRecipients ? [...message.manualRecipients] : []
		});
	}

	$effect(() => {
		const nextMessages = data.messages ?? [];
		const nextSelectedMessage = data.selectedMessage ?? null;
		const nextHydrationSignature = buildCommunicationPageHydrationSignature({
			messages: nextMessages,
			selectedMessage: nextSelectedMessage,
			filterOptions: data.filterOptions,
			filterOptionsLoaded: data.filterOptionsLoaded
		});
		if (nextHydrationSignature === lastHydratedServerDataSignature) {
			return;
		}

		lastHydratedServerDataSignature = nextHydrationSignature;

		const nextActiveView: MessageSidebarView = nextSelectedMessage
			? getCommunicationSidebarViewFromStatus(nextSelectedMessage.status)
			: getPreferredCommunicationSidebarView(nextMessages);
		messages = nextMessages;
		if (data.filterOptionsLoaded) {
			recipientFilterOptions = data.filterOptions;
			recipientFilterOptionsLoaded = true;
		}
		loadMessageIntoComposer(nextSelectedMessage, nextActiveView);
	});

	onMount(() => {
		richEditorReady = true;
	});

	function updateEditorContent(payload: {
		html: string;
		json: Record<string, unknown> | null;
		text: string;
	}): void {
		editorHtml = payload.html;
		editorJson = payload.json;
	}

	async function navigateWithoutDraftGuard(href: string): Promise<void> {
		allowNextNavigation = true;
		try {
			await goto(href);
			await invalidateAll();
		} finally {
			allowNextNavigation = false;
		}
	}

	async function openNewMessageComposer(): Promise<void> {
		if (selectedMessage === null) {
			loadMessageIntoComposer(null);
			return;
		}

		await navigateWithoutDraftGuard('/dashboard/communications');
	}

	beforeNavigate((navigation) => {
		if (
			typeof window === 'undefined' ||
			allowNextNavigation ||
			!hasUnsavedDraftChanges ||
			!canEditCurrentDraft
		) {
			return;
		}

		if (navigation.willUnload) {
			return;
		}

		navigation.cancel();
		pendingNavigationHref = navigation.to?.url ? navigation.to.url.toString() : null;
		unsavedDraftConfirmMode = 'leave';
		unsavedLeaveConfirmOpen = true;
	});

	$effect(() => {
		if (typeof window === 'undefined' || !hasUnsavedDraftChanges || !canEditCurrentDraft) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	$effect(() => {
		if (typeof window === 'undefined' || manualRecipientSuggestions.length === 0) return;

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (
				manualRecipientFieldElement &&
				target instanceof Node &&
				manualRecipientFieldElement.contains(target)
			) {
				return;
			}

			clearManualRecipientSuggestions();
		};

		window.addEventListener('pointerdown', handlePointerDown);
		return () => {
			window.removeEventListener('pointerdown', handlePointerDown);
		};
	});

	$effect(() => {
		if (manualRecipientSuggestions.length === 0) {
			return;
		}

		void tick().then(() => {
			manualRecipientSuggestionsElement?.focus();
		});
	});

	async function requestPreview(
		nextRecipientGroups: Array<{
			id: string;
			mode: CommunicationRecipientGroupMode;
			filters: CommunicationRecipientGroupDraft['filters'];
		}>,
		nextManualRecipients: CommunicationManualRecipientDraft[] = manualRecipients
	): Promise<{
		recipientGroups: CommunicationRecipientGroupDraft[];
		preview: CommunicationRecipientPreview;
	}> {
		if (!canPreviewAudience) {
			throw new Error('You do not have permission to preview communication recipients.');
		}

		const response = await fetch('/api/communications/preview', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				recipientGroups: nextRecipientGroups,
				manualRecipients: nextManualRecipients
			})
		});
		const payload = await response.json();
		if (!response.ok || payload.success === false) {
			throw new Error(payload.error ?? 'Unable to preview the selected audience.');
		}
		return {
			recipientGroups: payload.data.recipientGroups as CommunicationRecipientGroupDraft[],
			preview: payload.data.messagePreview as CommunicationRecipientPreview
		};
	}

	async function resolveManualRecipientQueries(queries: string[]): Promise<{
		status: 'resolved' | 'ambiguous';
		query: string;
		manualRecipients: CommunicationManualRecipientDraft[];
		suggestions: CommunicationManualRecipientSuggestion[];
	}> {
		const response = await fetch('/api/communications/recipients/resolve', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ queries })
		});
		const payload = await response.json();
		if (!response.ok || payload.success === false) {
			throw new Error(payload.error ?? 'Unable to resolve manual recipients.');
		}
		return {
			status: payload.data.status as 'resolved' | 'ambiguous',
			query: payload.data.query as string,
			manualRecipients: payload.data.manualRecipients as CommunicationManualRecipientDraft[],
			suggestions: payload.data.suggestions as CommunicationManualRecipientSuggestion[]
		};
	}

	function clearManualRecipientSuggestions(): void {
		manualRecipientSuggestions = [];
		manualRecipientSuggestionQuery = '';
		manualRecipientActiveSuggestionIndex = 0;
	}

	async function focusManualRecipientInputAtEnd(): Promise<void> {
		await tick();
		if (!manualRecipientInputElement) {
			return;
		}

		manualRecipientInputElement.focus();
		const caretPosition = manualRecipientInputElement.value.length;
		manualRecipientInputElement.setSelectionRange(caretPosition, caretPosition);
	}

	async function syncManualRecipients(
		nextManualRecipients: CommunicationManualRecipientDraft[],
		input?: {
			clearSuggestions?: boolean;
		}
	): Promise<void> {
		const previewResult = await requestPreview(recipientGroups, nextManualRecipients);
		manualRecipients = nextManualRecipients;
		recipientGroups = previewResult.recipientGroups;
		preview = previewResult.preview;
		if (input?.clearSuggestions ?? true) {
			clearManualRecipientSuggestions();
		}
	}

	async function ensureRecipientFilterOptionsLoaded(): Promise<void> {
		if (recipientFilterOptionsLoaded || recipientFilterOptionsLoading) {
			return;
		}

		recipientFilterOptionsLoading = true;
		try {
			const response = await fetch('/api/communications/filter-options');
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to load recipient filters.');
			}

			recipientFilterOptions = payload.data.filterOptions as CommunicationFilterOptions;
			recipientFilterOptionsLoaded = true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to load recipient filters.');
		} finally {
			recipientFilterOptionsLoading = false;
		}
	}

	function openRecipientBuilder(): void {
		if (!canPreviewAudience || !canEditCurrentDraft) {
			return;
		}

		recipientBuilderOpen = true;
		void ensureRecipientFilterOptionsLoaded();
	}

	async function commitManualRecipientQueries(
		queries: string[],
		fallbackInput = ''
	): Promise<void> {
		const normalizedQueries = queries
			.map((query) => query.trim())
			.filter((query) => query.length > 0);
		if (normalizedQueries.length === 0) {
			return;
		}
		if (!canEditCurrentDraft || !canPreviewAudience) {
			toast.error('You do not have permission to add manual recipients.');
			return;
		}

		manualRecipientLoading = true;
		try {
			let nextManualRecipients = manualRecipients;
			for (const query of normalizedQueries) {
				const resolution = await resolveManualRecipientQueries([query]);
				if (resolution.status === 'ambiguous') {
					if (nextManualRecipients !== manualRecipients) {
						await syncManualRecipients(nextManualRecipients, { clearSuggestions: false });
					}
					manualRecipientInput = resolution.query;
					manualRecipientSuggestionQuery = resolution.query;
					manualRecipientSuggestions = filterCommunicationManualRecipientSuggestions(
						nextManualRecipients,
						resolution.suggestions
					);
					manualRecipientActiveSuggestionIndex = 0;
					return;
				}

				nextManualRecipients = mergeCommunicationManualRecipients(
					nextManualRecipients,
					resolution.manualRecipients
				);
			}

			await syncManualRecipients(nextManualRecipients);
			manualRecipientInput = '';
			await focusManualRecipientInputAtEnd();
		} catch (error) {
			manualRecipientInput = fallbackInput.trimStart();
			clearManualRecipientSuggestions();
			toast.error(
				error instanceof Error ? error.message : 'Unable to add the selected manual recipients.'
			);
		} finally {
			manualRecipientLoading = false;
		}
	}

	function moveManualRecipientSuggestion(direction: 1 | -1): void {
		if (manualRecipientSuggestions.length === 0) {
			return;
		}

		manualRecipientActiveSuggestionIndex =
			(manualRecipientActiveSuggestionIndex + direction + manualRecipientSuggestions.length) %
			manualRecipientSuggestions.length;
	}

	async function handleManualRecipientInputChange(value: string): Promise<void> {
		manualRecipientInput = value;
		if (manualRecipientSuggestions.length > 0) {
			clearManualRecipientSuggestions();
		}
		const { tokens, remainder } = splitCommunicationManualRecipientInput(value);
		if (tokens.length === 0) {
			return;
		}

		manualRecipientInput = remainder.trimStart();
		await commitManualRecipientQueries(tokens, value);
	}

	async function removeManualRecipient(index: number): Promise<void> {
		const nextManualRecipients = manualRecipients.filter(
			(_, currentIndex) => currentIndex !== index
		);
		manualRecipientLoading = true;
		try {
			await syncManualRecipients(nextManualRecipients);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Unable to remove the selected recipient.'
			);
		} finally {
			manualRecipientLoading = false;
			void focusManualRecipientInputAtEnd();
		}
	}

	async function applyManualRecipientSuggestion(
		recipient: CommunicationManualRecipientDraft
	): Promise<void> {
		manualRecipientLoading = true;
		try {
			const nextManualRecipients = mergeCommunicationManualRecipients(manualRecipients, [
				recipient
			]);
			await syncManualRecipients(nextManualRecipients);
			manualRecipientInput = '';
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to add the selected recipient.');
		} finally {
			manualRecipientLoading = false;
			void focusManualRecipientInputAtEnd();
		}
	}

	async function saveDraftMessage(input?: {
		navigateToSavedDraft?: boolean;
		successToast?: string | null;
	}): Promise<string | null> {
		if (!canEditCurrentDraft) {
			toast.error('You do not have permission to save this draft.');
			return null;
		}

		saveLoading = true;
		try {
			const endpoint = selectedMessage?.id
				? `/api/communications/${selectedMessage.id}`
				: '/api/communications';
			const method = selectedMessage?.id ? 'PATCH' : 'POST';
			const response = await fetch(endpoint, {
				method,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					subject,
					editorJson,
					bodyHtml: editorHtml,
					manualRecipients,
					recipientGroups: recipientGroups.map((recipientGroup) => ({
						id: recipientGroup.id,
						mode: recipientGroup.mode,
						filters: recipientGroup.filters
					}))
				})
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to save this draft.');
			}
			const messageId = payload.data.messageId as string;
			if (input?.navigateToSavedDraft ?? true) {
				await navigateWithoutDraftGuard(`/dashboard/communications?messageId=${messageId}`);
			} else {
				baselineDraftStateSignature = currentDraftStateSignature;
			}
			if (input?.successToast !== null) {
				toast.success(input?.successToast ?? 'Draft saved.');
			}
			return messageId;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to save this draft.');
			return null;
		} finally {
			saveLoading = false;
		}
	}

	async function sendMessageNow(): Promise<void> {
		if (!canSendCommunication) {
			toast.error('You do not have permission to send communications.');
			return;
		}

		if (!selectedMessage?.id) {
			toast.error('Save the draft before sending.');
			return;
		}
		sendLoading = true;
		try {
			const response = await fetch(`/api/communications/${selectedMessage.id}/send`, {
				method: 'POST'
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to send this message.');
			}
			await navigateWithoutDraftGuard(`/dashboard/communications?messageId=${selectedMessage.id}`);
			toast.success('Communication sent.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to send this message.');
		} finally {
			sendLoading = false;
		}
	}

	async function openHistoryMessage(messageId: string): Promise<void> {
		if (!canViewHistory) {
			toast.error('You do not have permission to view message history.');
			return;
		}

		await navigateWithoutDraftGuard(`/dashboard/communications?messageId=${messageId}`);
	}

	async function duplicateHistoryMessage(messageId: string): Promise<void> {
		if (!canDuplicateCommunication) {
			toast.error('You do not have permission to duplicate messages.');
			return;
		}

		duplicationLoadingId = messageId;
		try {
			const response = await fetch(`/api/communications/${messageId}/duplicate`, {
				method: 'POST'
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to duplicate this message.');
			}
			await navigateWithoutDraftGuard(
				`/dashboard/communications?messageId=${payload.data.messageId}`
			);
			toast.success('Message duplicated into a new draft.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to duplicate this message.');
		} finally {
			duplicationLoadingId = '';
		}
	}

	function startNewMessage(): void {
		if (!canCreateDraft) {
			toast.error('You do not have permission to create drafts.');
			return;
		}

		if (hasUnsavedDraftChanges && canEditCurrentDraft) {
			unsavedDraftConfirmMode = 'new-message';
			unsavedLeaveConfirmOpen = true;
			return;
		}

		void openNewMessageComposer();
	}

	async function deleteCurrentDraft(): Promise<void> {
		if (!canDeleteCurrentDraft || !selectedMessage?.id) {
			toast.error('You do not have permission to delete this draft.');
			return;
		}

		deleteLoading = true;
		try {
			const response = await fetch(`/api/communications/${selectedMessage.id}`, {
				method: 'DELETE'
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.error ?? 'Unable to delete this draft.');
			}

			draftDeleteConfirmOpen = false;
			loadMessageIntoComposer(null);
			await navigateWithoutDraftGuard('/dashboard/communications');
			toast.success('Draft deleted.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Unable to delete this draft.');
		} finally {
			deleteLoading = false;
		}
	}

	async function confirmSaveBeforeLeaving(): Promise<void> {
		const confirmMode = unsavedDraftConfirmMode;
		const pendingHref = pendingNavigationHref;
		const savedMessageId = await saveDraftMessage({
			navigateToSavedDraft: false,
			successToast: 'Draft saved.'
		});
		if (!savedMessageId) {
			return;
		}

		unsavedLeaveConfirmOpen = false;
		pendingNavigationHref = null;
		unsavedDraftConfirmMode = 'leave';

		if (confirmMode === 'new-message') {
			await openNewMessageComposer();
			return;
		}

		if (pendingHref) {
			await navigateWithoutDraftGuard(pendingHref);
		}
	}

	function keepEditingDraft(): void {
		unsavedLeaveConfirmOpen = false;
		pendingNavigationHref = null;
		unsavedDraftConfirmMode = 'leave';
	}

	async function discardUnsavedDraftAndContinue(): Promise<void> {
		const confirmMode = unsavedDraftConfirmMode;
		const pendingHref = pendingNavigationHref;
		unsavedLeaveConfirmOpen = false;
		pendingNavigationHref = null;
		unsavedDraftConfirmMode = 'leave';

		if (confirmMode === 'new-message') {
			await openNewMessageComposer();
			return;
		}

		if (pendingHref) {
			await navigateWithoutDraftGuard(pendingHref);
		}
	}

	function applyRecipientBuilder(payload: {
		recipientGroups: CommunicationRecipientGroupDraft[];
		preview: CommunicationRecipientPreview;
	}): void {
		recipientGroups = payload.recipientGroups;
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
					<div
						class="bg-primary text-primary-foreground border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					>
						<IconMessageCircle class="h-6 w-6 lg:h-7 lg:w-7" />
					</div>
					<h1
						class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
					>
						{pageLabel}
					</h1>
				</div>
				<DashboardSearchLauncher />
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6">
		<div class="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)] gap-6">
			<div class="min-w-0 space-y-4">
				<section class="section-shell min-w-0">
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<h2 class="dashboard-section-title text-neutral-950">Message Composer</h2>
							<button
								type="button"
								class="button-primary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer"
								onclick={startNewMessage}
								disabled={!canCreateDraft}
							>
								<IconPlus class="h-4 w-4" />
								<span>New Message</span>
							</button>
						</div>
					</div>
					<div class="p-4 space-y-4">
						<div class="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
							<div class="space-y-2">
								<label
									class="mb-1 block text-sm font-sans text-neutral-950"
									for="communication-recipient-trigger">To</label
								>
								<button
									id="communication-recipient-trigger"
									type="button"
									class="button-secondary-outlined min-h-10 w-full items-center justify-between px-4 py-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
									onclick={openRecipientBuilder}
									disabled={!canPreviewAudience || !canEditCurrentDraft}
								>
									<span class="truncate text-sm text-neutral-950">{recipientSummaryText}</span>
									<span class="text-[11px] font-bold uppercase tracking-wide text-neutral-700">
										Recipient Groups
									</span>
								</button>
							</div>

							<div class="space-y-2">
								<label
									class="mb-1 block text-sm font-sans text-neutral-950"
									for="communication-manual-recipient-input">Manual Recipients</label
								>
								<div class="relative" bind:this={manualRecipientFieldElement}>
									<div class="h-10 w-full border-2 border-secondary-500 bg-white px-3">
										<div
											class="flex h-full items-center gap-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-thin"
										>
											{#each manualRecipients as recipient, index (recipient.userId ?? recipient.email)}
												<HoverTooltip
													text={`${recipient.fullName} (${recipient.email})`}
													case="preserve"
												>
													<span
														class="inline-flex shrink-0 items-center gap-1.5 border border-secondary-500 bg-secondary-50 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-secondary-950"
													>
														<span class="max-w-[9rem] truncate">{recipient.fullName}</span>
														{#if canEditCurrentDraft}
															<button
																type="button"
																class="cursor-pointer text-[11px] leading-none text-secondary-900"
																aria-label={`Remove ${recipient.fullName}`}
																onclick={() => void removeManualRecipient(index)}
																disabled={manualRecipientLoading}
															>
																×
															</button>
														{/if}
													</span>
												</HoverTooltip>
											{/each}
											<input
												id="communication-manual-recipient-input"
												bind:this={manualRecipientInputElement}
												class="no-date-input-focus-chrome h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-xs leading-none text-neutral-950"
												style="outline: 0px !important; box-shadow: none !important;"
												type="text"
												value={manualRecipientInput}
												name="communication-manual-recipients"
												role="combobox"
												aria-autocomplete="list"
												aria-expanded={manualRecipientSuggestions.length > 0}
												aria-controls="communication-manual-recipient-suggestions"
												aria-activedescendant={manualRecipientSuggestions.length > 0
													? `communication-manual-recipient-suggestion-${manualRecipientActiveSuggestionIndex}`
													: undefined}
												placeholder="Type a member name, email, or phone"
												autocomplete="off"
												autocorrect="off"
												autocapitalize="none"
												spellcheck="false"
												disabled={!canPreviewAudience || !canEditCurrentDraft}
												oninput={(event) =>
													void handleManualRecipientInputChange(event.currentTarget.value)}
												onkeydown={(event) => {
													if (manualRecipientSuggestions.length > 0) {
														if (event.key === 'ArrowDown') {
															event.preventDefault();
															moveManualRecipientSuggestion(1);
															return;
														}
														if (event.key === 'ArrowUp') {
															event.preventDefault();
															moveManualRecipientSuggestion(-1);
															return;
														}
														if (event.key === 'Enter') {
															event.preventDefault();
															const activeSuggestion =
																manualRecipientSuggestions[manualRecipientActiveSuggestionIndex] ??
																manualRecipientSuggestions[0];
															if (activeSuggestion) {
																void applyManualRecipientSuggestion(activeSuggestion);
															}
															return;
														}
														if (event.key === 'Escape') {
															event.preventDefault();
															clearManualRecipientSuggestions();
															return;
														}
													}

													if (event.key === 'Enter' || (event.key === ',' && !event.shiftKey)) {
														event.preventDefault();
														const pendingValue = manualRecipientInput.trim();
														manualRecipientInput = '';
														void commitManualRecipientQueries([pendingValue], pendingValue);
														return;
													}

													if (
														event.key === 'Backspace' &&
														manualRecipientInput.trim().length === 0 &&
														manualRecipients.length > 0
													) {
														event.preventDefault();
														void removeManualRecipient(manualRecipients.length - 1);
													}
												}}
												onblur={() => {
													if (manualRecipientSuggestions.length > 0) {
														return;
													}

													const pendingValue = manualRecipientInput.trim();
													if (!pendingValue) return;
													manualRecipientInput = '';
													void commitManualRecipientQueries([pendingValue], pendingValue);
												}}
											/>
										</div>
									</div>
									{#if manualRecipientSuggestions.length > 0}
										<div
											id="communication-manual-recipient-suggestions"
											bind:this={manualRecipientSuggestionsElement}
											class="absolute left-0 right-0 top-full z-30 mt-1 max-h-54 overflow-y-auto border-2 border-neutral-950 bg-white scrollbar-thin"
											role="listbox"
											aria-label="Manual recipient suggestions"
											tabindex="-1"
											onkeydown={(event) => {
												if (event.key === 'ArrowDown') {
													event.preventDefault();
													moveManualRecipientSuggestion(1);
													return;
												}
												if (event.key === 'ArrowUp') {
													event.preventDefault();
													moveManualRecipientSuggestion(-1);
													return;
												}
												if (event.key === 'Enter') {
													event.preventDefault();
													const activeSuggestion =
														manualRecipientSuggestions[manualRecipientActiveSuggestionIndex] ??
														manualRecipientSuggestions[0];
													if (activeSuggestion) {
														void applyManualRecipientSuggestion(activeSuggestion);
													}
													return;
												}
												if (event.key === 'Escape') {
													event.preventDefault();
													clearManualRecipientSuggestions();
													void focusManualRecipientInputAtEnd();
													return;
												}
												if (event.key === 'Backspace') {
													event.preventDefault();
													manualRecipientInput = manualRecipientInput.slice(0, -1);
													clearManualRecipientSuggestions();
													void focusManualRecipientInputAtEnd();
													return;
												}
												if (
													event.key.length === 1 &&
													!event.altKey &&
													!event.ctrlKey &&
													!event.metaKey
												) {
													event.preventDefault();
													manualRecipientInput = `${manualRecipientInput}${event.key}`;
													clearManualRecipientSuggestions();
													void focusManualRecipientInputAtEnd();
												}
											}}
										>
											<div
												class="border-b border-neutral-400 bg-neutral-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-700"
											>
												Multiple matches for "{manualRecipientSuggestionQuery}"
											</div>
											{#each manualRecipientSuggestions as suggestion, index (suggestion.userId ?? suggestion.email)}
												<button
													id={`communication-manual-recipient-suggestion-${index}`}
													type="button"
													role="option"
													aria-selected={index === manualRecipientActiveSuggestionIndex}
													class={`flex w-full items-center gap-2 border-b border-neutral-300 px-3 py-2 text-left text-sm cursor-pointer last:border-b-0 ${
														index === manualRecipientActiveSuggestionIndex
															? 'bg-neutral-100 text-neutral-950'
															: 'bg-white text-neutral-900'
													}`}
													onmousedown={(event) => {
														event.preventDefault();
													}}
													onmouseenter={() => {
														manualRecipientActiveSuggestionIndex = index;
													}}
													onclick={() => void applyManualRecipientSuggestion(suggestion)}
												>
													<span class="min-w-0 flex-1 truncate text-sm text-neutral-950">
														<span class="font-semibold">{suggestion.fullName}</span>
														<span class="ml-2 text-xs text-neutral-700">
															{suggestion.email}
														</span>
													</span>
													<span class="shrink-0 text-xs font-semibold text-neutral-700">
														{suggestion.lastActiveSeasonName ?? 'Never Active'}
													</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</div>

						<div class="space-y-2">
							<label
								class="mb-1 block text-sm font-sans text-neutral-950"
								for="communication-subject">Email Subject</label
							>
							<input
								id="communication-subject"
								class="input-secondary min-h-10"
								type="text"
								bind:value={subject}
								name="communication-subject"
								autocomplete="off"
								autocorrect="off"
								autocapitalize="sentences"
								spellcheck="false"
								disabled={!canEditCurrentDraft}
							/>
						</div>

						{#if richEditorReady}
							{#key editorResetToken}
								<CommunicationRichEditor
									initialHtml={editorHtml}
									initialJson={editorJson}
									editable={canEditCurrentDraft}
									onChange={updateEditorContent}
								/>
							{/key}
						{:else}
							<div class="min-h-[22rem] border border-neutral-950 bg-white px-4 py-4">
								<div
									class="flex h-full min-h-[22rem] items-center justify-center text-sm text-neutral-700"
								>
									Loading editor...
								</div>
							</div>
						{/if}

						<div
							class="flex flex-col gap-3 border-t border-neutral-950 pt-4 lg:flex-row lg:items-end lg:justify-between"
						>
							<div class="flex flex-wrap gap-2">
								{#each [{ label: 'Email', icon: IconMail, active: true }, { label: 'SMS', icon: IconDeviceMobileMessage, active: false }, { label: 'In-app', icon: IconBell, active: false }] as chip}
									<div
										class={`inline-flex items-center gap-2 border px-3 py-2 text-sm ${chip.active ? 'border-primary-700 bg-primary text-primary-foreground' : 'border-secondary-300 bg-white text-neutral-700 opacity-65'}`}
									>
										<chip.icon class="h-4 w-4" />
										<span>{chip.label}</span>
									</div>
								{/each}
							</div>

							<div class="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
								{#if canDeleteCurrentDraft}
									<button
										type="button"
										class="button-secondary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer border-error-700 text-error-700 hover:bg-error-50"
										onclick={() => {
											draftDeleteConfirmOpen = true;
										}}
										disabled={deleteLoading}
									>
										<IconTrash class="h-4 w-4" />
										<span>{deleteLoading ? 'Deleting...' : 'Delete Draft'}</span>
									</button>
								{/if}
								<button
									type="button"
									class="button-secondary-outlined px-3 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer"
									onclick={() => void saveDraftMessage()}
									disabled={saveLoading || !canEditCurrentDraft}
								>
									<IconRefresh class="h-4 w-4" />
									<span>{saveLoading ? 'Saving...' : 'Save Draft'}</span>
								</button>
								<SplitAddAction
									label={sendLoading ? 'Sending...' : 'Send Now'}
									options={sendActionOptions}
									ariaLabel="Open send options"
									buttonClass={HEADER_SPLIT_SEND_BUTTON_CLASS}
									menuButtonClass={HEADER_SPLIT_SEND_MENU_BUTTON_CLASS}
									disabled={sendLoading ||
										!canSendCommunication ||
										!selectedMessage?.id ||
										selectedMessage?.status !== 'draft'}
									on:click={() => void sendMessageNow()}
									on:action={() => {
										toast.info('Send later is coming soon.');
									}}
								/>
							</div>
						</div>
					</div>
				</section>
			</div>

			{#if canViewHistory}
				<aside class="w-full min-w-0 space-y-6">
					<section class="section-shell min-w-0">
						<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
							<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
								<h2 class="dashboard-section-title text-neutral-950">Messages</h2>
								<div
									class="messages-tab-scroll min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none]"
								>
									<div
										class="flex w-max min-w-full flex-nowrap items-stretch border-2 border-neutral-950 bg-white"
									>
										{#each [{ value: 'drafts', label: 'Drafts', count: draftMessageCount }, { value: 'scheduled', label: 'Scheduled', count: scheduledMessageCount }, { value: 'history', label: 'Sent', count: historyMessageCount }] as option}
											<button
												type="button"
												class={`border-r-2 border-neutral-950 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] cursor-pointer whitespace-nowrap last:border-r-0 ${
													activeMessageView === option.value
														? 'bg-secondary-100 text-secondary-950'
														: 'bg-white text-neutral-950 hover:bg-neutral-100'
												}`}
												onclick={() => setActiveSidebarView(option.value as MessageSidebarView)}
											>
												<span>{option.label}</span>
												<span class="ml-1.5 text-neutral-500">{option.count}</span>
											</button>
										{/each}
									</div>
								</div>
							</div>
						</div>
						<div class="p-4">
							{#if visibleSidebarItems.length === 0}
								<div class="border border-neutral-950 bg-white p-4 text-sm text-neutral-700">
									{getSidebarViewEmptyMessage(activeMessageView)}
								</div>
							{:else}
								<div class="max-h-[56rem] space-y-3 overflow-y-auto pr-1">
									{#each visibleSidebarItems as item}
										{@const itemDateValue = getSidebarItemDateValue(item)}
										<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
										<article
											class={`border-2 p-3 transition-colors ${
												item.message.status === 'draft' ? 'cursor-pointer' : ''
											} ${selectedMessage?.id === item.message.id ? 'border-secondary-700 bg-secondary-50' : 'border-neutral-950 bg-white'}`}
											role={item.message.status === 'draft' ? 'button' : undefined}
											tabindex={item.message.status === 'draft' ? 0 : undefined}
											aria-label={item.message.status === 'draft'
												? `Open draft ${item.message.subject}`
												: undefined}
											onclick={() => {
												if (item.message.status !== 'draft') return;
												void openHistoryMessage(item.message.id);
											}}
											onkeydown={(event) => {
												if (item.message.status !== 'draft') return;
												if (event.key !== 'Enter' && event.key !== ' ') return;
												event.preventDefault();
												void openHistoryMessage(item.message.id);
											}}
										>
											<div class="space-y-3">
												<div class="flex items-start justify-between gap-3">
													<div class="min-w-0 flex-1 space-y-2">
														{#if item.kind !== 'draft'}
															<div
																class="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide"
															>
																<span
																	class={`inline-flex border px-2 py-1 ${getSidebarItemBadgeClass(item)}`}
																>
																	{getSidebarItemBadgeText(item)}
																</span>
															</div>
														{/if}
														<HoverTooltip text={item.message.subject} case="preserve">
															<h3
																class="line-clamp-1 text-[1.6rem] leading-tight font-bold text-neutral-950"
															>
																{item.message.subject}
															</h3>
														</HoverTooltip>
													</div>
													<p class="shrink-0 text-sm font-semibold text-neutral-950">
														{#if itemDateValue}
															<DateHoverText
																display={formatDateDisplay(itemDateValue)}
																value={itemDateValue}
																includeTime
															/>
														{:else}
															--
														{/if}
													</p>
												</div>

												<div
													class="flex flex-col gap-3 border-t border-neutral-300 pt-3 lg:flex-row lg:items-center lg:justify-between"
												>
													<div class="space-y-1 text-sm text-neutral-950">
														<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
															<HoverTooltip text="Recipient groups">
																<p class="flex items-center gap-2">
																	<IconFilter
																		class="h-4 w-4 shrink-0 text-neutral-950 opacity-100"
																		color="currentColor"
																		stroke={2.1}
																	/>
																	<span>{item.message.recipientGroupCount}</span>
																</p>
															</HoverTooltip>
															<HoverTooltip text="Audience recipients">
																<p class="flex items-center gap-2">
																	<IconUsersGroup
																		class="h-4 w-4 shrink-0 text-neutral-950 opacity-100"
																		color="currentColor"
																		stroke={2.1}
																	/>
																	<span>{item.message.recipientCount}</span>
																</p>
															</HoverTooltip>
														</div>
														<HoverTooltip text="Author">
															<p class="flex items-center gap-2">
																<IconUserEdit
																	class="h-4 w-4 shrink-0 text-neutral-950 opacity-100"
																	color="currentColor"
																	stroke={2.1}
																/>
																<span>{item.message.createdByName}</span>
															</p>
														</HoverTooltip>
														{#if item.message.failureMessage}
															<p class="text-xs text-error-700">{item.message.failureMessage}</p>
														{/if}
													</div>

													<div class="flex flex-wrap items-center justify-end gap-2">
														{#if item.message.status !== 'draft'}
															<HoverTooltip text="View message">
																<button
																	type="button"
																	class="button-neutral-outlined dashboard-icon-button cursor-pointer text-neutral-950 border-neutral-950 hover:bg-neutral-100"
																	aria-label="View message"
																	onclick={() => void openHistoryMessage(item.message.id)}
																>
																	<IconEye
																		class="h-[1.05rem] w-[1.05rem] text-neutral-950 opacity-100"
																		color="currentColor"
																		stroke={2.2}
																	/>
																</button>
															</HoverTooltip>
														{/if}
														<HoverTooltip text="Duplicate into a new draft">
															<button
																type="button"
																class="button-neutral-outlined dashboard-icon-button cursor-pointer text-neutral-950 border-neutral-950 hover:bg-neutral-100"
																aria-label="Duplicate message"
																onclick={(event) => {
																	event.stopPropagation();
																	void duplicateHistoryMessage(item.message.id);
																}}
																disabled={duplicationLoadingId === item.message.id ||
																	!canDuplicateCommunication}
															>
																<IconCopy
																	class="h-[1.05rem] w-[1.05rem] text-neutral-950 opacity-100"
																	color="currentColor"
																	stroke={2.2}
																/>
															</button>
														</HoverTooltip>
													</div>
												</div>
											</div>
										</article>
									{/each}
								</div>
							{/if}
						</div>
					</section>
				</aside>
			{/if}
		</div>

		<RecipientBuilderWizard
			open={recipientBuilderOpen && canPreviewAudience && canEditCurrentDraft}
			filterOptions={recipientFilterOptions}
			filterOptionsLoading={recipientFilterOptionsLoading}
			initialRecipientGroups={recipientGroups}
			initialPreview={preview}
			onPreviewRequest={requestPreview}
			onApply={applyRecipientBuilder}
			onRequestClose={() => {
				recipientBuilderOpen = false;
			}}
		/>

		<WizardUnsavedConfirm
			open={draftDeleteConfirmOpen}
			title="Delete Draft?"
			message="Delete this draft and any unsaved changes? This cannot be undone."
			confirmLabel={deleteLoading ? 'Deleting...' : 'Delete Draft'}
			cancelLabel="Keep Draft"
			on:confirm={() => void deleteCurrentDraft()}
			on:cancel={() => {
				if (deleteLoading) return;
				draftDeleteConfirmOpen = false;
			}}
		/>

		<WizardUnsavedConfirm
			open={unsavedLeaveConfirmOpen}
			title={unsavedDraftConfirmMode === 'new-message'
				? 'Save Draft Before Starting New Message?'
				: 'Save Draft Before Leaving?'}
			message={unsavedDraftConfirmMode === 'new-message'
				? 'You have unsaved draft changes. Save or discard this draft before clearing the composer?'
				: 'You have unsaved draft changes. Save or discard this draft before leaving the page?'}
			confirmLabel={saveLoading ? 'Saving...' : 'Save Draft'}
			cancelLabel="Keep Editing"
			confirmVariant="primary"
			secondaryLabel="Discard Draft"
			secondaryVariant="error"
			on:confirm={() => void confirmSaveBeforeLeaving()}
			on:cancel={keepEditingDraft}
			on:secondary={() => void discardUnsavedDraftAndContinue()}
		/>
	</div>

	<style>
		.messages-tab-scroll::-webkit-scrollbar {
			display: none;
		}
	</style>
</div>
