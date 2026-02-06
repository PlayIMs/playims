const ANSI = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	gray: '\x1b[90m',
	blue: '\x1b[94m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m',
	white: '\x1b[97m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m'
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
	month: 'short',
	day: '2-digit',
	year: 'numeric',
	hour: '2-digit',
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

	const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
	return `${get('month')} ${get('day')}, ${get('year')} ${get('hour')}:${get('minute')}:${get('second')}.${milliseconds} ${get('dayPeriod')}`;
};

const statusColor = (status: number) => {
	if (status >= 500) {
		return ANSI.red;
	}
	if (status >= 400) {
		return ANSI.yellow;
	}
	return ANSI.green;
};

const methodColor = (method: string) => {
	switch (method.toUpperCase()) {
		case 'GET':
			return ANSI.cyan;
		case 'POST':
			return ANSI.green;
		case 'PUT':
		case 'PATCH':
			return ANSI.yellow;
		case 'DELETE':
			return ANSI.red;
		default:
			return ANSI.white;
	}
};

const isSuccessStatus = (status: number) => status >= 200 && status < 400;

export const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const getApiTableFromPath = (pathname: string) => {
	const segments = pathname.split('/').filter(Boolean);
	const resource = segments[1] ?? 'unknown';
	return resource.replace(/-/g, '_');
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
	const line =
		`${ANSI.gray}${formatTimestamp(now)}${ANSI.reset} ` +
		`${ANSI.blue}[${scope}]${ANSI.reset} ` +
		`${statusColor(status)}${outcome}${ANSI.reset} ` +
		`${methodColor(method)}${methodLabel}${ANSI.reset} ` +
		`${ANSI.magenta}${route}${ANSI.reset} ` +
		`${ANSI.dim}|${ANSI.reset} ` +
		`${ANSI.dim}table${ANSI.reset}=${ANSI.bold}${table}${ANSI.reset} ` +
		`${ANSI.dim}rows${ANSI.reset}=${ANSI.bold}${rows}${ANSI.reset} ` +
		`${ANSI.dim}status${ANSI.reset}=${ANSI.bold}${status}${ANSI.reset} ` +
		`${ANSI.dim}dur${ANSI.reset}=${ANSI.bold}${formatDuration(durationMs)}${ANSI.reset}` +
		(cleanedError ? ` ${ANSI.dim}err${ANSI.reset}="${cleanedError}"` : '');

	if (isSuccessStatus(status)) {
		console.info(line);
		return;
	}

	console.error(line);
};
