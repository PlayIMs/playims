import { json } from '@sveltejs/kit';
import type { League, Season } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { DASHBOARD_ALLOWED_ROLES, hasAnyRole } from '$lib/server/auth/rbac';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createIntramuralDivisionSchema,
	createIntramuralTeamSchema,
	moveIntramuralTeamSchema,
	removeIntramuralTeamSchema,
	type CreateIntramuralDivisionInput,
	type CreateIntramuralTeamInput,
	type ManageIntramuralLeagueResponse,
	type MoveIntramuralTeamInput,
	type RemoveIntramuralTeamInput
} from '$lib/server/intramural-offerings-validation';
import type { RequestHandler } from './$types';

const ACTIVE_TEAM_STATUS = 'active';
const WAITLIST_TEAM_STATUS = 'waitlist';

const toFieldErrorMap = (
	issues: Array<{ path: Array<PropertyKey>; message: string }>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};

	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) {
			fieldErrors[key] = [];
		}
		fieldErrors[key].push(issue.message);
	}

	return fieldErrors;
};

const normalizeText = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

const normalizePlacement = (value: 'active' | 'waitlist'): string =>
	value === 'waitlist' ? WAITLIST_TEAM_STATUS : ACTIVE_TEAM_STATUS;

const isActiveTeamStatus = (value: string | null | undefined): boolean =>
	normalizeText(value) === ACTIVE_TEAM_STATUS;

const normalizeSeasonName = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

