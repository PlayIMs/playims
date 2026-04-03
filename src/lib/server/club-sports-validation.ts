import { z } from 'zod';

const trimmedText = (label: string) => z.string().trim().min(1, `${label} is required.`);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeComparableText = (value: string | null | undefined) =>
	value?.trim().toLowerCase() ?? '';
const normalizeComparableSlug = (value: string | null | undefined) =>
	value
		?.trim()
		.toLowerCase()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '') ?? '';

const toDateMs = (value: string | null | undefined): number | null => {
	const normalized = value?.trim() ?? '';
	if (!normalized || !DATE_ONLY_PATTERN.test(normalized)) return null;
	const parsed = new Date(`${normalized}T00:00:00`).getTime();
	return Number.isNaN(parsed) ? null : parsed;
};

const nullableTrimmedUrl = z
	.string()
	.trim()
	.url('Enter a valid URL.')
	.or(z.literal(''))
	.nullable()
	.transform((value) => {
		if (value === '' || value === null) return null;
		return value;
	});

const optionalDate = z
	.string()
	.trim()
	.min(1)
	.or(z.literal(''))
	.nullable()
	.transform((value) => {
		if (value === '' || value === null) return null;
		return value;
	});

export const clubSeasonInputSchema = z.object({
	name: trimmedText('Season name'),
	slug: trimmedText('Season slug'),
	startDate: trimmedText('Start date'),
	endDate: optionalDate,
	isCurrent: z.boolean().default(false),
	isActive: z.boolean().default(true)
});

export const clubSeasonCopyInputSchema = z
	.object({
		enabled: z.boolean().default(false),
		sourceSeasonIds: z.array(z.string().trim()).default([]),
		includeClubs: z.boolean().default(true),
		includeLeagues: z.boolean().default(true),
		includeTeams: z.boolean().default(true),
		includeOfficers: z.boolean().default(false),
		includeRosters: z.boolean().default(false),
		includeSchedules: z.boolean().default(false)
	})
	.default({
		enabled: false,
		sourceSeasonIds: [],
		includeClubs: true,
		includeLeagues: true,
		includeTeams: true,
		includeOfficers: false,
		includeRosters: false,
		includeSchedules: false
	})
	.superRefine((copy, ctx) => {
		if (!copy.enabled) return;

		if (copy.sourceSeasonIds.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['sourceSeasonIds'],
				message: 'Choose at least one source season.'
			});
		}

		if (!copy.includeClubs && (copy.includeLeagues || copy.includeTeams || copy.includeOfficers)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['includeClubs'],
				message: 'Clubs must be included before leagues, teams, or officers can be copied.'
			});
		}

		if (!copy.includeLeagues && (copy.includeTeams || copy.includeSchedules)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['includeLeagues'],
				message: 'Leagues must be included before teams or schedules can be copied.'
			});
		}

		if (!copy.includeLeagues && copy.includeTeams) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['includeTeams'],
				message: 'Teams can only be copied when leagues are included.'
			});
		}

		if ((!copy.includeTeams || !copy.includeLeagues) && copy.includeRosters) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['includeRosters'],
				message: 'Rosters can only be copied when teams are included.'
			});
		}
	});

export const createClubSeasonSchema = z
	.object({
		season: clubSeasonInputSchema,
		copy: clubSeasonCopyInputSchema
	})
	.superRefine((input, ctx) => {
		const startMs = toDateMs(input.season.startDate);
		const endMs = toDateMs(input.season.endDate);
		if (startMs !== null && endMs !== null && endMs < startMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['season', 'endDate'],
				message: 'End date must be on or after the start date.'
			});
		}
	});

export const clubInputSchema = z.object({
	clubSeasonId: trimmedText('Club season'),
	name: trimmedText('Club name'),
	slug: trimmedText('Club slug'),
	sport: z.string().trim().nullable().default(null),
	description: z.string().trim().nullable().default(null),
	imageUrl: nullableTrimmedUrl.default(null),
	isActive: z.boolean().default(true)
});

