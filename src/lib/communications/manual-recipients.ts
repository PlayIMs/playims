import type {
	CommunicationManualRecipientDraft,
	CommunicationManualRecipientSuggestion
} from './types.js';

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

export const filterCommunicationManualRecipientSuggestions = (
	current: CommunicationManualRecipientDraft[],
	suggestions: CommunicationManualRecipientSuggestion[]
): CommunicationManualRecipientSuggestion[] => {
	const existingKeys = new Set(
		current
			.map((recipient) => getRecipientKey(recipient))
			.filter((key) => key.length > 0)
	);

	return suggestions.filter((suggestion) => !existingKeys.has(getRecipientKey(suggestion)));
};

export type CommunicationManualRecipientKeyboardAction =
	| { type: 'none' }
	| { type: 'select-all' }
	| { type: 'clear-all' }
	| { type: 'replace-all'; value: string };

export type CommunicationManualRecipientSelectionRange = {
	anchorIndex: number;
	focusIndex: number;
};

export const getCommunicationManualRecipientKeyboardAction = (input: {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	allSelected: boolean;
}): CommunicationManualRecipientKeyboardAction => {
	const isSelectAllShortcut =
		(input.ctrlKey || input.metaKey) && !input.altKey && input.key.toLowerCase() === 'a';

	if (isSelectAllShortcut) {
		return { type: 'select-all' };
	}

	if (!input.allSelected) {
		return { type: 'none' };
	}

	if (input.key === 'Backspace' || input.key === 'Delete') {
		return { type: 'clear-all' };
	}

	if (!input.ctrlKey && !input.metaKey && !input.altKey && input.key.length === 1) {
		return { type: 'replace-all', value: input.key };
	}

	return { type: 'none' };
};

export const selectCommunicationManualRecipientRange = (
	current: CommunicationManualRecipientSelectionRange | null,
	index: number,
	extend: boolean
): CommunicationManualRecipientSelectionRange | null => {
	if (!Number.isInteger(index) || index < 0) {
		return null;
	}

	if (!extend || !current) {
		return { anchorIndex: index, focusIndex: index };
	}

	return { anchorIndex: current.anchorIndex, focusIndex: index };
};

export const moveCommunicationManualRecipientSelection = (
	current: CommunicationManualRecipientSelectionRange | null,
	direction: 1 | -1,
	itemCount: number
): CommunicationManualRecipientSelectionRange | null => {
	if (itemCount <= 0) {
		return null;
	}

	const lastIndex = itemCount - 1;
	if (!current) {
		const index = direction < 0 ? lastIndex : 0;
		return { anchorIndex: index, focusIndex: index };
	}

	const nextFocusIndex = Math.max(0, Math.min(lastIndex, current.focusIndex + direction));
	return { anchorIndex: current.anchorIndex, focusIndex: nextFocusIndex };
};

export const getCommunicationManualRecipientSelectionIndices = (
	current: CommunicationManualRecipientSelectionRange | null,
	itemCount: number
): number[] => {
	if (!current || itemCount <= 0) {
		return [];
	}

	const startIndex = Math.max(0, Math.min(current.anchorIndex, current.focusIndex));
	const endIndex = Math.min(itemCount - 1, Math.max(current.anchorIndex, current.focusIndex));
	return Array.from({ length: endIndex - startIndex + 1 }, (_, index) => startIndex + index);
};
