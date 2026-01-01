// Reusable mapping utilities for DB rows → TS objects

// Convert snake_case to camelCase
function toCamelCaseKey(key: string): string {
	return key.replace(/_([a-z])/g, (_, chr: string) => chr.toUpperCase());
}

// Parse date-like values to Date|null (empty strings and null become null)
function parseDate(value: unknown): Date | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string' && value.trim() === '') return null;
	const date = new Date(value as string);
	return isNaN(date.getTime()) ? null : date;
}

// Camelize object keys; optionally strip a prefix (e.g., 'c_' for joined client columns)
function camelizeObject<T extends Record<string, unknown>>(
	row: Record<string, unknown>,
	options?: { stripPrefix?: string }
): T {
	const result: Record<string, unknown> = {};
	const stripPrefix = options?.stripPrefix;
	for (const [key, value] of Object.entries(row)) {
		let outKey = key;
		if (stripPrefix && outKey.startsWith(stripPrefix)) {
			outKey = outKey.slice(stripPrefix.length);
		}
		result[toCamelCaseKey(outKey)] = value;
	}
	return result as T;
}

// Map a client row object (already scoped to client fields) to a TS object with camelCase keys and Date fields
export function mapClientRow(
	raw: Record<string, unknown>,
	opts?: { prefix?: string }
): Record<string, unknown> {
	const client = camelizeObject<Record<string, unknown>>(raw, {
		stripPrefix: opts?.prefix ?? undefined
	});

	if ('createdAt' in client) client.createdAt = parseDate(client.createdAt);
	if ('updatedAt' in client) client.updatedAt = parseDate(client.updatedAt);

	return client;
}

// Map a user row with optional joined client aliased as c_* into a nested structure
export function mapUserRow(raw: Record<string, unknown>): Record<string, unknown> {
	// Separate user fields from client fields (c_*)
	const userFields: Record<string, unknown> = {};
	const clientFields: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (key.startsWith('c_')) {
			clientFields[key] = value;
		} else {
			userFields[key] = value;
		}
	}

	// Convert user fields to camelCase
	const user = camelizeObject<Record<string, unknown>>(userFields);

	// Dates on user
	if ('createdAt' in user) user.createdAt = parseDate(user.createdAt);
	if ('updatedAt' in user) user.updatedAt = parseDate(user.updatedAt);
	if ('lastLoginAt' in user) user.lastLoginAt = parseDate(user.lastLoginAt);
	if ('lastActiveAt' in user) user.lastActiveAt = parseDate(user.lastActiveAt);

	// Build nested client from c_* fields if present (at least c_id)
	const hasJoinedClient = Object.prototype.hasOwnProperty.call(raw, 'c_id');
	if (hasJoinedClient) {
		const client = mapClientRow(clientFields, { prefix: 'c_' });
		// If no id, treat as null; else provide at least id
		user.client = client && typeof client === 'object' && 'id' in client ? client : null;
	} else {
		user.client = null;
	}

	// Remove clientId if present to encourage using nested client
	if ('clientId' in user) {
		delete (user as Record<string, unknown>).clientId;
	}

	return user;
}

export const _internal = { toCamelCaseKey, camelizeObject, parseDate };
