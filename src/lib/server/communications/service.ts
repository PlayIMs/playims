import {
	EMPTY_COMMUNICATION_BATCH_FILTER,
	type CommunicationBatchDraft,
	type CommunicationBatchFilter,
	type CommunicationFilterOptions,
	type CommunicationMessageDetail,
	type CommunicationRecipientPreview,
	type CommunicationRosterRole,
	type CommunicationTeamStatus,
	type RecipientPreviewRow
} from '$lib/communications/types.js';
import { communicationHtmlToPlainText, sanitizeCommunicationHtml } from './html.js';
import type { CommunicationEmailProvider } from './provider.js';
import type {
	BatchPreviewResult,
	CommunicationAudienceRow,
	CommunicationDraftPayload,
	CommunicationStoragePort
} from './types.js';

const MEMBER_ROLE_OPTIONS: CommunicationFilterOptions['memberRoles'] = [
	{ value: '', label: 'All Roles' },
	{ value: 'participant', label: 'Participant' },
	{ value: 'manager', label: 'Manager' },
	{ value: 'admin', label: 'Admin' },
	{ value: 'dev', label: 'Developer' }
];
const MEMBER_SEX_OPTIONS: CommunicationFilterOptions['memberSexes'] = [
	{ value: '', label: 'All Sexes' },
	{ value: 'M', label: 'Male' },
	{ value: 'F', label: 'Female' }
];
const ROSTER_ROLE_OPTIONS: CommunicationFilterOptions['rosterRoles'] = [
	{ value: '', label: 'Any roster role' },
	{ value: 'captain', label: 'Captain' },
	{ value: 'co-captain', label: 'Co-Captain' },
	{ value: 'player', label: 'Player' }
];
const TEAM_STATUS_OPTIONS: CommunicationFilterOptions['teamStatuses'] = [
	{ value: '', label: 'Any team status' },
	{ value: 'active', label: 'Active' },
	{ value: 'waitlist', label: 'Waitlist' }
];

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? '';
const normalizeLower = (value: string | null | undefined): string => normalizeText(value).toLowerCase();
const splitTokens = (value: string): string[] =>
	value
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter((token) => token.length > 0);

const normalizeEmail = (value: string | null | undefined): string => normalizeLower(value);

const buildFullName = (row: CommunicationAudienceRow): string => {
	const joined = [normalizeText(row.firstName), normalizeText(row.lastName)]
		.filter((part) => part.length > 0)
		.join(' ')
		.trim();
	return joined.length > 0 ? joined : 'Unnamed Participant';
};

const getRosterRole = (row: CommunicationAudienceRow): CommunicationRosterRole | null => {
	if (row.isCaptain === 1) {
		return 'captain';
	}
	if (row.isCoCaptain === 1) {
		return 'co-captain';
	}
	if (normalizeText(row.teamId).length > 0) {
		return 'player';
	}
	return null;
};

const normalizeTeamStatus = (value: string | null | undefined): CommunicationTeamStatus | '' => {
	const normalized = normalizeLower(value);
	if (normalized === 'active') {
		return 'active';
	}
	if (normalized === 'waitlist') {
		return 'waitlist';
	}
	return '';
};

const matchesMemberQuery = (row: CommunicationAudienceRow, memberQuery: string): boolean => {
	const tokens = splitTokens(memberQuery);
	if (tokens.length === 0) {
		return true;
	}

	const haystack = [
		buildFullName(row),
		row.email,
		row.studentId,
		row.firstName,
		row.lastName
	]
		.map((value) => normalizeLower(value))
		.join(' ');
	return tokens.every((token) => haystack.includes(token));
};

const rowMatchesHierarchyFilters = (
	row: CommunicationAudienceRow,
	filters: CommunicationBatchFilter
): boolean => {
	if (filters.seasonId && normalizeText(row.seasonId) !== filters.seasonId) {
		return false;
	}
	if (filters.offeringId && normalizeText(row.offeringId) !== filters.offeringId) {
		return false;
	}
	if (filters.leagueId && normalizeText(row.leagueId) !== filters.leagueId) {
		return false;
	}
	if (filters.divisionId && normalizeText(row.divisionId) !== filters.divisionId) {
		return false;
	}
	if (filters.teamId && normalizeText(row.teamId) !== filters.teamId) {
		return false;
	}
	if (filters.rosterRole && getRosterRole(row) !== filters.rosterRole) {
		return false;
	}
	if (filters.teamStatus && normalizeTeamStatus(row.teamStatus) !== filters.teamStatus) {
		return false;
	}
	return true;
};

