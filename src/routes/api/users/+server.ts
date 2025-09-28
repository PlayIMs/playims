import { createDatabaseConnection } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const db = createDatabaseConnection(platform);
		const users = await db.users.getAll();
		return json(users);
	} catch (error) {
		console.error('API Error fetching users:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		// Basic validation
		if (!data.username || !data.email) {
			return json({ error: 'Username and email are required' }, { status: 400 });
		}

		const db = createDatabaseConnection(platform);
		const user = await db.users.create({
			username: data.username,
			email: data.email
		});

		return json(user, { status: 201 });
	} catch (error) {
		console.error('API Error creating user:', error);
		return json({ error: 'Failed to create user' }, { status: 500 });
	}
};
