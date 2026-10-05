/*
Brief description:
This file verifies the settings modules page helper that prepares editable navigation rows.

Deeper explanation:
The modules settings page lets administrators rename sidebar modules, reorder them, and now search
within the editor. These tests keep that presentation logic separate from the Svelte component so
the UI can become friendlier without burying important state rules inside markup.

Summary of tests:
1. It verifies that editor rows keep their original order indexes when search narrows the visible list.
2. It verifies that search matches custom labels, default labels, and navigation keys.
3. It verifies that dirty label counting ignores order-only changes.
*/

import { describe, expect, it } from 'vitest';

import {
	countDirtyNavigationLabels,
	getNavigationEditorRows
} from '../../src/routes/dashboard/settings/modules/modules-page-state';
import {
	getDefaultDashboardNavigationLabels,
	getDefaultDashboardNavigationOrder,
	type DashboardNavigationLabels
} from '../../src/lib/dashboard/navigation';

const createLabels = (overrides: Partial<DashboardNavigationLabels> = {}) => ({
	...getDefaultDashboardNavigationLabels(),
	...overrides
});

describe('settings modules page state', () => {
	it('keeps original order indexes when search narrows the visible list', () => {
		// the visible row index can differ from the real sidebar order, so move buttons need the real index.
		const order = getDefaultDashboardNavigationOrder();
		const labels = createLabels({
			memberManagement: 'People'
		});

		const rows = getNavigationEditorRows({
			order,
			labels,
			initialLabels: getDefaultDashboardNavigationLabels(),
			query: 'people'
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			key: 'memberManagement',
			orderIndex: order.indexOf('memberManagement'),
			label: 'People',
			isDirty: true
		});
	});

	it('matches custom labels, default labels, and navigation keys', () => {
		// this protects the search from feeling broken when users remember either old or renamed labels.
		const labels = createLabels({
			clubSports: 'Sport Clubs'
		});

		expect(
			getNavigationEditorRows({
				order: getDefaultDashboardNavigationOrder(),
				labels,
				initialLabels: labels,
				query: 'sport clubs'
			}).map((row) => row.key)
		).toEqual(['clubSports']);

		expect(
			getNavigationEditorRows({
				order: getDefaultDashboardNavigationOrder(),
				labels,
				initialLabels: labels,
				query: 'club sports'
			}).map((row) => row.key)
		).toEqual(['clubSports']);

		expect(
			getNavigationEditorRows({
				order: getDefaultDashboardNavigationOrder(),
				labels,
				initialLabels: labels,
				query: 'communicationCenter'
			}).map((row) => row.key)
		).toEqual(['communicationCenter']);
	});

	it('counts dirty labels without treating order changes as label edits', () => {
		// order is saved through a separate form, so the label summary should only count renamed modules.
		const initialLabels = createLabels();
		const labels = createLabels({
			settings: 'Setup',
			reports: 'Insights'
		});

		expect(countDirtyNavigationLabels(labels, initialLabels)).toBe(2);
	});
});
