/*
Brief description:
This file verifies the URL-state helpers that let mega search land users inside existing pages.

Deeper explanation:
Not every search result has its own standalone detail route. These helpers define how query-string
state is extracted for members, facilities, and league teams so the destination pages can expand,
focus, or highlight the right record after navigation.

Summary of tests:
1. It verifies that member selection reads the member ID from the URL.
2. It verifies that facility selection reads both facility and area IDs from the URL.
3. It verifies that league selection reads the team ID from the URL.
*/

import { describe, expect, it } from 'vitest';
import {
	readFacilitySearchSelection,
	readLeagueSearchSelection,
	readMemberSearchSelection
} from '../../src/lib/search/page-state';

describe('mega search page-state helpers', () => {
	it('reads the member ID from the url', () => {
		// member detail opening is driven by the query string rather than a dedicated page.
		const url = new URL('https://playims.test/dashboard/members?memberId=member-1&q=Jamie');

		expect(readMemberSearchSelection(url)).toEqual({ memberId: 'member-1' });
	});

	it('reads the facility and area IDs from the url', () => {
		// facility search can land on either a facility or a specific nested area inside it.
		const url = new URL(
			'https://playims.test/dashboard/facilities?facilityId=facility-1&areaId=area-2'
		);

		expect(readFacilitySearchSelection(url)).toEqual({
			facilityId: 'facility-1',
			areaId: 'area-2'
		});
	});

	it('reads the team ID from the league url', () => {
		// team results land on the owning league page and let that page focus the matching row.
		const url = new URL(
			'https://playims.test/dashboard/offerings/fall-2026/soccer/co-rec?teamId=team-9'
		);

		expect(readLeagueSearchSelection(url)).toEqual({ teamId: 'team-9' });
	});
});