const recipientMatchesFilters = (
	rows: CommunicationAudienceRow[],
	filters: CommunicationBatchFilter
): boolean => {
	const primaryRow = rows[0];
	if (!primaryRow) {
		return false;
	}
	if (!matchesMemberQuery(primaryRow, filters.memberQuery)) {
		return false;
	}
	if (filters.memberRole && normalizeText(primaryRow.memberRole) !== filters.memberRole) {
		return false;
	}
	if (filters.memberSex && normalizeText(primaryRow.memberSex) !== filters.memberSex) {
		return false;
	}

	const requiresRosterMatch = Boolean(
		filters.seasonId ||
			filters.offeringId ||
			filters.leagueId ||
			filters.divisionId ||
			filters.teamId ||
			filters.rosterRole ||
			filters.teamStatus
	);
	if (!requiresRosterMatch) {
		return true;
	}

	return rows.some((row) => rowMatchesHierarchyFilters(row, filters));
};

const toPreviewRow = (rows: CommunicationAudienceRow[]): RecipientPreviewRow => {
	const primaryRow = rows[0]!;
	return {
		userId: normalizeText(primaryRow.userId),
		membershipId: normalizeText(primaryRow.membershipId),
		fullName: buildFullName(primaryRow),
		email: normalizeEmail(primaryRow.email),
		studentId: normalizeText(primaryRow.studentId) || null,
		memberRole: normalizeText(primaryRow.memberRole),
		memberSex: normalizeText(primaryRow.memberSex) || null,
		teamName: normalizeText(primaryRow.teamName) || null,
		divisionName: normalizeText(primaryRow.divisionName) || null,
		leagueName: normalizeText(primaryRow.leagueName) || null,
		offeringName: normalizeText(primaryRow.offeringName) || null,
		seasonName: normalizeText(primaryRow.seasonName) || null,
		rosterRole: getRosterRole(primaryRow),
		teamStatus: normalizeText(primaryRow.teamStatus) || null
	};
};

const buildAudienceMap = (rows: CommunicationAudienceRow[]): Map<string, CommunicationAudienceRow[]> => {
	const grouped = new Map<string, CommunicationAudienceRow[]>();
	for (const row of rows) {
		const email = normalizeEmail(row.email);
		const userId = normalizeText(row.userId);
		const key = userId || email;
		if (!key || !email) {
			continue;
		}

		const entry = grouped.get(key);
		if (entry) {
			entry.push(row);
			continue;
		}
		grouped.set(key, [row]);
	}
	return grouped;
};

const buildBatchSummary = (
	filters: CommunicationBatchFilter,
	options: CommunicationFilterOptions
): string => {
	const labels: string[] = [];
	const appendLookup = <T extends { value: string; label: string }>(
		value: string,
		values: T[],
		fallbackPrefix: string
	) => {
		if (!value) {
			return;
		}
		const match = values.find((entry) => entry.value === value);
		labels.push(match ? match.label : `${fallbackPrefix}: ${value}`);
	};

	if (filters.memberQuery) {
		labels.push(`Search: "${filters.memberQuery}"`);
	}
	appendLookup(filters.memberRole, options.memberRoles, 'Role');
	appendLookup(filters.memberSex, options.memberSexes, 'Sex');
	appendLookup(filters.seasonId, options.seasons, 'Season');
	appendLookup(filters.offeringId, options.offerings, 'Offering');
	appendLookup(filters.leagueId, options.leagues, 'League');
	appendLookup(filters.divisionId, options.divisions, 'Division');
	appendLookup(filters.teamId, options.teams, 'Team');
	appendLookup(filters.rosterRole, options.rosterRoles, 'Roster role');
	appendLookup(filters.teamStatus, options.teamStatuses, 'Team status');

	return labels.length > 0 ? labels.join(' · ') : 'All active members with email';
};

