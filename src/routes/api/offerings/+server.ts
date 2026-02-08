import { DatabaseOperations } from '$lib/database';
import { resolveClientId } from '$lib/server/client-context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const createOfferingSchema = z.object({
	name: z.string().trim().min(1),
	slug: z.string().trim().min(1),
	type: z.enum(['league', 'tournament', 'other']).default('league'),
	description: z.string().trim().max(2000).optional(),
	minPlayers: z.number().int().positive().optional(),
	maxPlayers: z.number().int().positive().optional()
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = resolveClientId(locals);
		const offerings = await dbOps.offerings.getByClientId(clientId);

		return json({
			success: true,
			data: offerings,
			count: offerings.length
		});
	} catch (error) {
		console.error('Failed to fetch offerings:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch offerings'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const payload = await request.json();
		const parsed = createOfferingSchema.safeParse(payload);
		if (!parsed.success) {
			return json(
				{
					success: false,
					error: 'Invalid request payload'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = resolveClientId(locals);
		const offering = await dbOps.offerings.create({
			name: parsed.data.name,
			slug: parsed.data.slug,
			type: parsed.data.type,
			description: parsed.data.description,
			minPlayers: parsed.data.minPlayers,
			maxPlayers: parsed.data.maxPlayers,
			clientId
		});

		return json(
			{
				success: true,
				data: offering
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create offering:', error);
		return json(
			{
				success: false,
				error: 'Failed to create offering'
			},
			{ status: 500 }
		);
	}
};
