import type { DatabaseOperations } from '$lib/database';
import { repairLikelyMojibake } from '$lib/search/text-repair.js';
import type { SearchRecentPayload } from '$lib/search/types.js';

const MAX_RECENT_COUNT = 10;

export async function storeSearchRecentSelection(
	dbOps: DatabaseOperations,
	input: {
		userId: string;
		clientId: string;
		payload: SearchRecentPayload;
	}
): Promise<void> {
	const cleanedPayload = {
		...input.payload,
		title: repairLikelyMojibake(input.payload.title) ?? input.payload.title,
		subtitle: repairLikelyMojibake(input.payload.subtitle),
		badge: repairLikelyMojibake(input.payload.badge),
		meta: repairLikelyMojibake(input.payload.meta)
	};

	const existing = await dbOps.searchRecents.getByUserClientAndResultKey(
		input.userId,
		input.clientId,
		cleanedPayload.resultKey
	);

	if (existing?.id) {
		await dbOps.searchRecents.touch(existing.id, {
			category: cleanedPayload.category,
			title: cleanedPayload.title,
			subtitle: cleanedPayload.subtitle ?? null,
			href: cleanedPayload.href,
			badge: cleanedPayload.badge ?? null,
			meta: cleanedPayload.meta ?? null
		});
	} else {
		await dbOps.searchRecents.create({
			userId: input.userId,
			clientId: input.clientId,
			resultKey: cleanedPayload.resultKey,
			category: cleanedPayload.category,
			title: cleanedPayload.title,
			subtitle: cleanedPayload.subtitle ?? null,
			href: cleanedPayload.href,
			badge: cleanedPayload.badge ?? null,
			meta: cleanedPayload.meta ?? null
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
