import type {
	CommunicationManualRecipientDraft,
	CommunicationRecipientGroupDraft,
	CommunicationRecipientGroupFilter,
	CommunicationMessageDetail,
	CommunicationMessageSummary,
	CommunicationRecipientPreview,
	RecipientPreviewRow
} from '$lib/communications/types.js';

export interface CommunicationAudienceRow {
	userId: string | null;
	membershipId: string | null;
	email: string | null;
	cellPhone: string | null;
	firstName: string | null;
	lastName: string | null;
	studentId: string | null;
	memberRole: string | null;
	memberSex: string | null;
	teamId: string | null;
	teamName: string | null;
	teamStatus: string | null;
	divisionId: string | null;
	divisionName: string | null;
	leagueId: string | null;
	leagueName: string | null;
	offeringId: string | null;
	offeringName: string | null;
	seasonId: string | null;
	seasonName: string | null;
	seasonStartDate: string | null;
	seasonEndDate: string | null;
	seasonIsCurrent: number | null;
	isCaptain: number | null;
	isCoCaptain: number | null;
	rosterStatus: string | null;
}

export interface CommunicationStoragePort {
	listMessageSummaries(clientId: string, limit?: number): Promise<CommunicationMessageSummary[]>;
	getMessageDetail(clientId: string, messageId: string): Promise<CommunicationMessageDetail | null>;
	createDraft(input: {
		clientId: string;
		subject: string;
		editorJson: string | null;
		bodyHtml: string;
		bodyText: string;
		createdUser: string;
		updatedUser: string;
	}): Promise<{ id: string }>;
	updateDraft(input: {
		clientId: string;
		messageId: string;
		subject: string;
		editorJson: string | null;
		bodyHtml: string;
		bodyText: string;
		updatedUser: string;
	}): Promise<boolean>;
	deleteDraft(input: { clientId: string; messageId: string }): Promise<boolean>;
	replaceRecipientGroups(input: {
		messageId: string;
		recipientGroups: CommunicationRecipientGroupDraft[];
	}): Promise<void>;
	replaceManualRecipients(input: {
		messageId: string;
		manualRecipients: CommunicationManualRecipientDraft[];
	}): Promise<void>;
	replaceRecipients(input: {
		messageId: string;
		recipients: RecipientPreviewRow[];
	}): Promise<void>;
	markMessageSending(input: {
		clientId: string;
		messageId: string;
		recipientCount: number;
		updatedUser: string;
	}): Promise<boolean>;
	markMessageSent(input: {
		clientId: string;
		messageId: string;
		recipientCount: number;
		providerMessageId: string | null;
		updatedUser: string;
	}): Promise<boolean>;
	markMessageFailed(input: {
		clientId: string;
		messageId: string;
		failureMessage: string;
		updatedUser: string;
	}): Promise<boolean>;
	duplicateMessage(input: {
		clientId: string;
		messageId: string;
		createdUser: string;
		updatedUser: string;
	}): Promise<{ id: string } | null>;
	listAudienceRows(clientId: string): Promise<CommunicationAudienceRow[]>;
}

export interface RecipientGroupPreviewResult {
	preview: CommunicationRecipientPreview;
	storedRecipientGroup: CommunicationRecipientGroupDraft;
}

export interface CommunicationDraftPayload {
	messageId?: string;
	subject: string;
	editorJson: Record<string, unknown> | null;
	bodyHtml: string;
	manualRecipients: CommunicationManualRecipientDraft[];
	recipientGroups: Array<{
		id: string;
		mode: 'include' | 'exclude';
		filters: CommunicationRecipientGroupFilter;
	}>;
}
