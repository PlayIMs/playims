const ANSI = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	gray: '\x1b[90m',
	brightBlue: '\x1b[94m',
	brightMagenta: '\x1b[95m',
	brightCyan: '\x1b[96m',
	brightGreen: '\x1b[92m',
	brightYellow: '\x1b[93m',
	brightRed: '\x1b[91m',
	brightWhite: '\x1b[97m',
	blue: '\x1b[94m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m',
	white: '\x1b[97m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	teal: '\x1b[38;5;45m',
	orange: '\x1b[38;5;214m',
	violet: '\x1b[38;5;141m',
	lime: '\x1b[38;5;118m',
	rose: '\x1b[38;5;205m'
};

type RequestLogScope = 'API' | 'SSR';

type RequestSummaryLog = {
	scope?: RequestLogScope;
	method: string;
	endpoint?: string;
	table: string;
	recordCount: number | null;
	status: number;
	durationMs: number;
	error?: string | null;
};

const friendlyTimestampFormatter = new Intl.DateTimeFormat('en-US', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	second: '2-digit',
	hour12: true
});

const toFiniteCount = (value: unknown): number | null => {
	if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
		return null;
	}

	return Math.max(0, value);
};

const cleanForSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

const formatDuration = (durationMs: number) => `${durationMs.toFixed(durationMs < 100 ? 1 : 0)}ms`;

const formatMethod = (method: string) => method.toUpperCase().padEnd(6, ' ');

const formatTimestamp = (date: Date) => {
	const parts = friendlyTimestampFormatter.formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${get('day')} ${get('month')} ${get('year')} ${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod').toUpperCase()}`;
};

const statusColor = (status: number) => {
	if (status >= 500) {
		return ANSI.brightRed;
	}
	if (status >= 400) {
		return ANSI.brightYellow;
	}
	return ANSI.brightGreen;
};

const methodColor = (method: string) => {
	switch (method.toUpperCase()) {
		case 'GET':
			return ANSI.brightCyan;
		case 'POST':
			return ANSI.brightGreen;
		case 'PUT':
		case 'PATCH':
			return ANSI.brightYellow;
		case 'DELETE':
			return ANSI.brightRed;
		default:
			return ANSI.brightWhite;
	}
};

const isSuccessStatus = (status: number) => status >= 200 && status < 400;

export const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const getApiTableFromPath = (pathname: string) => {
	const segments = pathname.split('/').filter(Boolean);
	const resource = segments[1] ?? 'unknown';
	return resource.replace(/-/g, '_');
};

export const isSsrDataRequestPath = (pathname: string) => pathname.endsWith('/__data.json');

export const getSsrTableFromPath = (pathname: string) => {
	const normalized = pathname.replace(/\/__data\.json$/, '');
	const segments = normalized.split('/').filter(Boolean);
	if (segments.length === 0) {
		return 'root';
	}

	return segments.join('_').replace(/-/g, '_');
};

export const isStaticAssetRequestPath = (pathname: string) => {
	if (isSsrDataRequestPath(pathname)) {
		return false;
	}
	if (pathname.startsWith('/_app/')) {
		return true;
	}

	const lastSegment = pathname.split('/').filter(Boolean).at(-1) ?? '';
	return /\.[a-z0-9]{2,8}$/i.test(lastSegment);
};

export const getRecordCountFromPayload = (payload: unknown): number | null => {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const body = payload as Record<string, unknown>;
	const explicitCount = toFiniteCount(body.count);
	if (explicitCount !== null) {
		return explicitCount;
	}

	if (!Object.hasOwn(body, 'data')) {
		return null;
	}

	const { data } = body;
	if (Array.isArray(data)) {
		return data.length;
	}

	if (data === null || typeof data === 'undefined') {
		return 0;
	}

	return 1;
};

export const getErrorFromPayload = (payload: unknown): string | null => {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const errorValue = (payload as Record<string, unknown>).error;
	if (typeof errorValue !== 'string') {
		return null;
	}

	const cleaned = cleanForSingleLine(errorValue);
	return cleaned.length > 0 ? cleaned : null;
};

export const logRequestSummary = ({
	scope = 'API',
	method,
	endpoint,
	table,
	recordCount,
	status,
	durationMs,
	error
}: RequestSummaryLog) => {
	const outcome = isSuccessStatus(status) ? 'OK ' : 'ERR';
	const rows = recordCount === null ? 'n/a' : String(recordCount);
	const route = endpoint ? cleanForSingleLine(endpoint) : 'n/a';
	const now = new Date();
	const methodLabel = formatMethod(method);
	const cleanedError = error ? cleanForSingleLine(error) : null;
	const scopeColor = scope === 'API' ? ANSI.teal : ANSI.violet;
	const statusLabelColor = statusColor(status);
	const keyColor = ANSI.orange;
	const line =
		`${ANSI.gray}${formatTimestamp(now)}${ANSI.reset} ` +
		`${scopeColor}${ANSI.bold}[${scope}]${ANSI.reset} ` +
		`${statusLabelColor}${ANSI.bold}${outcome}${ANSI.reset} ` +
		`${methodColor(method)}${ANSI.bold}${methodLabel}${ANSI.reset} ` +
		`${ANSI.rose}${route}${ANSI.reset} ` +
		`${ANSI.dim}|${ANSI.reset} ` +
		`${keyColor}table${ANSI.reset}=${ANSI.brightBlue}${ANSI.bold}${table}${ANSI.reset} ` +
		`${keyColor}rows${ANSI.reset}=${ANSI.lime}${ANSI.bold}${rows}${ANSI.reset} ` +
		`${keyColor}status${ANSI.reset}=${statusLabelColor}${ANSI.bold}${status}${ANSI.reset} ` +
		`${keyColor}dur${ANSI.reset}=${ANSI.brightWhite}${ANSI.bold}${formatDuration(durationMs)}${ANSI.reset}` +
		(cleanedError
			? ` ${ANSI.brightRed}${ANSI.bold}err${ANSI.reset}="${ANSI.brightYellow}${cleanedError}${ANSI.reset}"`
			: '');

	if (isSuccessStatus(status)) {
		console.info(line);
		return;
	}

	console.error(line);
};
