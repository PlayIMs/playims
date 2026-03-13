/*
Brief description:
This file verifies the route behavior for creating a facility and its child areas.

Deeper explanation:
Facility creation is a good example of server code with multiple failure points. The route checks
platform bindings, validates nested input, detects duplicates, creates a parent record, creates
child records, and rolls back partial writes if something fails in the middle. Because those steps
are tightly connected, the comments below focus on why each helper and mock matters.

Summary of tests:
1. It verifies that the route fails early when the Cloudflare D1 binding is missing.
2. It verifies that archived duplicates return recovery metadata instead of writing again.
3. It verifies that partial writes are rolled back when area creation fails.
4. It verifies that the happy path creates the facility and all requested areas.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these mocks stand in for the tenant database layer.
// using hoisted mocks ensures the route imports the fake helpers instead of the real database code.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			facilities: {
				getAll: vi.fn(),
				create: vi.fn(),
				delete: vi.fn()
			},
			facilityAreas: {
				getByFacilityId: vi.fn(),
				create: vi.fn(),
				delete: vi.fn()
			}
		},
		getTenantDbOps: vi.fn()
	};
});

// this swaps the real tenant db context with our controlled fake.
// the route still executes normally, but all database decisions are now test-controlled.
vi.mock('$lib/server/database/context', () => {
	mocks.getTenantDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getTenantDbOps: mocks.getTenantDbOps
	};
});

import { POST } from '../../src/routes/api/facilities/+server';

// this is the shared valid payload used by most tests.
// centralizing it makes the route scenarios easier to compare because each test only changes the one
// input detail that matters for that scenario.
const createPayload = () => ({
	facility: {
		name: 'Main Gym',
		slug: 'main-gym',
		description: null,
		addressLine1: '123 Main St',
		addressLine2: null,
		city: 'Oxford',
		state: 'MS',
		postalCode: '38655',
		country: 'USA',
		timezone: 'America/Chicago',
		isActive: true,
		capacity: 250
	},
	areas: [
		{
			name: 'Court A',
			slug: 'court-a',
			description: null,
			isActive: true,
			capacity: 50
		},
		{
			name: 'Court B',
			slug: 'court-b',
			description: null,
			isActive: true,
			capacity: 60
		}
	]
});

// this creates the fake sveltekit event object expected by the route.
// the helper also lets us simulate missing database bindings or malformed request objects without
// rewriting the full event shape every time.
const createEvent = (input?: {
	body?: unknown;
	withDatabase?: boolean;
	request?: Request;
}) => {
	const url = new URL('https://playims.test/api/facilities');
	return {
		url,
		request:
			input?.request ??
			new Request(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input?.body ?? createPayload())
			}),
		platform: input?.withDatabase === false ? { env: {} } : { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: 'admin'
			}
		}
	} as any;
};

describe('facilities create route', () => {
	beforeEach(() => {
		// clear old calls so every test starts from a clean baseline.
		vi.clearAllMocks();
		// console.error is muted because rollback tests intentionally trigger failure paths and we
		// want the assertions to stay readable without noisy expected errors in the test output.
		vi.spyOn(console, 'error').mockImplementation(() => {});

		// these defaults represent the simplest success path.
		// tests can override only the specific dependency result they need to exercise.
		mocks.dbOps.facilities.getAll.mockResolvedValue([]);
		mocks.dbOps.facilities.create.mockResolvedValue({
			id: 'facility-1',
			name: 'Main Gym',
			slug: 'main-gym'
		});
		mocks.dbOps.facilityAreas.getByFacilityId.mockResolvedValue([]);
		mocks.dbOps.facilityAreas.create
			.mockResolvedValueOnce({
				id: 'area-1',
				name: 'Court A',
				slug: 'court-a'
			})
			.mockResolvedValueOnce({
				id: 'area-2',
				name: 'Court B',
				slug: 'court-b'
			});
		mocks.dbOps.facilityAreas.delete.mockResolvedValue(undefined);
		mocks.dbOps.facilities.delete.mockResolvedValue(undefined);
	});

	it('fails fast when the D1 binding is unavailable', async () => {
		// this protects the route from pretending a save worked when the platform binding is missing.
		// failing early is safer than attempting deeper logic with an unusable environment.
		const response = await POST(createEvent({ withDatabase: false }));
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload.error).toBe('Unable to save facility right now.');
	});

	it('returns archived duplicate metadata when the facility already exists in archived form', async () => {
		// the route has a special recovery path for archived duplicates so the ui can guide the user
		// toward restoring old data instead of blindly creating a second conflicting record.
		mocks.dbOps.facilities.getAll.mockResolvedValue([
			{
				id: 'facility-archived',
				name: 'Main Gym',
				slug: 'main-gym',
				isActive: 0
			}
		]);
		mocks.dbOps.facilityAreas.getByFacilityId.mockResolvedValue([
			{
				id: 'area-archived',
				name: 'Court A',
				slug: 'court-a',
				isActive: 0
			}
		]);

		const response = await POST(createEvent());
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('An archived facility with that name/slug already exists.');
		expect(payload.duplicateType).toBe('archived');
		expect(payload.archivedFacilityId).toBe('facility-archived');
		expect(payload.archivedAreaId).toBe('area-archived');
		expect(mocks.dbOps.facilities.create).not.toHaveBeenCalled();
	});

	it('rolls back created records if an area fails after the facility is created', async () => {
		// mock reset clears the success defaults so this test can simulate a partial failure:
		// the first area succeeds, the second one fails, and the route should clean up both the child
		// and parent records to avoid leaving half-created data behind.
		mocks.dbOps.facilityAreas.create
			.mockReset()
			.mockResolvedValueOnce({
				id: 'area-1',
				name: 'Court A',
				slug: 'court-a'
			})
			.mockResolvedValueOnce(null);

		const response = await POST(createEvent());
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload.error).toBe('Unable to save facility right now.');
		expect(mocks.dbOps.facilityAreas.delete).toHaveBeenCalledWith('area-1');
		expect(mocks.dbOps.facilities.delete).toHaveBeenCalledWith('facility-1');
	});

	it('creates a facility and its areas when the payload is valid', async () => {
		const response = await POST(createEvent());
		const payload = await response.json();

		expect(response.status).toBe(201);
		expect(payload.success).toBe(true);
		expect(payload.data.facility.id).toBe('facility-1');
		expect(payload.data.facilityAreas).toHaveLength(2);
		// object containing keeps the test centered on the fields that prove the route passed the right
		// write contract into the database layer.
		expect(mocks.dbOps.facilities.create).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: 'client-1',
				name: 'Main Gym',
				slug: 'main-gym',
				createdUser: 'user-1',
				updatedUser: 'user-1'
			})
		);
	});
});