export const buildCommunicationFilterOptions = (input: {
	seasons: Array<{ id: string; name: string | null }>;
	offerings: Array<{ id: string; name: string | null; seasonId: string | null }>;
	leagues: Array<{ id: string; name: string | null; seasonId: string | null; offeringId: string | null }>;
	divisions: Array<{ id: string; name: string | null; leagueId: string | null }>;
	teams: Array<{ id: string; name: string; divisionId: string | null }>;
}): CommunicationFilterOptions => ({
	memberRoles: MEMBER_ROLE_OPTIONS,
	memberSexes: MEMBER_SEX_OPTIONS,
	rosterRoles: ROSTER_ROLE_OPTIONS,
	teamStatuses: TEAM_STATUS_OPTIONS,
	seasons: input.seasons.map((season) => ({
		value: season.id,
		label: normalizeText(season.name) || 'Untitled season'
	})),
	offerings: input.offerings.map((offering) => ({
		value: offering.id,
		label: normalizeText(offering.name) || 'Untitled offering',
		seasonId: offering.seasonId
	})),
	leagues: input.leagues.map((league) => ({
		value: league.id,
		label: normalizeText(league.name) || 'Untitled league',
		seasonId: league.seasonId,
		offeringId: league.offeringId
	})),
	divisions: input.divisions.map((division) => ({
		value: division.id,
		label: normalizeText(division.name) || 'Untitled division',
		leagueId: division.leagueId
	})),
	teams: input.teams.map((team) => ({
		value: team.id,
		label: normalizeText(team.name) || 'Untitled team',
		divisionId: team.divisionId
	}))
});

export const createRecipientPreview = (
	rows: CommunicationAudienceRow[],
	filters: CommunicationBatchFilter,
	limit = 25
): CommunicationRecipientPreview => {
	const audienceMap = buildAudienceMap(rows);
	const matches = Array.from(audienceMap.values())
		.filter((recipientRows) => recipientMatchesFilters(recipientRows, filters))
		.map((recipientRows) => toPreviewRow(recipientRows))
		.sort((a, b) => a.fullName.localeCompare(b.fullName));

	return {
		totalCount: matches.length,
		rows: matches.slice(0, limit)
	};
};

const normalizeFilters = (filters: Partial<CommunicationBatchFilter>): CommunicationBatchFilter => ({
	...EMPTY_COMMUNICATION_BATCH_FILTER,
	memberQuery: normalizeText(filters.memberQuery),
	memberRole: (normalizeText(filters.memberRole) as CommunicationBatchFilter['memberRole']) || '',
	memberSex: (normalizeText(filters.memberSex) as CommunicationBatchFilter['memberSex']) || '',
	seasonId: normalizeText(filters.seasonId),
	offeringId: normalizeText(filters.offeringId),
	leagueId: normalizeText(filters.leagueId),
	divisionId: normalizeText(filters.divisionId),
	teamId: normalizeText(filters.teamId),
	rosterRole: (normalizeText(filters.rosterRole) as CommunicationBatchFilter['rosterRole']) || '',
	teamStatus: (normalizeText(filters.teamStatus) as CommunicationBatchFilter['teamStatus']) || ''
});

export class CommunicationService {
	private storage: CommunicationStoragePort;
	private emailProvider: CommunicationEmailProvider;

	constructor(input: { storage: CommunicationStoragePort; emailProvider: CommunicationEmailProvider }) {
		this.storage = input.storage;
		this.emailProvider = input.emailProvider;
	}

	async previewBatch(input: {
		clientId: string;
		batchId: string;
		mode: 'include' | 'exclude';
		filters: Partial<CommunicationBatchFilter>;
		filterOptions: CommunicationFilterOptions;
	}): Promise<BatchPreviewResult> {
		const filters = normalizeFilters(input.filters);
		const preview = createRecipientPreview(await this.storage.listAudienceRows(input.clientId), filters);
		return {
			preview,
			storedBatch: {
				id: input.batchId,
				mode: input.mode,
				filters,
				summaryText: buildBatchSummary(filters, input.filterOptions),
				resolvedRecipientCount: preview.totalCount
			}
		};
	}

