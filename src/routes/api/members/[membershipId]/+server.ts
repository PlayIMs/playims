import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { updateMemberSchema } from '$lib/server/members/validation';
import { canViewAsRole, isAdminLikeRole, normalizeRole } from '$lib/server/auth/rbac';
import type { MemberRole, UpdateMemberResponse } from '$lib/members/types.js';
import type { RequestHandler } from './$types';

const toFieldErrorMap = (
	issues: Array<{
		path: Array<PropertyKey>;
		message: string;
	}>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) {
			fieldErrors[key] = [];
		}
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
};

const resolveActiveClientId = (locals: App.Locals): string =>
	locals.session?.activeClientId ?? locals.user?.clientId ?? '';

const buildAuthModePayload = (role: string) => {
	const normalizedRole = normalizeRole(role);
	return {
		baseRole: normalizedRole,
		effectiveRole: normalizedRole,
		canViewAsRole: canViewAsRole(normalizedRole),
		isViewingAsRole: false,
		viewAsRole: null
	};
};

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = getCentralDbOps(event);
	const member = await dbOps.members.getByMembershipId(event.params.membershipId, clientId);
	if (!member) {
		return json({ success: false, error: 'Member not found.' }, { status: 404 });
	}

	event.locals.requestLogMeta = {
		table: 'users,user_clients',
		recordCount: 1
	};

	return json({
		success: true,
		data: {
			member
		}
	});
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{ success: false, error: 'Database is unavailable.' } satisfies UpdateMemberResponse,
			{ status: 500 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{ success: false, error: 'Invalid request payload.' } satisfies UpdateMemberResponse,
			{ status: 400 }
		);
	}

	const parsed = updateMemberSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies UpdateMemberResponse,
			{ status: 400 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = getCentralDbOps(event);
	const membership = await dbOps.members.getMembershipRecord(event.params.membershipId, clientId);
	if (!membership) {
		return json(
			{ success: false, error: 'Member not found.' } satisfies UpdateMemberResponse,
			{ status: 404 }
		);
	}

	if (parsed.data.action === 'edit-profile') {
		if (parsed.data.studentId) {
			const duplicateMembershipId = await dbOps.members.findActiveByStudentId(
				clientId,
				parsed.data.studentId,
				event.params.membershipId
			);
			if (duplicateMembershipId) {
				return json(
					{
						success: false,
						error: 'Student ID already belongs to another member in this organization.',
						fieldErrors: {
							studentId: ['Student ID already belongs to another member in this organization.']
						}
					} satisfies UpdateMemberResponse,
					{ status: 409 }
				);
			}
		}

		const duplicateEmailUser = await dbOps.users.getAuthByEmail(parsed.data.email);
		if (duplicateEmailUser?.id && duplicateEmailUser.id !== membership.userId) {
			return json(
				{
					success: false,
					error: 'That email address is already in use.',
					fieldErrors: {
						email: ['That email address is already in use.']
					}
				} satisfies UpdateMemberResponse,
				{ status: 409 }
			);
		}

		const updatedMember = await dbOps.members.updateProfile({
			membershipId: event.params.membershipId,
			clientId,
			email: parsed.data.email,
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			studentId: parsed.data.studentId,
			sex: parsed.data.sex ?? null,
			updatedUser: userId
		});

		if (!updatedMember) {
			return json(
				{ success: false, error: 'Unable to update member right now.' } satisfies UpdateMemberResponse,
				{ status: 500 }
			);
		}

		return json({
			success: true,
			data: {
				member: updatedMember
			}
		} satisfies UpdateMemberResponse);
	}

	if (!isAdminLikeRole(event.locals.user?.role)) {
		return json(
			{ success: false, error: 'Only administrators and developers can change member roles.' } satisfies UpdateMemberResponse,
			{ status: 403 }
		);
	}

	if (
		(membership.role === 'admin' || membership.role === 'dev') &&
		parsed.data.role === 'participant'
	) {
		const remainingAdminLikeMembers = await dbOps.members.countAdminLikeMembers(
			clientId,
			event.params.membershipId
		);
		if (remainingAdminLikeMembers <= 0) {
			return json(
				{ success: false, error: 'You cannot demote the last administrator.' } satisfies UpdateMemberResponse,
				{ status: 409 }
			);
		}
	}

	const updatedMember = await dbOps.members.updateRole({
		membershipId: event.params.membershipId,
		clientId,
		role: parsed.data.role,
		updatedUser: userId
	});
	if (!updatedMember) {
		return json(
			{ success: false, error: 'Unable to update role right now.' } satisfies UpdateMemberResponse,
			{ status: 500 }
		);
	}

	let authMode:
		| {
				baseRole: MemberRole;
				effectiveRole: MemberRole;
				canViewAsRole: boolean;
				isViewingAsRole: boolean;
				viewAsRole: MemberRole | null;
		  }
		| undefined;
	if (
		event.locals.session?.id &&
		resolveActiveClientId(event.locals) === clientId &&
		membership.userId === event.locals.user?.id
	) {
		const nowIso = new Date().toISOString();
		await dbOps.sessions.updateClientContext(event.locals.session.id, clientId, nowIso);
		authMode = buildAuthModePayload(updatedMember.role);
		if (event.locals.session) {
			event.locals.session = {
				...event.locals.session,
				role: authMode.effectiveRole,
				baseRole: authMode.baseRole,
				canViewAsRole: authMode.canViewAsRole,
				isViewingAsRole: false,
				viewAsRole: null
			};
		}
		if (event.locals.user) {
			event.locals.user = {
				...event.locals.user,
				role: authMode.effectiveRole,
				baseRole: authMode.baseRole,
				canViewAsRole: authMode.canViewAsRole,
				isViewingAsRole: false,
				viewAsRole: null
			};
		}
	}

	return json({
		success: true,
		data: {
			member: updatedMember,
			authMode
		}
	} satisfies UpdateMemberResponse);
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}

	if (!isAdminLikeRole(event.locals.user?.role)) {
		return json(
			{ success: false, error: 'Only administrators and developers can remove members.' },
			{ status: 403 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = getCentralDbOps(event);
	const membership = await dbOps.members.getMembershipRecord(event.params.membershipId, clientId);
	if (!membership) {
		return json({ success: false, error: 'Member not found.' }, { status: 404 });
	}

	if (membership.role === 'admin' || membership.role === 'dev') {
		const remainingAdminLikeMembers = await dbOps.members.countAdminLikeMembers(
			clientId,
			event.params.membershipId
		);
		if (remainingAdminLikeMembers <= 0) {
			return json(
				{ success: false, error: 'You cannot remove the last administrator.' },
				{ status: 409 }
			);
		}
	}

	if (membership.userId === event.locals.user?.id) {
		const activeMemberships = await dbOps.userClients.listActiveForUser(membership.userId);
		if (activeMemberships.length <= 1) {
			return json(
				{ success: false, error: 'You cannot remove your only active organization membership.' },
				{ status: 409 }
			);
		}
	}

	const removed = await dbOps.members.softRemove({
		membershipId: event.params.membershipId,
		clientId,
		updatedUser: userId
	});
	if (!removed) {
		return json({ success: false, error: 'Unable to remove member right now.' }, { status: 500 });
	}

	let payload: Record<string, unknown> = {};
	if (
		membership.userId === event.locals.user?.id &&
		event.locals.session?.id &&
		resolveActiveClientId(event.locals) === clientId
	) {
		const remainingMemberships = (await dbOps.userClients.listActiveForUser(membership.userId)).filter(
			(candidate) => candidate.clientId !== clientId
		);
		const fallbackMembership = remainingMemberships[0] ?? null;
		if (!fallbackMembership?.clientId) {
			return json(
				{ success: false, error: 'Unable to switch to another organization after removal.' },
				{ status: 500 }
			);
		}

		const updatedDefault = await dbOps.userClients.setDefaultMembership(
			membership.userId,
			fallbackMembership.clientId
		);
		const nextRole = normalizeRole(updatedDefault?.role ?? fallbackMembership.role);
		const nowIso = new Date().toISOString();
		await dbOps.sessions.updateClientContext(event.locals.session.id, fallbackMembership.clientId, nowIso);
		if (event.locals.session) {
			event.locals.session = {
				...event.locals.session,
				clientId: fallbackMembership.clientId,
				activeClientId: fallbackMembership.clientId,
				role: nextRole,
				baseRole: nextRole,
				canViewAsRole: canViewAsRole(nextRole),
				isViewingAsRole: false,
				viewAsRole: null
			};
		}
		if (event.locals.user) {
			event.locals.user = {
				...event.locals.user,
				clientId: fallbackMembership.clientId,
				role: nextRole,
				baseRole: nextRole,
				canViewAsRole: canViewAsRole(nextRole),
				isViewingAsRole: false,
				viewAsRole: null
			};
		}

		payload = {
			activeClientId: fallbackMembership.clientId,
			authMode: buildAuthModePayload(nextRole)
		};
	}

	return json({
		success: true,
		data: {
			removedMembershipId: event.params.membershipId,
			...payload
		}
	});
};
