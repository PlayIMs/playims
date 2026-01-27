import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const bracketId = url.searchParams.get('bracketId');
		const clientId = url.searchParams.get('clientId');

		const entries = bracketId
			? await dbOps.bracketEntries.getByBracketId(bracketId)
			: await dbOps.bracketEntries.getAll(clientId || undefined);

		return json({
			success: true,
			data: entries,
			count: entries.length
		});
	} catch (error) {
		console.error('API Error fetching bracket entries:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch bracket entries'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const entry = await dbOps.bracketEntries.create({
			clientId: data.clientId,
			bracketId: data.bracketId,
			seed: data.seed,
			teamId: data.teamId,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: entry
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating bracket entry:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create bracket entry'
			},
			{ status: 500 }
		);
	}
};