	async previewAudience(input: {
		clientId: string;
		batches: CommunicationBatchDraft[];
		limit?: number;
	}): Promise<CommunicationRecipientPreview> {
		const rows = await this.storage.listAudienceRows(input.clientId);
		const audienceMap = buildAudienceMap(rows);
		const includeKeys = new Set<string>();
		const excludeKeys = new Set<string>();

		for (const batch of input.batches) {
			const keys = Array.from(audienceMap.entries())
				.filter(([, recipientRows]) => recipientMatchesFilters(recipientRows, batch.filters))
				.map(([key]) => key);
			if (batch.mode === 'exclude') {
				for (const key of keys) {
					excludeKeys.add(key);
				}
				continue;
			}
			for (const key of keys) {
				includeKeys.add(key);
			}
		}

		const rowsOut = Array.from(includeKeys)
			.filter((key) => !excludeKeys.has(key))
			.map((key) => toPreviewRow(audienceMap.get(key)!))
			.sort((a, b) => a.fullName.localeCompare(b.fullName));

		return {
			totalCount: rowsOut.length,
			rows: rowsOut.slice(0, Math.max(1, input.limit ?? 25))
		};
	}

	async saveDraft(input: {
		clientId: string;
		userId: string;
		payload: CommunicationDraftPayload;
		filterOptions: CommunicationFilterOptions;
	}): Promise<{ id: string }> {
		const sanitizedHtml = sanitizeCommunicationHtml(input.payload.bodyHtml);
		const bodyText = communicationHtmlToPlainText(sanitizedHtml);
		const previewBatches = await Promise.all(
			input.payload.batches.map((batch) =>
				this.previewBatch({
					clientId: input.clientId,
					batchId: batch.id,
					mode: batch.mode,
					filters: batch.filters,
					filterOptions: input.filterOptions
				})
			)
		);
		const storedBatches = previewBatches.map((entry) => entry.storedBatch);
		const fullAudience = await this.previewAudience({
			clientId: input.clientId,
			batches: storedBatches,
			limit: Number.MAX_SAFE_INTEGER
		});

		const editorJson = input.payload.editorJson ? JSON.stringify(input.payload.editorJson) : null;
		const saved = input.payload.messageId
			? {
					id: input.payload.messageId,
					updated: await this.storage.updateDraft({
						clientId: input.clientId,
						messageId: input.payload.messageId,
						subject: input.payload.subject.trim(),
						editorJson,
						bodyHtml: sanitizedHtml,
						bodyText,
						updatedUser: input.userId
					})
				}
			: null;
		const messageId =
			saved?.updated && saved.id
				? saved.id
				: (
						await this.storage.createDraft({
							clientId: input.clientId,
							subject: input.payload.subject.trim(),
							editorJson,
							bodyHtml: sanitizedHtml,
							bodyText,
							createdUser: input.userId,
							updatedUser: input.userId
						})
					).id;

		await this.storage.replaceBatches({
			messageId,
			batches: storedBatches
		});
		await this.storage.replaceRecipients({
			messageId,
			recipients: fullAudience.rows
		});
		return { id: messageId };
	}

	async sendDraft(input: {
		clientId: string;
		userId: string;
		messageId: string;
	}): Promise<CommunicationMessageDetail> {
		const detail = await this.storage.getMessageDetail(input.clientId, input.messageId);
		if (!detail) {
			throw new Error('Communication message not found.');
		}
		if (detail.status !== 'draft') {
			throw new Error('Only draft messages can be sent.');
		}
		if (!detail.subject.trim()) {
			throw new Error('Subject is required before sending.');
		}
		if (!detail.bodyText.trim()) {
			throw new Error('Message body is required before sending.');
		}
		if (detail.recipients.length === 0) {
			throw new Error('At least one recipient is required before sending.');
		}

		await this.storage.markMessageSending({
			clientId: input.clientId,
			messageId: input.messageId,
			recipientCount: detail.recipients.length,
			updatedUser: input.userId
		});

		try {
			const sendResult = await this.emailProvider.sendMessage({
				to: detail.recipients.map((recipient) => recipient.email),
				subject: detail.subject,
				html: detail.bodyHtml,
				text: detail.bodyText
			});
			await this.storage.markMessageSent({
				clientId: input.clientId,
				messageId: input.messageId,
				recipientCount: detail.recipients.length,
				providerMessageId: sendResult.providerMessageId,
				updatedUser: input.userId
			});
		} catch (error) {
			const message =
				error instanceof Error && error.message.trim().length > 0
					? error.message
					: 'Unable to send the communication email.';
			await this.storage.markMessageFailed({
				clientId: input.clientId,
				messageId: input.messageId,
				failureMessage: message,
				updatedUser: input.userId
			});
			throw error;
		}

		const refreshed = await this.storage.getMessageDetail(input.clientId, input.messageId);
		if (!refreshed) {
			throw new Error('Communication message not found after sending.');
		}
		return refreshed;
	}
}
