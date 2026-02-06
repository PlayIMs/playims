import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const divisionId = url.searchParams.get('divisionId');
		const teamId = url.searchParams.get('teamId');
		const clientId = url.searchParams.get('clientId');

		const standings = divisionId
			? await dbOps.divisionStandings.getByDivisionId(divisionId)
			: teamId
				? await dbOps.divisionStandings.getByTeamId(teamId)
				: await dbOps.divisionStandings.getAll(clientId || undefined);

		return json({
			success: true,
			data: standings,
			count: standings.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch division standings'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const standing = await dbOps.divisionStandings.create({
			clientId: data.clientId,
			leagueId: data.leagueId,
			divisionId: data.divisionId,
			teamId: data.teamId,
			wins: data.wins,
			losses: data.losses,
			ties: data.ties,
			pointsFor: data.pointsFor,
			pointsAgainst: data.pointsAgainst,
			points: data.points,
			winPct: data.winPct,
			streak: data.streak,
			lastUpdatedAt: data.lastUpdatedAt,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: standing
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create division standing'
			},
			{ status: 500 }
		);
	}
};
