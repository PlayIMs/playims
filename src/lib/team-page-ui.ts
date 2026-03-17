export interface LocalChatMessage {
	id: string;
	sender: string;
	text: string;
	createdAtIso: string;
}

function normalizeStatus(status: string | null | undefined): string {
	return (status ?? '').trim().toLowerCase();
}

export function isPendingInvitationStatus(status: string | null | undefined): boolean {
	const normalized = normalizeStatus(status);
	return normalized.includes('pending') || normalized.includes('invite');
}

export function summarizeTeamRosterCounts(
	statuses: Array<string | null | undefined>
): { totalRosterPlayers: number; pendingInvitations: number } {
	let totalRosterPlayers = 0;
	let pendingInvitations = 0;

	for (const status of statuses) {
		if (isPendingInvitationStatus(status)) {
			pendingInvitations += 1;
			continue;
		}
		totalRosterPlayers += 1;
	}

	return { totalRosterPlayers, pendingInvitations };
}

export function createLocalChatMessage(
	rawMessage: string,
	options?: {
		id?: string;
		sender?: string;
		createdAtIso?: string;
	}
): LocalChatMessage | null {
	const text = rawMessage.trim();
	if (!text) return null;

	return {
		id: options?.id ?? crypto.randomUUID(),
		sender: options?.sender ?? 'You',
		text,
		createdAtIso: options?.createdAtIso ?? new Date().toISOString()
	};
}
