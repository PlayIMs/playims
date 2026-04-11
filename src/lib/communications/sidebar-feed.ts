import type { CommunicationMessageSummary } from '$lib/communications/types.js';

export type CommunicationSidebarFeedItemKind = 'draft' | 'scheduled' | 'history';
export type CommunicationSidebarView = 'drafts' | 'scheduled' | 'history';

export interface CommunicationSidebarFeedItem {
	kind: CommunicationSidebarFeedItemKind;
	message: CommunicationMessageSummary;
	primaryDate: string | null;
}

function normalizeOptionalDate(value: string | null | undefined): string | null {
	const normalized = value?.trim() ?? '';
	return normalized || null;
}

function toDateMs(value: string | null | undefined): number | null {
	const normalized = normalizeOptionalDate(value);
	if (!normalized) {
		return null;
	}

	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function getCommunicationScheduledAt(message: CommunicationMessageSummary): string | null {
	return normalizeOptionalDate(message.scheduledAt);
}

export function getCommunicationHistoryAt(message: CommunicationMessageSummary): string | null {
	return (
		normalizeOptionalDate(message.sentAt) ??
		normalizeOptionalDate(message.updatedAt) ??
		normalizeOptionalDate(message.createdAt)
	);
}

function isScheduledMessage(message: CommunicationMessageSummary, nowMs: number): boolean {
	if (message.status === 'scheduled') {
		return true;
	}

	const scheduledAtMs = toDateMs(message.scheduledAt);
	return scheduledAtMs !== null && scheduledAtMs > nowMs;
}

export function getCommunicationSidebarItemKind(
	message: CommunicationMessageSummary,
	now: Date = new Date()
): CommunicationSidebarFeedItemKind {
	if (message.status === 'draft') {
		return 'draft';
	}

	if (isScheduledMessage(message, now.getTime())) {
		return 'scheduled';
	}

	return 'history';
}

export function getCommunicationSidebarViewFromStatus(
	status: CommunicationMessageSummary['status'] | null | undefined
): CommunicationSidebarView {
	if (status === 'draft') {
		return 'drafts';
	}

	if (status === 'scheduled') {
		return 'scheduled';
	}

	return 'history';
}

export function getPreferredCommunicationSidebarView(
	messages: CommunicationMessageSummary[],
	now: Date = new Date()
): CommunicationSidebarView {
	for (const message of messages) {
		if (getCommunicationSidebarItemKind(message, now) === 'draft') {
			return 'drafts';
		}
	}

	for (const message of messages) {
		if (getCommunicationSidebarItemKind(message, now) === 'scheduled') {
			return 'scheduled';
		}
	}

	return 'history';
}

export function buildCommunicationSidebarFeed(
	messages: CommunicationMessageSummary[],
	now: Date = new Date()
): CommunicationSidebarFeedItem[] {
	return messages
		.map((message) => {
			const kind = getCommunicationSidebarItemKind(message, now);

			return {
				kind,
				message,
				primaryDate:
					kind === 'scheduled'
						? getCommunicationScheduledAt(message)
						: getCommunicationHistoryAt(message)
			} satisfies CommunicationSidebarFeedItem;
		})
		.sort((left, right) => {
			if (left.kind !== right.kind) {
				const kindRank: Record<CommunicationSidebarFeedItemKind, number> = {
					draft: 0,
					scheduled: 1,
					history: 2
				};
				return kindRank[left.kind] - kindRank[right.kind];
			}

			const leftMs = toDateMs(left.primaryDate);
			const rightMs = toDateMs(right.primaryDate);

			if (left.kind === 'scheduled') {
				if (leftMs !== null && rightMs !== null && leftMs !== rightMs) {
					return leftMs - rightMs;
				}
				if (leftMs !== null) return -1;
				if (rightMs !== null) return 1;
			} else {
				if (leftMs !== null && rightMs !== null && leftMs !== rightMs) {
					return rightMs - leftMs;
				}
				if (leftMs !== null) return -1;
				if (rightMs !== null) return 1;
			}

			return left.message.subject.localeCompare(right.message.subject);
		});
}
