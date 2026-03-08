<script lang="ts" generics="TRow">
	import type { Snippet } from 'svelte';
	import type { OfferingsTableColumn } from '$lib/components/offerings-table.js';

	interface Props {
		columns: OfferingsTableColumn[];
		rows: TRow[];
		caption?: string;
		wrapperClass?: string;
		tableClass?: string;
		rowId?: (row: TRow, rowIndex: number) => string | undefined;
		rowClass?: (row: TRow, rowIndex: number) => string | undefined;
		emptyBody?: Snippet<[]>;
		cell: Snippet<[TRow, OfferingsTableColumn]>;
	}

	let {
		columns,
		rows,
		caption,
		wrapperClass = 'border border-neutral-950 bg-white overflow-x-auto scrollbar-thin',
		tableClass = 'w-full table-fixed border-collapse',
		rowId,
		rowClass,
		emptyBody,
		cell
	}: Props = $props();

	function defaultRowClass(rowIndex: number, rowCount: number): string {
		const borderClass = rowIndex < rowCount - 1 ? 'border-b border-secondary-200' : '';
		const stripeClass = rowIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05';
		return ['align-middle', borderClass, stripeClass].filter(Boolean).join(' ');
	}

	function resolvedRowClass(row: TRow, rowIndex: number): string {
		const extraClass = rowClass?.(row, rowIndex)?.trim();
		const baseClass = defaultRowClass(rowIndex, rows.length);
		return extraClass ? `${baseClass} ${extraClass}` : baseClass;
	}
</script>

<div class={wrapperClass}>
	<table class={tableClass}>
		{#if caption}
			<caption class="sr-only">{caption}</caption>
		{/if}
		<colgroup>
			{#each columns as column}
				<col class={column.widthClass} />
			{/each}
		</colgroup>
		<thead>
			<tr class="border-b border-neutral-950 bg-neutral">
				{#each columns as column}
					<th
						scope="col"
						class={`px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 ${column.headerClass ?? ''}`}
					>
						{column.label}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				{#if emptyBody}
					{@render emptyBody()}
				{:else}
					<tr class="bg-neutral-25">
						<td
							colspan={columns.length}
							class="px-2 py-6 text-center text-sm font-sans text-neutral-950"
						>
							No rows available.
						</td>
					</tr>
				{/if}
			{:else}
				{#each rows as row, rowIndex}
					<tr id={rowId?.(row, rowIndex)} class={resolvedRowClass(row, rowIndex)}>
						{#each columns as column}
							{#if column.rowHeader}
								<th scope="row" class={`px-2 py-1 text-left ${column.cellClass ?? ''}`}>
									{@render cell(row, column)}
								</th>
							{:else}
								<td class={`px-2 py-1 text-left ${column.cellClass ?? ''}`}>
									{@render cell(row, column)}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
