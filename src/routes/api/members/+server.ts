import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { isAdminLikeRole } from '$lib/server/auth/rbac';
import { createMemberSchema, memberListQuerySchema } from '$lib/server/members/validation';
import { buildMemberInviteUrl, generateMemberInviteToken, getMemberInviteExpiryIso, hashMemberInviteToken } from '$lib/server/members/invites';
import type { CreateMemberResponse, MemberListResponse } from '$lib/members/types.js';
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

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' } satisfies MemberListResponse, {
			status: 500
		});
	}

	const parsed = memberListQuerySchema.safeParse({
		q: event.url.searchParams.get('q'),
		sex: event.url.searchParams.get('sex'),
		role: event.url.searchParams.get('role'),
		sort: event.url.searchParams.get('sort') ?? undefined,
		dir: event.url.searchParams.get('dir') ?? undefined,
		page: event.url.searchParams.get('page') ?? undefined
	});
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid member search parameters.'
			} satisfies MemberListResponse,
			{ status: 400 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = getCentralDbOps(event);
	const shouldSearch = parsed.data.q.trim().length >= 2;
	const result = shouldSearch
		? await dbOps.members.searchByClient({
				clientId,
				query: parsed.data.q,
				page: parsed.data.page,
				sex: parsed.data.sex ?? null,
				role: parsed.data.role ?? null,
				sort: parsed.data.sort,
				dir: parsed.data.dir
			})
		: await dbOps.members.listByClient({
				clientId,
				page: parsed.data.page,
				sex: parsed.data.sex ?? null,
				role: parsed.data.role ?? null,
				sort: parsed.data.sort,
				dir: parsed.data.dir
			});

	event.locals.requestLogMeta = {
		table: 'users,user_clients',
		recordCount: result.rows.length
	};

	return json({
		success: true,
		data: {
			rows: result.rows,
			page: result.page,
			pageSize: 50,
			totalCount: result.totalCount,
			hasNextPage: result.hasNextPage,
			hasPreviousPage: result.hasPreviousPage,
			sort: parsed.data.sort,
			dir: parsed.data.dir,
			query: parsed.data.q.trim(),
			sexFilter: parsed.data.sex ?? null,
			roleFilter: parsed.data.role ?? null
		}
	} satisfies MemberListResponse);
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{ success: false, error: 'Database is unavailable.' } satisfies CreateMemberResponse,
			{ status: 500 }
		);
	}

	if (!isAdminLikeRole(event.locals.user?.role)) {
		return json(
			{
				success: false,
				error: 'Only administrators and developers can add members.'
			} satisfies CreateMemberResponse,
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{ success: false, error: 'Invalid request payload.' } satisfies CreateMemberResponse,
			{ status: 400 }
		);
	}

	const parsed = createMemberSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies CreateMemberResponse,
			{ status: 400 }
		);
	}

	const dbOps = getCentralDbOps(event);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	if (parsed.data.studentId) {
		const duplicateMembershipId = await dbOps.members.findActiveByStudentId(
			clientId,
			parsed.data.studentId
		);
		if (duplicateMembershipId) {
			return json(
				{
					success: false,
					error: 'Student ID already belongs to another member in this organization.',
					fieldErrors: {
						studentId: ['Student ID already belongs to another member in this organization.']
					}
				} satisfies CreateMemberResponse,
				{ status: 409 }
			);
		}
	}

	const addResult = await dbOps.members.addOrReactivateMember({
		clientId,
		email: parsed.data.email,
		role: parsed.data.role,
		firstName: parsed.data.firstName,
		lastName: parsed.data.lastName,
		studentId: parsed.data.studentId,
		sex: parsed.data.sex ?? null,
		updatedUser: userId
	});

	if (addResult.status === 'already-active') {
		return json(
			{
				success: false,
				error: 'Member already exists in this organization.',
				fieldErrors: {
					email: ['Member already exists in this organization.']
				}
			} satisfies CreateMemberResponse,
			{ status: 409 }
		);
	}

	if (addResult.status === 'added' || addResult.status === 'reactivated') {
		return json({
			success: true,
			data: {
				member: addResult.member,
				addedExistingUser: true,
				reactivatedMembership: addResult.status === 'reactivated'
			}
		} satisfies CreateMemberResponse);
	}

	const existingPendingInvite = await dbOps.members.getPendingInviteByEmail(clientId, parsed.data.email);
	if (existingPendingInvite) {
		return json(
			{
				success: false,
				error: 'A pending invite already exists for this email address.',
				fieldErrors: {
					email: ['A pending invite already exists for this email address.']
				}
			} satisfies CreateMemberResponse,
			{ status: 409 }
		);
	}

	const inviteToken = generateMemberInviteToken();
	const invite = await dbOps.members.createInvite({
		clientId,
		email: parsed.data.email,
		firstName: parsed.data.firstName,
		lastName: parsed.data.lastName,
		studentId: parsed.data.studentId,
		sex: parsed.data.sex ?? null,
		role: parsed.data.role,
		mode: parsed.data.mode,
		tokenHash: await hashMemberInviteToken(inviteToken),
		expiresAt: getMemberInviteExpiryIso(),
		createdUser: userId
	});

	if (!invite) {
		return json(
			{ success: false, error: 'Unable to create invite right now.' } satisfies CreateMemberResponse,
			{ status: 500 }
		);
	}

	return json({
		success: true,
		data: {
			invite: {
				...invite,
				inviteUrl: buildMemberInviteUrl(event.url.origin, inviteToken)
			},
			addedExistingUser: false,
			reactivatedMembership: false
		}
	} satisfies CreateMemberResponse);
};
