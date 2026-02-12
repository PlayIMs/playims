import { describe, expect, it } from 'vitest';
import { handle } from '../../src/hooks.server';

const createCookies = () => {
	const jar = new Map<string, string>();
	return {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => {
			jar.set(name, value);
		},
		delete: (name: string) => {
			jar.delete(name);
		}
	};
};

const createEvent = (input: {
	pathname: string;
	method?: string;
	origin?: string;
	ip: string;
	locals?: Record<string, unknown>;
}) => {
	const method = input.method ?? 'GET';
	const url = new URL(`https://playims.test${input.pathname}`);
	const headers = new Headers();
	if (input.origin) {
		headers.set('origin', input.origin);
	}

	return {
		url,
		request: new Request(url, { method, headers }),
		cookies: createCookies(),
		locals: input.locals ?? {},
		getClientAddress: () => input.ip,
		platform: { env: {} }
	} as any;
};

const resolveOk = async () =>
	new Response('<html>ok</html>', {
		status: 200,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	});

describe('hooks security behavior', () => {
	it('rate limits form login POSTs', async () => {
		const ip = '198.51.100.61';
		for (let i = 0; i < 12; i += 1) {
			const event = createEvent({
				pathname: '/log-in',
				method: 'POST',
				origin: 'https://playims.test',
				ip
			});
			const response = await handle({ event, resolve: resolveOk });
			expect(response.status).toBe(200);
		}

		const blockedEvent = createEvent({
			pathname: '/log-in',
			method: 'POST',
			origin: 'https://playims.test',
			ip
		});
		const blockedResponse = await handle({ event: blockedEvent, resolve: resolveOk });
		expect(blockedResponse.status).toBe(429);
		expect(blockedResponse.headers.get('retry-after')).toBeTruthy();
	});

	it('rate limits form register POSTs', async () => {
		const ip = '198.51.100.62';
		for (let i = 0; i < 6; i += 1) {
			const event = createEvent({
				pathname: '/register',
				method: 'POST',
				origin: 'https://playims.test',
				ip
			});
			const response = await handle({ event, resolve: resolveOk });
			expect(response.status).toBe(200);
		}

		const blockedEvent = createEvent({
			pathname: '/register',
			method: 'POST',
			origin: 'https://playims.test',
			ip
		});
		const blockedResponse = await handle({ event: blockedEvent, resolve: resolveOk });
		expect(blockedResponse.status).toBe(429);
		expect(blockedResponse.headers.get('retry-after')).toBeTruthy();
	});

	it('adds no-store for protected SSR responses', async () => {
		const event = createEvent({
			pathname: '/dashboard',
			ip: '198.51.100.70',
			locals: {
				user: {
					id: 'u1',
					clientId: '11111111-1111-1111-1111-111111111111',
					role: 'manager'
				},
				session: {
					id: 's1',
					userId: 'u1',
					clientId: '11111111-1111-1111-1111-111111111111',
					activeClientId: '11111111-1111-1111-1111-111111111111',
					role: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('enforces role checks for dashboard SSR', async () => {
		const event = createEvent({
			pathname: '/dashboard',
			ip: '198.51.100.71',
			locals: {
				user: {
					id: 'u2',
					clientId: '22222222-2222-2222-2222-222222222222',
					role: 'player'
				},
				session: {
					id: 's2',
					userId: 'u2',
					clientId: '22222222-2222-2222-2222-222222222222',
					activeClientId: '22222222-2222-2222-2222-222222222222',
					role: 'player',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(403);
	});
});
