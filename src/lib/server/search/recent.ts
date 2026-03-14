import type { DatabaseOperations } from '$lib/database';
import type { MegaSearchRecentPayload } from '$lib/search/types.js';

const MAX_RECENT_COUNT = 10;

export async function storeMegaSearchRecentSelection(
	dbOps: DatabaseOperations,
	input: {
		userId: string;
		clientId: string;
		payload: MegaSearchRecentPayload;
	}
): Promise<void> {
	const existing = await dbOps.searchRecents.getByUserClientAndResultKey(
		input.userId,
		input.clientId,
		input.payload.resultKey
	);

	if (existing?.id) {
		await dbOps.searchRecents.touch(existing.id, {
			category: input.payload.category,
			title: input.payload.title,
			subtitle: input.payload.subtitle ?? null,
			href: input.payload.href,
			badge: input.payload.badge ?? null,
			meta: input.payload.meta ?? null
		});
	} else {
		await dbOps.searchRecents.create({
			userId: input.userId,
			clientId: input.clientId,
			resultKey: input.payload.resultKey,
			category: input.payload.category,
			title: input.payload.title,
			subtitle: input.payload.subtitle ?? null,
			href: input.payload.href,
			badge: input.payload.badge ?? null,
			meta: input.payload.meta ?? null
		});
	}

	const recents = await dbOps.searchRecents.listByUserAndClient(
		input.userId,
		input.clientId,
		MAX_RECENT_COUNT + 1
	);
	if (recents.length > MAX_RECENT_COUNT) {
		await dbOps.searchRecents.deleteByIds(recents.slice(MAX_RECENT_COUNT).map((entry) => entry.id));
	}
}
