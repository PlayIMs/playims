import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const facilityId = url.searchParams.get('facilityId');
		const clientId = url.searchParams.get('clientId');

		const areas = facilityId
			? await dbOps.facilityAreas.getByFacilityId(facilityId)
			: await dbOps.facilityAreas.getAll(clientId || undefined);

		return json({
			success: true,
			data: areas,
			count: areas.length
		});
	} catch (error) {
		console.error('API Error fetching facility areas:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch facility areas'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		if (!data.name) {
			return json(
				{
					success: false,
					error: 'Name is required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const area = await dbOps.facilityAreas.create({
			clientId: data.clientId,
			facilityId: data.facilityId,
			name: data.name,
			code: data.code,
			isActive: data.isActive,
			metadata: data.metadata,
			createdUser: data.createdUser,
			updatedUser: data.updatedUser
		});

		return json(
			{
				success: true,
				data: area
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('API Error creating facility area:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create facility area'
			},
			{ status: 500 }
		);
	}
};
