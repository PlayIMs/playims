import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

const requiredText = (label: string, max = 160) =>
	z
		.preprocess(
			normalizeText,
			z
				.string()
				.min(1, `${label} is required.`)
				.max(max, `${label} must be ${max} characters or fewer.`)
		);

const slugField = (label: string) =>
	z.preprocess(
		normalizeText,
		z
			.string()
			.min(1, `${label} is required.`)
			.max(120, `${label} must be 120 characters or fewer.`)
			.regex(SLUG_REGEX, `${label} must use lowercase letters, numbers, and dashes only.`)
	);

const requiredUrl = (label: string) =>
	z
		.preprocess(
			normalizeText,
			z
				.string()
				.min(1, `${label} is required.`)
				.max(500, `${label} must be 500 characters or fewer.`)
				.url(`${label} must be a valid URL.`)
		);

const requiredDate = (label: string) =>
	z
		.preprocess(normalizeText, z.string().regex(DATE_REGEX, `${label} must be in YYYY-MM-DD format.`));

const optionalDate = z.preprocess((value) => {
	if (typeof value !== 'string') {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}, z.union([z.string().regex(DATE_REGEX, 'Date must be in YYYY-MM-DD format.'), z.null()]));

const requiredInt = (label: string, min = 0, max = 500) =>
	z
		.number()
		.int(`${label} must be a whole number.`)
		.min(min, `${label} must be at least ${min}.`)
		.max(max, `${label} must be ${max} or less.`);

const toDateMs = (value: string | null) => {
	if (!value || !DATE_REGEX.test(value)) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`).getTime();
	return Number.isNaN(parsed) ? null : parsed;
};

const offeringInputSchema = z.object({
	name: requiredText('Offering name', 140),
	slug: slugField('Offering slug'),
	isActive: z.boolean(),
	imageUrl: requiredUrl('Offering image URL'),
	minPlayers: requiredInt('Minimum players', 1, 100),
	maxPlayers: requiredInt('Maximum players', 1, 100),
	rulebookUrl: requiredUrl('Rulebook URL'),
	sport: requiredText('Sport', 80),
	type: z.enum(['league', 'tournament']),
	description: requiredText('Offering description', 2000)
});

const leagueInputSchema = z.object({
	name: requiredText('League name', 140),
	slug: slugField('League slug'),
	description: requiredText('League description', 2000),
	season: requiredText('Season', 80),
	gender: z.enum(['mens', 'womens', 'corec', 'unified']),
	skillLevel: z.enum(['competitive', 'intermediate', 'recreational', 'all']),
	regStartDate: requiredDate('Registration start date'),
	regEndDate: requiredDate('Registration end date'),
	seasonStartDate: requiredDate('Season start date'),
	seasonEndDate: requiredDate('Season end date'),
	hasPostseason: z.boolean(),
	postseasonStartDate: optionalDate,
	postseasonEndDate: optionalDate,
	hasPreseason: z.boolean(),
	preseasonStartDate: optionalDate,
	preseasonEndDate: optionalDate,
	isActive: z.boolean(),
	isLocked: z.boolean(),
	imageUrl: requiredUrl('League image URL')
});

export const createIntramuralOfferingWithLeagueSchema = z
	.object({
		offering: offeringInputSchema,
		league: leagueInputSchema
	})
	.superRefine((payload, ctx) => {
		const minPlayers = payload.offering.minPlayers;
		const maxPlayers = payload.offering.maxPlayers;
		if (minPlayers > maxPlayers) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['offering', 'maxPlayers'],
				message: 'Maximum players must be greater than or equal to minimum players.'
			});
		}

		const regStartMs = toDateMs(payload.league.regStartDate);
		const regEndMs = toDateMs(payload.league.regEndDate);
		const seasonStartMs = toDateMs(payload.league.seasonStartDate);
		const seasonEndMs = toDateMs(payload.league.seasonEndDate);

		if (regStartMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'regStartDate'],
				message: 'Registration start date is invalid.'
			});
		}

		if (regEndMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'regEndDate'],
				message: 'Registration end date is invalid.'
			});
		}

		if (seasonStartMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'seasonStartDate'],
				message: 'Season start date is invalid.'
			});
		}

		if (seasonEndMs === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'seasonEndDate'],
				message: 'Season end date is invalid.'
			});
		}

		if (regStartMs !== null && regEndMs !== null && regStartMs > regEndMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'regEndDate'],
				message: 'Registration end date must be on or after registration start date.'
			});
		}

		if (regEndMs !== null && seasonStartMs !== null && regEndMs > seasonStartMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'seasonStartDate'],
				message: 'Season start date must be on or after registration end date.'
			});
		}

		if (seasonStartMs !== null && seasonEndMs !== null && seasonStartMs > seasonEndMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['league', 'seasonEndDate'],
				message: 'Season end date must be on or after season start date.'
			});
		}

		const preseasonStartMs = toDateMs(payload.league.preseasonStartDate);
		const preseasonEndMs = toDateMs(payload.league.preseasonEndDate);
		if (payload.league.hasPreseason) {
			if (!payload.league.preseasonStartDate) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'preseasonStartDate'],
					message: 'Preseason start date is required when preseason is enabled.'
				});
			}
			if (!payload.league.preseasonEndDate) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'preseasonEndDate'],
					message: 'Preseason end date is required when preseason is enabled.'
				});
			}
			if (
				preseasonStartMs !== null &&
				preseasonEndMs !== null &&
				preseasonStartMs > preseasonEndMs
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'preseasonEndDate'],
					message: 'Preseason end date must be on or after preseason start date.'
				});
			}
			if (
				preseasonEndMs !== null &&
				seasonStartMs !== null &&
				preseasonEndMs > seasonStartMs
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'preseasonEndDate'],
					message: 'Preseason must end on or before season start date.'
				});
			}
		}

		const postseasonStartMs = toDateMs(payload.league.postseasonStartDate);
		const postseasonEndMs = toDateMs(payload.league.postseasonEndDate);
		if (payload.league.hasPostseason) {
			if (!payload.league.postseasonStartDate) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'postseasonStartDate'],
					message: 'Postseason start date is required when postseason is enabled.'
				});
			}
			if (!payload.league.postseasonEndDate) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'postseasonEndDate'],
					message: 'Postseason end date is required when postseason is enabled.'
				});
			}
			if (
				postseasonStartMs !== null &&
				postseasonEndMs !== null &&
				postseasonStartMs > postseasonEndMs
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'postseasonEndDate'],
					message: 'Postseason end date must be on or after postseason start date.'
				});
			}
			if (
				seasonEndMs !== null &&
				postseasonStartMs !== null &&
				postseasonStartMs < seasonEndMs
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['league', 'postseasonStartDate'],
					message: 'Postseason must start on or after season end date.'
				});
			}
		}
	});

export type CreateIntramuralOfferingWithLeagueInput = z.infer<
	typeof createIntramuralOfferingWithLeagueSchema
>;

export type CreatedIntramuralActivity = {
	id: string;
	offeringId: string | null;
	leagueId: string | null;
	offeringType: 'league' | 'tournament';
	offeringName: string;
	leagueName: string;
	seasonLabel: string;
	season: string | null;
	year: number | null;
	gender: string | null;
	skillLevel: string | null;
	registrationStart: string | null;
	registrationEnd: string | null;
	seasonStart: string | null;
	seasonEnd: string | null;
	divisionCount: number;
	spotsRemaining: number | null;
	isLocked: boolean;
	isActive: boolean;
};

export type CreateIntramuralOfferingWithLeagueResponse = {
	success: boolean;
	data?: {
		offeringId: string;
		leagueId: string;
		activity: CreatedIntramuralActivity;
	};
	error?: string;
	fieldErrors?: Record<string, string[] | undefined>;
};
