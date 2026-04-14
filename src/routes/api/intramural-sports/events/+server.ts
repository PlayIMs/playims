import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import {
	createIntramuralEventSchema,
	type CreateIntramuralEventInput,
	type CreateIntramuralEventResponse
} from '$lib/server/intramural-events-validation';
import { buildScheduleEvent, mapById } from '$lib/server/schedule-events';
import type { RequestHandler } from './$types';

const toFieldErrorMap = (
	issues: Array<{ path: Array<PropertyKey>; message: string }>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) fieldErrors[key] = [];
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
};

function toIsoDateTime(value: string): string {
	return new Date(value).toISOString();
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save event right now.'
			} satisfies CreateIntramuralEventResponse,
			{ status: 500 }
		);
	}

	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_OFFERINGS, { mutate: true })) {
		return json(
			{
				success: false,
				error: 'Only managers, administrators, and developers can create schedule events.'
			} satisfies CreateIntramuralEventResponse,
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
			} satisfies CreateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	const parsed = createIntramuralEventSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies CreateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	const input: CreateIntramuralEventInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const [season, offering, league, division, facility, facilityArea] = await Promise.all([
			dbOps.seasons.getByClientIdAndId(clientId, input.event.seasonId),
			dbOps.offerings.getByClientIdAndId(clientId, input.event.offeringId),
			dbOps.leagues.getByClientIdAndId(clientId, input.event.leagueId),
			dbOps.divisions.getById(input.event.divisionId),
			input.event.facilityId
				? dbOps.facilities.getByClientIdAndId(clientId, input.event.facilityId)
				: Promise.resolve(null),
			input.event.facilityAreaId
				? dbOps.facilityAreas.getByClientIdAndId(clientId, input.event.facilityAreaId)
				: Promise.resolve(null)
		]);

		const issues: Array<{ path: Array<PropertyKey>; message: string }> = [];
		if (!season?.id) {
			issues.push({
				path: ['event', 'seasonId'],
				message: 'Choose a valid season.'
			});
		}
		if (!offering?.id) {
			issues.push({
				path: ['event', 'offeringId'],
				message: 'Choose a valid offering.'
			});
		} else if (season?.id && offering.seasonId !== season.id) {
			issues.push({
				path: ['event', 'offeringId'],
				message: 'Choose an offering that belongs to the selected season.'
			});
		}
		if (!league?.id) {
			issues.push({
				path: ['event', 'leagueId'],
				message: 'Choose a valid league.'
			});
		} else {
			if (offering?.id && league.offeringId !== offering.id) {
				issues.push({
					path: ['event', 'leagueId'],
					message: 'Choose a league that belongs to the selected offering.'
				});
			}
			if (season?.id && league.seasonId && league.seasonId !== season.id) {
				issues.push({
					path: ['event', 'leagueId'],
					message: 'Choose a league that belongs to the selected season.'
				});
			}
		}
		if (!division?.id) {
			issues.push({
				path: ['event', 'divisionId'],
				message: 'Choose a valid division.'
			});
		} else if (league?.id && division.leagueId !== league.id) {
			issues.push({
				path: ['event', 'divisionId'],
				message: 'Choose a division that belongs to the selected league.'
			});
		}
		if (input.event.facilityId && !facility?.id) {
			issues.push({
				path: ['event', 'facilityId'],
				message: 'Choose a valid facility.'
			});
		}
		if (input.event.facilityAreaId && !facilityArea?.id) {
			issues.push({
				path: ['event', 'facilityAreaId'],
				message: 'Choose a valid facility area.'
			});
		} else if (facilityArea?.id && facility?.id && facilityArea.facilityId !== facility.id) {
			issues.push({
				path: ['event', 'facilityAreaId'],
				message: 'Choose a facility area that belongs to the selected facility.'
			});
		}

		const teams = division?.id
			? await dbOps.teams.getByClientIdAndDivisionIds(clientId, [division.id])
			: [];
		const activeTeams = teams.filter((team) => team.isActive !== 0 && team.id);
		const teamsById = mapById(activeTeams as Array<(typeof activeTeams)[number] & { id: string }>);
		const homeTeam = teamsById.get(input.event.homeTeamId);
		const awayTeam = teamsById.get(input.event.awayTeamId);
		if (!homeTeam?.id) {
			issues.push({
				path: ['event', 'homeTeamId'],
				message: 'Choose a home team that belongs to the selected division.'
			});
		}
		if (!awayTeam?.id) {
			issues.push({
				path: ['event', 'awayTeamId'],
				message: 'Choose an away team that belongs to the selected division.'
			});
		}

		if (issues.length > 0) {
			return json(
				{
					success: false,
					error: 'Selected event details do not belong to the same intramural structure.',
					fieldErrors: toFieldErrorMap(issues)
				} satisfies CreateIntramuralEventResponse,
				{ status: 400 }
			);
		}

		const createdEvent = await dbOps.events.create({
			clientId,
			offeringId: input.event.offeringId,
			leagueId: input.event.leagueId,
			divisionId: input.event.divisionId,
			facilityId: input.event.facilityId,
			facilityAreaId: input.event.facilityAreaId,
			homeTeamId: input.event.homeTeamId,
			awayTeamId: input.event.awayTeamId,
			scheduledStartAt: toIsoDateTime(input.event.scheduledStartAt),
			scheduledEndAt: toIsoDateTime(input.event.scheduledEndAt),
			status: 'scheduled',
			isPostseason: input.event.isPostseason ? 1 : 0,
			roundLabel: input.event.roundLabel,
			weekNumber: input.event.weekNumber,
			notes: input.event.notes,
			type: 'game',
			isActive: 1,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdEvent?.id) {
			return json(
				{
					success: false,
					error: 'Unable to save event right now.'
				} satisfies CreateIntramuralEventResponse,
				{ status: 500 }
			);
		}

		return json(
			{
				success: true,
				data: {
					event: buildScheduleEvent(
						createdEvent,
						new Map([
							[input.event.homeTeamId, homeTeam!],
							[input.event.awayTeamId, awayTeam!]
						]),
						new Map([[input.event.offeringId, offering!]]),
						new Map([[input.event.seasonId, season!]]),
						new Map([[input.event.leagueId, league!]]),
						new Map([[input.event.divisionId, division!]]),
						facility?.id ? new Map([[facility.id, facility]]) : new Map(),
						facilityArea?.id ? new Map([[facilityArea.id, facilityArea]]) : new Map()
					)
				}
			} satisfies CreateIntramuralEventResponse,
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create intramural event:', error);
		return json(
			{
				success: false,
				error: 'Unable to save event right now.'
			} satisfies CreateIntramuralEventResponse,
			{ status: 500 }
		);
	}
};
