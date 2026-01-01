import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);

		// Support filtering by clientId
		const clientId = url.searchParams.get('clientId');

		const users = clientId ? await dbOps.users.getByClientId(clientId) : await dbOps.users.getAll();

		return json({
			success: true,
			data: users,
			count: users.length
		});
	} catch (error) {
		console.error('API Error fetching users:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch users'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		// Basic validation
		if (!data.clientId || !data.email) {
			return json(
				{
					success: false,
					error: 'Client ID and email are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const user = await dbOps.users.create({
			clientId: data.clientId,
			email: data.email,
			firstName: data.firstName,
			lastName: data.lastName,
			role: data.role
		});

		return json(
			{
				success: true,
				data: user
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating user:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create user'
			},
			{ status: 500 }
		);
	}
};
