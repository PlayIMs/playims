import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
const normalizeSlug = (value: unknown) => {
	if (typeof value !== 'string') return value;
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
};

const requiredText = (label: string, max = 160) =>
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

const slugField = (label: string) =>
	z.preprocess(
		normalizeSlug,
		z
			.string()
			.min(1, `${label} is required.`)
			.max(120, `${label} must be 120 characters or fewer.`)
			.regex(SLUG_REGEX, `${label} must use lowercase letters, numbers, and dashes only.`)
	);

const optionalUrl = (label: string) =>
	z.preprocess(
		(value) => {
			if (typeof value !== 'string') return value;
			const trimmed = value.trim();
			return trimmed.length === 0 ? null : trimmed;
		},
		z.union([
			z
				.string()
				.max(500, `${label} must be 500 characters or fewer.`)
				.url(`${label} must be a valid URL.`),
			z.null()
		])
	);

const optionalInt = (label: string, min = 1, max = 500) =>
	z.union([
		z
			.number()
			.int(`${label} must be a whole number.`)
			.min(min, `${label} must be at least ${min}.`)
			.max(max, `${label} must be ${max} or less.`),
		z.null()
	]);

const requiredDate = (label: string) =>
	z.preprocess(
		normalizeText,
		z.string().regex(DATE_REGEX, `${label} must be in YYYY-MM-DD format.`)
	);

const requiredDateTime = (label: string) =>
	z.preprocess(
		normalizeText,
		z.string().regex(DATE_TIME_REGEX, `${label} must be in YYYY-MM-DDTHH:mm format.`)
	);

const optionalDate = z.preprocess(
	(value) => {
		if (typeof value !== 'string') return value;
		const trimmed = value.trim();
		return trimmed.length === 0 ? null : trimmed;
	},
	z.union([z.string().regex(DATE_REGEX, 'Date must be in YYYY-MM-DD format.'), z.null()])
);

const toDateMs = (value: string | null): number | null => {
	if (!value) return null;
	if (DATE_REGEX.test(value)) {
		const parsed = new Date(`${value}T00:00:00`).getTime();
		return Number.isNaN(parsed) ? null : parsed;
	}
	if (DATE_TIME_REGEX.test(value)) {
		const parsed = new Date(value).getTime();
		return Number.isNaN(parsed) ? null : parsed;
	}
	return null;
};

const toDateOnlyMs = (value: string | null): number | null => {
	if (!value) return null;
	if (DATE_REGEX.test(value)) return toDateMs(value);
	if (!DATE_TIME_REGEX.test(value)) return null;
	return toDateMs(value.slice(0, 10));
};

const offeringInputSchema = z.object({
	name: requiredText('Offering name', 140),
	slug: slugField('Offering slug'),
	isActive: z.boolean(),
	imageUrl: optionalUrl('Offering image URL'),
	minPlayers: optionalInt('Minimum players', 1, 100),
	maxPlayers: optionalInt('Maximum players', 1, 100),
	rulebookUrl: optionalUrl('Rulebook URL'),
	sport: requiredText('Sport', 80),
	type: z.enum(['league', 'tournament']),
	description: optionalText('Offering description', 2000)
});

const leagueInputSchema = z.object({
	name: requiredText('League name', 140),
	slug: slugField('League slug'),
	description: optionalText('League description', 2000),
	season: requiredText('Season', 80),
	gender: z.union([z.enum(['male', 'female', 'mixed']), z.null()]),
	skillLevel: z.union([z.enum(['competitive', 'intermediate', 'recreational', 'all']), z.null()]),
	regStartDate: requiredDateTime('Registration start date'),
	regEndDate: requiredDateTime('Registration end date'),
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
	imageUrl: optionalUrl('League image URL')
});

