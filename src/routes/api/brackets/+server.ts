import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const divisionId = url.searchParams.get('divisionId');
		const clientId = url.searchParams.get('clientId');

		const brackets = divisionId
			? await dbOps.brackets.getByDivisionId(divisionId)
			: await dbOps.brackets.getAll(clientId || undefined);

		return json({
			success: true,
			data: brackets,
			count: brackets.length
		});
	} catch (error) {
		console.error('API Error fetching brackets:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch brackets'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.name) {
			return json(
				{
					success: false,
					error: 'Name is required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const bracket = await dbOps.brackets.create({
			clientId: data.clientId,
			leagueId: data.leagueId,
			divisionId: data.divisionId,
			name: data.name,
			type: data.type,
			startsAt: data.startsAt,
			endsAt: data.endsAt,
			status: data.status,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: bracket
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating bracket:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create bracket'
			},
			{ status: 500 }
		);
	}
};
