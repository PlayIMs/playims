import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = url.searchParams.get('clientId');
		const sports = clientId ? await dbOps.sports.getByClientId(clientId) : await dbOps.sports.getAll();

		return json({
			success: true,
			data: sports,
			count: sports.length
		});
	} catch (error) {
		console.error('API Error fetching sports:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch sports'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.name || !data.slug) {
			return json(
				{
					success: false,
					error: 'Name and slug are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const sport = await dbOps.sports.create({
			name: data.name,
			slug: data.slug,
			type: data.type,
			description: data.description,
			minPlayers: data.minPlayers,
			maxPlayers: data.maxPlayers,
			clientId: data.clientId,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: sport
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating sport:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create sport'
			},
			{ status: 500 }
		);
	}
};
