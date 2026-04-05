import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import {
	communicationMessageManualRecipients,
	communicationMessageRecipientGroups,
	communicationMessageRecipients,
	communicationMessages,
	leagues,
	offerings,
	rosters,
	seasons,
	teams,
	divisions,
	userClients,
	users
} from '../schema/index.js';
import type {
	CommunicationManualRecipientDraft,
	CommunicationMessageDetail,
	CommunicationMessageSummary,
	CommunicationRecipientGroupDraft,
	RecipientPreviewRow
} from '$lib/communications/types.js';
import { EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER } from '$lib/communications/types.js';
import type {
	CommunicationAudienceRow,
	CommunicationStoragePort
} from '$lib/server/communications/types.js';

const buildFullName = (firstName: string | null, lastName: string | null): string => {
	const joined = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
	return joined.length > 0 ? joined : 'Unknown sender';
};

const summarizeRecipientGroupLabels = (labels: string[]): string => {
	if (labels.length === 0) {
		return 'No recipient groups yet';
	}
	if (labels.length <= 2) {
		return labels.join(' · ');
	}
	return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2} more`;
};

const nowIso = (): string => new Date().toISOString();

const parseEditorJson = (value: string | null): Record<string, unknown> | null => {
	if (!value?.trim()) {
		return null;
	}

	try {
		return JSON.parse(value) as Record<string, unknown>;
	} catch {
		return null;
	}
};

const parseFilters = (value: string): typeof EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER => {
	try {
		return {
			...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
			...(JSON.parse(value) as Record<string, string>)
		};
	} catch {
		return { ...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER };
	}
};

const toRecipientMetadata = (row: RecipientPreviewRow): string =>
	JSON.stringify({
		teamName: row.teamName,
		divisionName: row.divisionName,
		leagueName: row.leagueName,
		offeringName: row.offeringName,
		seasonName: row.seasonName,
		rosterRole: row.rosterRole,
		teamStatus: row.teamStatus
	});

export class CommunicationOperations implements CommunicationStoragePort {
	constructor(private db: DrizzleClient) {}

	async listMessageSummaries(clientId: string, limit = 40): Promise<CommunicationMessageSummary[]> {
		const messages = await this.db
			.select({
				id: communicationMessages.id,
				channel: communicationMessages.channel,
				status: communicationMessages.status,
				subject: communicationMessages.subject,
				recipientCount: communicationMessages.recipientCount,
				createdAt: communicationMessages.createdAt,
				updatedAt: communicationMessages.updatedAt,
				sentAt: communicationMessages.sentAt,
				failureMessage: communicationMessages.failureMessage,
				createdUserFirstName: users.firstName,
				createdUserLastName: users.lastName
			})
			.from(communicationMessages)
			.leftJoin(users, eq(communicationMessages.createdUser, users.id))
			.where(eq(communicationMessages.clientId, clientId))
			.orderBy(desc(communicationMessages.updatedAt))
			.limit(limit);

		const messageIds = messages.map((message) => message.id);
		const recipientGroupRows =
			messageIds.length > 0
				? await this.db
						.select({
							messageId: communicationMessageRecipientGroups.messageId,
							summaryText: communicationMessageRecipientGroups.summaryText,
							sortOrder: communicationMessageRecipientGroups.sortOrder
						})
						.from(communicationMessageRecipientGroups)
						.where(inArray(communicationMessageRecipientGroups.messageId, messageIds))
						.orderBy(
							asc(communicationMessageRecipientGroups.messageId),
							asc(communicationMessageRecipientGroups.sortOrder)
						)
				: [];
		const recipientGroupLabelsByMessageId = new Map<string, string[]>();
		for (const recipientGroup of recipientGroupRows) {
			const labels = recipientGroupLabelsByMessageId.get(recipientGroup.messageId) ?? [];
			labels.push(recipientGroup.summaryText);
			recipientGroupLabelsByMessageId.set(recipientGroup.messageId, labels);
		}

		return messages.map((message) => ({
			id: message.id,
			channel: message.channel as CommunicationMessageSummary['channel'],
			status: message.status as CommunicationMessageSummary['status'],
			subject: message.subject,
			recipientGroupCount: (recipientGroupLabelsByMessageId.get(message.id) ?? []).length,
			recipientCount: message.recipientCount,
			createdAt: message.createdAt,
			updatedAt: message.updatedAt,
			sentAt: message.sentAt,
			createdByName: buildFullName(message.createdUserFirstName, message.createdUserLastName),
			recipientGroupSummary: summarizeRecipientGroupLabels(
				recipientGroupLabelsByMessageId.get(message.id) ?? []
			),
			failureMessage: message.failureMessage
		}));
	}

	async getMessageDetail(clientId: string, messageId: string): Promise<CommunicationMessageDetail | null> {
		const messageRows = await this.db
			.select({
				id: communicationMessages.id,
				channel: communicationMessages.channel,
				status: communicationMessages.status,
				subject: communicationMessages.subject,
				editorJson: communicationMessages.editorJson,
				bodyHtml: communicationMessages.bodyHtml,
				bodyText: communicationMessages.bodyText,
				recipientCount: communicationMessages.recipientCount,
				createdAt: communicationMessages.createdAt,
				updatedAt: communicationMessages.updatedAt,
				sentAt: communicationMessages.sentAt,
				failureMessage: communicationMessages.failureMessage,
				createdUserFirstName: users.firstName,
				createdUserLastName: users.lastName
			})
			.from(communicationMessages)
			.leftJoin(users, eq(communicationMessages.createdUser, users.id))
			.where(
				and(eq(communicationMessages.clientId, clientId), eq(communicationMessages.id, messageId))
			)
			.limit(1);
		const message = messageRows[0];
		if (!message) {
			return null;
		}

		const [recipientGroups, manualRecipients, recipients] = await Promise.all([
			this.db
				.select()
				.from(communicationMessageRecipientGroups)
				.where(eq(communicationMessageRecipientGroups.messageId, messageId))
				.orderBy(asc(communicationMessageRecipientGroups.sortOrder)),
			this.db
				.select()
				.from(communicationMessageManualRecipients)
				.where(eq(communicationMessageManualRecipients.messageId, messageId))
				.orderBy(asc(communicationMessageManualRecipients.sortOrder)),
			this.db
				.select()
				.from(communicationMessageRecipients)
				.where(eq(communicationMessageRecipients.messageId, messageId))
				.orderBy(asc(communicationMessageRecipients.fullName), asc(communicationMessageRecipients.email))
		]);

		const recipientGroupSummary = summarizeRecipientGroupLabels(
			recipientGroups.map((recipientGroup) => recipientGroup.summaryText)
		);
		return {
			id: message.id,
			channel: message.channel as CommunicationMessageDetail['channel'],
			status: message.status as CommunicationMessageDetail['status'],
			subject: message.subject,
			recipientGroupCount: recipientGroups.length,
			editorJson: parseEditorJson(message.editorJson),
			bodyHtml: message.bodyHtml,
			bodyText: message.bodyText,
			recipientCount: message.recipientCount,
			createdAt: message.createdAt,
			updatedAt: message.updatedAt,
			sentAt: message.sentAt,
			createdByName: buildFullName(message.createdUserFirstName, message.createdUserLastName),
			recipientGroupSummary,
			failureMessage: message.failureMessage,
			recipientGroups: recipientGroups.map((recipientGroup) => ({
				id: recipientGroup.id,
				mode: recipientGroup.mode as 'include' | 'exclude',
				filters: parseFilters(recipientGroup.filtersJson),
				summaryText: recipientGroup.summaryText,
				resolvedRecipientCount: recipientGroup.resolvedRecipientCount
			})),
			manualRecipients: manualRecipients.map((recipient) => ({
				userId: recipient.userId,
				email: recipient.email,
				fullName: recipient.fullName
			})),
			recipients: recipients.map((recipient) => ({
				userId: recipient.userId,
				email: recipient.email,
				fullName: recipient.fullName,
				resolutionMetadata: recipient.resolutionMetadata
			}))
		};
	}

	async createDraft(input: {
		clientId: string;
		subject: string;
		editorJson: string | null;
		bodyHtml: string;
		bodyText: string;
		createdUser: string;
		updatedUser: string;
	}): Promise<{ id: string }> {
		const id = crypto.randomUUID();
		const now = nowIso();
		await this.db.insert(communicationMessages).values({
			id,
			clientId: input.clientId,
			channel: 'email',
			status: 'draft',
			subject: input.subject,
			editorJson: input.editorJson,
			bodyHtml: input.bodyHtml,
			bodyText: input.bodyText,
			recipientCount: 0,
			createdAt: now,
			updatedAt: now,
			createdUser: input.createdUser,
			updatedUser: input.updatedUser
		});
		return { id };
	}

	async updateDraft(input: {
		clientId: string;
		messageId: string;
		subject: string;
		editorJson: string | null;
		bodyHtml: string;
		bodyText: string;
		updatedUser: string;
	}): Promise<boolean> {
		const result = await this.db
			.update(communicationMessages)
			.set({
				subject: input.subject,
				editorJson: input.editorJson,
				bodyHtml: input.bodyHtml,
				bodyText: input.bodyText,
				updatedAt: nowIso(),
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(communicationMessages.clientId, input.clientId),
					eq(communicationMessages.id, input.messageId),
					eq(communicationMessages.status, 'draft')
				)
			)
			.returning({ id: communicationMessages.id });

		return result.length > 0;
	}

	async deleteDraft(input: { clientId: string; messageId: string }): Promise<boolean> {
		const deletedMessages = await this.db
			.delete(communicationMessages)
			.where(
				and(
					eq(communicationMessages.clientId, input.clientId),
					eq(communicationMessages.id, input.messageId),
					eq(communicationMessages.status, 'draft')
				)
			)
			.returning({ id: communicationMessages.id });
		if (deletedMessages.length === 0) {
			return false;
		}

		await this.db
			.delete(communicationMessageRecipientGroups)
			.where(eq(communicationMessageRecipientGroups.messageId, input.messageId));
		await this.db
			.delete(communicationMessageManualRecipients)
			.where(eq(communicationMessageManualRecipients.messageId, input.messageId));
		await this.db
			.delete(communicationMessageRecipients)
			.where(eq(communicationMessageRecipients.messageId, input.messageId));

		return true;
	}

	async replaceRecipientGroups(input: {
		messageId: string;
		recipientGroups: CommunicationRecipientGroupDraft[];
	}): Promise<void> {
		await this.db
			.delete(communicationMessageRecipientGroups)
			.where(eq(communicationMessageRecipientGroups.messageId, input.messageId));
		if (input.recipientGroups.length === 0) {
			return;
		}

		const now = nowIso();
		await this.db.insert(communicationMessageRecipientGroups).values(
			input.recipientGroups.map((recipientGroup, index) => ({
				id: recipientGroup.id || crypto.randomUUID(),
				messageId: input.messageId,
				mode: recipientGroup.mode,
				sortOrder: index,
				filtersJson: JSON.stringify(recipientGroup.filters),
				summaryText: recipientGroup.summaryText,
				resolvedRecipientCount: recipientGroup.resolvedRecipientCount,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	async replaceManualRecipients(input: {
		messageId: string;
		manualRecipients: CommunicationManualRecipientDraft[];
	}): Promise<void> {
		await this.db
			.delete(communicationMessageManualRecipients)
			.where(eq(communicationMessageManualRecipients.messageId, input.messageId));
		if (input.manualRecipients.length === 0) {
			return;
		}

		const now = nowIso();
		await this.db.insert(communicationMessageManualRecipients).values(
			input.manualRecipients.map((recipient, index) => ({
				id: crypto.randomUUID(),
				messageId: input.messageId,
				sortOrder: index,
				userId: recipient.userId,
				email: recipient.email,
				fullName: recipient.fullName,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	async replaceRecipients(input: {
		messageId: string;
		recipients: RecipientPreviewRow[];
	}): Promise<void> {
		await this.db
			.delete(communicationMessageRecipients)
			.where(eq(communicationMessageRecipients.messageId, input.messageId));

		if (input.recipients.length === 0) {
			await this.db
				.update(communicationMessages)
				.set({ recipientCount: 0, updatedAt: nowIso() })
				.where(eq(communicationMessages.id, input.messageId));
			return;
		}

		const now = nowIso();
		await this.db.insert(communicationMessageRecipients).values(
			input.recipients.map((recipient) => ({
				id: crypto.randomUUID(),
				messageId: input.messageId,
				userId: recipient.userId || null,
				email: recipient.email,
				fullName: recipient.fullName,
				resolutionMetadata: toRecipientMetadata(recipient),
				createdAt: now,
				updatedAt: now
			}))
		);
		await this.db
			.update(communicationMessages)
			.set({
				recipientCount: input.recipients.length,
				updatedAt: now
			})
			.where(eq(communicationMessages.id, input.messageId));
	}

	async markMessageSending(input: {
		clientId: string;
		messageId: string;
		recipientCount: number;
		updatedUser: string;
	}): Promise<boolean> {
		const result = await this.db
			.update(communicationMessages)
			.set({
				status: 'sending',
				recipientCount: input.recipientCount,
				failureMessage: null,
				updatedAt: nowIso(),
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(communicationMessages.clientId, input.clientId),
					eq(communicationMessages.id, input.messageId)
				)
			)
			.returning({ id: communicationMessages.id });
		return result.length > 0;
	}

	async markMessageSent(input: {
		clientId: string;
		messageId: string;
		recipientCount: number;
		providerMessageId: string | null;
		updatedUser: string;
	}): Promise<boolean> {
		const now = nowIso();
		const result = await this.db
			.update(communicationMessages)
			.set({
				status: 'sent',
				recipientCount: input.recipientCount,
				providerMessageId: input.providerMessageId,
				failureMessage: null,
				sentAt: now,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(communicationMessages.clientId, input.clientId),
					eq(communicationMessages.id, input.messageId)
				)
			)
			.returning({ id: communicationMessages.id });
		return result.length > 0;
	}

	async markMessageFailed(input: {
		clientId: string;
		messageId: string;
		failureMessage: string;
		updatedUser: string;
	}): Promise<boolean> {
		const result = await this.db
			.update(communicationMessages)
			.set({
				status: 'failed',
				failureMessage: input.failureMessage,
				updatedAt: nowIso(),
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(communicationMessages.clientId, input.clientId),
					eq(communicationMessages.id, input.messageId)
				)
			)
			.returning({ id: communicationMessages.id });
		return result.length > 0;
	}

	async duplicateMessage(input: {
		clientId: string;
		messageId: string;
		createdUser: string;
		updatedUser: string;
	}): Promise<{ id: string } | null> {
		const detail = await this.getMessageDetail(input.clientId, input.messageId);
		if (!detail) {
			return null;
		}

		const created = await this.createDraft({
			clientId: input.clientId,
			subject: `${detail.subject} (Copy)`,
			editorJson: detail.editorJson ? JSON.stringify(detail.editorJson) : null,
			bodyHtml: detail.bodyHtml,
			bodyText: detail.bodyText,
			createdUser: input.createdUser,
			updatedUser: input.updatedUser
		});
		await this.replaceRecipientGroups({
			messageId: created.id,
			recipientGroups: detail.recipientGroups.map((recipientGroup) => ({
				...recipientGroup,
				id: crypto.randomUUID()
			}))
		});
		await this.replaceManualRecipients({
			messageId: created.id,
			manualRecipients: detail.manualRecipients
		});
		await this.replaceRecipients({
			messageId: created.id,
			recipients: detail.recipients.map((recipient) => {
				const metadata = recipient.resolutionMetadata
					? (JSON.parse(recipient.resolutionMetadata) as Record<string, string | null>)
					: {};
				return {
					userId: recipient.userId ?? '',
					membershipId: '',
					fullName: recipient.fullName,
					email: recipient.email,
					studentId: null,
					memberRole: '',
					memberSex: null,
					teamName: metadata.teamName ?? null,
					divisionName: metadata.divisionName ?? null,
					leagueName: metadata.leagueName ?? null,
					offeringName: metadata.offeringName ?? null,
					seasonName: metadata.seasonName ?? null,
					rosterRole: (metadata.rosterRole as RecipientPreviewRow['rosterRole']) ?? null,
					teamStatus: metadata.teamStatus ?? null
				};
			})
		});
		return created;
	}

	async listAudienceRows(clientId: string): Promise<CommunicationAudienceRow[]> {
		return await this.db
			.select({
				userId: userClients.userId,
				membershipId: userClients.id,
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
				studentId: userClients.studentId,
				memberRole: userClients.role,
				memberSex: userClients.sex,
				teamId: rosters.teamId,
				teamName: teams.name,
				teamStatus: teams.teamStatus,
				divisionId: teams.divisionId,
				divisionName: divisions.name,
				leagueId: divisions.leagueId,
				leagueName: leagues.name,
				offeringId: leagues.offeringId,
				offeringName: offerings.name,
				seasonId: leagues.seasonId,
				seasonName: seasons.name,
				isCaptain: rosters.isCaptain,
				isCoCaptain: rosters.isCoCaptain,
				rosterStatus: rosters.rosterStatus
			})
			.from(userClients)
			.innerJoin(users, eq(userClients.userId, users.id))
			.leftJoin(
				rosters,
				and(eq(rosters.userId, userClients.userId), eq(rosters.clientId, userClients.clientId))
			)
			.leftJoin(teams, eq(rosters.teamId, teams.id))
			.leftJoin(divisions, eq(teams.divisionId, divisions.id))
			.leftJoin(leagues, eq(divisions.leagueId, leagues.id))
			.leftJoin(offerings, eq(leagues.offeringId, offerings.id))
			.leftJoin(seasons, eq(leagues.seasonId, seasons.id))
			.where(and(eq(userClients.clientId, clientId), eq(userClients.status, 'active')))
			.orderBy(asc(users.lastName), asc(users.firstName), asc(users.email));
	}
}
