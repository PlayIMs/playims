/*
Brief description:
This file verifies the shared client-side redirect that handles expired authenticated sessions.

Deeper explanation:
The app uses many independent fetch calls and unsaved-change guards, so this behavior has to live
in one shared helper instead of being copied into every page. These tests prove the helper sends
users to the login screen with the current page preserved in `next`, and that it clears local
beforeunload guards first so the browser does not stop the redirect with a confirmation prompt.

Summary of tests:
1. It builds a login redirect URL that preserves the current pathname, search, and hash.
2. It redirects same-origin 401 responses to the login page and removes beforeunload handlers.
3. It leaves successful responses alone.
4. It ignores 401 responses from other origins.
*/

import { describe, expect, it, vi } from 'vitest';
import {
	buildLoginRedirectHref,
	installAuthSessionRedirect,
	type AuthSessionRedirectWindowLike
} from '../../src/lib/client/auth-session-redirect';

const createWindowLike = (
	pathname = '/dashboard/communications',
	fetchImpl: () => Promise<Response> = async () => new Response('ok', { status: 200 })
) => {
	// this fake window is enough to exercise the fetch and unload interception without a browser.
	const trackedBeforeUnloadListeners = new Set<string>();
	const beforeUnloadRemovalCalls: Array<{
		listener: EventListenerOrEventListenerObject;
		capture: boolean;
	}> = [];
	const location = {
		origin: 'https://playims.test',
		pathname,
		search: '?tab=drafts',
		hash: '#composer',
		replace: vi.fn()
	};

	const addEventListener = vi.fn(
		(
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions
		) => {
			if (type !== 'beforeunload') {
				return;
			}

			const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
			trackedBeforeUnloadListeners.add(`${String(listener)}:${capture}`);
		}
	);

	const removeEventListener = vi.fn(
		(
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | EventListenerOptions
		) => {
			if (type !== 'beforeunload') {
				return;
			}

			const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
			beforeUnloadRemovalCalls.push({ listener, capture });
			trackedBeforeUnloadListeners.delete(`${String(listener)}:${capture}`);
		}
	);

	const windowLike: AuthSessionRedirectWindowLike & {
		trackedBeforeUnloadListeners: Set<string>;
		beforeUnloadRemovalCalls: Array<{
			listener: EventListenerOrEventListenerObject;
			capture: boolean;
		}>;
	} = {
		fetch: vi.fn(fetchImpl),
		location,
		addEventListener,
		removeEventListener,
		onbeforeunload: null,
		trackedBeforeUnloadListeners,
		beforeUnloadRemovalCalls
	};

	return windowLike;
};

describe('auth session redirect helper', () => {
	it('builds a login redirect that preserves the current page path', () => {
		expect(
			buildLoginRedirectHref({
				pathname: '/dashboard/communications',
				search: '?tab=drafts',
				hash: '#composer'
			})
		).toBe('/log-in?next=%2Fdashboard%2Fcommunications%3Ftab%3Ddrafts%23composer');
	});

	it('redirects same-origin 401 responses and clears beforeunload handlers first', async () => {
		// this mirrors the real app case: a save request fails because the session is gone.
		const windowLike = createWindowLike(
			'/dashboard/communications',
			async () => new Response('Missing authenticated session', { status: 401 })
		);
		const cleanup = installAuthSessionRedirect(windowLike);
		try {
			const handler = () => {};
			windowLike.addEventListener('beforeunload', handler, { capture: false });
			windowLike.onbeforeunload = handler;

			const response = await windowLike.fetch('/api/communications/preview', {
				method: 'POST'
			});

			expect(response.status).toBe(401);
			expect(windowLike.location.replace).toHaveBeenCalledWith(
				'/log-in?next=%2Fdashboard%2Fcommunications%3Ftab%3Ddrafts%23composer'
			);
			expect(windowLike.onbeforeunload).toBeNull();
			expect(windowLike.trackedBeforeUnloadListeners.size).toBe(0);
			expect(windowLike.beforeUnloadRemovalCalls).toEqual([{ listener: handler, capture: false }]);
		} finally {
			cleanup();
		}
	});

	it('leaves successful same-origin responses alone', async () => {
		const windowLike = createWindowLike();
		const cleanup = installAuthSessionRedirect(windowLike);
		try {
			const response = await windowLike.fetch('/api/communications/preview', {
				method: 'POST'
			});

			expect(response.status).toBe(200);
			expect(windowLike.location.replace).not.toHaveBeenCalled();
		} finally {
			cleanup();
		}
	});

	it('ignores 401 responses from other origins', async () => {
		const windowLike = createWindowLike('/dashboard/communications', async () => new Response('Unauthorized', { status: 401 }));
		const cleanup = installAuthSessionRedirect(windowLike);
		try {
			const response = await windowLike.fetch('https://example.com/api/communications/preview');

			expect(response.status).toBe(401);
			expect(windowLike.location.replace).not.toHaveBeenCalled();
		} finally {
			cleanup();
		}
	});
});
