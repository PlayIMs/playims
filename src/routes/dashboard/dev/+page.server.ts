import {
	createOrganizationAction,
	loadOrganizationAdminMemberships
} from '$lib/server/organization-admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		organizations: await loadOrganizationAdminMemberships(event)
	};
};

export const actions: Actions = {
	createOrganization: createOrganizationAction
};
