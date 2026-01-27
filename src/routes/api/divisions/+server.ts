import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const leagueId = url.searchParams.get('leagueId');
		const divisions = leagueId ? await dbOps.divisions.getByLeagueId(leagueId) : await dbOps.divisions.getAll();

		return json({
			success: true,
			data: divisions,
			count: divisions.length
		});
	} catch (error) {
		console.error('API Error fetching divisions:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch divisions'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.leagueId || !data.name || !data.slug) {
			return json(
				{
					success: false,
					error: 'League ID, name, and slug are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const division = await dbOps.divisions.create({
			leagueId: data.leagueId,
			name: data.name,
			slug: data.slug,
			description: data.description,
			maxTeams: data.maxTeams,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: division
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating division:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create division'
			},
			{ status: 500 }
		);
	}
};
