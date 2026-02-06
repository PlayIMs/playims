import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = url.searchParams.get('actorUserId');
		const clientId = url.searchParams.get('clientId');

		const logs = actorUserId
			? await dbOps.auditLogs.getByActorUserId(actorUserId)
			: await dbOps.auditLogs.getAll(clientId || undefined);

		return json({
			success: true,
			data: logs,
			count: logs.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch audit logs'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.action) {
			return json(
				{
					success: false,
					error: 'Action is required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const log = await dbOps.auditLogs.create({
			clientId: data.clientId,
			actorUserId: data.actorUserId,
			action: data.action,
			entityType: data.entityType,
			entityId: data.entityId,
			details: data.details,
			ipAddress: data.ipAddress,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: log
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create audit log'
			},
			{ status: 500 }
		);
	}
};
