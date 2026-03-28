import { and, asc, desc, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { userClients, users } from '../schema/index.js';
import {
	MEMBER_PAGE_SIZE,
	type MemberAssignableRole,
	type MemberDetail,
	type MemberListRow,
	type MemberRole,
	type MemberSex,
	type MemberSortKey,
	type SortDirection
} from '../../members/types.js';

const ADMIN_LIKE_ROLES = ['admin', 'dev'] as const;

const normalizeText = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : null;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const splitSearchTokens = (value: string): string[] =>
	value
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

const fullNameExpression = sql<string>`trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, ''))`;
const reverseFullNameExpression = sql<string>`trim(coalesce(${users.lastName}, '') || ' ' || coalesce(${users.firstName}, ''))`;
const studentIdBlankSortExpression = sql<number>`case
	when ${userClients.studentId} is null or trim(${userClients.studentId}) = '' then 1
	else 0
end`;
const roleRankExpression = sql<number>`case ${userClients.role}
	when 'participant' then 0
	when 'manager' then 1
	when 'admin' then 2
	when 'dev' then 3
	else 4
end`;

type MemberRowSelection = {
	membershipId: string;
	clientId: string;
	userId: string;
	studentId: string | null;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	sex: string | null;
	role: string;
	status: string;
	avatarUrl?: string | null;
	cellPhone?: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	lastLoginAt?: string | null;
	lastActiveAt?: string | null;
};

const toMemberSex = (value: string | null | undefined): MemberSex | null => {
	return value === 'M' || value === 'F' ? value : null;
};

const toMemberRole = (value: string | null | undefined): MemberRole => {
	if (value === 'manager' || value === 'admin' || value === 'dev') {
		return value;
	}
	return 'participant';
};

const buildFullName = (firstName: string | null, lastName: string | null): string => {
	const joined = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
	return joined.length > 0 ? joined : 'Unnamed Member';
};

const mapMemberRow = (row: MemberRowSelection): MemberListRow => ({
	membershipId: row.membershipId,
	userId: row.userId,
	studentId: normalizeText(row.studentId),
	firstName: normalizeText(row.firstName),
	lastName: normalizeText(row.lastName),
	fullName: buildFullName(row.firstName, row.lastName),
	email: normalizeText(row.email),
	sex: toMemberSex(row.sex),
	role: toMemberRole(row.role),
	status: row.status,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt
});

const mapMemberDetail = (row: MemberRowSelection): MemberDetail => ({
	...mapMemberRow(row),
	clientId: row.clientId,
	avatarUrl: row.avatarUrl ?? null,
	cellPhone: row.cellPhone ?? null,
	lastLoginAt: row.lastLoginAt ?? null,
	lastActiveAt: row.lastActiveAt ?? null
});

const buildSearchConditions = (query: string): SQL[] => {
	const tokens = splitSearchTokens(query);
	if (tokens.length === 0) {
		return [];
	}

	return tokens.map((token) => {
		const pattern = `%${escapeLike(token)}%`;
		return or(
			sql`lower(trim(coalesce(${users.firstName}, ''))) like ${pattern} escape '\\'`,
			sql`lower(trim(coalesce(${users.lastName}, ''))) like ${pattern} escape '\\'`,
			sql`lower(${fullNameExpression}) like ${pattern} escape '\\'`,
			sql`lower(${reverseFullNameExpression}) like ${pattern} escape '\\'`,
			sql`lower(trim(coalesce(${users.email}, ''))) like ${pattern} escape '\\'`,
			sql`lower(trim(coalesce(${userClients.studentId}, ''))) like ${pattern} escape '\\'`
		) as SQL;
	});
};

const buildMemberOrderBy = (sort: MemberSortKey, dir: SortDirection): SQL[] => {
	const orderValue = dir === 'asc' ? asc : desc;

	switch (sort) {
		case 'studentId':
			return [
				asc(studentIdBlankSortExpression),
				asc(
					sql<number>`case
						when trim(coalesce(${userClients.studentId}, '')) <> ''
							and trim(${userClients.studentId}) glob '[0-9]*'
						then 0
						else 1
					end`
				),
				orderValue(
					sql<number>`case
						when trim(coalesce(${userClients.studentId}, '')) <> ''
							and trim(${userClients.studentId}) glob '[0-9]*'
						then cast(trim(${userClients.studentId}) as integer)
					end`
				),
				orderValue(sql`lower(trim(coalesce(${userClients.studentId}, '')))`),
				asc(userClients.id)
			];
		case 'firstName':
			return [
				asc(
					sql<number>`case
						when trim(coalesce(${users.firstName}, '')) = '' then 1
						else 0
					end`
				),
				orderValue(sql`lower(trim(coalesce(${users.firstName}, '')))`),
				orderValue(sql`lower(trim(coalesce(${users.lastName}, '')))`),
				asc(userClients.id)
			];
		case 'lastName':
			return [
				asc(
					sql<number>`case
						when trim(coalesce(${users.lastName}, '')) = '' then 1
						else 0
					end`
				),
				orderValue(sql`lower(trim(coalesce(${users.lastName}, '')))`),
				orderValue(sql`lower(trim(coalesce(${users.firstName}, '')))`),
				asc(userClients.id)
			];
		case 'email':
			return [
				asc(sql<number>`case when ${users.email} is null or trim(${users.email}) = '' then 1 else 0 end`),
				orderValue(sql`lower(trim(coalesce(${users.email}, '')))`),
				asc(userClients.id)
			];
		case 'sex':
			return [
				asc(sql<number>`case when ${userClients.sex} is null or trim(${userClients.sex}) = '' then 1 else 0 end`),
				orderValue(sql`upper(trim(coalesce(${userClients.sex}, '')))`),
				orderValue(sql`lower(trim(coalesce(${users.lastName}, '')))`),
				orderValue(sql`lower(trim(coalesce(${users.firstName}, '')))`),
				asc(userClients.id)
			];
		case 'role':
			return [orderValue(roleRankExpression), asc(userClients.id)];
		default:
			return [
				asc(
					sql<number>`case
						when trim(coalesce(${users.lastName}, '')) = '' then 1
						else 0
					end`
				),
				orderValue(sql`lower(trim(coalesce(${users.lastName}, '')))`),
				orderValue(sql`lower(trim(coalesce(${users.firstName}, '')))`),
				asc(userClients.id)
			];
	}
};

export class MemberOperations {
	constructor(private db: DrizzleClient) {}

	async listByClient(input: {
		clientId: string;
		page?: number;
		sex?: MemberSex | null;
		role?: MemberRole | null;
		sort?: MemberSortKey;
		dir?: SortDirection;
	}): Promise<{
		rows: MemberListRow[];
		totalCount: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		page: number;
	}> {
		return await this.searchByClient({
			clientId: input.clientId,
			query: '',
			page: input.page,
			sex: input.sex,
			role: input.role,
			sort: input.sort,
			dir: input.dir
		});
	}

	async searchByClient(input: {
		clientId: string;
		query: string;
		page?: number;
		sex?: MemberSex | null;
		role?: MemberRole | null;
		sort?: MemberSortKey;
		dir?: SortDirection;
	}): Promise<{
		rows: MemberListRow[];
		totalCount: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		page: number;
	}> {
		const requestedPage = Math.max(1, Math.trunc(input.page ?? 1));
		const sort = input.sort ?? 'lastName';
		const dir = input.dir ?? 'asc';
		const query = input.query.trim();
		const sexFilter = input.sex ?? null;
		const roleFilter = input.role ?? null;
		const whereClauses: SQL[] = [
			eq(userClients.clientId, input.clientId),
			eq(userClients.status, 'active'),
			...buildSearchConditions(query)
		];
		if (sexFilter) {
			whereClauses.push(eq(userClients.sex, sexFilter));
		}
		if (roleFilter) {
			whereClauses.push(eq(userClients.role, roleFilter));
		}

		const countResult = await this.db
			.select({
				count: sql<number>`count(*)`
			})
			.from(userClients)
			.innerJoin(users, eq(userClients.userId, users.id))
			.where(and(...whereClauses));

		const totalCount = Number(countResult[0]?.count ?? 0);
		const totalPages = totalCount > 0 ? Math.ceil(totalCount / MEMBER_PAGE_SIZE) : 1;
		const page = Math.min(requestedPage, totalPages);

		const result = totalCount
			? await this.db
					.select({
						membershipId: userClients.id,
						clientId: userClients.clientId,
						userId: users.id,
						studentId: userClients.studentId,
						firstName: users.firstName,
						lastName: users.lastName,
						email: users.email,
						sex: userClients.sex,
						role: userClients.role,
						status: userClients.status,
						createdAt: userClients.createdAt,
						updatedAt: userClients.updatedAt
					})
					.from(userClients)
					.innerJoin(users, eq(userClients.userId, users.id))
					.where(and(...whereClauses))
					.orderBy(...buildMemberOrderBy(sort, dir))
					.limit(MEMBER_PAGE_SIZE + 1)
					.offset((page - 1) * MEMBER_PAGE_SIZE)
			: [];

		const hasNextPage = result.length > MEMBER_PAGE_SIZE;
		const rows = result.slice(0, MEMBER_PAGE_SIZE).map((row) => mapMemberRow(row));

		return {
			rows,
			totalCount,
			hasNextPage,
			hasPreviousPage: page > 1,
			page
		};
	}

	async getByMembershipId(membershipId: string, clientId: string): Promise<MemberDetail | null> {
		const result = await this.db
			.select({
				membershipId: userClients.id,
				clientId: userClients.clientId,
				userId: users.id,
				studentId: userClients.studentId,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				sex: userClients.sex,
				role: userClients.role,
				status: userClients.status,
				avatarUrl: users.avatarUrl,
				cellPhone: users.cellPhone,
				createdAt: userClients.createdAt,
				updatedAt: userClients.updatedAt,
				lastLoginAt: users.lastLoginAt,
				lastActiveAt: users.lastActiveAt
			})
			.from(userClients)
			.innerJoin(users, eq(userClients.userId, users.id))
			.where(and(eq(userClients.id, membershipId), eq(userClients.clientId, clientId)))
			.limit(1);

		return result[0] ? mapMemberDetail(result[0]) : null;
	}

	async getMembershipRecord(membershipId: string, clientId: string): Promise<{
		membershipId: string;
		clientId: string;
		userId: string;
		role: MemberRole;
		status: string;
		email: string | null;
	} | null> {
		const result = await this.db
			.select({
				membershipId: userClients.id,
				clientId: userClients.clientId,
				userId: userClients.userId,
				role: userClients.role,
				status: userClients.status,
				email: users.email
			})
			.from(userClients)
			.innerJoin(users, eq(userClients.userId, users.id))
			.where(and(eq(userClients.id, membershipId), eq(userClients.clientId, clientId)))
			.limit(1);

		const row = result[0];
		if (!row) {
			return null;
		}

		return {
			...row,
			role: toMemberRole(row.role)
		};
	}

	async findActiveByStudentId(
		clientId: string,
		studentId: string,
		excludeMembershipId?: string
	): Promise<string | null> {
		const normalizedStudentId = normalizeText(studentId);
		if (!normalizedStudentId) {
			return null;
		}

		const whereClauses: SQL[] = [
			eq(userClients.clientId, clientId),
			eq(userClients.status, 'active'),
			sql`trim(${userClients.studentId}) = ${normalizedStudentId}`
		];
		if (excludeMembershipId) {
			whereClauses.push(ne(userClients.id, excludeMembershipId));
		}

		const result = await this.db
			.select({ membershipId: userClients.id })
			.from(userClients)
			.where(and(...whereClauses))
			.limit(1);

		return result[0]?.membershipId ?? null;
	}

	async updateProfile(input: {
		membershipId: string;
		clientId: string;
		email: string;
		firstName?: string | null;
		lastName?: string | null;
		studentId?: string | null;
		sex?: MemberSex | null;
		updatedUser: string | null;
	}): Promise<MemberDetail | null> {
		const membership = await this.getMembershipRecord(input.membershipId, input.clientId);
		if (!membership) {
			return null;
		}

		const now = new Date().toISOString();
		await this.db
			.update(users)
			.set({
				email: normalizeEmail(input.email),
				firstName: normalizeText(input.firstName),
				lastName: normalizeText(input.lastName),
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(eq(users.id, membership.userId));

		await this.db
			.update(userClients)
			.set({
				studentId: normalizeText(input.studentId),
				sex: input.sex ?? null,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(and(eq(userClients.id, input.membershipId), eq(userClients.clientId, input.clientId)));

		return await this.getByMembershipId(input.membershipId, input.clientId);
	}

	async updateRole(input: {
		membershipId: string;
		clientId: string;
		role: MemberAssignableRole;
		updatedUser: string | null;
	}): Promise<MemberDetail | null> {
		const now = new Date().toISOString();
		await this.db
			.update(userClients)
			.set({
				role: input.role,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(and(eq(userClients.id, input.membershipId), eq(userClients.clientId, input.clientId)));

		return await this.getByMembershipId(input.membershipId, input.clientId);
	}

	async softRemove(input: {
		membershipId: string;
		clientId: string;
		updatedUser: string | null;
	}): Promise<boolean> {
		const now = new Date().toISOString();
		const updated = await this.db
			.update(userClients)
			.set({
				status: 'inactive',
				isDefault: 0,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(userClients.id, input.membershipId),
					eq(userClients.clientId, input.clientId),
					eq(userClients.status, 'active')
				)
			)
			.returning({ membershipId: userClients.id });

		return updated.length > 0;
	}

	async countAdminLikeMembers(clientId: string, excludeMembershipId?: string): Promise<number> {
		const whereClauses: SQL[] = [
			eq(userClients.clientId, clientId),
			eq(userClients.status, 'active'),
			or(...ADMIN_LIKE_ROLES.map((role) => eq(userClients.role, role))) as SQL
		];
		if (excludeMembershipId) {
			whereClauses.push(ne(userClients.id, excludeMembershipId));
		}

		const result = await this.db
			.select({
				count: sql<number>`count(*)`
			})
			.from(userClients)
			.where(and(...whereClauses));

		return Number(result[0]?.count ?? 0);
	}

	async addOrReactivateMember(input: {
		clientId: string;
		email: string;
		role: MemberAssignableRole;
		firstName?: string | null;
		lastName?: string | null;
		studentId?: string | null;
		sex?: MemberSex | null;
		updatedUser: string | null;
	}): Promise<
		| {
				status: 'user-not-found';
		  }
		| {
				status: 'already-active';
		  }
		| {
				status: 'added' | 'reactivated';
				member: MemberDetail;
		  }
	> {
		const normalizedEmail = normalizeEmail(input.email);
		const existingUser = await this.db
			.select({
				id: users.id
			})
			.from(users)
			.where(sql`lower(trim(${users.email})) = ${normalizedEmail}`)
			.limit(1);

		const foundUserId = existingUser[0]?.id;
		if (!foundUserId) {
			return { status: 'user-not-found' };
		}

		const existingMembership = await this.db
			.select({
				membershipId: userClients.id,
				status: userClients.status
			})
			.from(userClients)
			.where(and(eq(userClients.clientId, input.clientId), eq(userClients.userId, foundUserId)))
			.limit(1);

		const now = new Date().toISOString();
		if (existingMembership[0]?.status === 'active') {
			return { status: 'already-active' };
		}

		if (existingMembership[0]) {
			await this.db
				.update(userClients)
				.set({
					role: input.role,
					status: 'active',
					studentId: normalizeText(input.studentId),
					sex: input.sex ?? null,
					updatedAt: now,
					updatedUser: input.updatedUser
				})
				.where(eq(userClients.id, existingMembership[0].membershipId));

			const member = await this.getByMembershipId(existingMembership[0].membershipId, input.clientId);
			if (!member) {
				throw new Error('MEMBER_REACTIVATION_FAILED');
			}
			return {
				status: 'reactivated',
				member
			};
		}

		const createdMembership = await this.db
			.insert(userClients)
			.values({
				id: crypto.randomUUID(),
				userId: foundUserId,
				clientId: input.clientId,
				role: input.role,
				status: 'active',
				studentId: normalizeText(input.studentId),
				sex: input.sex ?? null,
				isDefault: 0,
				createdAt: now,
				updatedAt: now,
				createdUser: input.updatedUser,
				updatedUser: input.updatedUser
			})
			.returning({ membershipId: userClients.id });

		const membershipId = createdMembership[0]?.membershipId;
		if (!membershipId) {
			throw new Error('MEMBER_CREATE_FAILED');
		}

		const member = await this.getByMembershipId(membershipId, input.clientId);
		if (!member) {
			throw new Error('MEMBER_CREATE_FAILED');
		}

		return {
			status: 'added',
			member
		};
	}
}
