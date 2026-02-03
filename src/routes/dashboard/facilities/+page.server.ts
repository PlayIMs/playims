import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';

function asTrimmedString(value: FormDataEntryValue | null): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}

function asInt01(value: FormDataEntryValue | null): number | null {
	if (typeof value !== 'string') return null;
	const n = Number(value);
	if (n === 0 || n === 1) return n;
	return null;
}

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

function normalizeSlugAllowTrailing(raw: string | null): string | null {
	if (!raw) return null;
	return raw
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-/, '');
}

function normalizeName(raw: string | null): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	return trimmed.length ? trimmed.toLowerCase() : null;
}

export const load: PageServerLoad = async ({ platform, url, locals }) => {
	if (!platform) throw error(500, 'Platform not available');

	// Secured server-side query (no client-side DB access). Auth can be enforced once locals.user exists.
	const dbOps = new DatabaseOperations(platform as App.Platform);
	// Ensure a stable default client for admin/dev until auth is implemented.
	await ensureDefaultClient(dbOps);
	const clientId = resolveClientId(locals);

	const facilityId = url.searchParams.get('facilityId');

	const facilities = clientId ? await dbOps.facilities.getAll(clientId) : [];
	const facilityAreas = clientId ? await dbOps.facilityAreas.getAll(clientId) : [];

	return {
		clientId,
		facilityId,
		facilities,
		facilityAreas
	};
};

