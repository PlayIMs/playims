import { actions as accountActions, load as accountLoad } from '../account/+page.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return await accountLoad(event as unknown as Parameters<typeof accountLoad>[0]);
};

export const actions: Actions = {
	createOrganization: async (event) => {
		return await accountActions.createOrganization(event as unknown as Parameters<
			typeof accountActions.createOrganization
		>[0]);
	}
};
