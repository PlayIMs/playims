import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const leagueId = url.searchParams.get('leagueId');
		const divisionId = url.searchParams.get('divisionId');
		const clientId = url.searchParams.get('clientId');

		const announcements = divisionId
			? await dbOps.announcements.getByDivisionId(divisionId)
			: leagueId
				? await dbOps.announcements.getByLeagueId(leagueId)
				: await dbOps.announcements.getAll(clientId || undefined);

		return json({
			success: true,
			data: announcements,
			count: announcements.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch announcements'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.title) {
			return json(
				{
					success: false,
					error: 'Title is required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const announcement = await dbOps.announcements.create({
			clientId: data.clientId,
			leagueId: data.leagueId,
			divisionId: data.divisionId,
			title: data.title,
			body: data.body,
			publishedAt: data.publishedAt,
			isPinned: data.isPinned,
			isActive: data.isActive,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: announcement
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create announcement'
			},
			{ status: 500 }
		);
	}
};
