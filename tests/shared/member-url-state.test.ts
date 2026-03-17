/*
Brief description:
This file verifies the helper that synchronizes dashboard member list state into the URL.

Deeper explanation:
The members page mirrors filters, sorting, and pagination into query params so the view can be shared
and restored. These tests protect the initialization guard that prevents `replaceState` from firing
before the SvelteKit router is ready, while also locking the exact query-string behavior for member
list state.

Summary of tests:
1. It verifies that URL sync is skipped until the page is ready to update router state.
2. It verifies that active member filters and pagination are serialized into query params.
3. It verifies that default member list state removes optional query params from the URL.
*/

import { describe, expect, it, vi } from 'vitest';
import { syncMembersUrlIfReady } from '../../src/lib/members/url-state';

describe('member url state helper', () => {
	it('skips replaceState work until router-backed url sync is ready', () => {
		// the first client effect runs before the router finishes initializing, so url sync must wait.
		const replace = vi.fn();

		syncMembersUrlIfReady({
			href: 'https://playims.test/dashboard/members',
			ready: false,
			replace,
			state: {
				searchQuery: 'jamie',
				sexFilter: '',
				roleFilter: '',
				sortKey: 'lastName',
				sortDir: 'asc',
				currentPage: 1
			}
		});

		expect(replace).not.toHaveBeenCalled();
	});

	it('serializes active member search state into query params', () => {
		// non-default filters should become shareable url state for the current members view.
		const replace = vi.fn();

		syncMembersUrlIfReady({
			href: 'https://playims.test/dashboard/members',
			ready: true,
			replace,
			state: {
				searchQuery: 'jamie',
				sexFilter: 'F',
				roleFilter: 'manager',
				sortKey: 'email',
				sortDir: 'desc',
				currentPage: 3
			}
		});

		expect(replace).toHaveBeenCalledWith('/dashboard/members?q=jamie&sex=F&role=manager&sort=email&dir=desc&page=3');
	});

	it('removes optional params when the member list is back at defaults', () => {
		// clearing filters should clean the url instead of leaving stale query params behind.
		const replace = vi.fn();

		syncMembersUrlIfReady({
			href: 'https://playims.test/dashboard/members?q=jamie&sex=F&role=manager&sort=email&dir=desc&page=3#table',
			ready: true,
			replace,
			state: {
				searchQuery: '',
				sexFilter: '',
				roleFilter: '',
				sortKey: 'lastName',
				sortDir: 'asc',
				currentPage: 1
			}
		});

		expect(replace).toHaveBeenCalledWith('/dashboard/members#table');
	});
});
