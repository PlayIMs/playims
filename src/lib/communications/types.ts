export type CommunicationChannel = 'email';
export type CommunicationMessageStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type CommunicationRecipientGroupMode = 'include' | 'exclude';
export type CommunicationRosterRole = 'captain' | 'co-captain' | 'player';
export type CommunicationTeamStatus = 'active' | 'waitlist';

export interface CommunicationRecipientGroupFilter {
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

export interface CommunicationRecipientGroupDraft {
	id: string;
	mode: CommunicationRecipientGroupMode;
	filters: CommunicationRecipientGroupFilter;
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

export interface CommunicationManualRecipientDraft {
	userId: string | null;
	email: string;
	fullName: string;
}

export interface CommunicationManualRecipientSuggestion extends CommunicationManualRecipientDraft {
	lastLoginAt: string | null;
}

export interface CommunicationMessageSummary {
	id: string;
	channel: CommunicationChannel;
	status: CommunicationMessageStatus;
	subject: string;
	recipientGroupCount: number;
	recipientCount: number;
	createdAt: string | null;
	updatedAt: string | null;
	scheduledAt?: string | null;
	sentAt: string | null;
	createdByName: string;
	recipientGroupSummary: string;
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
	recipientGroups: CommunicationRecipientGroupDraft[];
	manualRecipients: CommunicationManualRecipientDraft[];
	recipients: CommunicationMessageRecipient[];
}

export interface CommunicationFilterOption {
	value: string;
	label: string;
}

export interface CommunicationFilterOptions {
	memberRoles: Array<{ value: CommunicationRecipientGroupFilter['memberRole']; label: string }>;
	memberSexes: Array<{ value: CommunicationRecipientGroupFilter['memberSex']; label: string }>;
	rosterRoles: Array<{ value: CommunicationRecipientGroupFilter['rosterRole']; label: string }>;
	teamStatuses: Array<{ value: CommunicationRecipientGroupFilter['teamStatus']; label: string }>;
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
	recipientGroups: CommunicationRecipientGroupDraft[];
	manualRecipients: CommunicationManualRecipientDraft[];
}

export const createEmptyCommunicationFilterOptions = (): CommunicationFilterOptions => ({
	memberRoles: [],
	memberSexes: [],
	rosterRoles: [],
	teamStatuses: [],
	seasons: [],
	offerings: [],
	leagues: [],
	divisions: [],
	teams: []
});

export const EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER: CommunicationRecipientGroupFilter = {
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
