import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const eventId = url.searchParams.get('eventId');
		const clientId = url.searchParams.get('clientId');

		const officials = eventId
			? await dbOps.sportOfficials.getByEventId(eventId)
			: await dbOps.sportOfficials.getAll(clientId || undefined);

		return json({
			success: true,
			data: officials,
			count: officials.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch sport officials'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const official = await dbOps.sportOfficials.create({
			clientId: data.clientId,
			eventId: data.eventId,
			userId: data.userId,
			role: data.role,
			status: data.status,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: official
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create sport official'
			},
			{ status: 500 }
		);
	}
};