export const actions: Actions = {
	createFacility: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const clientId = resolveClientId(locals);
		const name = asTrimmedString(form.get('name'));
		// Allow trailing dashes during input, trim them on save
		const slug = normalizeSlugAllowTrailing(asTrimmedString(form.get('slug')));

		if (!name)
			return fail(400, { message: 'Facility name is required.', action: 'createFacility' });
		if (!slug)
			return fail(400, { message: 'Facility slug is required.', action: 'createFacility' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;

		// Prevent duplicates by name or slug (within the client), including archived records.
		const existingFacilities = await dbOps.facilities.getAll(clientId);
		const nameKey = normalizeName(name);
		const duplicate = existingFacilities.find((f) => {
			const fName = normalizeName(f.name ?? null);
			const fSlug = normalizeSlug(f.slug ?? null);
			return (nameKey && fName === nameKey) || fSlug === slug;
		});
		if (duplicate) {
			const isArchived = duplicate.isActive === 0;
			if (isArchived) {
				return fail(400, {
					message: `An archived facility with that name/slug already exists. Please restore or delete it before creating one with the same name/slug.`,
					action: 'createFacility',
					archivedFacilityId: duplicate.id,
					duplicateType: 'archived'
				});
			}
			return fail(400, {
				message: 'A facility with that name/slug already exists.',
				action: 'createFacility'
			});
		}

		const created = await dbOps.facilities.create({
			clientId,
			name,
			slug,
			addressLine1: asTrimmedString(form.get('addressLine1')) || undefined,
			addressLine2: asTrimmedString(form.get('addressLine2')) || undefined,
			city: asTrimmedString(form.get('city')) || undefined,
			state: asTrimmedString(form.get('state')) || undefined,
			postalCode: asTrimmedString(form.get('postalCode')) || undefined,
			country: asTrimmedString(form.get('country')) || undefined,
			timezone: asTrimmedString(form.get('timezone')) || undefined,
			description: asTrimmedString(form.get('description')) || undefined,
			metadata: asTrimmedString(form.get('metadata')) || undefined,
			isActive: 1,
			createdUser: actorUserId || undefined,
			updatedUser: actorUserId || undefined
		});

		if (!created?.id)
			return fail(500, { message: 'Failed to create facility.', action: 'createFacility' });
		throw redirect(303, `/dashboard/facilities?facilityId=${encodeURIComponent(created.id)}`);
	},

	updateFacility: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityId = asTrimmedString(form.get('facilityId'));
		if (!facilityId) return fail(400, { message: 'Facility ID is required.' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;
		const clientId = resolveClientId(locals);

		// Security: validate ownership manually (D1 has no RLS)
		const existing = await dbOps.facilities.getById(facilityId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility not found.' });

		// Normalize inputs (allow trailing dash during typing, trim on save)
		const slugUpdate = normalizeSlugAllowTrailing(asTrimmedString(form.get('slug')));
		const nameUpdate = asTrimmedString(form.get('name'));
		const addressLine1Update = asTrimmedString(form.get('addressLine1'));
		const addressLine2Update = asTrimmedString(form.get('addressLine2'));
		const cityUpdate = asTrimmedString(form.get('city'));
		const stateUpdate = asTrimmedString(form.get('state'));
		const postalCodeUpdate = asTrimmedString(form.get('postalCode'));
		const countryUpdate = asTrimmedString(form.get('country'));
		const timezoneUpdate = asTrimmedString(form.get('timezone'));
		const descriptionUpdate = asTrimmedString(form.get('description'));

		// Check for actual changes
		const hasChanges =
			(nameUpdate !== undefined && nameUpdate !== existing.name) ||
			(slugUpdate !== undefined && slugUpdate !== existing.slug) ||
			(addressLine1Update !== undefined && addressLine1Update !== existing.addressLine1) ||
			(addressLine2Update !== undefined && addressLine2Update !== existing.addressLine2) ||
			(cityUpdate !== undefined && cityUpdate !== existing.city) ||
			(stateUpdate !== undefined && stateUpdate !== existing.state) ||
			(postalCodeUpdate !== undefined && postalCodeUpdate !== existing.postalCode) ||
			(countryUpdate !== undefined && countryUpdate !== existing.country) ||
			(timezoneUpdate !== undefined && timezoneUpdate !== existing.timezone) ||
			(descriptionUpdate !== undefined && descriptionUpdate !== existing.description);

		if (!hasChanges) {
			return { ok: true, facilityId, noChange: true };
		}

		// Prevent duplicates when changing name/slug.
		if (nameUpdate || slugUpdate) {
			const existingFacilities = await dbOps.facilities.getAll(clientId);
			const nameKey = normalizeName(nameUpdate ?? null);
			const duplicate = existingFacilities.find((f) => {
				if (f.id === facilityId) return false;
				const fName = normalizeName(f.name ?? null);
				const fSlug = normalizeSlug(f.slug ?? null);
				return (nameKey && fName === nameKey) || (slugUpdate && fSlug === slugUpdate);
			});
			if (duplicate) {
				const isArchived = duplicate.isActive === 0;
				if (isArchived) {
					return fail(400, {
						message: `An archived facility with that name/slug already exists. Please restore or delete it before creating one with the same name/slug.`,
						action: 'updateFacility',
						archivedFacilityId: duplicate.id,
						duplicateType: 'archived'
					});
				}
				return fail(400, {
					message: 'A facility with that name/slug already exists.',
					action: 'updateFacility'
				});
			}
		}

		const updated = await dbOps.facilities.update(facilityId, {
			name: nameUpdate ?? undefined,
			slug: slugUpdate ?? undefined,
			addressLine1: addressLine1Update ?? undefined,
			addressLine2: addressLine2Update ?? undefined,
			city: cityUpdate ?? undefined,
			state: stateUpdate ?? undefined,
			postalCode: postalCodeUpdate ?? undefined,
			country: countryUpdate ?? undefined,
			timezone: timezoneUpdate ?? undefined,
			description: descriptionUpdate ?? undefined,
			metadata: asTrimmedString(form.get('metadata')) ?? undefined,
			updatedUser: actorUserId || undefined
		});

		return { ok: true, facilityId: updated?.id };
	},

	setFacilityArchived: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityId = asTrimmedString(form.get('facilityId'));
		const isActive = asInt01(form.get('isActive'));
		if (!facilityId) return fail(400, { message: 'Facility ID is required.' });
		if (isActive === null) return fail(400, { message: 'isActive must be 0 or 1.' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;
		const clientId = resolveClientId(locals);

		const existing = await dbOps.facilities.getById(facilityId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility not found.' });

		await dbOps.facilities.update(facilityId, {
			isActive,
			updatedUser: actorUserId || undefined
		});

		return { ok: true };
	},

	createFacilityArea: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const clientId = resolveClientId(locals);
		const facilityId = asTrimmedString(form.get('facilityId'));
		const name = asTrimmedString(form.get('name'));
		// Allow trailing dashes during input, trim them on save
		const slug = normalizeSlugAllowTrailing(asTrimmedString(form.get('slug')));

		if (!facilityId)
			return fail(400, { message: 'Facility is required.', action: 'createFacilityArea' });
		if (!name)
			return fail(400, { message: 'Area name is required.', action: 'createFacilityArea' });
		if (!slug)
			return fail(400, { message: 'Area slug is required.', action: 'createFacilityArea' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;

		const facility = await dbOps.facilities.getById(facilityId);
		if (!facility || facility.clientId !== clientId)
			return fail(404, { message: 'Facility not found.', action: 'createFacilityArea' });

		// Prevent duplicates by name or slug within the facility (including archived).
		const allExistingAreas = await dbOps.facilityAreas.getByFacilityId(facilityId);
		const nameKey = normalizeName(name);
		const duplicate = allExistingAreas.find((a) => {
			const aName = normalizeName(a.name ?? null);
			const aSlug = normalizeSlug(a.slug ?? null);
			return (nameKey && aName === nameKey) || aSlug === slug;
		});
		if (duplicate) {
			const isArchived = duplicate.isActive === 0;
			if (isArchived) {
				return fail(400, {
					message: `An archived facility area with that name/slug already exists. Please restore or delete it before creating one with the same name/slug.`,
					action: 'createFacilityArea',
					archivedAreaId: duplicate.id,
					archivedAreaFacilityId: facilityId,
					duplicateType: 'archived'
				});
			}
			return fail(400, {
				message: 'A facility area with that name/slug already exists.',
				action: 'createFacilityArea'
			});
		}

		const created = await dbOps.facilityAreas.create({
			clientId,
			facilityId,
			name,
			slug,
			isActive: 1,
			metadata: asTrimmedString(form.get('metadata')) || undefined,
			createdUser: actorUserId || undefined,
			updatedUser: actorUserId || undefined
		});

		if (!created?.id)
			return fail(500, {
				message: 'Failed to create facility area.',
				action: 'createFacilityArea'
			});
		// Keep user on the same facility after creating an area
		throw redirect(303, `/dashboard/facilities?facilityId=${encodeURIComponent(facilityId)}`);
	},

	updateFacilityArea: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityAreaId = asTrimmedString(form.get('facilityAreaId'));
		if (!facilityAreaId) return fail(400, { message: 'Facility area ID is required.' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;
		const clientId = resolveClientId(locals);

		const existing = await dbOps.facilityAreas.getById(facilityAreaId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility area not found.' });

		// Normalize inputs
		const slugUpdate = normalizeSlugAllowTrailing(asTrimmedString(form.get('slug')));
		const nameUpdate = asTrimmedString(form.get('name'));

		// Check for actual changes
		const hasChanges =
			(nameUpdate !== undefined && nameUpdate !== existing.name) ||
			(slugUpdate !== undefined && slugUpdate !== existing.slug);

		if (!hasChanges) {
			return { ok: true, facilityAreaId, noChange: true };
		}

		// Prevent duplicates within the facility when changing name/slug.
		if (nameUpdate || slugUpdate) {
			const existingAreas = await dbOps.facilityAreas.getByFacilityId(existing.facilityId ?? '');
			const nameKey = normalizeName(nameUpdate ?? null);
			const duplicate = existingAreas.find((a) => {
				if (a.id === facilityAreaId) return false;
				const aName = normalizeName(a.name ?? null);
				const aSlug = normalizeSlug(a.slug ?? null);
				return (nameKey && aName === nameKey) || (slugUpdate && aSlug === slugUpdate);
			});
			if (duplicate) {
				const isArchived = duplicate.isActive === 0;
				if (isArchived) {
					return fail(400, {
						message: `An archived facility area with that name/slug already exists. Please restore or delete it before creating one with the same name/slug.`,
						action: 'updateFacilityArea',
						archivedAreaId: duplicate.id,
						archivedAreaFacilityId: existing.facilityId,
						duplicateType: 'archived'
					});
				}
				return fail(400, {
					message: 'A facility area with that name/slug already exists.',
					action: 'updateFacilityArea'
				});
			}
		}

		const updated = await dbOps.facilityAreas.update(facilityAreaId, {
			name: nameUpdate ?? undefined,
			slug: slugUpdate ?? undefined,
			metadata: asTrimmedString(form.get('metadata')) ?? undefined,
			updatedUser: actorUserId || undefined
		});

		return { ok: true, facilityAreaId: updated?.id };
	},

	moveFacilityArea: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityAreaId = asTrimmedString(form.get('facilityAreaId'));
		const facilityId = asTrimmedString(form.get('facilityId'));
		if (!facilityAreaId) return fail(400, { message: 'Facility area ID is required.' });
		if (!facilityId) return fail(400, { message: 'New facility is required.' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;
		const clientId = resolveClientId(locals);

		const existing = await dbOps.facilityAreas.getById(facilityAreaId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility area not found.' });

		const newFacility = await dbOps.facilities.getById(facilityId);
		if (!newFacility || newFacility.clientId !== clientId)
			return fail(404, { message: 'Facility not found.' });

		await dbOps.facilityAreas.update(facilityAreaId, {
			facilityId,
			updatedUser: actorUserId || undefined
		});

		return { ok: true };
	},

	setFacilityAreaArchived: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityAreaId = asTrimmedString(form.get('facilityAreaId'));
		const isActive = asInt01(form.get('isActive'));
		if (!facilityAreaId) return fail(400, { message: 'Facility area ID is required.' });
		if (isActive === null) return fail(400, { message: 'isActive must be 0 or 1.' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const actorUserId = locals.user?.id ?? null;
		const clientId = resolveClientId(locals);

		const existing = await dbOps.facilityAreas.getById(facilityAreaId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility area not found.' });

		await dbOps.facilityAreas.update(facilityAreaId, {
			isActive,
			updatedUser: actorUserId || undefined
		});

		return { ok: true };
	},

	deleteFacility: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityId = asTrimmedString(form.get('facilityId'));
		const confirmSlug = asTrimmedString(form.get('confirmSlug'));
		if (!facilityId)
			return fail(400, { message: 'Facility ID is required.', action: 'deleteFacility' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = resolveClientId(locals);

		const existing = await dbOps.facilities.getById(facilityId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility not found.', action: 'deleteFacility' });
		if (existing.isActive !== 0) {
			return fail(400, {
				message: 'Facility must be archived before deleting.',
				action: 'deleteFacility'
			});
		}
		const expected = normalizeSlug(existing.slug ?? null);
		const provided = normalizeSlug(confirmSlug ?? null);
		if (!expected || provided !== expected) {
			return fail(400, {
				message: 'To delete, type the facility slug exactly.',
				action: 'deleteFacility'
			});
		}

		const ok = await dbOps.facilities.delete(facilityId);
		if (!ok) return fail(500, { message: 'Failed to delete facility.', action: 'deleteFacility' });

		throw redirect(303, `/dashboard/facilities`);
	},

	deleteFacilityArea: async ({ request, platform, locals }) => {
		if (!platform) throw error(500, 'Platform not available');
		const form = await request.formData();

		const facilityAreaId = asTrimmedString(form.get('facilityAreaId'));
		const confirmSlug = asTrimmedString(form.get('confirmSlug'));
		if (!facilityAreaId)
			return fail(400, { message: 'Facility area ID is required.', action: 'deleteFacilityArea' });

		const dbOps = new DatabaseOperations(platform as App.Platform);
		const clientId = resolveClientId(locals);

		const existing = await dbOps.facilityAreas.getById(facilityAreaId);
		if (!existing || existing.clientId !== clientId)
			return fail(404, { message: 'Facility area not found.', action: 'deleteFacilityArea' });
		if (existing.isActive !== 0) {
			return fail(400, {
				message: 'Facility area must be archived before deleting.',
				action: 'deleteFacilityArea'
			});
		}
		const expected = normalizeSlug(existing.slug ?? null);
		const provided = normalizeSlug(confirmSlug ?? null);
		if (!expected || provided !== expected) {
			return fail(400, {
				message: 'To delete, type the area slug exactly.',
				action: 'deleteFacilityArea'
			});
		}

		const ok = await dbOps.facilityAreas.delete(facilityAreaId);
		if (!ok)
			return fail(500, {
				message: 'Failed to delete facility area.',
				action: 'deleteFacilityArea'
			});

		return { ok: true };
	}
};
