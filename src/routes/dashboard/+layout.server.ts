import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const firstName = locals.user?.firstName?.trim() ?? '';
	const lastName = locals.user?.lastName?.trim() ?? '';
	const fullName = `${firstName} ${lastName}`.trim();

	return {
		viewer: {
			name: fullName.length > 0 ? fullName : null,
			email: locals.user?.email?.trim() ?? null
		}
	};
};
