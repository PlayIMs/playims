import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = url.searchParams.get('clientId');
		const facilities = await dbOps.facilities.getAll(clientId || undefined);

		return json({
			success: true,
			data: facilities,
			count: facilities.length
		});
	} catch (error) {
		console.error('API Error fetching facilities:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch facilities'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

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
		const facility = await dbOps.facilities.create({
			clientId: data.clientId,
			name: data.name,
			slug: data.slug,
			addressLine1: data.addressLine1,
			addressLine2: data.addressLine2,
			city: data.city,
			state: data.state,
			postalCode: data.postalCode,
			country: data.country,
			timezone: data.timezone,
			description: data.description ?? data.notes,
			metadata: data.metadata,
			isActive: data.isActive,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: facility
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating facility:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create facility'
			},
			{ status: 500 }
		);
	}
};
