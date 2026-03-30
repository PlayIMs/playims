import type { AuthRole, MemberAssignableRole } from '$lib/server/auth/permissions';

export const MEMBER_PAGE_SIZE = 50;

export type MemberSex = 'M' | 'F';
export type MemberRole = AuthRole;
export type { MemberAssignableRole };
export type MemberSortKey =
	| 'studentId'
	| 'firstName'
	| 'lastName'
	| 'email'
	| 'lastLoginAt'
	| 'sex'
	| 'role';
export type SortDirection = 'asc' | 'desc';

export interface MemberListRow {
	membershipId: string;
	userId: string;
	studentId: string | null;
	firstName: string | null;
	lastName: string | null;
	fullName: string;
	email: string | null;
	lastLoginAt: string | null;
	sex: MemberSex | null;
	role: MemberRole;
	status: string;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface MemberDetail extends MemberListRow {
	clientId: string;
	avatarUrl: string | null;
	cellPhone: string | null;
	lastLoginAt: string | null;
	lastActiveAt: string | null;
}

export interface MemberListResponse {
	success: boolean;
	data?: {
		rows: MemberListRow[];
		page: number;
		pageSize: number;
		totalCount: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		sort: MemberSortKey;
		dir: SortDirection;
		query: string;
		sexFilter: MemberSex | null;
		roleFilter: MemberRole | null;
	};
	error?: string;
}

export interface CreateMemberRequest {
	email: string;
	role: MemberAssignableRole;
	firstName: string;
	lastName: string;
	studentId: string;
	sex: MemberSex;
}

export interface CreateMemberResponse {
	success: boolean;
	data?: {
		member: MemberDetail;
		addedExistingUser: boolean;
		createdNewUser: boolean;
		reactivatedMembership: boolean;
		temporaryPassword?: string;
	};
	error?: string;
	fieldErrors?: Record<string, string[]>;
}

export interface UpdateMemberProfileRequest {
	action: 'edit-profile';
	email: string;
	firstName?: string | null;
	lastName?: string | null;
	studentId?: string | null;
	sex?: MemberSex | null;
}

export interface UpdateMemberRoleRequest {
	action: 'set-role';
	role: MemberAssignableRole;
}

export interface UpdateMemberResponse {
	success: boolean;
	data?: {
		member: MemberDetail;
		authMode?: {
			baseRole: MemberRole;
			effectiveRole: MemberRole;
			canViewAsRole: boolean;
			isViewingAsRole: boolean;
			viewAsRole: MemberRole | null;
		};
	};
	error?: string;
	fieldErrors?: Record<string, string[]>;
}
