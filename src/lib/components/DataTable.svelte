<script lang="ts" generics="TRow">
	import type { Snippet } from 'svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import type {
		DataTableColumn,
		DataTableHeaderTextTransform,
		DataTableTextAlignment,
		DataTableVerticalAlignment
	} from '$lib/components/data-table.js';

	interface Props {
		columns: DataTableColumn[];
		rows: TRow[];
		caption?: string;
		wrapperClass?: string;
		tableClass?: string;
		rowId?: (row: TRow, rowIndex: number) => string | undefined;
		rowClass?: (row: TRow, rowIndex: number) => string | undefined;
		emptyBody?: Snippet<[]>;
		cell: Snippet<[TRow, DataTableColumn]>;
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
		alignment: DataTableTextAlignment | undefined,
		fallback: DataTableTextAlignment
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
		alignment: DataTableVerticalAlignment | undefined
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

	function resolveHeaderPaddingClass(column: DataTableColumn): string {
		if (column.headerPaddingX === 'none') return '';
		const classes: string[] = [];
		if (!column.headerPaddingLeft) classes.push('pl-2');
		if (!column.headerPaddingRight) classes.push('pr-2');
		return classes.join(' ');
	}

	function resolveBodyPaddingClass(column: DataTableColumn): string {
		if (column.cellPaddingX === 'none') return '';
		const classes: string[] = [];
		if (!column.cellPaddingLeft) classes.push('pl-2');
		if (!column.cellPaddingRight) classes.push('pr-2');
		return classes.join(' ');
	}

	function resolveHeaderTextTransformClass(
		textTransform: DataTableHeaderTextTransform | undefined
	): string {
		return textTransform === 'normal' ? 'normal-case' : 'uppercase';
	}

	function resolveHeaderCellClass(column: DataTableColumn): string {
		const classes = [
			resolveHeaderPaddingClass(column),
			'py-1',
			resolveTextAlignmentClass(column.headerTextAlignment, 'left'),
			resolveHeaderTextTransformClass(column.headerTextTransform),
			'text-[11px] font-bold tracking-wide text-neutral-950'
		];
		return classes.filter(Boolean).join(' ');
	}

	function headerHoverTooltipText(column: DataTableColumn): string | undefined {
		return column.headerHoverTooltipText ?? column.headerTooltipText;
	}

	function resolveBodyCellClass(column: DataTableColumn): string {
		const classes = [
			resolveBodyPaddingClass(column),
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
					<th
						scope="col"
						class={resolveHeaderCellClass(column)}
						style:padding-left={column.headerPaddingLeft}
						style:padding-right={column.headerPaddingRight}
					>
						{#if headerHoverTooltipText(column)}
							<HoverTooltip
								text={headerHoverTooltipText(column) ?? ''}
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
								<th
									scope="row"
									class={resolveBodyCellClass(column)}
									style:padding-left={column.cellPaddingLeft}
									style:padding-right={column.cellPaddingRight}
								>
									{@render cell(row, column)}
								</th>
							{:else}
								<td
									class={resolveBodyCellClass(column)}
									style:padding-left={column.cellPaddingLeft}
									style:padding-right={column.cellPaddingRight}
								>
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