export const clubLeagueInputSchema = z
	.object({
		name: trimmedText('League name'),
		slug: trimmedText('League slug'),
		stackOrder: z.number().int().positive().default(1),
		description: z.string().trim().nullable().default(null),
		gender: z.string().trim().nullable().default(null),
		regStartDate: optionalDate.default(null),
		regEndDate: optionalDate.default(null),
		seasonStartDate: optionalDate.default(null),
		seasonEndDate: optionalDate.default(null),
		isActive: z.boolean().default(true),
		isLocked: z.boolean().default(false),
		imageUrl: nullableTrimmedUrl.default(null)
	})
	.superRefine((league, ctx) => {
		const regStartMs = toDateMs(league.regStartDate);
		const regEndMs = toDateMs(league.regEndDate);
		const seasonStartMs = toDateMs(league.seasonStartDate);
		const seasonEndMs = toDateMs(league.seasonEndDate);

		if (regStartMs !== null && regEndMs !== null && regEndMs < regStartMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['regEndDate'],
				message: 'Registration end date must be on or after the registration start date.'
			});
		}

		if (seasonStartMs !== null && seasonEndMs !== null && seasonEndMs < seasonStartMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['seasonEndDate'],
				message: 'Season end date must be on or after the season start date.'
			});
		}

		if (regEndMs !== null && seasonStartMs !== null && regEndMs > seasonStartMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['seasonStartDate'],
				message: 'Season start date must be on or after the registration end date.'
			});
		}
	});

const addLeagueCollectionIssues = (
	leagues: z.infer<typeof clubLeagueInputSchema>[],
	ctx: z.RefinementCtx,
	pathPrefix: string
) => {
	const seenNames = new Map<string, number>();
	const seenSlugs = new Map<string, number>();

	for (const [index, league] of leagues.entries()) {
		const normalizedName = normalizeComparableText(league.name);
		const normalizedSlug = normalizeComparableSlug(league.slug);

		if (normalizedName) {
			const previousIndex = seenNames.get(normalizedName);
			if (previousIndex !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [pathPrefix, index, 'name'],
					message: 'League name must be unique within this request.'
				});
			} else {
				seenNames.set(normalizedName, index);
			}
		}

		if (normalizedSlug) {
			const previousIndex = seenSlugs.get(normalizedSlug);
			if (previousIndex !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [pathPrefix, index, 'slug'],
					message: 'League slug must be unique within this request.'
				});
			} else {
				seenSlugs.set(normalizedSlug, index);
			}
		}
	}
};

export const createClubSchema = z
	.object({
		club: clubInputSchema,
		leagues: z.array(clubLeagueInputSchema).default([])
	})
	.superRefine((input, ctx) => {
		addLeagueCollectionIssues(input.leagues, ctx, 'leagues');
	});

export const updateClubSchema = z.object({
	clubId: trimmedText('Club'),
	club: clubInputSchema
});

export const createClubLeagueSchema = z
	.object({
		clubId: trimmedText('Club'),
		leagues: z.array(clubLeagueInputSchema).min(1, 'At least one league is required.')
	})
	.superRefine((input, ctx) => {
		addLeagueCollectionIssues(input.leagues, ctx, 'leagues');
	});

export const clubTeamInputSchema = z.object({
	name: trimmedText('Team name'),
	slug: trimmedText('Team slug'),
	description: z.string().trim().nullable().default(null),
	teamColor: z.string().trim().nullable().default(null),
	isActive: z.boolean().default(true)
});

export const createClubTeamSchema = z.object({
	team: clubTeamInputSchema
});

export const officerTitleInputSchema = z.object({
	name: trimmedText('Title name'),
	slug: trimmedText('Title slug'),
	scope: z.enum(['club', 'team', 'both']),
	isActive: z.boolean().default(true)
});

export const createOfficerTitleSchema = z.object({
	title: officerTitleInputSchema.extend({
		clubId: z.string().trim().nullable().optional()
	})
});

export const updateOfficerTitleSchema = z.object({
	titleId: trimmedText('Title'),
	title: officerTitleInputSchema
});

export const officerAssignmentInputSchema = z.object({
	titleId: trimmedText('Title'),
	userId: trimmedText('Member'),
	clubSeasonId: trimmedText('Club season'),
	clubId: trimmedText('Club'),
	clubLeagueId: z.string().trim().nullable().optional(),
	clubTeamId: z.string().trim().nullable().optional()
});

export const createOfficerAssignmentSchema = z.object({
	assignment: officerAssignmentInputSchema
});

export type CreateClubSeasonInput = z.infer<typeof createClubSeasonSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type UpdateClubInput = z.infer<typeof updateClubSchema>;
export type CreateClubLeagueInput = z.infer<typeof createClubLeagueSchema>;
export type CreateClubTeamInput = z.infer<typeof createClubTeamSchema>;
export type UpdateOfficerTitleInput = z.infer<typeof updateOfficerTitleSchema>;
export type CreateOfficerAssignmentInput = z.infer<typeof createOfficerAssignmentSchema>;
