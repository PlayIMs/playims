import { createDatabaseConnection } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const db = createDatabaseConnection(platform);
		const clients = await db.clients.getAll();
		return json(clients);
	} catch (error) {
		console.error('API Error fetching clients:', error);
		return json({ error: 'Failed to fetch clients' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		// Basic validation
		if (!data.name || !data.email) {
			return json({ error: 'Name and email are required' }, { status: 400 });
		}

		const db = createDatabaseConnection(platform);
		const client = await db.clients.create({
			name: data.name,
			email: data.email
		});

		return json(client, { status: 201 });
	} catch (error) {
		console.error('API Error creating client:', error);
		return json({ error: 'Failed to create client' }, { status: 500 });
	}
};
