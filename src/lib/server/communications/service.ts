import {
	EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
	type CommunicationManualRecipientDraft,
	type CommunicationManualRecipientSuggestion,
	type CommunicationRecipientGroupDraft,
	type CommunicationRecipientGroupFilter,
	type CommunicationFilterOptions,
	type CommunicationMessageDetail,
	type CommunicationRecipientPreview,
	type CommunicationRosterRole,
	type CommunicationTeamStatus,
	type RecipientPreviewRow
} from '$lib/communications/types.js';
import { normalizePhoneDigitsForSearch } from '$lib/utils/phone-format.js';
import { communicationHtmlToPlainText, sanitizeCommunicationHtml } from './html.js';
import type { CommunicationEmailProvider } from './provider.js';
import type {
	RecipientGroupPreviewResult,
	CommunicationAudienceRow,
	CommunicationDraftPayload,
	CommunicationStoragePort
} from './types.js';

export const MAX_COMMUNICATION_SEND_RECIPIENTS = 500;
const MAX_MANUAL_RECIPIENT_SUGGESTIONS = 25;

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

const normalizeEmail = (value: string | null | undefined): string => normalizeLower(value);
const normalizePhoneDigits = (value: string | null | undefined): string =>
	normalizePhoneDigitsForSearch(value);

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

