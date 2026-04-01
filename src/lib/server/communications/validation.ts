import { z } from 'zod';

const nonEmptyTrimmed = (message: string) => z.string().trim().min(1, message);

export const communicationBatchFilterSchema = z.object({
	memberQuery: z.string().trim().max(120).default(''),
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

export const communicationBatchInputSchema = z.object({
	id: nonEmptyTrimmed('Batch ID is required.'),
	mode: z.enum(['include', 'exclude']),
	filters: communicationBatchFilterSchema
});

export const communicationPreviewRequestSchema = z.object({
	batches: z.array(communicationBatchInputSchema).max(20)
});

export const communicationDraftPayloadSchema = z.object({
	messageId: z.string().trim().max(64).optional(),
	subject: z.string().trim().max(160),
	editorJson: z.record(z.string(), z.unknown()).nullable(),
	bodyHtml: z.string().max(50000),
	batches: z.array(communicationBatchInputSchema).max(20)
});

export const communicationSendRequestSchema = z.object({
	messageId: nonEmptyTrimmed('Message ID is required.')
});
