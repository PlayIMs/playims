import { z } from 'zod';

const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

const requiredText = (label: string, max = 120) =>
	z.preprocess(
		normalizeText,
		z
			.string()
			.min(1, `${label} is required.`)
			.max(max, `${label} must be ${max} characters or fewer.`)
	);

const optionalText = (label: string, max = 2000) =>
	z.preprocess(
		(value) => {
			if (typeof value !== 'string') return value;
			const trimmed = value.trim();
			return trimmed.length === 0 ? null : trimmed;
		},
		z.union([z.string().max(max, `${label} must be ${max} characters or fewer.`), z.null()])
	);

const requiredDateTime = (label: string) =>
	z.preprocess(
		normalizeText,
		z.string().regex(DATE_TIME_REGEX, `${label} must be in YYYY-MM-DDTHH:mm format.`)
	);

const optionalId = (label: string, max = 120) =>
	z.preprocess(
		(value) => {
			if (typeof value !== 'string') return value;
			const trimmed = value.trim();
			return trimmed.length === 0 ? null : trimmed;
		},
		z.union([z.string().max(max, `${label} must be ${max} characters or fewer.`), z.null()])
	);

const optionalPositiveInt = (label: string, max = 999) =>
	z.union([
		z
			.number()
			.int(`${label} must be a whole number.`)
			.min(1, `${label} must be at least 1.`)
			.max(max, `${label} must be ${max} or less.`),
		z.null()
	]);

const requiredNonNegativeInt = (label: string, max = 999) =>
	z
		.number()
		.int(`${label} must be a whole number.`)
		.min(0, `${label} must be at least 0.`)
		.max(max, `${label} must be ${max} or less.`);

const toDateMs = (value: string | null): number | null => {
	if (!value || !DATE_TIME_REGEX.test(value)) return null;
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? null : parsed;
};

const intramuralEventInputSchema = z.object({
	seasonId: requiredText('Season'),
	offeringId: requiredText('Offering'),
	leagueId: requiredText('League'),
	divisionId: requiredText('Division'),
	homeTeamId: requiredText('Home team'),
	awayTeamId: requiredText('Away team'),
	scheduledStartAt: requiredDateTime('Scheduled start time'),
	scheduledEndAt: requiredDateTime('Scheduled end time'),
	facilityId: optionalId('Facility'),
	facilityAreaId: optionalId('Facility area'),
	weekNumber: optionalPositiveInt('Week number', 999),
	roundLabel: optionalText('Round label', 140),
	notes: optionalText('Event notes', 2000),
	isPostseason: z.boolean()
});

const intramuralEventUpdateInputSchema = intramuralEventInputSchema.extend({
	id: requiredText('Event')
});

const intramuralEventDuplicateInputSchema = z.object({
	action: z.literal('duplicate'),
	eventId: requiredText('Event')
});

const intramuralEventRestoreInputSchema = z.object({
	action: z.literal('restore-delete'),
	eventId: requiredText('Event')
});

const intramuralEventResultsInputSchema = z.object({
	id: requiredText('Event'),
	homeScore: requiredNonNegativeInt('Home score'),
	awayScore: requiredNonNegativeInt('Away score')
});

export const createIntramuralEventSchema = z
	.object({
		event: intramuralEventInputSchema
	})
	.superRefine((payload, ctx) => {
		if (payload.event.homeTeamId === payload.event.awayTeamId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'awayTeamId'],
				message: 'Home and away teams must be different.'
			});
		}

		const startMs = toDateMs(payload.event.scheduledStartAt);
		const endMs = toDateMs(payload.event.scheduledEndAt);
		if (startMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'scheduledStartAt'],
				message: 'Scheduled start time is invalid.'
			});
		}
		if (endMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'scheduledEndAt'],
				message: 'Scheduled end time is invalid.'
			});
		}
		if (startMs !== null && endMs !== null && endMs <= startMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'scheduledEndAt'],
				message: 'Scheduled end time must be after the scheduled start time.'
			});
		}

		if (!payload.event.facilityId && payload.event.facilityAreaId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'facilityAreaId'],
				message: 'Choose a facility before selecting a facility area.'
			});
		}
	});

export const editIntramuralEventSchema = z
	.object({
		action: z.literal('edit'),
		event: intramuralEventUpdateInputSchema
	})
	.superRefine((payload, ctx) => {
		if (payload.event.homeTeamId === payload.event.awayTeamId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'awayTeamId'],
				message: 'Home and away teams must be different.'
			});
		}

		const startMs = toDateMs(payload.event.scheduledStartAt);
		const endMs = toDateMs(payload.event.scheduledEndAt);
		if (startMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'scheduledStartAt'],
				message: 'Scheduled start time is invalid.'
			});
		}
		if (endMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'scheduledEndAt'],
				message: 'Scheduled end time is invalid.'
			});
		}
		if (startMs !== null && endMs !== null && endMs <= startMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'scheduledEndAt'],
				message: 'Scheduled end time must be after the scheduled start time.'
			});
		}

		if (!payload.event.facilityId && payload.event.facilityAreaId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['event', 'facilityAreaId'],
				message: 'Choose a facility before selecting a facility area.'
			});
		}
	});

export const enterIntramuralEventResultsSchema = z.object({
	action: z.literal('enter-results'),
	event: intramuralEventResultsInputSchema
});

export const duplicateIntramuralEventSchema = intramuralEventDuplicateInputSchema;

export const restoreDeletedIntramuralEventSchema = intramuralEventRestoreInputSchema;

export const deleteIntramuralEventSchema = z.object({
	action: z.literal('delete'),
	eventId: requiredText('Event')
});

export type CreateIntramuralEventInput = z.infer<typeof createIntramuralEventSchema>;

export type EditIntramuralEventInput = z.infer<typeof editIntramuralEventSchema>;

export type EnterIntramuralEventResultsInput = z.infer<typeof enterIntramuralEventResultsSchema>;

export type DuplicateIntramuralEventInput = z.infer<typeof duplicateIntramuralEventSchema>;

export type RestoreDeletedIntramuralEventInput = z.infer<
	typeof restoreDeletedIntramuralEventSchema
>;

export type DeleteIntramuralEventInput = z.infer<typeof deleteIntramuralEventSchema>;

export type CreateIntramuralEventResponse = {
	success: boolean;
	data?: {
		event: import('$lib/utils/schedule-page').ScheduleEventRecord;
	};
	error?: string;
	fieldErrors?: Record<string, string[] | undefined>;
};

export type UpdateIntramuralEventResponse = CreateIntramuralEventResponse;

export type DuplicateIntramuralEventResponse = CreateIntramuralEventResponse;

export type DeleteIntramuralEventResponse = {
	success: boolean;
	data?: {
		eventId: string;
	};
	error?: string;
	fieldErrors?: Record<string, string[] | undefined>;
};
