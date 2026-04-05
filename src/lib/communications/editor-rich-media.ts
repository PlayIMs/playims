const COMMUNICATION_EDITOR_MAX_TABLE_COLUMNS = 8;
const COMMUNICATION_EDITOR_MAX_TABLE_ROWS = 8;

export interface CommunicationEditorImageInput {
	src?: string | null;
	alt?: string | null;
	title?: string | null;
}

export interface CommunicationEditorImageAttributes {
	src: string;
	alt?: string;
	title?: string;
}

export interface CommunicationEditorImageFileLike {
	type?: string | null;
}

export interface CommunicationEditorTableConfigInput {
	rows?: number | null;
	cols?: number | null;
	withHeaderRow?: boolean | null;
}

export interface CommunicationEditorTableConfig {
	rows: number;
	cols: number;
	withHeaderRow: boolean;
}

const normalizeOptionalText = (value?: string | null): string | undefined => {
	const normalized = value?.trim() ?? '';
	return normalized || undefined;
};

const clampInteger = (value: number | null | undefined, min: number, max: number): number => {
	const fallbackValue = Number.isFinite(value) ? Math.trunc(value as number) : min;
	return Math.min(Math.max(fallbackValue, min), max);
};

export const normalizeCommunicationEditorUrl = (value?: string | null): string | null => {
	const normalized = value?.trim() ?? '';
	if (!normalized) {
		return null;
	}

	if (/^(https?:\/\/|mailto:|tel:)/i.test(normalized)) {
		return /^(javascript:|data:)/i.test(normalized) ? null : normalized;
	}

	if (/^\/\//.test(normalized)) {
		return `https:${normalized}`;
	}

	if (/^(javascript:|data:)/i.test(normalized)) {
		return null;
	}

	if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(normalized)) {
		return `https://${normalized}`;
	}

	return null;
};

export const normalizeCommunicationEditorImageAttributes = (
	input: CommunicationEditorImageInput
): CommunicationEditorImageAttributes | null => {
	const src = normalizeCommunicationEditorUrl(input.src);
	if (!src || !/^https?:\/\//i.test(src)) {
		return null;
	}

	return {
		src,
		alt: normalizeOptionalText(input.alt),
		title: normalizeOptionalText(input.title)
	};
};

export const isCommunicationEditorImageFile = (
	file: CommunicationEditorImageFileLike | null | undefined
): boolean => {
	const mimeType = file?.type?.trim() ?? '';
	return /^image\//i.test(mimeType);
};

export const buildCommunicationEditorTableConfig = (
	input: CommunicationEditorTableConfigInput
): CommunicationEditorTableConfig => ({
	rows: clampInteger(input.rows, 1, COMMUNICATION_EDITOR_MAX_TABLE_ROWS),
	cols: clampInteger(input.cols, 1, COMMUNICATION_EDITOR_MAX_TABLE_COLUMNS),
	withHeaderRow: input.withHeaderRow ?? true
});
