import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import {
	createIntramuralEventSchema,
	duplicateIntramuralEventSchema,
	deleteIntramuralEventSchema,
	editIntramuralEventSchema,
	enterIntramuralEventResultsSchema,
	restoreDeletedIntramuralEventSchema,
	type CreateIntramuralEventInput,
	type CreateIntramuralEventResponse,
	type DuplicateIntramuralEventInput,
	type DuplicateIntramuralEventResponse,
	type DeleteIntramuralEventInput,
	type DeleteIntramuralEventResponse,
	type EditIntramuralEventInput,
	type EnterIntramuralEventResultsInput,
	type RestoreDeletedIntramuralEventInput,
	type UpdateIntramuralEventResponse
} from '$lib/server/intramural-events-validation';
import { buildScheduleEvent, mapById } from '$lib/server/schedule-events';
import type { Event } from '$lib/database/schema/events';
import type { Facility } from '$lib/database/schema/facilities';
import type { FacilityArea } from '$lib/database/schema/facility-areas';
import type { League } from '$lib/database/schema/leagues';
import type { Division } from '$lib/database/schema/divisions';
import type { Offering } from '$lib/database/schema/offerings';
import type { Season } from '$lib/database/schema/seasons';
import type { Team } from '$lib/database/schema/teams';
import type { RequestHandler } from './$types';

type FieldIssue = { path: Array<PropertyKey>; message: string };

function toFieldErrorMap(issues: FieldIssue[]): Record<string, string[]> {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) fieldErrors[key] = [];
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
}

function toIsoDateTime(value: string): string {
	return new Date(value).toISOString();
}

type EventRelationContext = {
	season: Season | null;
	offering: Offering | null;
	league: League | null;
	division: Division | null;
	facility: Facility | null;
	facilityArea: FacilityArea | null;
	homeTeam: Team | null;
	awayTeam: Team | null;
};

