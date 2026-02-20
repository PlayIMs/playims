import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { AUTH_ENV_KEYS } from '$lib/server/auth/constants';
import { hashPassword, normalizeIterations, verifyPassword } from '$lib/server/auth/password';
import { normalizeRole } from '$lib/server/auth/rbac';
import { clearSessionCookie, revokeCurrentSession } from '$lib/server/auth/session';
import { resolvePasswordPepper } from '$lib/server/auth/service';
import {
	accountArchiveSchema,
	accountCreateOrganizationSchema,
	accountPasswordChangeSchema,
	accountProfileSchema,
	switchClientSchema
} from '$lib/server/auth/validation';
import { validateClientSlug } from '$lib/server/client-slug';
import { getCentralDbOps } from '$lib/server/database/context';
import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const FIELD_LABELS: Record<string, string> = {
	firstName: 'First name',
	lastName: 'Last name',
	cellPhoneCountryCode: 'Country code',
	cellPhone: 'Cell phone',
	organizationName: 'Organization name',
	organizationSlug: 'Organization slug',
	metadata: 'Metadata',
	membershipRole: 'Membership role',
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
			account: null,
			organizations: []
		};
	}

	const dbOps = getCentralDbOps(event);
	const clientId = requireAuthenticatedClientId(locals);
	const userId = requireAuthenticatedUserId(locals);
	const nowIso = new Date().toISOString();

	const [user, activeSessionCount, activeSessions, memberships] = await Promise.all([
		dbOps.users.getAuthByIdForClient(userId, clientId),
		dbOps.sessions.countActiveForUserInClient(userId, clientId, nowIso),
		dbOps.sessions.getActiveForUserInClient(userId, clientId, nowIso),
		dbOps.userClients.listActiveForUserWithClientDetails(userId)
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

	const profileCompletionFields = [user.firstName, user.lastName, user.cellPhone];
	const completedFields = profileCompletionFields.filter(
		(value) => typeof value === 'string' && value.trim().length > 0
	).length;
	const profileCompletionPercent = Math.round(
		(completedFields / profileCompletionFields.length) * 100
	);

	const organizations = memberships
		.map(({ membership, client }) => {
			const clientName = client?.name?.trim() || 'Organization';
			const clientSlug = client?.slug?.trim() || null;
			return {
				clientId: membership.clientId,
				clientName,
				clientSlug,
				role: membership.role ?? 'player',
				isDefault: membership.isDefault === 1,
				isCurrent: membership.clientId === clientId
			};
		})
		.toSorted((a, b) => {
			if (a.isCurrent && !b.isCurrent) return -1;
			if (!a.isCurrent && b.isCurrent) return 1;
			return a.clientName.localeCompare(b.clientName, 'en', { sensitivity: 'base' });
		});

	return {
		organizations,
		account: {
			id: user.id,
			email: user.email ?? '',
			firstName: user.firstName ?? '',
			lastName: user.lastName ?? '',
			cellPhone: user.cellPhone ?? '',
			role: user.role ?? 'player',
			status: user.status ?? 'unknown',
			createdAt: user.createdAt ?? null,
			updatedAt: user.updatedAt ?? null,
			emailVerifiedAt: user.emailVerifiedAt ?? null,
			firstLoginAt: user.firstLoginAt ?? null,
			lastLoginAt: user.lastLoginAt ?? null,
			lastActiveAt: user.lastActiveAt ?? null,
			sessionCount: user.sessionCount ?? 0,
			currentSessionExpiresAt: locals.session?.expiresAt ?? null,
			activeSessionCount,
			activeSessions: activeSessions.map((session) => ({
				id: session.id,
				userAgent: session.userAgent ?? null,
				ipAddress: session.ipAddress ?? null,
				locationCity: session.locationCity ?? null,
				locationStation: session.locationStation ?? null,
				lastSeenAt: session.lastSeenAt,
				createdAt: session.createdAt,
				expiresAt: session.expiresAt,
				isCurrent: session.id === locals.session?.id
			})),
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
			cellPhone: formData.get('cellPhone')?.toString()
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

		const dbOps = getCentralDbOps(event);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);

		const updated = await dbOps.users.updateSelfProfile({
			userId,
			clientId,
			firstName: toNullableString(parsed.data.firstName),
			lastName: toNullableString(parsed.data.lastName),
			cellPhone: toNullableString(parsed.data.cellPhone),
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

		const dbOps = getCentralDbOps(event);
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

	createOrganization: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'createOrganization', error: 'Database is not configured.' });
		}

		if (!event.locals.user || !event.locals.session) {
			return fail(401, { action: 'createOrganization', error: 'Authentication required.' });
		}

		const formData = await event.request.formData();
		const parsed = accountCreateOrganizationSchema.safeParse({
			organizationName: formData.get('organizationName')?.toString(),
			organizationSlug: formData.get('organizationSlug')?.toString(),
			selfJoinEnabled: formData.get('selfJoinEnabled')?.toString(),
			membershipRole: formData.get('membershipRole')?.toString(),
			switchToOrganization: formData.get('switchToOrganization')?.toString(),
			setDefaultOrganization: formData.get('setDefaultOrganization')?.toString(),
			metadata: formData.get('metadata')?.toString()
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'createOrganization',
				error: getValidationMessage(
					parsed.error.issues,
					'Please provide valid organization details.'
				)
			});
		}

		const dbOps = getCentralDbOps(event);
		const userId = requireAuthenticatedUserId(event.locals);
		const nowIso = new Date().toISOString();

		const slugValidation = validateClientSlug(parsed.data.organizationSlug);
		if (!slugValidation.ok) {
			const slugError =
				slugValidation.code === 'CLIENT_SLUG_RESERVED'
					? 'That organization slug is reserved.'
					: slugValidation.code === 'CLIENT_SLUG_REQUIRED'
						? 'Organization slug is required.'
						: 'Organization slug must use letters, numbers, and dashes.';
			return fail(400, {
				action: 'createOrganization',
				error: slugError
			});
		}

		const existingClient = await dbOps.clients.getByNormalizedSlug(slugValidation.slug);
		if (existingClient?.id) {
			return fail(409, {
				action: 'createOrganization',
				error: 'That organization slug is already in use.'
			});
		}

		let createdClient: Awaited<ReturnType<typeof dbOps.clients.create>> | null = null;
		try {
			createdClient = await dbOps.clients.create({
				name: parsed.data.organizationName.trim(),
				slug: slugValidation.slug,
				selfJoinEnabled: parsed.data.selfJoinEnabled,
				metadata: parsed.data.metadata?.trim() || undefined,
				createdUser: userId,
				updatedUser: userId
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (message === 'CLIENT_SLUG_RESERVED') {
				return fail(400, {
					action: 'createOrganization',
					error: 'That organization slug is reserved.'
				});
			}
			if (message === 'CLIENT_SLUG_INVALID' || message === 'CLIENT_SLUG_REQUIRED') {
				return fail(400, {
					action: 'createOrganization',
					error: 'Organization slug must use letters, numbers, and dashes.'
				});
			}
			return fail(500, {
				action: 'createOrganization',
				error: 'Unable to create organization right now.'
			});
		}

		if (!createdClient?.id) {
			return fail(500, {
				action: 'createOrganization',
				error: 'Unable to create organization right now.'
			});
		}

		const membership = await dbOps.userClients.ensureMembership({
			userId,
			clientId: createdClient.id,
			role: parsed.data.membershipRole,
			status: 'active',
			isDefault: parsed.data.setDefaultOrganization,
			createdUser: userId,
			updatedUser: userId
		});

		if (!membership) {
			return fail(500, {
				action: 'createOrganization',
				error: 'Organization created, but membership setup failed.'
			});
		}

		let switched = false;
		if (parsed.data.switchToOrganization && event.locals.session?.id) {
			const updatedSession = await dbOps.sessions.updateClientContext(
				event.locals.session.id,
				createdClient.id,
				nowIso
			);
			if (updatedSession) {
				switched = true;
				const resolvedRole = normalizeRole(membership.role);
				event.locals.session = {
					...event.locals.session,
					clientId: createdClient.id,
					activeClientId: createdClient.id,
					role: resolvedRole
				};
				event.locals.user = {
					...event.locals.user,
					clientId: createdClient.id,
					role: resolvedRole
				};
			}
		}

		return {
			action: 'createOrganization',
			success: switched
				? `Organization "${createdClient.name?.trim() || 'Organization'}" created and activated.`
				: `Organization "${createdClient.name?.trim() || 'Organization'}" created.`
		};
	},

	switchOrganization: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'switchOrganization', error: 'Authentication is unavailable.' });
		}

		if (!event.locals.user || !event.locals.session) {
			return fail(401, { action: 'switchOrganization', error: 'Authentication required.' });
		}

		const formData = await event.request.formData();
		const parsed = switchClientSchema.safeParse({
			clientId: formData.get('clientId')?.toString()
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'switchOrganization',
				error: 'Please choose a valid organization.'
			});
		}

		const requestedClientId = parsed.data.clientId;
		if (requestedClientId === event.locals.session.activeClientId) {
			return {
				action: 'switchOrganization',
				success: 'That organization is already active.'
			};
		}

		const dbOps = getCentralDbOps(event);
		const userId = requireAuthenticatedUserId(event.locals);
		const activeMembership = await dbOps.userClients.getActiveMembership(userId, requestedClientId);
		if (!activeMembership) {
			return fail(403, {
				action: 'switchOrganization',
				error: 'You do not have access to that organization.'
			});
		}

		const nowIso = new Date().toISOString();
		const updatedSession = await dbOps.sessions.updateClientContext(
			event.locals.session.id,
			requestedClientId,
			nowIso
		);
		if (!updatedSession) {
			return fail(500, {
				action: 'switchOrganization',
				error: 'Unable to switch organizations right now.'
			});
		}

		await dbOps.userClients.setDefaultMembership(userId, requestedClientId);

		const resolvedRole = normalizeRole(activeMembership.role);
		event.locals.session = {
			...event.locals.session,
			clientId: requestedClientId,
			activeClientId: requestedClientId,
			role: resolvedRole
		};
		event.locals.user = {
			...event.locals.user,
			clientId: requestedClientId,
			role: resolvedRole
		};

		return {
			action: 'switchOrganization',
			success: 'Organization switched.'
		};
	},

	signOut: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'signOut', error: 'Authentication is unavailable.' });
		}

		const dbOps = getCentralDbOps(event);
		await revokeCurrentSession(event, dbOps);
		throw redirect(303, '/log-in');
	},

	signOutSession: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'signOutSession', error: 'Authentication is unavailable.' });
		}

		const formData = await event.request.formData();
		const rawSessionId = formData.get('sessionId');
		const sessionId = typeof rawSessionId === 'string' ? rawSessionId.trim() : '';
		if (!sessionId) {
			return fail(400, {
				action: 'signOutSession',
				error: 'Session id is required.'
			});
		}

		const dbOps = getCentralDbOps(event);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);
		const nowIso = new Date().toISOString();
		const session = await dbOps.sessions.getActiveByIdForUserInClient(
			sessionId,
			userId,
			clientId,
			nowIso
		);

		if (!session) {
			return fail(404, {
				action: 'signOutSession',
				error: 'Session not found.'
			});
		}

		if (session.id === event.locals.session?.id) {
			await revokeCurrentSession(event, dbOps);
			throw redirect(303, '/log-in');
		}

		const revoked = await dbOps.sessions.revokeById(session.id);
		if (!revoked) {
			return fail(500, {
				action: 'signOutSession',
				error: 'Unable to sign out that session.'
			});
		}

		return {
			action: 'signOutSession',
			success: 'Session signed out.'
		};
	},

	signOutEverywhere: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { action: 'signOutEverywhere', error: 'Authentication is unavailable.' });
		}

		const dbOps = getCentralDbOps(event);
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

		const dbOps = getCentralDbOps(event);
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
