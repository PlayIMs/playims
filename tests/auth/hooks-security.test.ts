/*
Brief description:
This file verifies the security decisions made by the main server hook.

Deeper explanation:
The server hook is a central policy layer for rate limiting, cache headers, authentication, and
role enforcement. A regression there can affect many routes at once, so these tests focus on the
high-risk branches that decide who can reach protected pages and APIs. The small event helpers keep
the tests readable while still exercising the real hook implementation.

Summary of tests:
1. It verifies that repeated login posts are rate limited.
2. It verifies that repeated registration posts are rate limited.
3. It verifies that protected SSR responses receive no-store cache headers.
4. It verifies that SSR request logging redacts invite tokens from both paths and query values.
5. It verifies that nonce-based CSP responses add the nonce to inline SSR script tags.
6. It verifies that participant users can still reach participant-safe dashboard SSR routes.
7. It verifies that participant users are blocked from restricted dashboard SSR routes.
8. It verifies that developer users can still reach protected dashboard SSR routes.
9. It verifies that read-only API access can use the base role during participant view mode.
10. It verifies that mutating API access is blocked by the effective participant role during view mode.
11. It verifies that the join-client API route requires authentication.
*/

import { describe, expect, it, vi } from 'vitest';
import { handle } from '../../src/hooks.server';

