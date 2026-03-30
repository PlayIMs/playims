<script lang="ts" generics="TRow">
	import type { Snippet } from 'svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { toast } from '$lib/toasts';
	import type {
		DataTableColumn,
		DataTableHeaderTextTransform,
		DataTableSortDirection,
		DataTableSortState,
		DataTableTextAlignment,
		DataTableVerticalAlignment
	} from '$lib/components/data-table.js';
	import {
		areDataTableSortStatesEqual,
		getActiveDataTableSortState,
		getNextDataTableSortOverride,
		isDataTableColumnSortable,
		sortDataTableRows
	} from '$lib/components/data-table-sort.js';
	import {
		formatDataTableClipboardSuccessMessage,
		getDataTableColumnCopyText,
		isDataTableColumnCopyEnabled
	} from '$lib/components/data-table.js';

	interface Props {
		columns: DataTableColumn<TRow>[];
		rows: TRow[];
		caption?: string;
		wrapperClass?: string;
		tableClass?: string;
		rowId?: (row: TRow, rowIndex: number) => string | undefined;
		rowClass?: (row: TRow, rowIndex: number) => string | undefined;
		emptyBody?: Snippet<[]>;
		defaultSort?: DataTableSortState | null;
		cell: Snippet<[TRow, DataTableColumn<TRow>]>;
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
		defaultSort = null,
		cell
	}: Props = $props();
	let sortOverride = $state<DataTableSortState | null>(null);

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

	function resolveHeaderPaddingClass(column: DataTableColumn<TRow>): string {
		if (column.headerPaddingX === 'none') return '';
		const classes: string[] = [];
		if (!column.headerPaddingLeft) classes.push('pl-2');
		if (!column.headerPaddingRight) classes.push('pr-2');
		return classes.join(' ');
	}

	function resolveBodyPaddingClass(column: DataTableColumn<TRow>): string {
		if (column.cellPaddingX === 'none') return '';
		const classes: string[] = [];
		if (!column.cellPaddingLeft) classes.push('pl-2');
		if (!column.cellPaddingRight) classes.push('pr-2');
		return classes.join(' ');
	}

	function resolveHeaderTextTransformClass(
		textTransform: DataTableHeaderTextTransform | undefined
	): string {
		if (textTransform === 'normal') return 'normal-case';
		if (textTransform === 'uppercase') return 'uppercase';
		return 'data-table-header-title-case';
	}

	function resolveHeaderCellClass(column: DataTableColumn<TRow>): string {
		const classes = [
			resolveHeaderPaddingClass(column),
			'py-1',
			resolveTextAlignmentClass(column.headerTextAlignment, 'left'),
			resolveHeaderTextTransformClass(column.headerTextTransform),
			'text-[11px] font-bold tracking-wide text-neutral-950'
		];
		return classes.filter(Boolean).join(' ');
	}

	function headerHoverTooltipText(column: DataTableColumn<TRow>): string | undefined {
		return column.headerHoverTooltipText ?? column.headerTooltipText;
	}

	function resolveBodyCellClass(column: DataTableColumn<TRow>): string {
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
		const borderClass = rowIndex < rowCount - 1 ? 'border-b border-neutral-950' : '';
		const stripeClass = rowIndex % 2 === 0 ? 'bg-neutral-25' : 'bg-neutral-05';
		return ['align-middle', borderClass, stripeClass].filter(Boolean).join(' ');
	}

	function resolvedRowClass(row: TRow, rowIndex: number): string {
		const extraClass = rowClass?.(row, rowIndex)?.trim();
		const baseClass = defaultRowClass(rowIndex, rows.length);
		return extraClass ? `${baseClass} ${extraClass}` : baseClass;
	}

	const activeSortState = $derived.by(() => getActiveDataTableSortState(sortOverride, defaultSort));

	const sortedRows = $derived.by(() => sortDataTableRows(rows, columns, activeSortState));

	function handleSortColumnClick(column: DataTableColumn<TRow>): void {
		if (!isDataTableColumnSortable(column)) return;
		sortOverride = getNextDataTableSortOverride(column.key, sortOverride, defaultSort);
	}

	function headerAriaSort(column: DataTableColumn<TRow>): 'none' | 'ascending' | 'descending' {
		if (activeSortState?.columnKey !== column.key) return 'none';
		return activeSortState.direction === 'asc' ? 'ascending' : 'descending';
	}

	function sortIndicator(column: DataTableColumn<TRow>): DataTableSortDirection | null {
		return isDataTableColumnSortable(column) && sortOverride?.columnKey === column.key
			? sortOverride.direction
			: null;
	}

	function sortIndicatorSymbol(direction: DataTableSortDirection | null): string {
		if (direction === 'asc') return '\u25B4';
		if (direction === 'desc') return '\u25BE';
		return '';
	}

	function copyCellAriaLabel(column: DataTableColumn<TRow>, row: TRow): string {
		const copyText = getDataTableColumnCopyText(column, row);
		return copyText ? `Copy ${column.label}: ${copyText}` : `Copy ${column.label}`;
	}

	async function copyCellValue(column: DataTableColumn<TRow>, row: TRow): Promise<void> {
		const copyText = getDataTableColumnCopyText(column, row);
		if (!copyText) return;
		if (typeof navigator === 'undefined' || !navigator.clipboard) {
			toast.error('Unable to copy that value right now.', {
				title: 'Clipboard'
			});
			return;
		}

		try {
			await navigator.clipboard.writeText(copyText);
			toast.success(formatDataTableClipboardSuccessMessage(copyText), {
				title: 'Clipboard'
			});
		} catch {
			toast.error('Unable to copy that value right now.', {
				title: 'Clipboard'
			});
		}
	}

	function handleCopyCellKeydown(
		event: KeyboardEvent,
		column: DataTableColumn<TRow>,
		row: TRow
	): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		void copyCellValue(column, row);
	}
