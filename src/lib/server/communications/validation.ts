import { z } from 'zod';

const nonEmptyTrimmed = (message: string) => z.string().trim().min(1, message);

export const communicationRecipientGroupFilterSchema = z.object({
	memberRole: z.enum(['', 'participant', 'manager', 'admin', 'dev']).default(''),
	memberSex: z.enum(['', 'M', 'F']).default(''),
	seasonId: z.string().trim().max(64).default(''),
	offeringId: z.string().trim().max(64).default(''),
	leagueId: z.string().trim().max(64).default(''),
	divisionId: z.string().trim().max(64).default(''),
	teamId: z.string().trim().max(64).default(''),
	rosterRole: z.enum(['', 'captain', 'co-captain', 'player']).default(''),
	teamStatus: z.enum(['', 'active', 'waitlist']).default('')
});

export const communicationRecipientGroupInputSchema = z.object({
	id: nonEmptyTrimmed('Recipient group ID is required.'),
	mode: z.enum(['include', 'exclude']),
	filters: communicationRecipientGroupFilterSchema
});

export const communicationManualRecipientSchema = z.object({
	userId: z
		.string()
		.trim()
		.max(64)
		.nullable()
		.optional()
		.transform((value) => value ?? null),
	email: nonEmptyTrimmed('Recipient email or lookup text is required.').max(160),
	fullName: nonEmptyTrimmed('Recipient name is required.').max(160)
});

export const communicationPreviewRequestSchema = z.object({
	manualRecipients: z.array(communicationManualRecipientSchema).max(100).default([]),
	recipientGroups: z.array(communicationRecipientGroupInputSchema).max(20)
});

export const communicationDraftPayloadSchema = z.object({
	messageId: z.string().trim().max(64).optional(),
	subject: z.string().trim().max(160),
	editorJson: z.record(z.string(), z.unknown()).nullable(),
	bodyHtml: z.string().max(50000),
	manualRecipients: z.array(communicationManualRecipientSchema).max(100).default([]),
	recipientGroups: z.array(communicationRecipientGroupInputSchema).max(20)
});

export const communicationSendRequestSchema = z.object({
	messageId: nonEmptyTrimmed('Message ID is required.')
});

export const communicationManualRecipientResolveRequestSchema = z.object({
	queries: z.array(nonEmptyTrimmed('Recipient query is required.').max(160)).min(1).max(25)
});
