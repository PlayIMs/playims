import { dev } from '$app/environment';
import {
	getApiTableFromPath,
	getErrorFromPayload,
	getRecordCountFromPayload,
	logRequestSummary,
	nowMs
} from '$lib/server/request-logger';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Handle Chrome DevTools project settings request
	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response('Go away, Chrome DevTools!', { status: 404 });
	}

	if (!event.url.pathname.startsWith('/api/')) {
		return resolve(event);
	}

	const startedAt = nowMs();
	const method = event.request.method;
	const endpoint = `${event.url.pathname}${event.url.search}`;
	const table = getApiTableFromPath(event.url.pathname);

	try {
		const response = await resolve(event);
		let recordCount: number | null = response.status === 304 ? 0 : null;
		let errorMessage: string | null = null;
		const contentType = response.headers.get('content-type') ?? '';

		if (contentType.includes('application/json') && response.status !== 304) {
			try {
				const payload = (await response.clone().json()) as unknown;
				recordCount = getRecordCountFromPayload(payload);
				errorMessage = getErrorFromPayload(payload);
			} catch {
				recordCount = null;
			}
		}

		if (recordCount === null && response.status >= 400) {
			recordCount = 0;
		}

		logRequestSummary({
			method,
			endpoint,
			table,
			recordCount,
			status: response.status,
			durationMs: nowMs() - startedAt,
			error: errorMessage
		});

		return response;
	} catch (error) {
		logRequestSummary({
			method,
			endpoint,
			table,
			recordCount: 0,
			status: 500,
			durationMs: nowMs() - startedAt,
			error: error instanceof Error ? error.message : 'Unhandled API error'
		});

		throw error;
	}
};
