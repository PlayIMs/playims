import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { AUTH_ENV_KEYS } from '$lib/server/auth/constants';
import { normalizeIterations, hashPassword } from '$lib/server/auth/password';
import { resolvePasswordPepper } from '$lib/server/auth/service';
import { createMemberSchema, memberListQuerySchema } from '$lib/server/members/validation';
import type {
	CreateMemberResponse,
	MemberListResponse,
	MemberRole,
	MemberSex,
	MemberSortKey,
	SortDirection
} from '$lib/members/types.js';
import type { RequestHandler } from './$types';

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

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

const buildEmptyMemberPayload = (input: {
	query: string;
	sort: MemberSortKey;
	dir: SortDirection;
	sexFilter: MemberSex | null;
	roleFilter: MemberRole | null;
	lastActiveSeasonId: string | null;
}): NonNullable<MemberListResponse['data']> => ({
	rows: [],
	page: 1,
	pageSize: 50,
	totalCount: 0,
	hasNextPage: false,
	hasPreviousPage: false,
	sort: input.sort,
	dir: input.dir,
	query: input.query,
	sexFilter: input.sexFilter,
	roleFilter: input.roleFilter,
	lastActiveSeasonId: input.lastActiveSeasonId
});

const readAuthEnv = (event: { platform?: App.Platform }, key: string): string | undefined => {
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

const resolvePasswordIterations = (event: { platform?: App.Platform }): number =>
	normalizeIterations(readAuthEnv(event, AUTH_ENV_KEYS.passwordIterations));

const generateTemporaryPassword = (length = 16): string => {
	const randomBytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(
		randomBytes,
		(byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]
	).join('');
};

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{ success: false, error: 'Database is unavailable.' } satisfies MemberListResponse,
			{
				status: 500
			}
		);
	}

	const parsed = memberListQuerySchema.safeParse({
		q: event.url.searchParams.get('q'),
		sex: event.url.searchParams.get('sex'),
		role: event.url.searchParams.get('role'),
		lastActiveSeason: event.url.searchParams.get('lastActiveSeason'),
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

	const query = parsed.data.q.trim();
	if (query.length < 2) {
		event.locals.requestLogMeta = {
			table: 'users,user_clients',
			recordCount: 0
		};

		return json({
			success: true,
			data: buildEmptyMemberPayload({
				query,
				sort: parsed.data.sort,
				dir: parsed.data.dir,
				sexFilter: parsed.data.sex ?? null,
				roleFilter: parsed.data.role ?? null,
				lastActiveSeasonId: parsed.data.lastActiveSeason ?? null
			})
		} satisfies MemberListResponse);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = getCentralDbOps(event);
	const result = await dbOps.members.searchByClient({
		clientId,
		query,
		page: parsed.data.page,
		sex: parsed.data.sex ?? null,
		role: parsed.data.role ?? null,
		lastActiveSeasonId: parsed.data.lastActiveSeason ?? null,
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
			query,
			sexFilter: parsed.data.sex ?? null,
			roleFilter: parsed.data.role ?? null,
			lastActiveSeasonId: parsed.data.lastActiveSeason ?? null
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

	if (!requirePermission(event.locals, PERMISSIONS.ADD_MEMBER, { mutate: true })) {
		return json(
			{
				success: false,
				error: 'You do not have permission to add members.'
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
		sex: parsed.data.sex,
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
				createdNewUser: false,
				reactivatedMembership: addResult.status === 'reactivated'
			}
		} satisfies CreateMemberResponse);
	}

	let passwordPepper: string;
	try {
		passwordPepper = resolvePasswordPepper(event);
	} catch {
		return json(
			{
				success: false,
				error: 'Temporary password generation is unavailable right now.'
			} satisfies CreateMemberResponse,
			{ status: 500 }
		);
	}

	const temporaryPassword = generateTemporaryPassword();
	const passwordHash = await hashPassword({
		password: temporaryPassword,
		pepper: passwordPepper,
		iterations: resolvePasswordIterations(event)
	});

	const createdUser = await dbOps.users.createAuthUser({
		email: parsed.data.email,
		passwordHash,
		firstName: parsed.data.firstName,
		lastName: parsed.data.lastName,
		status: 'active',
		mustChangePassword: true,
		createdUser: userId,
		updatedUser: userId
	});
	if (!createdUser?.id) {
		return json(
			{
				success: false,
				error: 'Unable to create the member account right now.'
			} satisfies CreateMemberResponse,
			{ status: 500 }
		);
	}

	const membership = await dbOps.userClients.ensureMembership({
		userId: createdUser.id,
		clientId,
		role: parsed.data.role,
		status: 'active',
		studentId: parsed.data.studentId,
		sex: parsed.data.sex,
		isDefault: false,
		createdUser: userId,
		updatedUser: userId
	});
	if (!membership?.id) {
		return json(
			{
				success: false,
				error: 'Unable to create the member account right now.'
			} satisfies CreateMemberResponse,
			{ status: 500 }
		);
	}

	const member = await dbOps.members.getByMembershipId(membership.id, clientId);
	if (!member) {
		return json(
			{
				success: false,
				error: 'Unable to load the new member right now.'
			} satisfies CreateMemberResponse,
			{ status: 500 }
		);
	}

	return json({
		success: true,
		data: {
			member,
			addedExistingUser: false,
			createdNewUser: true,
			reactivatedMembership: false,
			temporaryPassword
		}
	} satisfies CreateMemberResponse);
};
