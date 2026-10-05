/*
Brief description:
This file verifies the generated and fallback HTML content security policies.

Deeper explanation:
The dashboard applies a shared HTML Content Security Policy from the main server hook. In local Vite
development, the browser needs a slightly different policy so the dev client can use its worker and
live-reload connection. These tests protect that policy builder directly so future tightening of the
CSP does not accidentally break local development again. SvelteKit normally supplies the production
header before the hook runs, so its configuration must also permit the app's inline theme and toast
styles while continuing to restrict scripts.

Summary of tests:
1. It verifies that the production HTML CSP keeps strict self-only worker and connect sources.
2. It verifies that the development HTML CSP allows Vite worker blobs and websocket-style connects.
3. It verifies that the production configuration allows UI styles without allowing inline scripts.
*/

import { describe, expect, it } from 'vitest';

import { buildHtmlContentSecurityPolicy } from '../../src/hooks.server';
import config from '../../svelte.config.js';

describe('hooks html content security policy', () => {
	it('allows production theme and toast styles while preserving script restrictions', () => {
		// check the actual renderer configuration because the hook leaves existing csp headers intact.
		const directives = config.kit.csp.directives;
		expect(directives['style-src']).toEqual([
			'self',
			'unsafe-inline',
			'https://fonts.googleapis.com'
		]);
		expect(directives['script-src']).toEqual(['self']);
		expect(directives['connect-src']).toEqual(['self']);
		expect(directives['worker-src']).toEqual(['self']);
		expect(buildHtmlContentSecurityPolicy(false)).toContain(
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
		);
	});

	it('keeps production html csp strict', () => {
		// production should stay locked down to self for workers and connections unless we explicitly widen it.
		const csp = buildHtmlContentSecurityPolicy(false);

		expect(csp).toContain("connect-src 'self'");
		expect(csp).toContain("worker-src 'self'");
		expect(csp).not.toContain("worker-src 'self' blob:");
		expect(csp).not.toContain('ws:');
	});

	it('allows vite dev worker and hmr connections in development', () => {
		// vite dev uses a blob worker and websocket/http connections during dependency optimization and hmr.
		const csp = buildHtmlContentSecurityPolicy(true);

		expect(csp).toContain("connect-src 'self' ws: wss: http: https:");
		expect(csp).toContain("worker-src 'self' blob:");
	});
});
