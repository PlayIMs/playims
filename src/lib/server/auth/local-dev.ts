import type { RequestEvent } from '@sveltejs/kit';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOCALHOST_SUFFIX = '.localhost';

export const LOCAL_DEV_USERNAME = 'dev';
export const LOCAL_DEV_PASSWORD = 'dev';

export const isLocalhostHostname = (hostname: string): boolean => {
	const normalized = hostname.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	if (LOCALHOST_HOSTNAMES.has(normalized)) {
		return true;
	}

	return normalized.endsWith(LOCALHOST_SUFFIX);
};

export const isLocalhostRequest = (event: Pick<RequestEvent, 'url'>): boolean =>
	isLocalhostHostname(event.url.hostname);

export const isLocalDevCredentialPair = (
	username: string | null | undefined,
	password: string | null | undefined
): boolean => username?.trim() === LOCAL_DEV_USERNAME && password?.trim() === LOCAL_DEV_PASSWORD;
