import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clients = await dbOps.clients.getAll();
		return json({
			success: true,
			data: clients,
			count: clients.length
		});
	} catch (error) {
		console.error('API Error fetching clients:', error);
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
		const data = await request.json();

		// Basic validation
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
		const client = await dbOps.clients.create({
			name: data.name,
			slug: data.slug,
			metadata: data.metadata
		});

		return json(
			{
				success: true,
				data: client
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating client:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create client'
			},
			{ status: 500 }
		);
	}
};
