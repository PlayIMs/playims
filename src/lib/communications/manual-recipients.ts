import type { CommunicationManualRecipientDraft } from './types.js';

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? '';
const normalizeEmail = (value: string | null | undefined): string => normalizeText(value).toLowerCase();

const getRecipientKey = (recipient: CommunicationManualRecipientDraft): string =>
	normalizeText(recipient.userId) || normalizeEmail(recipient.email);

export const splitCommunicationManualRecipientInput = (value: string): {
	tokens: string[];
	remainder: string;
} => {
	const parts = value.split(/[,\n]/);
	const endsWithDelimiter = /[,\n]\s*$/.test(value);
	const committedParts = endsWithDelimiter ? parts : parts.slice(0, -1);
	const remainder = endsWithDelimiter ? '' : (parts.at(-1) ?? '');

	return {
		tokens: committedParts.map((part) => normalizeText(part)).filter((part) => part.length > 0),
		remainder
	};
};

export const mergeCommunicationManualRecipients = (
	current: CommunicationManualRecipientDraft[],
	incoming: CommunicationManualRecipientDraft[]
): CommunicationManualRecipientDraft[] => {
	const merged = new Map<string, CommunicationManualRecipientDraft>();

	for (const recipient of [...current, ...incoming]) {
		const key = getRecipientKey(recipient);
		if (!key || merged.has(key)) {
			continue;
		}

		merged.set(key, {
			userId: normalizeText(recipient.userId) || null,
			email: normalizeEmail(recipient.email),
			fullName: normalizeText(recipient.fullName)
		});
	}

	return Array.from(merged.values());
};