const getAudienceKey = (input: {
	userId?: string | null | undefined;
	email: string | null | undefined;
}): string => {
	return normalizeText(input.userId) || normalizeEmail(input.email);
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

const rowMatchesHierarchyFilters = (
	row: CommunicationAudienceRow,
	filters: CommunicationRecipientGroupFilter
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
	filters: CommunicationRecipientGroupFilter
): boolean => {
	const primaryRow = rows[0];
	if (!primaryRow) {
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

const toManualRecipient = (rows: CommunicationAudienceRow[]): CommunicationManualRecipientDraft => {
	const primaryRow = rows[0]!;
	return {
		userId: normalizeText(primaryRow.userId) || null,
		email: normalizeEmail(primaryRow.email),
		fullName: buildFullName(primaryRow)
	};
};

const getLatestLoginAt = (rows: CommunicationAudienceRow[]): string | null => {
	const loginRows = rows
		.map((row) => normalizeText(row.lastLoginAt))
		.filter((value) => value.length > 0);
	if (loginRows.length === 0) {
		return null;
	}

	return (
		loginRows
			.slice()
			.sort((left, right) => Date.parse(right) - Date.parse(left))
			.at(0) ?? null
	);
};

const toManualRecipientSuggestion = (
	rows: CommunicationAudienceRow[]
): CommunicationManualRecipientSuggestion => ({
	...toManualRecipient(rows),
	lastLoginAt: getLatestLoginAt(rows)
});

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

const dedupeManualRecipients = (
	manualRecipients: CommunicationManualRecipientDraft[]
): CommunicationManualRecipientDraft[] => {
	const deduped = new Map<string, CommunicationManualRecipientDraft>();
	for (const recipient of manualRecipients) {
		const key = getAudienceKey(recipient);
		if (!key || deduped.has(key)) {
			continue;
		}
		deduped.set(key, {
			userId: normalizeText(recipient.userId) || null,
			email: normalizeEmail(recipient.email),
			fullName: normalizeText(recipient.fullName)
		});
	}
	return Array.from(deduped.values());
};

type ManualRecipientMatchResult =
	| {
			status: 'resolved';
			query: string;
			manualRecipient: CommunicationManualRecipientDraft;
	  }
	| {
			status: 'ambiguous';
			query: string;
			suggestions: CommunicationManualRecipientSuggestion[];
	  }
	| {
			status: 'not_found';
			query: string;
			message: string;
	  };

const buildRecipientGroupSummary = (
	filters: CommunicationRecipientGroupFilter,
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
	filters: CommunicationRecipientGroupFilter,
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

const normalizeFilters = (
	filters: Partial<CommunicationRecipientGroupFilter>
): CommunicationRecipientGroupFilter => ({
	...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
	memberRole:
		(normalizeText(filters.memberRole) as CommunicationRecipientGroupFilter['memberRole']) || '',
	memberSex:
		(normalizeText(filters.memberSex) as CommunicationRecipientGroupFilter['memberSex']) || '',
	seasonId: normalizeText(filters.seasonId),
	offeringId: normalizeText(filters.offeringId),
	leagueId: normalizeText(filters.leagueId),
	divisionId: normalizeText(filters.divisionId),
	teamId: normalizeText(filters.teamId),
	rosterRole:
		(normalizeText(filters.rosterRole) as CommunicationRecipientGroupFilter['rosterRole']) || '',
	teamStatus:
		(normalizeText(filters.teamStatus) as CommunicationRecipientGroupFilter['teamStatus']) || ''
});

export class CommunicationService {
	private storage: CommunicationStoragePort;
	private emailProvider: CommunicationEmailProvider;

	constructor(input: { storage: CommunicationStoragePort; emailProvider: CommunicationEmailProvider }) {
		this.storage = input.storage;
		this.emailProvider = input.emailProvider;
	}

	async searchManualRecipientMatches(input: {
		clientId: string;
		query: string;
	}): Promise<ManualRecipientMatchResult> {
		const normalizedQuery = normalizeText(input.query);
		if (!normalizedQuery) {
			return {
				status: 'not_found',
				query: input.query,
				message: 'Recipient query is required.'
			};
		}

		const rows = await this.storage.listAudienceRows(input.clientId);
		const audienceMap = buildAudienceMap(rows);
		const loweredQuery = normalizeLower(input.query);
		const phoneDigitsQuery = normalizePhoneDigits(input.query);

		const exactEmailMatch = Array.from(audienceMap.values()).find(
			(audienceRows) => normalizeEmail(audienceRows[0]?.email) === loweredQuery
		);
		if (exactEmailMatch) {
			return {
				status: 'resolved',
				query: input.query,
				manualRecipient: toManualRecipient(exactEmailMatch)
			};
		}

		if (phoneDigitsQuery.length > 0) {
			const exactPhoneMatches = Array.from(audienceMap.values()).filter(
				(audienceRows) => normalizePhoneDigits(audienceRows[0]?.cellPhone) === phoneDigitsQuery
			);
			if (exactPhoneMatches.length === 1) {
				return {
					status: 'resolved',
					query: input.query,
					manualRecipient: toManualRecipient(exactPhoneMatches[0]!)
				};
			}
			if (exactPhoneMatches.length > 1) {
				return {
					status: 'ambiguous',
					query: input.query,
					suggestions: exactPhoneMatches
						.map((rowsOut) => toManualRecipientSuggestion(rowsOut))
						.sort((a, b) => a.fullName.localeCompare(b.fullName))
						.slice(0, MAX_MANUAL_RECIPIENT_SUGGESTIONS)
				};
			}
		}

		const exactNameMatches = Array.from(audienceMap.values()).filter(
			(audienceRows) => normalizeLower(buildFullName(audienceRows[0]!)) === loweredQuery
		);
		if (exactNameMatches.length === 1) {
			return {
				status: 'resolved',
				query: input.query,
				manualRecipient: toManualRecipient(exactNameMatches[0]!)
			};
		}
		if (exactNameMatches.length > 1) {
			return {
				status: 'ambiguous',
				query: input.query,
				suggestions: exactNameMatches
					.map((rowsOut) => toManualRecipientSuggestion(rowsOut))
					.sort((a, b) => a.fullName.localeCompare(b.fullName))
					.slice(0, MAX_MANUAL_RECIPIENT_SUGGESTIONS)
			};
		}

		const partialMatches = Array.from(audienceMap.values()).filter((audienceRows) => {
			const fullName = normalizeLower(buildFullName(audienceRows[0]!));
			const email = normalizeEmail(audienceRows[0]?.email);
			const cellPhone = normalizePhoneDigits(audienceRows[0]?.cellPhone);
			return (
				fullName.includes(loweredQuery) ||
				email.includes(loweredQuery) ||
				(phoneDigitsQuery.length > 0 && cellPhone.includes(phoneDigitsQuery))
			);
		});
		if (partialMatches.length === 1) {
			return {
				status: 'resolved',
				query: input.query,
				manualRecipient: toManualRecipient(partialMatches[0]!)
			};
		}
		if (partialMatches.length > 1) {
			return {
				status: 'ambiguous',
				query: input.query,
				suggestions: partialMatches
					.map((rowsOut) => toManualRecipientSuggestion(rowsOut))
					.sort((a, b) => a.fullName.localeCompare(b.fullName))
					.slice(0, MAX_MANUAL_RECIPIENT_SUGGESTIONS)
			};
		}

		return {
			status: 'not_found',
			query: input.query,
			message: `No active member in this organization matches "${normalizedQuery}".`
		};
	}

	async resolveManualRecipients(input: {
		clientId: string;
		manualRecipients?: Array<{
			userId?: string | null;
			email: string;
			fullName: string;
		}>;
	}): Promise<CommunicationManualRecipientDraft[]> {
		const resolved: CommunicationManualRecipientDraft[] = [];
		for (const recipient of input.manualRecipients ?? []) {
			const result = await this.searchManualRecipientMatches({
				clientId: input.clientId,
				query: normalizeText(recipient.fullName) || normalizeText(recipient.email)
			});

			if (result.status === 'resolved') {
				resolved.push(result.manualRecipient);
				continue;
			}

			if (result.status === 'ambiguous') {
				throw new Error(
					`Multiple members match "${result.query}". Use the full name or email address.`
				);
			}

			throw new Error(result.message);
		}

		return dedupeManualRecipients(resolved);
	}

	async previewRecipientGroup(input: {
		clientId: string;
		recipientGroupId: string;
		mode: 'include' | 'exclude';
		filters: Partial<CommunicationRecipientGroupFilter>;
		filterOptions: CommunicationFilterOptions;
	}): Promise<RecipientGroupPreviewResult> {
		const filters = normalizeFilters(input.filters);
		const preview = createRecipientPreview(await this.storage.listAudienceRows(input.clientId), filters);
		return {
			preview,
			storedRecipientGroup: {
				id: input.recipientGroupId,
				mode: input.mode,
				filters,
				summaryText: buildRecipientGroupSummary(filters, input.filterOptions),
				resolvedRecipientCount: preview.totalCount
			}
		};
	}

	async previewAudience(input: {
		clientId: string;
		recipientGroups: CommunicationRecipientGroupDraft[];
		manualRecipients?: CommunicationManualRecipientDraft[];
		limit?: number;
	}): Promise<CommunicationRecipientPreview> {
		const rows = await this.storage.listAudienceRows(input.clientId);
		const audienceMap = buildAudienceMap(rows);
		const includeKeys = new Set<string>();
		const excludeKeys = new Set<string>();

		for (const recipientGroup of input.recipientGroups) {
			const keys = Array.from(audienceMap.entries())
				.filter(([, recipientRows]) =>
					recipientMatchesFilters(recipientRows, recipientGroup.filters)
				)
				.map(([key]) => key);
			if (recipientGroup.mode === 'exclude') {
				for (const key of keys) {
					excludeKeys.add(key);
				}
				continue;
			}
			for (const key of keys) {
				includeKeys.add(key);
			}
		}

		for (const manualRecipient of input.manualRecipients ?? []) {
			const key = getAudienceKey(manualRecipient);
			if (!key || !audienceMap.has(key)) {
				continue;
			}
			includeKeys.add(key);
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
		const previewRecipientGroups = await Promise.all(
			input.payload.recipientGroups.map((recipientGroup) =>
				this.previewRecipientGroup({
					clientId: input.clientId,
					recipientGroupId: recipientGroup.id,
					mode: recipientGroup.mode,
					filters: recipientGroup.filters,
					filterOptions: input.filterOptions
				})
			)
		);
		const storedRecipientGroups = previewRecipientGroups.map((entry) => entry.storedRecipientGroup);
		const storedManualRecipients = await this.resolveManualRecipients({
			clientId: input.clientId,
			manualRecipients: input.payload.manualRecipients
		});
		const fullAudience = await this.previewAudience({
			clientId: input.clientId,
			recipientGroups: storedRecipientGroups,
			manualRecipients: storedManualRecipients,
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

		await this.storage.replaceRecipientGroups({
			messageId,
			recipientGroups: storedRecipientGroups
		});
		await this.storage.replaceManualRecipients({
			messageId,
			manualRecipients: storedManualRecipients
		});
		await this.storage.replaceRecipients({
			messageId,
			recipients: fullAudience.rows
		});
		return { id: messageId };
	}

	async deleteDraft(input: {
		clientId: string;
		messageId: string;
	}): Promise<{ deleted: true }> {
		const detail = await this.storage.getMessageDetail(input.clientId, input.messageId);
		if (!detail) {
			throw new Error('Communication message not found.');
		}
		if (detail.status !== 'draft') {
			throw new Error('Only draft messages can be deleted.');
		}

		const deleted = await this.storage.deleteDraft({
			clientId: input.clientId,
			messageId: input.messageId
		});
		if (!deleted) {
			throw new Error('Communication message not found.');
		}

		return { deleted: true };
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
		if (detail.recipients.length > MAX_COMMUNICATION_SEND_RECIPIENTS) {
			throw new Error(
				`This message has too many recipients to send at once. Reduce the audience to ${MAX_COMMUNICATION_SEND_RECIPIENTS} recipients or fewer.`
			);
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
