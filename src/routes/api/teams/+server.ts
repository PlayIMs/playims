import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const divisionId = url.searchParams.get('divisionId');
		const teams = divisionId
			? await dbOps.teams.getByDivisionId(divisionId)
			: await dbOps.teams.getAll();

		return json({
			success: true,
			data: teams,
			count: teams.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch teams'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.clientId || !data.divisionId || !data.name || !data.slug) {
			return json(
				{
					success: false,
					error: 'Client ID, division ID, name, and slug are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const team = await dbOps.teams.create({
			clientId: data.clientId,
			divisionId: data.divisionId,
			name: data.name,
			slug: data.slug,
			description: data.description,
			imageUrl: data.imageUrl,
			teamStatus: data.teamStatus,
			doesAcceptFreeAgents: data.doesAcceptFreeAgents,
			isAutoAcceptMembers: data.isAutoAcceptMembers,
			currentRosterSize: data.currentRosterSize,
			teamColor: data.teamColor,
			dateRegistered: data.dateRegistered,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: team
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create team'
			},
			{ status: 500 }
		);
	}
};
