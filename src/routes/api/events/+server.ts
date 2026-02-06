import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = url.searchParams.get('clientId');
		const events = await dbOps.events.getAll(clientId || undefined);

		return json({
			success: true,
			data: events,
			count: events.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch events'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.clientId || !data.type) {
			return json(
				{
					success: false,
					error: 'Client ID and type are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const event = await dbOps.events.create({
			clientId: data.clientId,
			type: data.type,
			sportId: data.sportId,
			leagueId: data.leagueId,
			divisionId: data.divisionId,
			facilityId: data.facilityId,
			facilityAreaId: data.facilityAreaId,
			homeTeamId: data.homeTeamId,
			awayTeamId: data.awayTeamId,
			scheduledStartAt: data.scheduledStartAt,
			scheduledEndAt: data.scheduledEndAt,
			actualStartAt: data.actualStartAt,
			actualEndAt: data.actualEndAt,
			status: data.status,
			isPostseason: data.isPostseason,
			roundLabel: data.roundLabel,
			weekNumber: data.weekNumber,
			homeScore: data.homeScore,
			awayScore: data.awayScore,
			winnerTeamId: data.winnerTeamId,
			forfeitType: data.forfeitType,
			notes: data.notes,
			isActive: data.isActive,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: event
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create event'
			},
			{ status: 500 }
		);
	}
};
