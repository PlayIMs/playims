import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const userId = url.searchParams.get('userId');
		const clientId = url.searchParams.get('clientId');

		const notifications = userId
			? await dbOps.notifications.getByUserId(userId)
			: await dbOps.notifications.getAll(clientId || undefined);

		return json({
			success: true,
			data: notifications,
			count: notifications.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch notifications'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const notification = await dbOps.notifications.create({
			clientId: data.clientId,
			userId: data.userId,
			type: data.type,
			title: data.title,
			body: data.body,
			entityType: data.entityType,
			entityId: data.entityId,
			readAt: data.readAt,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: notification
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create notification'
			},
			{ status: 500 }
		);
	}
};
