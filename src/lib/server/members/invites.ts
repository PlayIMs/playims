const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

const toBase64Url = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');

export const generateMemberInviteToken = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return toBase64Url(bytes);
};

export const hashMemberInviteToken = async (token: string): Promise<string> => {
	const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token));
	return toHex(new Uint8Array(digest));
};

export const getMemberInviteExpiryIso = (days = 7): string =>
	new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export const buildMemberInviteUrl = (origin: string, token: string): string =>
	`${origin.replace(/\/+$/, '')}/accept-member-invite/${encodeURIComponent(token)}`;
