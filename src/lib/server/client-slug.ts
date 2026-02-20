const RESERVED_CLIENT_SLUGS = new Set([
	'api',
	'dashboard',
	'log-in',
	'register',
	'schedule',
	'colors',
	'offline',
	'_app',
	'favicon.ico',
	'robots.txt',
	'sitemap.xml'
]);

export const normalizeClientSlug = (value: string | null | undefined): string => {
	if (!value) {
		return '';
	}

	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
};

export const isReservedClientSlug = (value: string | null | undefined): boolean => {
	const normalized = normalizeClientSlug(value);
	return normalized.length > 0 && RESERVED_CLIENT_SLUGS.has(normalized);
};

export const CLIENT_SLUG_VALIDATION_ERROR = {
	EMPTY: 'CLIENT_SLUG_REQUIRED',
	RESERVED: 'CLIENT_SLUG_RESERVED',
	INVALID_FORMAT: 'CLIENT_SLUG_INVALID'
} as const;

export const validateClientSlug = (
	value: string | null | undefined
):
	| { ok: true; slug: string }
	| { ok: false; code: (typeof CLIENT_SLUG_VALIDATION_ERROR)[keyof typeof CLIENT_SLUG_VALIDATION_ERROR] } => {
	const trimmed = value?.trim() ?? '';
	if (trimmed.length === 0) {
		return { ok: false, code: CLIENT_SLUG_VALIDATION_ERROR.EMPTY };
	}

	const normalized = normalizeClientSlug(trimmed);
	if (normalized.length === 0) {
		return { ok: false, code: CLIENT_SLUG_VALIDATION_ERROR.INVALID_FORMAT };
	}

	if (isReservedClientSlug(normalized)) {
		return { ok: false, code: CLIENT_SLUG_VALIDATION_ERROR.RESERVED };
	}

	return { ok: true, slug: normalized };
};

export const RESERVED_CLIENT_SLUG_VALUES = [...RESERVED_CLIENT_SLUGS];