export const createIntramuralOfferingWithLeagueSchema = z
	.object({
		offering: offeringInputSchema,
		leagues: z.array(leagueInputSchema)
	})
	.superRefine((payload, ctx) => {
		const minPlayers = payload.offering.minPlayers;
		const maxPlayers = payload.offering.maxPlayers;
		if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['offering', 'maxPlayers'],
				message: 'Maximum players must be greater than or equal to minimum players.'
			});
		}

		const seenLeagueSlugs = new Map<string, number>();
		payload.leagues.forEach((league, index) => {
			const previousIndex = seenLeagueSlugs.get(league.slug);
			if (previousIndex !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'slug'],
					message: 'League slug must be unique within this request.'
				});
				return;
			}
			seenLeagueSlugs.set(league.slug, index);
		});

		payload.leagues.forEach((league, index) => {
			const regStartMs = toDateMs(league.regStartDate);
			const regEndMs = toDateMs(league.regEndDate);
			const regEndDateOnlyMs = toDateOnlyMs(league.regEndDate);
			const seasonStartMs = toDateMs(league.seasonStartDate);
			const seasonEndMs = toDateMs(league.seasonEndDate);

			if (regStartMs === null) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'regStartDate'],
					message: 'Registration start date is invalid.'
				});
			}

			if (regEndMs === null) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'regEndDate'],
					message: 'Registration end date is invalid.'
				});
			}

			if (seasonStartMs === null) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'seasonStartDate'],
					message: 'Season start date is invalid.'
				});
			}

			if (seasonEndMs === null) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'seasonEndDate'],
					message: 'Season end date is invalid.'
				});
			}

			if (regStartMs !== null && regEndMs !== null && regStartMs > regEndMs) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'regEndDate'],
					message: 'Registration end date must be on or after registration start date.'
				});
			}

			if (regEndDateOnlyMs !== null && seasonStartMs !== null && regEndDateOnlyMs > seasonStartMs) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'seasonStartDate'],
					message: 'Season start date must be on or after registration end date.'
				});
			}

			if (seasonStartMs !== null && seasonEndMs !== null && seasonStartMs > seasonEndMs) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['leagues', index, 'seasonEndDate'],
					message: 'Season end date must be on or after season start date.'
				});
			}

			const preseasonStartMs = toDateMs(league.preseasonStartDate);
			const preseasonEndMs = toDateMs(league.preseasonEndDate);
			if (league.hasPreseason) {
				if (!league.preseasonStartDate) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['leagues', index, 'preseasonStartDate'],
						message: 'Preseason start date is required when preseason is enabled.'
					});
				}
				if (!league.preseasonEndDate) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['leagues', index, 'preseasonEndDate'],
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
						path: ['leagues', index, 'preseasonEndDate'],
						message: 'Preseason end date must be on or after preseason start date.'
					});
				}
				if (preseasonEndMs !== null && seasonStartMs !== null && preseasonEndMs > seasonStartMs) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['leagues', index, 'preseasonEndDate'],
						message: 'Preseason must end on or before season start date.'
					});
				}
			}

			const postseasonStartMs = toDateMs(league.postseasonStartDate);
			const postseasonEndMs = toDateMs(league.postseasonEndDate);
			if (league.hasPostseason) {
				if (!league.postseasonStartDate) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['leagues', index, 'postseasonStartDate'],
						message: 'Postseason start date is required when postseason is enabled.'
					});
				}
				if (!league.postseasonEndDate) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['leagues', index, 'postseasonEndDate'],
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
						path: ['leagues', index, 'postseasonEndDate'],
						message: 'Postseason end date must be on or after postseason start date.'
					});
				}
				if (seasonEndMs !== null && postseasonStartMs !== null && postseasonStartMs < seasonEndMs) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['leagues', index, 'postseasonStartDate'],
						message: 'Postseason must start on or after season end date.'
					});
				}
			}
		});
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
		leagueIds: string[];
		activities: CreatedIntramuralActivity[];
	};
	error?: string;
	fieldErrors?: Record<string, string[] | undefined>;
};
