import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = url.searchParams.get('clientId');
		const sportId = url.searchParams.get('sportId');

		const leagues = sportId
			? await dbOps.leagues.getBySportId(sportId)
			: clientId
				? await dbOps.leagues.getByClientId(clientId)
				: await dbOps.leagues.getAll();

		return json({
			success: true,
			data: leagues,
			count: leagues.length
		});
	} catch (error) {
		console.error('API Error fetching leagues:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch leagues'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.clientId || !data.sportId || !data.name || !data.slug) {
			return json(
				{
					success: false,
					error: 'Client ID, sport ID, name, and slug are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const league = await dbOps.leagues.create({
			clientId: data.clientId,
			sportId: data.sportId,
			name: data.name,
			slug: data.slug,
			year: data.year,
			season: data.season,
			description: data.description,
			gender: data.gender,
			skillLevel: data.skillLevel,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: league
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating league:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create league'
			},
			{ status: 500 }
		);
	}
};
