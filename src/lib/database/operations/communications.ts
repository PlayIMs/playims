import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import {
	communicationMessageBatches,
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
	CommunicationMessageDetail,
	CommunicationMessageSummary,
	RecipientPreviewRow
} from '$lib/communications/types.js';
import { EMPTY_COMMUNICATION_BATCH_FILTER } from '$lib/communications/types.js';
import type {
	CommunicationAudienceRow,
	CommunicationStoragePort
} from '$lib/server/communications/types.js';

const buildFullName = (firstName: string | null, lastName: string | null): string => {
	const joined = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
	return joined.length > 0 ? joined : 'Unknown sender';
};

const summarizeBatchLabels = (labels: string[]): string => {
	if (labels.length === 0) {
		return 'No audience batches yet';
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

const parseFilters = (value: string): typeof EMPTY_COMMUNICATION_BATCH_FILTER => {
	try {
		return {
			...EMPTY_COMMUNICATION_BATCH_FILTER,
			...(JSON.parse(value) as Record<string, string>)
		};
	} catch {
		return { ...EMPTY_COMMUNICATION_BATCH_FILTER };
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
		const batchRows =
			messageIds.length > 0
				? await this.db
						.select({
							messageId: communicationMessageBatches.messageId,
							summaryText: communicationMessageBatches.summaryText,
							sortOrder: communicationMessageBatches.sortOrder
						})
						.from(communicationMessageBatches)
						.where(inArray(communicationMessageBatches.messageId, messageIds))
						.orderBy(
							asc(communicationMessageBatches.messageId),
							asc(communicationMessageBatches.sortOrder)
						)
				: [];
		const batchLabelsByMessageId = new Map<string, string[]>();
		for (const batch of batchRows) {
			const labels = batchLabelsByMessageId.get(batch.messageId) ?? [];
			labels.push(batch.summaryText);
			batchLabelsByMessageId.set(batch.messageId, labels);
		}

		return messages.map((message) => ({
			id: message.id,
			channel: message.channel as CommunicationMessageSummary['channel'],
			status: message.status as CommunicationMessageSummary['status'],
			subject: message.subject,
			recipientCount: message.recipientCount,
			createdAt: message.createdAt,
			updatedAt: message.updatedAt,
			sentAt: message.sentAt,
			createdByName: buildFullName(message.createdUserFirstName, message.createdUserLastName),
			batchSummary: summarizeBatchLabels(batchLabelsByMessageId.get(message.id) ?? []),
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

		const [batches, recipients] = await Promise.all([
			this.db
				.select()
				.from(communicationMessageBatches)
				.where(eq(communicationMessageBatches.messageId, messageId))
				.orderBy(asc(communicationMessageBatches.sortOrder)),
			this.db
				.select()
				.from(communicationMessageRecipients)
				.where(eq(communicationMessageRecipients.messageId, messageId))
				.orderBy(asc(communicationMessageRecipients.fullName), asc(communicationMessageRecipients.email))
		]);

		const batchSummary = summarizeBatchLabels(batches.map((batch) => batch.summaryText));
		return {
			id: message.id,
			channel: message.channel as CommunicationMessageDetail['channel'],
			status: message.status as CommunicationMessageDetail['status'],
			subject: message.subject,
			editorJson: parseEditorJson(message.editorJson),
			bodyHtml: message.bodyHtml,
			bodyText: message.bodyText,
			recipientCount: message.recipientCount,
			createdAt: message.createdAt,
			updatedAt: message.updatedAt,
			sentAt: message.sentAt,
			createdByName: buildFullName(message.createdUserFirstName, message.createdUserLastName),
			batchSummary,
			failureMessage: message.failureMessage,
			batches: batches.map((batch) => ({
				id: batch.id,
				mode: batch.mode as 'include' | 'exclude',
				filters: parseFilters(batch.filtersJson),
				summaryText: batch.summaryText,
				resolvedRecipientCount: batch.resolvedRecipientCount
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

	async replaceBatches(input: {
		messageId: string;
		batches: CommunicationMessageDetail['batches'];
	}): Promise<void> {
		await this.db
			.delete(communicationMessageBatches)
			.where(eq(communicationMessageBatches.messageId, input.messageId));
		if (input.batches.length === 0) {
			return;
		}

		const now = nowIso();
		await this.db.insert(communicationMessageBatches).values(
			input.batches.map((batch, index) => ({
				id: batch.id || crypto.randomUUID(),
				messageId: input.messageId,
				mode: batch.mode,
				sortOrder: index,
				filtersJson: JSON.stringify(batch.filters),
				summaryText: batch.summaryText,
				resolvedRecipientCount: batch.resolvedRecipientCount,
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
		await this.replaceBatches({
			messageId: created.id,
			batches: detail.batches.map((batch) => ({
				...batch,
				id: crypto.randomUUID()
			}))
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