async function requireEventContext(
	event: Parameters<RequestHandler>[0],
	clientId: string,
	input: {
		seasonId: string;
		offeringId: string;
		leagueId: string;
		divisionId: string;
		facilityId: string | null;
		facilityAreaId: string | null;
		homeTeamId: string;
		awayTeamId: string;
	}
) {
	const dbOps = await getTenantDbOps(event, clientId);
	const [season, offering, league, division, facility, facilityArea] = await Promise.all([
		dbOps.seasons.getByClientIdAndId(clientId, input.seasonId),
		dbOps.offerings.getByClientIdAndId(clientId, input.offeringId),
		dbOps.leagues.getByClientIdAndId(clientId, input.leagueId),
		dbOps.divisions.getById(input.divisionId),
		input.facilityId
			? dbOps.facilities.getByClientIdAndId(clientId, input.facilityId)
			: Promise.resolve(null),
		input.facilityAreaId
			? dbOps.facilityAreas.getByClientIdAndId(clientId, input.facilityAreaId)
			: Promise.resolve(null)
	]);

	const issues: FieldIssue[] = [];
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
	if (input.facilityId && !facility?.id) {
		issues.push({
			path: ['event', 'facilityId'],
			message: 'Choose a valid facility.'
		});
	}
	if (input.facilityAreaId && !facilityArea?.id) {
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
	const homeTeam = teamsById.get(input.homeTeamId);
	const awayTeam = teamsById.get(input.awayTeamId);
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

	return {
		issues,
		season,
		offering,
		league,
		division,
		facility,
		facilityArea,
		homeTeam,
		awayTeam
	};
}

async function loadEventContextFromRecord(
	event: Parameters<RequestHandler>[0],
	clientId: string,
	record: {
		offeringId: string | null;
		leagueId: string | null;
		divisionId: string | null;
		facilityId: string | null;
		facilityAreaId: string | null;
		homeTeamId: string | null;
		awayTeamId: string | null;
	}
): Promise<EventRelationContext> {
	const dbOps = await getTenantDbOps(event, clientId);
	const offering = record.offeringId
		? await dbOps.offerings.getByClientIdAndId(clientId, record.offeringId)
		: null;
	const season = offering?.seasonId
		? await dbOps.seasons.getByClientIdAndId(clientId, offering.seasonId)
		: null;
	const league = record.leagueId
		? await dbOps.leagues.getByClientIdAndId(clientId, record.leagueId)
		: null;
	const division = record.divisionId ? await dbOps.divisions.getById(record.divisionId) : null;
	const facility = record.facilityId
		? await dbOps.facilities.getByClientIdAndId(clientId, record.facilityId)
		: null;
	const facilityArea = record.facilityAreaId
		? await dbOps.facilityAreas.getByClientIdAndId(clientId, record.facilityAreaId)
		: null;
	const teams = division?.id
		? await dbOps.teams.getByClientIdAndDivisionIds(clientId, [division.id])
		: [];
	const activeTeams = teams.filter((team) => team.isActive !== 0 && team.id);
	const teamsById = mapById(activeTeams as Array<(typeof activeTeams)[number] & { id: string }>);

	return {
		season,
		offering,
		league,
		division,
		facility,
		facilityArea,
		homeTeam: record.homeTeamId ? (teamsById.get(record.homeTeamId) ?? null) : null,
		awayTeam: record.awayTeamId ? (teamsById.get(record.awayTeamId) ?? null) : null
	};
}

function buildRelationMap<T extends { id: string }>(
	records: Array<T | null | undefined>
): Map<string, T> {
	return mapById(records.filter((record): record is T => Boolean(record)));
}

function buildScheduleResponse(record: Event, context: EventRelationContext) {
	return buildScheduleEvent(
		record,
		buildRelationMap([context.homeTeam, context.awayTeam]),
		buildRelationMap([context.offering]),
		buildRelationMap([context.season]),
		buildRelationMap([context.league]),
		buildRelationMap([context.division]),
		context.facility?.id ? buildRelationMap([context.facility]) : new Map(),
		context.facilityArea?.id ? buildRelationMap([context.facilityArea]) : new Map()
	);
}

export const POST: RequestHandler = async (requestEvent) => {
	if (!requestEvent.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save event right now.'
			} satisfies CreateIntramuralEventResponse,
			{ status: 500 }
		);
	}

	if (!requirePermission(requestEvent.locals, PERMISSIONS.MANAGE_OFFERINGS, { mutate: true })) {
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
		body = (await requestEvent.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies CreateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	const action =
		typeof body === 'object' && body !== null && 'action' in body
			? String((body as { action?: unknown }).action ?? '')
			: '';
	const parsed = createIntramuralEventSchema.safeParse(body);
	const parsedDuplicate = duplicateIntramuralEventSchema.safeParse(body);
	if (action === 'duplicate' && !parsedDuplicate.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsedDuplicate.error.issues)
			} satisfies DuplicateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	if (parsedDuplicate.success) {
		const input: DuplicateIntramuralEventInput = parsedDuplicate.data;
		const clientId = requireAuthenticatedClientId(requestEvent.locals);
		const userId = requireAuthenticatedUserId(requestEvent.locals);
		const dbOps = await getTenantDbOps(requestEvent, clientId);

		try {
			const currentEvent = await dbOps.events.getByClientIdAndId(clientId, input.eventId);
			if (!currentEvent?.id) {
				return json(
					{
						success: false,
						error: 'Event not found.'
					} satisfies DuplicateIntramuralEventResponse,
					{ status: 404 }
				);
			}

			const currentOffering = currentEvent.offeringId
				? await dbOps.offerings.getByClientIdAndId(clientId, currentEvent.offeringId)
				: null;
			const context = await requireEventContext(requestEvent, clientId, {
				seasonId: currentOffering?.seasonId ?? '',
				offeringId: currentEvent.offeringId ?? '',
				leagueId: currentEvent.leagueId ?? '',
				divisionId: currentEvent.divisionId ?? '',
				facilityId: currentEvent.facilityId,
				facilityAreaId: currentEvent.facilityAreaId,
				homeTeamId: currentEvent.homeTeamId ?? '',
				awayTeamId: currentEvent.awayTeamId ?? ''
			});

			if (context.issues.length > 0) {
				return json(
					{
						success: false,
						error: 'Selected event details do not belong to the same intramural structure.',
						fieldErrors: toFieldErrorMap(context.issues)
					} satisfies DuplicateIntramuralEventResponse,
					{ status: 400 }
				);
			}

			const duplicatedEvent = await dbOps.events.create({
				clientId,
				offeringId: currentEvent.offeringId!,
				leagueId: currentEvent.leagueId!,
				divisionId: currentEvent.divisionId!,
				facilityId: currentEvent.facilityId,
				facilityAreaId: currentEvent.facilityAreaId,
				homeTeamId: currentEvent.homeTeamId!,
				awayTeamId: currentEvent.awayTeamId!,
				scheduledStartAt: currentEvent.scheduledStartAt!,
				scheduledEndAt: currentEvent.scheduledEndAt!,
				status: 'scheduled',
				isPostseason: currentEvent.isPostseason ? 1 : 0,
				roundLabel: currentEvent.roundLabel,
				weekNumber: currentEvent.weekNumber,
				notes: currentEvent.notes,
				type: currentEvent.type || 'game',
				isActive: currentEvent.isActive ?? 1,
				createdUser: userId,
				updatedUser: userId
			});

			if (!duplicatedEvent?.id) {
				return json(
					{
						success: false,
						error: 'Unable to duplicate event right now.'
					} satisfies DuplicateIntramuralEventResponse,
					{ status: 500 }
				);
			}

			return json(
				{
					success: true,
					data: {
						event: buildScheduleResponse(duplicatedEvent, {
							season: context.season!,
							offering: context.offering!,
							league: context.league!,
							division: context.division!,
							facility: context.facility,
							facilityArea: context.facilityArea,
							homeTeam: context.homeTeam!,
							awayTeam: context.awayTeam!
						})
					}
				} satisfies DuplicateIntramuralEventResponse,
				{ status: 201 }
			);
		} catch (error) {
			console.error('Failed to duplicate intramural event:', error);
			return json(
				{
					success: false,
					error: 'Unable to duplicate event right now.'
				} satisfies DuplicateIntramuralEventResponse,
				{ status: 500 }
			);
		}
	}

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
	const clientId = requireAuthenticatedClientId(requestEvent.locals);
	const userId = requireAuthenticatedUserId(requestEvent.locals);
	const dbOps = await getTenantDbOps(requestEvent, clientId);

	try {
		const context = await requireEventContext(requestEvent, clientId, input.event);
		if (context.issues.length > 0) {
			return json(
				{
					success: false,
					error: 'Selected event details do not belong to the same intramural structure.',
					fieldErrors: toFieldErrorMap(context.issues)
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
					event: buildScheduleResponse(createdEvent, {
						season: context.season!,
						offering: context.offering!,
						league: context.league!,
						division: context.division!,
						facility: context.facility,
						facilityArea: context.facilityArea,
						homeTeam: context.homeTeam!,
						awayTeam: context.awayTeam!
					})
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

export const PATCH: RequestHandler = async (requestEvent) => {
	if (!requestEvent.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save event right now.'
			} satisfies UpdateIntramuralEventResponse,
			{ status: 500 }
		);
	}

	if (!requirePermission(requestEvent.locals, PERMISSIONS.MANAGE_OFFERINGS, { mutate: true })) {
		return json(
			{
				success: false,
				error: 'Only managers, administrators, and developers can manage schedule events.'
			} satisfies UpdateIntramuralEventResponse,
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await requestEvent.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies UpdateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	const action =
		typeof body === 'object' && body !== null && 'action' in body
			? String((body as { action?: unknown }).action ?? '')
			: '';
	const parsedDuplicate = duplicateIntramuralEventSchema.safeParse(body);
	if (action === 'duplicate' && !parsedDuplicate.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsedDuplicate.error.issues)
			} satisfies DuplicateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	if (parsedDuplicate.success) {
		const input: DuplicateIntramuralEventInput = parsedDuplicate.data;
		const clientId = requireAuthenticatedClientId(requestEvent.locals);
		const userId = requireAuthenticatedUserId(requestEvent.locals);
		const dbOps = await getTenantDbOps(requestEvent, clientId);

		try {
			const currentEvent = await dbOps.events.getByClientIdAndId(clientId, input.eventId);
			if (!currentEvent?.id) {
				return json(
					{
						success: false,
						error: 'Event not found.'
					} satisfies DuplicateIntramuralEventResponse,
					{ status: 404 }
				);
			}

			const currentOffering = currentEvent.offeringId
				? await dbOps.offerings.getByClientIdAndId(clientId, currentEvent.offeringId)
				: null;
			const context = await requireEventContext(requestEvent, clientId, {
				seasonId: currentOffering?.seasonId ?? '',
				offeringId: currentEvent.offeringId ?? '',
				leagueId: currentEvent.leagueId ?? '',
				divisionId: currentEvent.divisionId ?? '',
				facilityId: currentEvent.facilityId,
				facilityAreaId: currentEvent.facilityAreaId,
				homeTeamId: currentEvent.homeTeamId ?? '',
				awayTeamId: currentEvent.awayTeamId ?? ''
			});

			if (context.issues.length > 0) {
				return json(
					{
						success: false,
						error: 'Selected event details do not belong to the same intramural structure.',
						fieldErrors: toFieldErrorMap(context.issues)
					} satisfies DuplicateIntramuralEventResponse,
					{ status: 400 }
				);
			}

			const duplicatedEvent = await dbOps.events.create({
				clientId,
				offeringId: currentEvent.offeringId!,
				leagueId: currentEvent.leagueId!,
				divisionId: currentEvent.divisionId!,
				facilityId: currentEvent.facilityId,
				facilityAreaId: currentEvent.facilityAreaId,
				homeTeamId: currentEvent.homeTeamId!,
				awayTeamId: currentEvent.awayTeamId!,
				scheduledStartAt: currentEvent.scheduledStartAt!,
				scheduledEndAt: currentEvent.scheduledEndAt!,
				status: 'scheduled',
				isPostseason: currentEvent.isPostseason ?? 0,
				roundLabel: currentEvent.roundLabel,
				weekNumber: currentEvent.weekNumber,
				notes: currentEvent.notes,
				type: currentEvent.type || 'game',
				isActive: currentEvent.isActive ?? 1,
				createdUser: userId,
				updatedUser: userId
			});

			if (!duplicatedEvent?.id) {
				return json(
					{
						success: false,
						error: 'Unable to duplicate event right now.'
					} satisfies DuplicateIntramuralEventResponse,
					{ status: 500 }
				);
			}

			return json(
				{
					success: true,
					data: {
						event: buildScheduleResponse(duplicatedEvent, {
							season: context.season!,
							offering: context.offering!,
							league: context.league!,
							division: context.division!,
							facility: context.facility,
							facilityArea: context.facilityArea,
							homeTeam: context.homeTeam!,
							awayTeam: context.awayTeam!
						})
					}
				} satisfies DuplicateIntramuralEventResponse,
				{ status: 201 }
			);
		} catch (error) {
			console.error('Failed to duplicate intramural event:', error);
			return json(
				{
					success: false,
					error: 'Unable to duplicate event right now.'
				} satisfies DuplicateIntramuralEventResponse,
				{ status: 500 }
			);
		}
	}

	const parsedRestore = restoreDeletedIntramuralEventSchema.safeParse(body);
	if (action === 'restore-delete' && !parsedRestore.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsedRestore.error.issues)
			} satisfies UpdateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	if (parsedRestore.success) {
		const input: RestoreDeletedIntramuralEventInput = parsedRestore.data;
		const clientId = requireAuthenticatedClientId(requestEvent.locals);
		const userId = requireAuthenticatedUserId(requestEvent.locals);
		const dbOps = await getTenantDbOps(requestEvent, clientId);

		try {
			const currentEvent = await dbOps.events.getByClientIdAndId(clientId, input.eventId);
			if (!currentEvent?.id) {
				return json(
					{
						success: false,
						error: 'Event not found.'
					} satisfies UpdateIntramuralEventResponse,
					{ status: 404 }
				);
			}

			const restoredEvent = await dbOps.events.updateByClientIdAndId(clientId, input.eventId, {
				isActive: 1,
				updatedUser: userId
			});

			if (!restoredEvent?.id) {
				return json(
					{
						success: false,
						error: 'Unable to restore event right now.'
					} satisfies UpdateIntramuralEventResponse,
					{ status: 500 }
				);
			}

			const updatedContext = await loadEventContextFromRecord(requestEvent, clientId, currentEvent);

			return json(
				{
					success: true,
					data: {
						event: buildScheduleResponse(restoredEvent, updatedContext)
					}
				} satisfies UpdateIntramuralEventResponse,
				{ status: 200 }
			);
		} catch (error) {
			console.error('Failed to restore intramural event:', error);
			return json(
				{
					success: false,
					error: 'Unable to restore event right now.'
				} satisfies UpdateIntramuralEventResponse,
				{ status: 500 }
			);
		}
	}

	const parsedEdit = editIntramuralEventSchema.safeParse(body);
	if (action === 'edit' && !parsedEdit.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsedEdit.error.issues)
			} satisfies UpdateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	if (parsedEdit.success) {
		const input: EditIntramuralEventInput = parsedEdit.data;
		const clientId = requireAuthenticatedClientId(requestEvent.locals);
		const userId = requireAuthenticatedUserId(requestEvent.locals);
		const dbOps = await getTenantDbOps(requestEvent, clientId);

		try {
			const currentEvent = await dbOps.events.getByClientIdAndId(clientId, input.event.id);
			if (!currentEvent?.id) {
				return json(
					{
						success: false,
						error: 'Event not found.'
					} satisfies UpdateIntramuralEventResponse,
					{ status: 404 }
				);
			}

			const context = await requireEventContext(requestEvent, clientId, input.event);
			if (context.issues.length > 0) {
				return json(
					{
						success: false,
						error: 'Selected event details do not belong to the same intramural structure.',
						fieldErrors: toFieldErrorMap(context.issues)
					} satisfies UpdateIntramuralEventResponse,
					{ status: 400 }
				);
			}

			const updatedEvent = await dbOps.events.updateByClientIdAndId(clientId, input.event.id, {
				offeringId: input.event.offeringId,
				leagueId: input.event.leagueId,
				divisionId: input.event.divisionId,
				facilityId: input.event.facilityId,
				facilityAreaId: input.event.facilityAreaId,
				homeTeamId: input.event.homeTeamId,
				awayTeamId: input.event.awayTeamId,
				scheduledStartAt: toIsoDateTime(input.event.scheduledStartAt),
				scheduledEndAt: toIsoDateTime(input.event.scheduledEndAt),
				isPostseason: input.event.isPostseason ? 1 : 0,
				roundLabel: input.event.roundLabel,
				weekNumber: input.event.weekNumber,
				notes: input.event.notes,
				updatedUser: userId
			});

			if (!updatedEvent?.id) {
				return json(
					{
						success: false,
						error: 'Unable to save event right now.'
					} satisfies UpdateIntramuralEventResponse,
					{ status: 500 }
				);
			}

			return json(
				{
					success: true,
					data: {
						event: buildScheduleResponse(updatedEvent, {
							season: context.season!,
							offering: context.offering!,
							league: context.league!,
							division: context.division!,
							facility: context.facility,
							facilityArea: context.facilityArea,
							homeTeam: context.homeTeam!,
							awayTeam: context.awayTeam!
						})
					}
				} satisfies UpdateIntramuralEventResponse,
				{ status: 200 }
			);
		} catch (error) {
			console.error('Failed to update intramural event:', error);
			return json(
				{
					success: false,
					error: 'Unable to save event right now.'
				} satisfies UpdateIntramuralEventResponse,
				{ status: 500 }
			);
		}
	}

	const parsedResults = enterIntramuralEventResultsSchema.safeParse(body);
	if (action === 'enter-results' && !parsedResults.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsedResults.error.issues)
			} satisfies UpdateIntramuralEventResponse,
			{ status: 400 }
		);
	}

	if (parsedResults.success) {
		const input: EnterIntramuralEventResultsInput = parsedResults.data;
		const clientId = requireAuthenticatedClientId(requestEvent.locals);
		const userId = requireAuthenticatedUserId(requestEvent.locals);
		const dbOps = await getTenantDbOps(requestEvent, clientId);

		try {
			const currentEvent = await dbOps.events.getByClientIdAndId(clientId, input.event.id);
			if (!currentEvent?.id) {
				return json(
					{
						success: false,
						error: 'Event not found.'
					} satisfies UpdateIntramuralEventResponse,
					{ status: 404 }
				);
			}

			const homeScore = input.event.homeScore;
			const awayScore = input.event.awayScore;
			const winnerTeamId =
				homeScore === awayScore
					? null
					: homeScore > awayScore
						? currentEvent.homeTeamId
						: currentEvent.awayTeamId;

			const updatedEvent = await dbOps.events.updateByClientIdAndId(clientId, input.event.id, {
				status: 'completed',
				homeScore,
				awayScore,
				winnerTeamId,
				actualEndAt: currentEvent.actualEndAt ?? new Date().toISOString(),
				updatedUser: userId
			});

			if (!updatedEvent?.id) {
				return json(
					{
						success: false,
						error: 'Unable to save event right now.'
					} satisfies UpdateIntramuralEventResponse,
					{ status: 500 }
				);
			}

			const updatedContext = await loadEventContextFromRecord(requestEvent, clientId, currentEvent);

			return json(
				{
					success: true,
					data: {
						event: buildScheduleResponse(updatedEvent, updatedContext)
					}
				} satisfies UpdateIntramuralEventResponse,
				{ status: 200 }
			);
		} catch (error) {
			console.error('Failed to update intramural event results:', error);
			return json(
				{
					success: false,
					error: 'Unable to save event right now.'
				} satisfies UpdateIntramuralEventResponse,
				{ status: 500 }
			);
		}
	}

	return json(
		{
			success: false,
			error: 'Invalid request payload.'
		} satisfies UpdateIntramuralEventResponse,
		{ status: 400 }
	);
};

