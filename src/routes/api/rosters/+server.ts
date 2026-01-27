import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const teamId = url.searchParams.get('teamId');
		const userId = url.searchParams.get('userId');

		const rosters = teamId
			? await dbOps.rosters.getByTeamId(teamId)
			: userId
				? await dbOps.rosters.getByUserId(userId)
				: await dbOps.rosters.getAll();

		return json({
			success: true,
			data: rosters,
			count: rosters.length
		});
	} catch (error) {
		console.error('API Error fetching rosters:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch rosters'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.clientId || !data.teamId || !data.userId) {
			return json(
				{
					success: false,
					error: 'Client ID, team ID, and user ID are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const roster = await dbOps.rosters.create({
			clientId: data.clientId,
			teamId: data.teamId,
			userId: data.userId,
			isCaptain: data.isCaptain,
			isCoCaptain: data.isCoCaptain,
			rosterStatus: data.rosterStatus,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: roster
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating roster:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create roster'
			},
			{ status: 500 }
		);
	}
};
