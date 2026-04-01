export type CommunicationChannel = 'email';
export type CommunicationMessageStatus = 'draft' | 'sending' | 'sent' | 'failed';
export type CommunicationBatchMode = 'include' | 'exclude';
export type CommunicationRosterRole = 'captain' | 'co-captain' | 'player';
export type CommunicationTeamStatus = 'active' | 'waitlist';

export interface CommunicationBatchFilter {
	memberQuery: string;
	memberRole: '' | 'participant' | 'manager' | 'admin' | 'dev';
	memberSex: '' | 'M' | 'F';
	seasonId: string;
	offeringId: string;
	leagueId: string;
	divisionId: string;
	teamId: string;
	rosterRole: '' | CommunicationRosterRole;
	teamStatus: '' | CommunicationTeamStatus;
}

export interface CommunicationBatchDraft {
	id: string;
	mode: CommunicationBatchMode;
	filters: CommunicationBatchFilter;
	summaryText: string;
	resolvedRecipientCount: number;
}

export interface RecipientPreviewRow {
	userId: string;
	membershipId: string;
	fullName: string;
	email: string;
	studentId: string | null;
	memberRole: string;
	memberSex: string | null;
	teamName: string | null;
	divisionName: string | null;
	leagueName: string | null;
	offeringName: string | null;
	seasonName: string | null;
	rosterRole: CommunicationRosterRole | null;
	teamStatus: string | null;
}

export interface CommunicationRecipientPreview {
	totalCount: number;
	rows: RecipientPreviewRow[];
}

export interface CommunicationMessageSummary {
	id: string;
	channel: CommunicationChannel;
	status: CommunicationMessageStatus;
	subject: string;
	recipientCount: number;
	createdAt: string | null;
	updatedAt: string | null;
	sentAt: string | null;
	createdByName: string;
	batchSummary: string;
	failureMessage: string | null;
}

export interface CommunicationMessageRecipient {
	userId: string | null;
	email: string;
	fullName: string;
	resolutionMetadata: string | null;
}

export interface CommunicationMessageDetail extends CommunicationMessageSummary {
	editorJson: Record<string, unknown> | null;
	bodyHtml: string;
	bodyText: string;
	batches: CommunicationBatchDraft[];
	recipients: CommunicationMessageRecipient[];
}

export interface CommunicationFilterOption {
	value: string;
	label: string;
}

export interface CommunicationFilterOptions {
	memberRoles: Array<{ value: CommunicationBatchFilter['memberRole']; label: string }>;
	memberSexes: Array<{ value: CommunicationBatchFilter['memberSex']; label: string }>;
	rosterRoles: Array<{ value: CommunicationBatchFilter['rosterRole']; label: string }>;
	teamStatuses: Array<{ value: CommunicationBatchFilter['teamStatus']; label: string }>;
	seasons: CommunicationFilterOption[];
	offerings: Array<CommunicationFilterOption & { seasonId: string | null }>;
	leagues: Array<
		CommunicationFilterOption & {
			seasonId: string | null;
			offeringId: string | null;
		}
	>;
	divisions: Array<
		CommunicationFilterOption & {
			leagueId: string | null;
		}
	>;
	teams: Array<
		CommunicationFilterOption & {
			divisionId: string | null;
		}
	>;
}

export interface CommunicationAudiencePreviewResponse {
	messagePreview: CommunicationRecipientPreview;
	batches: CommunicationBatchDraft[];
}

export const EMPTY_COMMUNICATION_BATCH_FILTER: CommunicationBatchFilter = {
	memberQuery: '',
	memberRole: '',
	memberSex: '',
	seasonId: '',
	offeringId: '',
	leagueId: '',
	divisionId: '',
	teamId: '',
	rosterRole: '',
	teamStatus: ''
};
