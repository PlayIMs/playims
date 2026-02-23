import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const firstName = locals.user?.firstName?.trim() ?? '';
	const lastName = locals.user?.lastName?.trim() ?? '';
	const fullName = `${firstName} ${lastName}`.trim();
	const baseRole = locals.user?.baseRole ?? locals.user?.role ?? null;
	const effectiveRole = locals.user?.role ?? locals.user?.baseRole ?? null;
	const canViewAsPlayer = locals.user?.canViewAsPlayer ?? false;
	const isViewingAsPlayer = locals.user?.isViewingAsPlayer ?? false;

	return {
		viewer: {
			name: fullName.length > 0 ? fullName : null,
			email: locals.user?.email?.trim() ?? null
		},
		authMode: {
			baseRole,
			effectiveRole,
			canViewAsPlayer,
			isViewingAsPlayer
		}
	};
};