</script>

{#snippet bodyCellContent(row: TRow, column: DataTableColumn<TRow>)}
	{#if isDataTableColumnCopyEnabled(column) && getDataTableColumnCopyText(column, row)}
		<div
			role="button"
			tabindex="0"
			class="inline-block max-w-full cursor-default rounded-[2px] underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-700 focus-visible:ring-offset-1 hover:underline focus-visible:underline"
			aria-label={copyCellAriaLabel(column, row)}
			onclick={() => void copyCellValue(column, row)}
			onkeydown={(event) => handleCopyCellKeydown(event, column, row)}
		>
			{@render cell(row, column)}
		</div>
	{:else}
		{@render cell(row, column)}
	{/if}
{/snippet}

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
						aria-sort={headerAriaSort(column)}
						class={resolveHeaderCellClass(column)}
						style:padding-left={column.headerPaddingLeft}
						style:padding-right={column.headerPaddingRight}
					>
						{#if isDataTableColumnSortable(column)}
							<button
								type="button"
								class="relative inline-flex items-center justify-center overflow-visible cursor-pointer focus-visible:outline-none"
								onclick={() => handleSortColumnClick(column)}
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
									<span>{column.label}</span>
								{/if}
								{#if sortIndicator(column)}
									<span
										aria-hidden="true"
										class="pointer-events-none absolute left-full top-1/2 ml-0.5 -translate-y-1/2 text-[12px] leading-none"
									>
										{sortIndicatorSymbol(sortIndicator(column))}
									</span>
								{/if}
							</button>
						{:else if headerHoverTooltipText(column)}
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
				{#each sortedRows as row, rowIndex}
					<tr id={rowId?.(row, rowIndex)} class={resolvedRowClass(row, rowIndex)}>
						{#each columns as column}
							{#if column.rowHeader}
								<th
									scope="row"
									class={resolveBodyCellClass(column)}
									style:padding-left={column.cellPaddingLeft}
									style:padding-right={column.cellPaddingRight}
								>
									{@render bodyCellContent(row, column)}
								</th>
							{:else}
								<td
									class={resolveBodyCellClass(column)}
									style:padding-left={column.cellPaddingLeft}
									style:padding-right={column.cellPaddingRight}
								>
									{@render bodyCellContent(row, column)}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
