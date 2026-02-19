<script lang="ts">
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconPencil from '@tabler/icons-svelte/icons/pencil';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconTrash from '@tabler/icons-svelte/icons/trash';

	interface Props {
		title: string;
		itemSingular: string;
		itemPlural: string;
		items: unknown[];
		draftActive: boolean;
		emptyMessage: string;
		onAdd: () => void;
		onEdit: (index: number) => void;
		onCopy: (index: number) => void;
		onMoveUp: (index: number) => void;
		onMoveDown: (index: number) => void;
		onRemove: (index: number) => void;
		getItemName: (item: unknown) => string;
		getItemSlug: (item: unknown) => string;
		containerClass?: string;
		listClass?: string;
		showDraftNotice?: boolean;
		draftNoticeText?: string;
		itemBody?: Snippet<[unknown, number]>;
	}

	let {
		title,
		itemSingular,
		itemPlural,
		items,
		draftActive,
		emptyMessage,
		onAdd,
		onEdit,
		onCopy,
		onMoveUp,
		onMoveDown,
		onRemove,
		getItemName,
		getItemSlug,
		containerClass = 'border border-secondary-300 bg-white p-3 space-y-3',
		listClass =
			'space-y-2 max-h-[61vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-secondary-700 scrollbar-track-secondary-400 scrollbar-corner-secondary-500 hover:scrollbar-thumb-secondary-700 active:scrollbar-thumb-secondary-700 scrollbar-hover:scrollbar-thumb-secondary-800 scrollbar-active:scrollbar-thumb-secondary-700',
		showDraftNotice = false,
		draftNoticeText = '',
		itemBody
	}: Props = $props();

	function toTitleCase(value: string): string {
		return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
	}
</script>

<div class={containerClass}>
	<div class="flex items-center justify-between gap-2">
		<h3 class="text-sm font-bold font-sans text-neutral-950 uppercase tracking-wide">{title}</h3>
		<button
			type="button"
			class="button-secondary-outlined p-1.5 cursor-pointer"
			aria-label={`Add ${itemSingular}`}
			title={`Add ${itemSingular}`}
			onclick={onAdd}
		>
			<IconPlus class="w-4 h-4" />
		</button>
	</div>

	{#if draftActive && showDraftNotice && draftNoticeText.trim().length > 0}
		<div class="border border-secondary-300 bg-secondary-50 p-2">
			<p class="text-xs font-sans text-neutral-950">{draftNoticeText}</p>
		</div>
	{/if}

	{#if items.length === 0}
		<p class="text-sm text-neutral-950 font-sans">{emptyMessage}</p>
	{:else}
		<div class={listClass}>
			{#each items as item, itemIndex (itemIndex)}
				<div class="border border-secondary-300 bg-neutral p-3 space-y-2" animate:flip={{ duration: 180, easing: cubicOut }}>
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-semibold text-neutral-950">
								{getItemName(item).trim() || `Untitled ${toTitleCase(itemSingular)}`}
							</p>
							<p class="text-xs text-neutral-900">Slug: {getItemSlug(item) || 'TBD'}</p>
						</div>
						<div class="flex items-center gap-1">
							{#if items.length > 1}
								{#if itemIndex > 0}
									<button
										type="button"
										class="button-secondary-outlined p-1.5 cursor-pointer"
										aria-label={`Move ${itemSingular} up`}
										title="Move up"
										onclick={() => onMoveUp(itemIndex)}
									>
										<IconChevronUp class="w-4 h-4" />
									</button>
								{/if}
								{#if itemIndex < items.length - 1}
									<button
										type="button"
										class="button-secondary-outlined p-1.5 cursor-pointer"
										aria-label={`Move ${itemSingular} down`}
										title="Move down"
										onclick={() => onMoveDown(itemIndex)}
									>
										<IconChevronDown class="w-4 h-4" />
									</button>
								{/if}
							{/if}
							<button
								type="button"
								class="button-secondary-outlined p-1.5 cursor-pointer"
								aria-label={`Edit ${itemSingular}`}
								title="Edit"
								onclick={() => onEdit(itemIndex)}
							>
								<IconPencil class="w-4 h-4" />
							</button>
							<button
								type="button"
								class="button-secondary-outlined p-1.5 cursor-pointer"
								aria-label={`Copy ${itemSingular}`}
								title="Copy"
								onclick={() => onCopy(itemIndex)}
							>
								<IconCopy class="w-4 h-4" />
							</button>
							<button
								type="button"
								class="button-secondary-outlined p-1.5 cursor-pointer"
								aria-label={`Remove ${itemSingular}`}
								title="Remove"
								onclick={() => onRemove(itemIndex)}
							>
								<IconTrash class="w-4 h-4 text-error-700" />
							</button>
						</div>
					</div>
					{@render itemBody?.(item, itemIndex)}
				</div>
			{/each}
		</div>
	{/if}
</div>
