// Example API endpoint using Drizzle ORM for type-safe queries
// NOTE: Type errors will resolve after running 'pnpm run build'
import { DatabaseOperations } from '$lib/database/operations.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform);
		const clients = await dbOps.getAllClients();

		return json({
			success: true,
			data: clients,
			count: clients.length
		});
	} catch (error) {
		console.error('Error fetching clients:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch clients'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const body = await request.json();

		// Type-safe validation
		if (!body.name || !body.email) {
			return json(
				{
					success: false,
					error: 'Name and email are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform);
		const client = await dbOps.createClient({
			name: body.name,
			email: body.email
		});

		return json(
			{
				success: true,
				data: client
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating client:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create client'
			},
			{ status: 500 }
		);
	}
};