const formatLegacySeasonLabel = (league: League): string => {
	const season = league.season?.trim() ?? '';
	const year = league.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year}`;
	return '';
};

const leagueMatchesSeason = (league: League, season: Season): boolean => {
	if (league.seasonId) {
		return league.seasonId === season.id;
	}

	return normalizeSeasonName(formatLegacySeasonLabel(league)) === normalizeSeasonName(season.name);
};

async function syncDivisionTeamCounts(
	dbOps: Awaited<ReturnType<typeof getTenantDbOps>>,
	clientId: string,
	divisionIds: string[],
	updatedUser: string
): Promise<void> {
	const uniqueDivisionIds = Array.from(
		new Set(
			divisionIds
				.map((divisionId) => divisionId.trim())
				.filter((divisionId) => divisionId.length > 0)
		)
	);
	if (uniqueDivisionIds.length === 0) {
		return;
	}

	const teams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, uniqueDivisionIds);
	const activeTeamCounts = new Map<string, number>();
	for (const team of teams) {
		if (!team.divisionId || !isActiveTeamStatus(team.teamStatus)) continue;
		activeTeamCounts.set(team.divisionId, (activeTeamCounts.get(team.divisionId) ?? 0) + 1);
	}

	for (const divisionId of uniqueDivisionIds) {
		await dbOps.divisions.updateTeamsCount(
			divisionId,
			activeTeamCounts.get(divisionId) ?? 0,
			updatedUser
		);
	}
}

function assertLeagueParamMatches(
	paramsLeagueId: string,
	bodyLeagueId: string
): Record<string, string[]> | null {
	if (paramsLeagueId === bodyLeagueId) {
		return null;
	}

	return {
		leagueId: ['Request league does not match the page you are managing.']
	};
}

async function resolveLeagueFromParams(
	event: Parameters<RequestHandler>[0],
	dbOps: Awaited<ReturnType<typeof getTenantDbOps>>,
	clientId: string
) {
	const season = await dbOps.seasons.getByClientIdAndSlug(clientId, event.params.seasonSlug);
	if (!season?.id) {
		return {
			season: null,
			league: null
		};
	}

	let league = await dbOps.leagues.getByClientIdSeasonIdAndSlug(
		clientId,
		season.id,
		event.params.leagueSlug
	);
	if (!league?.id) {
		const leagues = await dbOps.leagues.getByClientId(clientId);
		league =
			leagues.find(
				(candidate) =>
					candidate.slug?.trim() === event.params.leagueSlug &&
					leagueMatchesSeason(candidate, season)
			) ?? null;
	}
	return {
		season,
		league
	};
}

function activeTeamsInDivision(
	divisionId: string,
	teams: Array<{ id: string; divisionId: string; teamStatus: string | null }>,
	ignoreTeamId?: string
): number {
	return teams.filter((team) => {
		if (ignoreTeamId && team.id === ignoreTeamId) return false;
		return team.divisionId === divisionId && isActiveTeamStatus(team.teamStatus);
	}).length;
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to update league right now.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 500 }
		);
	}

	if (!hasAnyRole(event.locals.user?.role, DASHBOARD_ALLOWED_ROLES)) {
		return json(
			{
				success: false,
				error: 'You do not have access to manage this league.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const action =
		typeof body === 'object' && body !== null ? (body as { action?: string }).action : undefined;
	if (action !== 'create-division' && action !== 'create-team') {
		return json(
			{
				success: false,
				error: 'Unsupported league action.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const parsed =
		action === 'create-division'
			? createIntramuralDivisionSchema.safeParse(body)
			: createIntramuralTeamSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const input = parsed.data as CreateIntramuralDivisionInput | CreateIntramuralTeamInput;

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const { season, league } = await resolveLeagueFromParams(event, dbOps, clientId);
		if (!season?.id) {
			return json(
				{
					success: false,
					error: 'Season not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		if (!league?.id) {
			return json(
				{
					success: false,
					error: 'League not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		const paramFieldErrors = assertLeagueParamMatches(league.id, input.leagueId);
		if (paramFieldErrors) {
			return json(
				{
					success: false,
					error: 'Invalid league selected.',
					fieldErrors: paramFieldErrors
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 400 }
			);
		}

		const divisions = await dbOps.divisions.getByLeagueId(league.id);
		if (input.action === 'create-division') {
			const duplicateIssues: Array<{ path: Array<string>; message: string }> = [];
			const normalizedName = normalizeText(input.division.name);
			const duplicateName = divisions.some(
				(division) => normalizeText(division.name) === normalizedName
			);
			if (duplicateName) {
				duplicateIssues.push({
					path: ['division', 'name'],
					message: 'A division with this name already exists for this league.'
				});
			}

			const duplicateSlug = divisions.some(
				(division) => normalizeText(division.slug) === normalizeText(input.division.slug)
			);
			if (duplicateSlug) {
				duplicateIssues.push({
					path: ['division', 'slug'],
					message: 'A division with this slug already exists for this league.'
				});
			}

			if (duplicateIssues.length > 0) {
				return json(
					{
						success: false,
						error: 'Duplicate division detected.',
						fieldErrors: toFieldErrorMap(duplicateIssues)
					} satisfies ManageIntramuralLeagueResponse,
					{ status: 409 }
				);
			}

			const createdDivision = await dbOps.divisions.create({
				leagueId: league.id,
				name: input.division.name,
				slug: input.division.slug,
				description: input.division.description,
				dayOfWeek: input.division.dayOfWeek,
				gameTime: input.division.gameTime,
				maxTeams: input.division.maxTeams,
				location: input.division.location,
				isActive: 1,
				isLocked: input.division.isLocked ? 1 : 0,
				teamsCount: 0,
				startDate: input.division.startDate,
				createdUser: userId,
				updatedUser: userId
			});

			if (!createdDivision?.id) {
				return json(
					{
						success: false,
						error: 'Unable to create division right now.'
					} satisfies ManageIntramuralLeagueResponse,
					{ status: 500 }
				);
			}

			return json(
				{
					success: true,
					data: {
						leagueId: league.id,
						divisionId: createdDivision.id
					}
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 201 }
			);
		}

		const targetDivision =
			divisions.find((division) => division.id === input.team.divisionId) ?? null;
		if (!targetDivision?.id) {
			return json(
				{
					success: false,
					error: 'Select a valid division.',
					fieldErrors: {
						'team.divisionId': ['Select a valid division for this league.']
					}
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 400 }
			);
		}

		const duplicateTeamSlug = await dbOps.teams.getByClientIdAndSlug(clientId, input.team.slug);
		if (duplicateTeamSlug?.id) {
			return json(
				{
					success: false,
					error: 'Duplicate team detected.',
					fieldErrors: {
						'team.slug': ['A team with this slug already exists.']
					}
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 409 }
			);
		}

		const leagueTeamPool = await dbOps.teams.getByClientIdAndDivisionIds(
			clientId,
			divisions
				.map((division) => division.id)
				.filter((divisionId): divisionId is string => Boolean(divisionId))
		);
		if (
			input.team.placement === 'active' &&
			typeof targetDivision.maxTeams === 'number' &&
			activeTeamsInDivision(
				targetDivision.id,
				leagueTeamPool as Array<{ id: string; divisionId: string; teamStatus: string | null }>
			) >= targetDivision.maxTeams
		) {
			return json(
				{
					success: false,
					error: 'Selected division is full.',
					fieldErrors: {
						'team.divisionId': [
							'This division is already at capacity. Add the team to the waitlist instead.'
						]
					}
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 409 }
			);
		}

		const createdTeam = await dbOps.teams.create({
			clientId,
			divisionId: targetDivision.id,
			name: input.team.name,
			slug: input.team.slug,
			description: input.team.description,
			imageUrl: input.team.imageUrl,
			teamStatus: normalizePlacement(input.team.placement),
			doesAcceptFreeAgents: 0,
			isAutoAcceptMembers: 0,
			currentRosterSize: 0,
			teamColor: input.team.teamColor,
			dateRegistered: new Date().toISOString(),
			isActive: 1,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdTeam?.id) {
			return json(
				{
					success: false,
					error: 'Unable to create team right now.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 500 }
			);
		}

		if (isActiveTeamStatus(createdTeam.teamStatus)) {
			await syncDivisionTeamCounts(dbOps, clientId, [targetDivision.id], userId);
		}

		return json(
			{
				success: true,
				data: {
					leagueId: league.id,
					teamId: createdTeam.id
				}
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to manage intramural league create actions:', error);
		return json(
			{
				success: false,
				error: 'Unable to update league right now.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to update team placement right now.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 500 }
		);
	}

	if (!hasAnyRole(event.locals.user?.role, DASHBOARD_ALLOWED_ROLES)) {
		return json(
			{
				success: false,
				error: 'You do not have access to manage this league.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const parsed = moveIntramuralTeamSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const input: MoveIntramuralTeamInput = parsed.data;

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const { season, league } = await resolveLeagueFromParams(event, dbOps, clientId);
		if (!season?.id) {
			return json(
				{
					success: false,
					error: 'Season not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		if (!league?.id) {
			return json(
				{
					success: false,
					error: 'League not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		const paramFieldErrors = assertLeagueParamMatches(league.id, input.leagueId);
		if (paramFieldErrors) {
			return json(
				{
					success: false,
					error: 'Invalid league selected.',
					fieldErrors: paramFieldErrors
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 400 }
			);
		}

		const divisions = await dbOps.divisions.getByLeagueId(league.id);
		const divisionIds = divisions
			.map((division) => division.id)
			.filter((divisionId): divisionId is string => Boolean(divisionId));
		const teams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, divisionIds);
		const team = teams.find((candidate) => candidate.id === input.teamId) ?? null;
		if (!team?.id) {
			return json(
				{
					success: false,
					error: 'Team not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		const targetDivision = divisions.find((division) => division.id === input.divisionId) ?? null;
		if (!targetDivision?.id) {
			return json(
				{
					success: false,
					error: 'Select a valid division.',
					fieldErrors: {
						divisionId: ['Select a valid division for this league.']
					}
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 400 }
			);
		}

		if (
			input.placement === 'active' &&
			typeof targetDivision.maxTeams === 'number' &&
			activeTeamsInDivision(
				targetDivision.id,
				teams as Array<{ id: string; divisionId: string; teamStatus: string | null }>,
				team.id
			) >= targetDivision.maxTeams
		) {
			return json(
				{
					success: false,
					error: 'Selected division is full.',
					fieldErrors: {
						divisionId: ['This division is already at capacity.']
					}
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 409 }
			);
		}

		const updatedTeam = await dbOps.teams.updatePlacement(
			clientId,
			team.id,
			{
				divisionId: targetDivision.id,
				teamStatus: normalizePlacement(input.placement)
			},
			userId
		);

		if (!updatedTeam?.id) {
			return json(
				{
					success: false,
					error: 'Unable to move team right now.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 500 }
			);
		}

		await dbOps.divisionStandings.deleteByClientIdAndTeamId(clientId, team.id);
		await syncDivisionTeamCounts(dbOps, clientId, [team.divisionId, targetDivision.id], userId);

		return json({
			success: true,
			data: {
				leagueId: league.id,
				teamId: updatedTeam.id
			}
		} satisfies ManageIntramuralLeagueResponse);
	} catch (error) {
		console.error('Failed to move intramural team:', error);
		return json(
			{
				success: false,
				error: 'Unable to move team right now.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to remove team right now.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 500 }
		);
	}

	if (!hasAnyRole(event.locals.user?.role, DASHBOARD_ALLOWED_ROLES)) {
		return json(
			{
				success: false,
				error: 'You do not have access to manage this league.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const parsed = removeIntramuralTeamSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 400 }
		);
	}

	const input: RemoveIntramuralTeamInput = parsed.data;

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const { season, league } = await resolveLeagueFromParams(event, dbOps, clientId);
		if (!season?.id) {
			return json(
				{
					success: false,
					error: 'Season not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		if (!league?.id) {
			return json(
				{
					success: false,
					error: 'League not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		const paramFieldErrors = assertLeagueParamMatches(league.id, input.leagueId);
		if (paramFieldErrors) {
			return json(
				{
					success: false,
					error: 'Invalid league selected.',
					fieldErrors: paramFieldErrors
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 400 }
			);
		}

		const divisions = await dbOps.divisions.getByLeagueId(league.id);
		const divisionIds = divisions
			.map((division) => division.id)
			.filter((divisionId): divisionId is string => Boolean(divisionId));
		const teams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, divisionIds);
		const team = teams.find((candidate) => candidate.id === input.teamId) ?? null;
		if (!team?.id) {
			return json(
				{
					success: false,
					error: 'Team not found.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 404 }
			);
		}

		await dbOps.rosters.deleteByClientIdAndTeamId(clientId, team.id);
		await dbOps.divisionStandings.deleteByClientIdAndTeamId(clientId, team.id);
		const deleted = await dbOps.teams.deleteByClientIdAndId(clientId, team.id);
		if (!deleted) {
			return json(
				{
					success: false,
					error: 'Unable to remove team right now.'
				} satisfies ManageIntramuralLeagueResponse,
				{ status: 500 }
			);
		}

		await syncDivisionTeamCounts(dbOps, clientId, [team.divisionId], userId);

		return json({
			success: true,
			data: {
				leagueId: league.id,
				teamId: team.id
			}
		} satisfies ManageIntramuralLeagueResponse);
	} catch (error) {
		console.error('Failed to remove intramural team:', error);
		return json(
			{
				success: false,
				error: 'Unable to remove team right now.'
			} satisfies ManageIntramuralLeagueResponse,
			{ status: 500 }
		);
	}
};
