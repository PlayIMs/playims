export function addOrUpdateCollectionItem<TItem>(
	items: TItem[],
	draft: TItem,
	editingIndex: number | null
): TItem[] {
	if (editingIndex === null) return [...items, draft];
	return items.map((item, index) => (index === editingIndex ? draft : item));
}

export function duplicateCollectionItem<TItem>(
	items: TItem[],
	index: number,
	createDuplicate: (source: TItem, items: TItem[]) => TItem
): TItem[] {
	const source = items[index];
	if (!source) return items;
	const duplicate = createDuplicate(source, items);
	const next = [...items];
	next.splice(index + 1, 0, duplicate);
	return next;
}

export function reorderCollectionItem<TItem>(
	items: TItem[],
	index: number,
	targetIndex: number
): TItem[] {
	if (
		index < 0 ||
		targetIndex < 0 ||
		index >= items.length ||
		targetIndex >= items.length ||
		index === targetIndex
	) {
		return items;
	}

	const reordered = [...items];
	const current = reordered[index];
	const target = reordered[targetIndex];
	if (!current || !target) return items;

	reordered[index] = target;
	reordered[targetIndex] = current;
	return reordered;
}

export function moveCollectionItemByOffset<TItem>(
	items: TItem[],
	index: number,
	offset: -1 | 1
): TItem[] {
	const targetIndex = index + offset;
	if (targetIndex < 0 || targetIndex >= items.length) return items;

	const reordered = [...items];
	const [moved] = reordered.splice(index, 1);
	if (!moved) return items;
	reordered.splice(targetIndex, 0, moved);
	return reordered;
}

export function removeCollectionItem<TItem>(items: TItem[], index: number): TItem[] {
	if (index < 0 || index >= items.length) return items;
	return items.filter((_, itemIndex) => itemIndex !== index);
}

export function adjustEditingIndexOnReorder(
	editingIndex: number | null,
	index: number,
	targetIndex: number
): number | null {
	if (editingIndex === null) return null;
	if (editingIndex === index) return targetIndex;
	if (editingIndex === targetIndex) return index;
	return editingIndex;
}

export function adjustEditingIndexOnRemove(
	editingIndex: number | null,
	removedIndex: number
): number | null {
	if (editingIndex === null) return null;
	if (editingIndex === removedIndex) return null;
	if (editingIndex > removedIndex) return editingIndex - 1;
	return editingIndex;
}

export function startDraft<TDraft>(createEmptyDraft: () => TDraft): {
	draftActive: true;
	editingIndex: null;
	draft: TDraft;
} {
	return {
		draftActive: true,
		editingIndex: null,
		draft: createEmptyDraft()
	};
}

export function cancelDraft<TDraft>(createEmptyDraft: () => TDraft): {
	draftActive: false;
	editingIndex: null;
	draft: TDraft;
} {
	return {
		draftActive: false,
		editingIndex: null,
		draft: createEmptyDraft()
	};
}

export function startEditingDraft<TDraft>(
	items: TDraft[],
	index: number,
	createEmptyDraft: () => TDraft
): {
	draftActive: boolean;
	editingIndex: number | null;
	draft: TDraft;
} {
	const source = items[index];
	if (!source) {
		return {
			draftActive: false,
			editingIndex: null,
			draft: createEmptyDraft()
		};
	}

	return {
		draftActive: true,
		editingIndex: index,
		draft: source
	};
}
