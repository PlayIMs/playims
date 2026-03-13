export const MEMBER_PAGE_SIZE = 50;
export const MEMBER_INVITE_PAGE_SIZE = 10;

export type MemberSex = 'M' | 'F';
export type MemberAssignableRole = 'participant' | 'manager' | 'admin';
export type MemberRole = MemberAssignableRole | 'dev';
export type MemberSortKey = 'studentId' | 'firstName' | 'lastName' | 'email' | 'sex' | 'role';
export type SortDirection = 'asc' | 'desc';
export type MemberInviteMode = 'invite' | 'preprovision';
export type MemberInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type AcceptMemberInviteAccountMode = 'new-account' | 'existing-account';

export interface MemberListRow {
	membershipId: string;
	userId: string;
	studentId: string | null;
	firstName: string | null;
	lastName: string | null;
	fullName: string;
	email: string | null;
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
	invitePending: boolean;
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

export interface PendingInviteRow {
	inviteId: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	studentId: string | null;
	sex: MemberSex | null;
	role: MemberAssignableRole;
	mode: MemberInviteMode;
	status: MemberInviteStatus;
	expiresAt: string;
	createdAt: string;
}

export interface PendingInviteListResponse {
	success: boolean;
	data?: {
		rows: PendingInviteRow[];
		pageSize: number;
	};
	error?: string;
}

export interface CreateMemberRequest {
	mode: MemberInviteMode;
	email: string;
	role: MemberAssignableRole;
	firstName?: string | null;
	lastName?: string | null;
	studentId?: string | null;
	sex?: MemberSex | null;
}

export interface CreateMemberResponse {
	success: boolean;
	data?: {
		member?: MemberListRow;
		invite?: PendingInviteRow & {
			inviteUrl: string;
		};
		addedExistingUser: boolean;
		reactivatedMembership: boolean;
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

export interface AcceptMemberInviteRequest {
	token: string;
	password?: string;
	confirmPassword?: string;
	firstName?: string | null;
	lastName?: string | null;
}

export interface AcceptMemberInvitePreview {
	clientName: string;
	clientSlug: string | null;
	email: string;
	firstName: string | null;
	lastName: string | null;
	studentId: string | null;
	sex: MemberSex | null;
	role: MemberAssignableRole;
	mode: MemberInviteMode;
	expiresAt: string;
	accountMode: AcceptMemberInviteAccountMode;
}
