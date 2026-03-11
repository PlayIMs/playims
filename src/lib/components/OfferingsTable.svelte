<script lang="ts" generics="TRow">
	import type { Snippet } from 'svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import type {
		OfferingsTableColumn,
		OfferingsTableHeaderTextTransform,
		OfferingsTableHorizontalPadding,
		OfferingsTableTextAlignment,
		OfferingsTableVerticalAlignment
	} from '$lib/components/offerings-table.js';

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

	function resolveTextAlignmentClass(
		alignment: OfferingsTableTextAlignment | undefined,
		fallback: OfferingsTableTextAlignment
	): string {
		switch (alignment ?? fallback) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	}

	function resolveVerticalAlignmentClass(
		alignment: OfferingsTableVerticalAlignment | undefined
	): string {
		switch (alignment) {
			case 'top':
				return 'align-top';
			case 'bottom':
				return 'align-bottom';
			case 'middle':
				return 'align-middle';
			default:
				return '';
		}
	}

	function resolvePaddingXClass(padding: OfferingsTableHorizontalPadding | undefined): string {
		return padding === 'none' ? '' : 'px-2';
	}

	function resolveHeaderTextTransformClass(
		textTransform: OfferingsTableHeaderTextTransform | undefined
	): string {
		return textTransform === 'normal' ? 'normal-case' : 'uppercase';
	}

	function resolveHeaderCellClass(column: OfferingsTableColumn): string {
		const classes = [
			resolvePaddingXClass(column.headerPaddingX),
			'py-1',
			resolveTextAlignmentClass(column.headerTextAlignment, 'left'),
			resolveHeaderTextTransformClass(column.headerTextTransform),
			'text-[11px] font-bold tracking-wide text-neutral-950'
		];
		return classes.filter(Boolean).join(' ');
	}

	function resolveBodyCellClass(column: OfferingsTableColumn): string {
		const classes = [
			resolvePaddingXClass(column.cellPaddingX),
			'py-1',
			resolveTextAlignmentClass(column.cellTextAlignment, 'left'),
			resolveVerticalAlignmentClass(column.cellVerticalAlignment),
			column.tabularNumbers ? 'tabular-nums' : ''
		];
		return classes.filter(Boolean).join(' ');
	}

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
				<col style:width={column.width} />
			{/each}
		</colgroup>
		<thead>
			<tr class="border-b border-neutral-950 bg-neutral">
				{#each columns as column}
					<th scope="col" class={resolveHeaderCellClass(column)}>
						{#if column.headerTooltipText}
							<HoverTooltip
								text={column.headerTooltipText}
								wrapperClass="inline-flex"
								maxWidthClass="max-w-72"
							>
								<span>{column.label}</span>
							</HoverTooltip>
						{:else}
							{column.label}
						{/if}
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
								<th scope="row" class={resolveBodyCellClass(column)}>
									{@render cell(row, column)}
								</th>
							{:else}
								<td class={resolveBodyCellClass(column)}>
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