export const DELETE: RequestHandler = async (requestEvent) => {
	if (!requestEvent.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to delete event right now.'
			} satisfies DeleteIntramuralEventResponse,
			{ status: 500 }
		);
	}

	if (!requirePermission(requestEvent.locals, PERMISSIONS.MANAGE_OFFERINGS, { mutate: true })) {
		return json(
			{
				success: false,
				error: 'Only managers, administrators, and developers can manage schedule events.'
			} satisfies DeleteIntramuralEventResponse,
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await requestEvent.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			} satisfies DeleteIntramuralEventResponse,
			{ status: 400 }
		);
	}

	const parsed = deleteIntramuralEventSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies DeleteIntramuralEventResponse,
			{ status: 400 }
		);
	}

	const input: DeleteIntramuralEventInput = parsed.data;
	const clientId = requireAuthenticatedClientId(requestEvent.locals);
	const userId = requireAuthenticatedUserId(requestEvent.locals);
	const dbOps = await getTenantDbOps(requestEvent, clientId);

	try {
		const currentEvent = await dbOps.events.getByClientIdAndId(clientId, input.eventId);
		if (!currentEvent?.id) {
			return json(
				{
					success: false,
					error: 'Event not found.'
				} satisfies DeleteIntramuralEventResponse,
				{ status: 404 }
			);
		}

		const deletedEvent = await dbOps.events.updateByClientIdAndId(clientId, input.eventId, {
			isActive: 0,
			updatedUser: userId
		});
		if (!deletedEvent?.id) {
			return json(
				{
					success: false,
					error: 'Unable to delete event right now.'
				} satisfies DeleteIntramuralEventResponse,
				{ status: 500 }
			);
		}

		return json(
			{
				success: true,
				data: {
					eventId: input.eventId
				}
			} satisfies DeleteIntramuralEventResponse,
			{ status: 200 }
		);
	} catch (error) {
		console.error('Failed to delete intramural event:', error);
		return json(
			{
				success: false,
				error: 'Unable to delete event right now.'
			} satisfies DeleteIntramuralEventResponse,
			{ status: 500 }
		);
	}
};
