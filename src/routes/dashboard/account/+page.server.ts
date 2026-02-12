import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { AUTH_ENV_KEYS } from '$lib/server/auth/constants';
import { hashPassword, normalizeIterations, verifyPassword } from '$lib/server/auth/password';
import { clearSessionCookie, revokeCurrentSession } from '$lib/server/auth/session';
import { resolvePasswordPepper } from '$lib/server/auth/service';
import {
	accountArchiveSchema,
	accountPasswordChangeSchema,
	accountPreferencesSchema,
	accountProfileSchema
} from '$lib/server/auth/validation';
import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const FIELD_LABELS: Record<string, string> = {
	firstName: 'First name',
	lastName: 'Last name',
	cellPhoneCountryCode: 'Country code',
	cellPhone: 'Cell phone',
	avatarUrl: 'Avatar URL',
	timezone: 'Timezone',
	preferences: 'Preferences',
	notes: 'Notes',
	currentPassword: 'Current password',
	newPassword: 'New password',
	confirmPassword: 'Confirm password',
	confirmation: 'Confirmation'
};

const readAuthEnv = (event: Pick<RequestEvent, 'platform'>, key: string): string | undefined => {
	const platformValue = (event.platform?.env as Record<string, unknown> | undefined)?.[key];
	if (typeof platformValue === 'string' && platformValue.trim().length > 0) {
		return platformValue.trim();
	}

	const nodeValue = process.env[key];
	if (typeof nodeValue === 'string' && nodeValue.trim().length > 0) {
		return nodeValue.trim();
	}

	return undefined;
};

const getValidationMessage = (
	issues: {
		path: PropertyKey[];
		message: string;
	}[],
	fallback: string
) => {
	const issue = issues[0];
	if (!issue) {
		return fallback;
	}

	const field = String(issue.path[0] ?? '');
	const label = FIELD_LABELS[field];
	if (label) {
		return `${label}: ${issue.message}`;
	}

	return issue.message || fallback;
};

const toNullableString = (value: string | null | undefined) => {
	const trimmed = value?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : null;
};

const resolvePasswordIterations = (event: Pick<RequestEvent, 'platform'>) =>
	normalizeIterations(readAuthEnv(event, AUTH_ENV_KEYS.passwordIterations));