const createCookies = () => {
	// this in-memory cookie jar is enough for hook tests because they only need get/set/delete behavior.
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
	// centralizing event creation keeps each test focused on the policy branch it is proving.
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

// this acts like a successful downstream response so the hook behavior itself stays under test.
const resolveOk = async () =>
	new Response('<html>ok</html>', {
		status: 200,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	});

describe('hooks security behavior', () => {
	it('rate limits form login POSTs', async () => {
		// the loop burns through the allowed request budget so the final request proves the limiter trips.
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
		// registration uses a different threshold, so it needs its own dedicated regression check.
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
		// this authenticated dashboard request proves the hook adds security headers even on success.
		const event = createEvent({
			pathname: '/dashboard',
			ip: '198.51.100.70',
			locals: {
				user: {
					id: 'u1',
					clientId: '11111111-1111-1111-1111-111111111111',
					role: 'manager',
					baseRole: 'manager'
				},
				session: {
					id: 's1',
					userId: 'u1',
					clientId: '11111111-1111-1111-1111-111111111111',
					activeClientId: '11111111-1111-1111-1111-111111111111',
					role: 'manager',
					baseRole: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
	});

	it('redacts invite tokens from SSR request logs', async () => {
		// both the tokenized path and any nested redirect back to that path should be scrubbed in logs.
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		try {
			const event = createEvent({
				pathname:
					'/accept-member-invite/super-secret-token?next=%2Faccept-member-invite%2Fsuper-secret-token&token=another-secret',
				ip: '198.51.100.78'
			});

			const response = await handle({ event, resolve: resolveOk });
			expect(response.status).toBe(200);

			const logOutput = infoSpy.mock.calls.flat().join(' ');
			expect(logOutput).toContain('/accept-member-invite/[redacted]');
			expect(logOutput).toContain('next=%2Faccept-member-invite%2F%5Bredacted%5D');
			expect(logOutput).toContain('token=%5Bredacted%5D');
			expect(logOutput).not.toContain('super-secret-token');
			expect(logOutput).not.toContain('another-secret');
		} finally {
			infoSpy.mockRestore();
		}
	});

	it('adds the csp nonce to inline SSR script tags when the response already includes nonce-based csp', async () => {
		// sveltekit can emit a nonce-based csp header, but manual inline scripts in route head content do not
		// automatically receive that nonce. this regression test locks in the server-side html rewrite.
		const event = createEvent({
			pathname: '/',
			ip: '198.51.100.79'
		});

		const response = await handle({
			event,
			resolve: async () =>
				new Response(
					[
						'<html><head>',
						'<script>window.inlineTheme=true;</script>',
						'<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
						'<script src="/app.js"></script>',
						'<script nonce="already-there">window.keepNonce=true;</script>',
						'</head><body>ok</body></html>'
					].join(''),
					{
						status: 200,
						headers: {
							'content-type': 'text/html; charset=utf-8',
							'content-security-policy':
								"default-src 'self'; script-src 'self' 'nonce-test-nonce'; style-src 'self' 'unsafe-inline'"
						}
					}
				)
		});

		const html = await response.text();
		expect(html).toContain('<script nonce="test-nonce">window.inlineTheme=true;</script>');
		expect(html).toContain(
			'<script nonce="test-nonce" type="application/ld+json">{"@context":"https://schema.org"}</script>'
		);
		expect(html).toContain('<script src="/app.js"></script>');
		expect(html).toContain('<script nonce="already-there">window.keepNonce=true;</script>');
	});

	it('allows participant users on participant-safe dashboard SSR routes', async () => {
		// the root dashboard is the safe landing page for a real participant membership.
		const event = createEvent({
			pathname: '/dashboard',
			ip: '198.51.100.71',
			locals: {
				user: {
					id: 'u2',
					clientId: '22222222-2222-2222-2222-222222222222',
					role: 'participant',
					baseRole: 'participant'
				},
				session: {
					id: 's2',
					userId: 'u2',
					clientId: '22222222-2222-2222-2222-222222222222',
					activeClientId: '22222222-2222-2222-2222-222222222222',
					role: 'participant',
					baseRole: 'participant',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(200);
	});

	it('blocks participant users from restricted dashboard SSR routes', async () => {
		// participant memberships should still be denied from management pages like settings.
		const event = createEvent({
			pathname: '/dashboard/settings',
			ip: '198.51.100.72',
			locals: {
				user: {
					id: 'u2',
					clientId: '22222222-2222-2222-2222-222222222222',
					role: 'participant',
					baseRole: 'participant'
				},
				session: {
					id: 's2',
					userId: 'u2',
					clientId: '22222222-2222-2222-2222-222222222222',
					activeClientId: '22222222-2222-2222-2222-222222222222',
					role: 'participant',
					baseRole: 'participant',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(403);
	});

	it('allows dashboard SSR for dev role', async () => {
		// this guards the elevated-role allowlist so future auth changes do not lock out developers.
		const event = createEvent({
			pathname: '/dashboard',
			ip: '198.51.100.80',
			locals: {
				user: {
					id: 'u3',
					clientId: '33333333-3333-4333-8333-333333333333',
					role: 'dev',
					baseRole: 'dev'
				},
				session: {
					id: 's3',
					userId: 'u3',
					clientId: '33333333-3333-4333-8333-333333333333',
					activeClientId: '33333333-3333-4333-8333-333333333333',
					role: 'dev',
					baseRole: 'dev',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(200);
	});

	it('allows role-protected API reads using base role during participant view mode', async () => {
		// read access should follow the stronger base role so safe data fetches still work in view-as mode.
		const event = createEvent({
			pathname: '/api/themes',
			method: 'GET',
			ip: '198.51.100.81',
			locals: {
				user: {
					id: 'u4',
					clientId: '44444444-4444-4444-8444-444444444444',
					role: 'participant',
					baseRole: 'manager'
				},
				session: {
					id: 's4',
					userId: 'u4',
					clientId: '44444444-4444-4444-8444-444444444444',
					activeClientId: '44444444-4444-4444-8444-444444444444',
					role: 'participant',
					baseRole: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(200);
	});

	it('blocks mutating role-protected API calls using effective participant role during participant view mode', async () => {
		// writes should follow the effective role instead, which prevents view-as mode from bypassing
		// mutating route protections.
		const event = createEvent({
			pathname: '/api/themes',
			method: 'POST',
			origin: 'https://playims.test',
			ip: '198.51.100.82',
			locals: {
				user: {
					id: 'u5',
					clientId: '55555555-5555-4555-8555-555555555555',
					role: 'participant',
					baseRole: 'manager'
				},
				session: {
					id: 's5',
					userId: 'u5',
					clientId: '55555555-5555-4555-8555-555555555555',
					activeClientId: '55555555-5555-4555-8555-555555555555',
					role: 'participant',
					baseRole: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(403);
	});

	it('requires authentication for join-client API route', async () => {
		// this covers a protected auth route directly to prove the hook rejects anonymous callers early.
		const event = createEvent({
			pathname: '/api/auth/join-client',
			method: 'POST',
			origin: 'https://playims.test',
			ip: '198.51.100.72',
			locals: {}
		});

		const response = await handle({ event, resolve: resolveOk });
		expect(response.status).toBe(401);
	});
});
