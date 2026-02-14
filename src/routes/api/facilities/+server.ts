import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	createFacilityWithAreasSchema,
	type CreateFacilityWithAreasInput
} from '$lib/server/facilities-validation';
import type { RequestHandler } from './$types';

function normalizeSlug(raw: string | null): string | null {
	if (!raw) return null;
	return raw
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function normalizeName(raw: string | null): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

const toFieldErrorMap = (
	issues: Array<{ path: Array<PropertyKey>; message: string }>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) fieldErrors[key] = [];
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save facility right now.'
			},
			{ status: 500 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			},
			{ status: 400 }
		);
	}

	const parsed = createFacilityWithAreasSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			},
			{ status: 400 }
		);
	}

	const input: CreateFacilityWithAreasInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	let createdFacilityId: string | null = null;
	const createdAreaIds: string[] = [];
	const createdAreas = [];

	try {
		const existingFacilities = await dbOps.facilities.getAll(clientId);
		const incomingFacilitySlug = normalizeSlug(input.facility.slug);
		const incomingFacilityName = normalizeName(input.facility.name);
		const duplicateFacility = existingFacilities.find((facility) => {
			const facilityName = normalizeName(facility.name ?? null);
			const facilitySlug = normalizeSlug(facility.slug ?? null);
			return (
				(incomingFacilityName && facilityName === incomingFacilityName) ||
				(incomingFacilitySlug && facilitySlug === incomingFacilitySlug)
			);
		});

		if (duplicateFacility) {
			const isArchivedDuplicate = duplicateFacility.isActive === 0;
			const baseResponse = {
				success: false as const,
				error: isArchivedDuplicate
					? 'An archived facility with that name/slug already exists.'
					: 'A facility with that name/slug already exists.',
				fieldErrors: {
					'facility.slug': ['A facility with this slug already exists.']
				}
			};

			if (!isArchivedDuplicate) {
				return json(baseResponse, { status: 409 });
			}

			let archivedAreaId: string | undefined;
			if (duplicateFacility.id && input.areas.length > 0) {
				const existingAreas = await dbOps.facilityAreas.getByFacilityId(duplicateFacility.id);
				const firstAreaConflict = input.areas.find((incomingArea) => {
					const incomingName = normalizeName(incomingArea.name);
					const incomingSlug = normalizeSlug(incomingArea.slug);
					const matched = existingAreas.find((existingArea) => {
						const existingName = normalizeName(existingArea.name ?? null);
						const existingSlug = normalizeSlug(existingArea.slug ?? null);
						return (
							(incomingName && existingName === incomingName) ||
							(incomingSlug && existingSlug === incomingSlug)
						);
					});
					if (matched?.id && matched.isActive === 0) {
						archivedAreaId = matched.id;
						return true;
					}
					return false;
				});
				void firstAreaConflict;
			}

			return json(
				{
					...baseResponse,
					duplicateType: 'archived',
					archivedFacilityId: duplicateFacility.id,
					...(archivedAreaId
						? {
								archivedAreaId,
								archivedAreaFacilityId: duplicateFacility.id
							}
						: {})
				},
				{ status: 409 }
			);
		}

		const createdFacility = await dbOps.facilities.create({
			clientId,
			name: input.facility.name,
			slug: input.facility.slug,
			addressLine1: input.facility.addressLine1 ?? undefined,
			addressLine2: input.facility.addressLine2 ?? undefined,
			city: input.facility.city ?? undefined,
			state: input.facility.state ?? undefined,
			postalCode: input.facility.postalCode ?? undefined,
			country: input.facility.country ?? undefined,
			timezone: input.facility.timezone ?? undefined,
			capacity: input.facility.capacity,
			description: input.facility.description ?? undefined,
			isActive: input.facility.isActive ? 1 : 0,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdFacility?.id) {
			return json(
				{
					success: false,
					error: 'Unable to save facility right now.'
				},
				{ status: 500 }
			);
		}

		createdFacilityId = createdFacility.id;
		for (const area of input.areas) {
			const createdArea = await dbOps.facilityAreas.create({
				clientId,
				facilityId: createdFacility.id,
				name: area.name,
				slug: area.slug,
				capacity: area.capacity,
				description: area.description ?? undefined,
				isActive: area.isActive ? 1 : 0,
				createdUser: userId,
				updatedUser: userId
			});

			if (!createdArea?.id) {
				throw new Error('Failed to create facility area.');
			}

			createdAreaIds.push(createdArea.id);
			createdAreas.push(createdArea);
		}

		return json(
			{
				success: true,
				data: {
					facility: createdFacility,
					facilityAreas: createdAreas
				}
			},
			{ status: 201 }
		);
	} catch (err) {
		if (createdAreaIds.length > 0) {
			for (const areaId of createdAreaIds) {
				try {
					await dbOps.facilityAreas.delete(areaId);
				} catch (cleanupError) {
					console.error('Failed to rollback facility area create:', cleanupError);
				}
			}
		}
		if (createdFacilityId) {
			try {
				await dbOps.facilities.delete(createdFacilityId);
			} catch (cleanupError) {
				console.error('Failed to rollback facility create:', cleanupError);
			}
		}

		console.error('Failed to create facility and areas:', err);
		return json(
			{
				success: false,
				error: 'Unable to save facility right now.'
			},
			{ status: 500 }
		);
	}
};