const toAccountAgeDays = (createdAtIso: string | null | undefined) => {
	if (!createdAtIso) {
		return null;
	}

	const createdAtMs = Date.parse(createdAtIso);
	if (!Number.isFinite(createdAtMs)) {
		return null;
	}

	return Math.max(0, Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
};

export const load: PageServerLoad = async (event) => {
	const { platform, locals } = event;

	if (!platform?.env?.DB) {
		return {
			error: 'Database is not configured.',
			account: null
		};
	}

	const dbOps = new DatabaseOperations(platform as App.Platform);
	const clientId = requireAuthenticatedClientId(locals);
	const userId = requireAuthenticatedUserId(locals);
	const nowIso = new Date().toISOString();

	const [user, activeSessionCount] = await Promise.all([
		dbOps.users.getAuthByIdForClient(userId, clientId),
		dbOps.sessions.countActiveForUserInClient(userId, clientId, nowIso)
	]);

	locals.requestLogMeta = {
		table: 'users',
		recordCount: user ? 1 : 0
	};

	if (!user) {
		throw redirect(303, '/log-in');
	}

	if (user.status !== 'active') {
		clearSessionCookie(event);
		event.locals.session = undefined;
		event.locals.user = undefined;
		throw redirect(303, '/log-in');
	}

	const profileCompletionFields = [
		user.firstName,
		user.lastName,
		user.cellPhone,
		user.avatarUrl,
		user.timezone,
		user.preferences,
		user.notes
	];
	const completedFields = profileCompletionFields.filter(
		(value) => typeof value === 'string' && value.trim().length > 0
	).length;
	const profileCompletionPercent = Math.round((completedFields / profileCompletionFields.length) * 100);

	return {
		account: {
			id: user.id,
			email: user.email ?? '',
			firstName: user.firstName ?? '',
			lastName: user.lastName ?? '',
			cellPhone: user.cellPhone ?? '',
			avatarUrl: user.avatarUrl ?? '',
			timezone: user.timezone ?? '',
			role: user.role ?? 'player',
			status: user.status ?? 'unknown',
			preferences: user.preferences ?? '',
			notes: user.notes ?? '',
			createdAt: user.createdAt ?? null,
			updatedAt: user.updatedAt ?? null,
			emailVerifiedAt: user.emailVerifiedAt ?? null,
			firstLoginAt: user.firstLoginAt ?? null,
			lastLoginAt: user.lastLoginAt ?? null,
			lastActiveAt: user.lastActiveAt ?? null,
			sessionCount: user.sessionCount ?? 0,
			currentSessionExpiresAt: locals.session?.expiresAt ?? null,
			activeSessionCount,
			profileCompletionPercent,
			accountAgeDays: toAccountAgeDays(user.createdAt)
		}
	};
};

export const actions: Actions = {
	updateProfile: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'updateProfile', error: 'Database is not configured.' });
		}

		const formData = await event.request.formData();
		const parsed = accountProfileSchema.safeParse({
			firstName: formData.get('firstName')?.toString(),
			lastName: formData.get('lastName')?.toString(),
			cellPhoneCountryCode: formData.get('cellPhoneCountryCode')?.toString(),
			cellPhone: formData.get('cellPhone')?.toString(),
			avatarUrl: formData.get('avatarUrl')?.toString(),
			timezone: formData.get('timezone')?.toString()
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'updateProfile',
				error: getValidationMessage(
					parsed.error.issues,
					'Please provide valid values for your profile.'
				)
			});
		}

		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);

		const updated = await dbOps.users.updateSelfProfile({
			userId,
			clientId,
			firstName: toNullableString(parsed.data.firstName),
			lastName: toNullableString(parsed.data.lastName),
			cellPhone: toNullableString(parsed.data.cellPhone),
			avatarUrl: toNullableString(parsed.data.avatarUrl),
			timezone: toNullableString(parsed.data.timezone),
			updatedUser: userId
		});

		if (!updated) {
			return fail(404, {
				action: 'updateProfile',
				error: 'Unable to update this profile.'
			});
		}

		if (event.locals.user) {
			event.locals.user = {
				...event.locals.user,
				firstName: updated.firstName ?? null,
				lastName: updated.lastName ?? null,
				cellPhone: updated.cellPhone ?? null
			};
		}

		return {
			action: 'updateProfile',
			success: 'Profile updated.'
		};
	},

	updateDetails: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'updateDetails', error: 'Database is not configured.' });
		}

		const formData = await event.request.formData();
		const parsed = accountPreferencesSchema.safeParse({
			preferences: formData.get('preferences')?.toString(),
			notes: formData.get('notes')?.toString()
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'updateDetails',
				error: getValidationMessage(
					parsed.error.issues,
					'Please provide valid preferences and notes.'
				)
			});
		}

		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);

		const updated = await dbOps.users.updateSelfPreferences({
			userId,
			clientId,
			preferences: toNullableString(parsed.data.preferences),
			notes: toNullableString(parsed.data.notes),
			updatedUser: userId
		});

		if (!updated) {
			return fail(404, {
				action: 'updateDetails',
				error: 'Unable to update account details.'
			});
		}

		return {
			action: 'updateDetails',
			success: 'Account details updated.'
		};
	},

	changePassword: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'changePassword', error: 'Database is not configured.' });
		}

		const formData = await event.request.formData();
		const parsed = accountPasswordChangeSchema.safeParse({
			currentPassword: formData.get('currentPassword')?.toString(),
			newPassword: formData.get('newPassword')?.toString(),
			confirmPassword: formData.get('confirmPassword')?.toString()
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'changePassword',
				error: getValidationMessage(parsed.error.issues, 'Please provide a valid password update.')
			});
		}

		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);
		const user = await dbOps.users.getAuthByIdForClient(userId, clientId);

		if (!user || user.status !== 'active' || !user.passwordHash) {
			return fail(400, {
				action: 'changePassword',
				error: 'Unable to update password for this account.'
			});
		}

		let passwordPepper: string;
		try {
			passwordPepper = resolvePasswordPepper(event);
		} catch {
			return fail(500, {
				action: 'changePassword',
				error: 'Password updates are temporarily unavailable.'
			});
		}

		const validCurrentPassword = await verifyPassword({
			password: parsed.data.currentPassword,
			pepper: passwordPepper,
			storedHash: user.passwordHash
		});
		if (!validCurrentPassword) {
			return fail(400, {
				action: 'changePassword',
				error: 'Current password is incorrect.'
			});
		}

		const newPasswordHash = await hashPassword({
			password: parsed.data.newPassword,
			pepper: passwordPepper,
			iterations: resolvePasswordIterations(event)
		});

		const updated = await dbOps.users.updateSelfPasswordHash({
			userId,
			clientId,
			passwordHash: newPasswordHash,
			updatedUser: userId
		});

		if (!updated) {
			return fail(500, {
				action: 'changePassword',
				error: 'Failed to update password.'
			});
		}

		if (event.locals.session?.id) {
			await dbOps.sessions.revokeAllForUserExceptSessionInClient(
				userId,
				clientId,
				event.locals.session.id
			);
		}

		return {
			action: 'changePassword',
			success: 'Password updated. Other active sessions were signed out.'
		};
	},

	signOut: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'signOut', error: 'Authentication is unavailable.' });
		}

		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		await revokeCurrentSession(event, dbOps);
		throw redirect(303, '/log-in');
	},

	signOutEverywhere: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'signOutEverywhere', error: 'Authentication is unavailable.' });
		}

		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);

		await dbOps.sessions.revokeAllForUserInClient(userId, clientId);
		clearSessionCookie(event);
		event.locals.session = undefined;
		event.locals.user = undefined;

		throw redirect(303, '/log-in');
	},

	archiveAccount: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'archiveAccount', error: 'Database is not configured.' });
		}

		const formData = await event.request.formData();
		const parsed = accountArchiveSchema.safeParse({
			currentPassword: formData.get('currentPassword')?.toString(),
			confirmation: formData.get('confirmation')?.toString()
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'archiveAccount',
				error: getValidationMessage(
					parsed.error.issues,
					'To archive this account, confirm with your password and ARCHIVE text.'
				)
			});
		}

		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);
		const user = await dbOps.users.getAuthByIdForClient(userId, clientId);

		if (!user || user.status !== 'active' || !user.passwordHash) {
			return fail(400, {
				action: 'archiveAccount',
				error: 'Unable to archive this account.'
			});
		}

		let passwordPepper: string;
		try {
			passwordPepper = resolvePasswordPepper(event);
		} catch {
			return fail(500, {
				action: 'archiveAccount',
				error: 'Account archival is temporarily unavailable.'
			});
		}

		const validPassword = await verifyPassword({
			password: parsed.data.currentPassword,
			pepper: passwordPepper,
			storedHash: user.passwordHash
		});
		if (!validPassword) {
			return fail(400, {
				action: 'archiveAccount',
				error: 'Current password is incorrect.'
			});
		}

		const archived = await dbOps.users.archiveSelf({
			userId,
			clientId,
			updatedUser: userId
		});
		if (!archived) {
			return fail(500, {
				action: 'archiveAccount',
				error: 'Failed to archive this account.'
			});
		}

		await dbOps.sessions.revokeAllForUserInClient(userId, clientId);
		clearSessionCookie(event);
		event.locals.session = undefined;
		event.locals.user = undefined;

		throw redirect(303, '/log-in?archived=1');
	}
};
