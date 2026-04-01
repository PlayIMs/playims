import { z } from 'zod';

const trimmedText = (label: string) => z.string().trim().min(1, `${label} is required.`);

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

export const createClubSeasonSchema = z.object({
	season: clubSeasonInputSchema,
	copy: z
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

const clubLeagueInputSchema = z.object({
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
});

export const createClubSchema = z.object({
	club: clubInputSchema,
	leagues: z.array(clubLeagueInputSchema).default([])
});

export const updateClubSchema = z.object({
	clubId: trimmedText('Club'),
	club: clubInputSchema
});

export const createClubLeagueSchema = z.object({
	clubId: trimmedText('Club'),
	leagues: z.array(clubLeagueInputSchema).min(1, 'At least one league is required.')
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
