import { formatPhoneForDisplay } from '$lib/utils/phone-format.js';
import type { MemberListRow, MemberRole } from '$lib/members/types.js';

const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
	participant: 'Participant',
	manager: 'Manager',
	admin: 'Admin',
	dev: 'Developer'
};

export function formatMemberLastLoginForDisplay(value: string | null): string {
	if (!value) return '';
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return '';
	const date = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(parsed);
	const time = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit'
	})
		.format(parsed)
		.replace(/\s([AP]M)$/i, '$1');
	return `${date}, ${time}`;
}

export function formatMemberRowForClipboard(row: MemberListRow): string {
	return [
		row.fullName,
		row.studentId ?? '--',
		row.email ?? '--',
		formatPhoneForDisplay(row.cellPhone) || '--',
		formatMemberLastLoginForDisplay(row.lastLoginAt) || 'Never',
		row.sex ?? '--',
		MEMBER_ROLE_LABELS[row.role]
	].join('\t');
}
