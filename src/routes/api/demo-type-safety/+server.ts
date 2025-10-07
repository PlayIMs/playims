// Demo API endpoint showing Drizzle ORM type safety
// Try this: http://localhost:5173/api/demo-type-safety
import { DatabaseOperations } from '$lib/database/operations.js';
import type { Client, User } from '$lib/database/schema.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);

	try {
		// ✅ Type-safe: TypeScript knows getAllClients() returns Client[]
		const clients: Client[] = await dbOps.getAllClients();

		// ✅ Type-safe: TypeScript knows getAllUsers() returns User[]
		const users: User[] = await dbOps.getAllUsers();

		// ✅ Type-safe: Auto-completion works on client properties
		const clientNames = clients.map((client) => ({
			id: client.id, // ✅ TypeScript knows 'id' exists
			name: client.name, // ✅ TypeScript knows 'name' exists
			email: client.email // ✅ TypeScript knows 'email' exists
			// age: client.age  // ❌ TypeScript ERROR: 'age' doesn't exist!
		}));

		// ✅ Type-safe: Auto-completion works on user properties
		const userInfo = users.map((user) => ({
			id: user.id,
			username: user.username, // ✅ TypeScript knows this field
			email: user.email
		}));

		return json({
			success: true,
			message: 'Drizzle ORM Type Safety Demo',
			data: {
				clients: clientNames,
				users: userInfo,
				typeSafetyExamples: [
					'✅ TypeScript knows all column names',
					'✅ Auto-completion works everywhere',
					'✅ Invalid fields cause compile errors',
					'✅ Return types are automatically inferred',
					'✅ No runtime errors from typos!'
				]
			},
			stats: {
				totalClients: clients.length,
				totalUsers: users.length
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Example POST handler showing type-safe creation
export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const body = await request.json();

		// ✅ Type-safe: We know exactly what fields are required
		if (!body.name || !body.email) {
			return json(
				{
					success: false,
					error: 'Missing required fields: name and email'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform);

		// ✅ Type-safe: createClient expects specific fields
		const newClient = await dbOps.createClient({
			name: body.name, // ✅ TypeScript ensures this is a string
			email: body.email // ✅ TypeScript ensures this is a string
		});

		// ✅ Type-safe: TypeScript knows newClient has all Client fields
		return json(
			{
				success: true,
				message: 'Client created with type safety!',
				data: {
					id: newClient.id,
					name: newClient.name,
					email: newClient.email,
					createdAt: newClient.createdAt
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create client'
			},
			{ status: 500 }
		);
	}
};
