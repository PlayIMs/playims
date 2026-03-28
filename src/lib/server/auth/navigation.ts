import { buildPermissionSnapshot, type AuthRole } from '$lib/server/auth/permissions';

export const sanitizeAuthRedirectPath = (value: string | null | undefined): string | null => {
	if (!value) {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/api/')) {
		return null;
	}

	return trimmed;
};

const isPasswordSetupPath = (value: string | null | undefined): boolean =>
	typeof value === 'string' && (value === '/set-password' || value.startsWith('/set-password?'));

export const buildPasswordSetupLocation = (nextPath: string | null | undefined): string => {
	const sanitizedNextPath = sanitizeAuthRedirectPath(nextPath);
	if (!sanitizedNextPath || isPasswordSetupPath(sanitizedNextPath)) {
		return '/set-password';
	}

	return `/set-password?next=${encodeURIComponent(sanitizedNextPath)}`;
};

export const resolvePostAuthRedirect = (input: {
	nextPath: string | null | undefined;
	role: AuthRole | string | null | undefined;
	mustChangePassword?: boolean;
}): string => {
	if (input.mustChangePassword) {
		return buildPasswordSetupLocation(input.nextPath);
	}

	const sanitizedNextPath = sanitizeAuthRedirectPath(input.nextPath);
	if (sanitizedNextPath && !isPasswordSetupPath(sanitizedNextPath)) {
		return sanitizedNextPath;
	}

	return buildPermissionSnapshot(input.role).VIEW_DASHBOARD_HOME ? '/dashboard' : '/';
};
