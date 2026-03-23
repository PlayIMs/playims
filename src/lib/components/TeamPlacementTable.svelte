<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import type { DataTableColumn, DataTableSortState } from '$lib/components/data-table.js';
	import { parseDateTooltipValue } from '$lib/utils/date-tooltip.js';

	interface TeamPlacementTableRow {
		id: string;
		name: string;
		slug: string;
		status: string;
		rosterSize: number;
		captainName: string | null;
		dateCreated: string | null;
		dateJoined: string | null;
		description: string | null;
	}

	interface Props {
		rows: TeamPlacementTableRow[];
		icon: any;
		caption: string;
		maxPlayers: number | null;
		hasSearchQuery?: boolean;
		emptySearchMessage?: string;
		emptyMessage?: string;
		defaultSort?: DataTableSortState | null;
		teamHref?: (row: TeamPlacementTableRow) => string | undefined;
	}

	let {
		rows,
		icon,
		caption,
		maxPlayers,
		hasSearchQuery = false,
		emptySearchMessage = 'No teams match this search.',
		emptyMessage = 'No teams available.',
		defaultSort = { columnKey: 'date-joined', direction: 'asc' },
		teamHref
	}: Props = $props();

	const columns: DataTableColumn<TeamPlacementTableRow>[] = [
		{
			key: 'team',
			label: 'Team',
			width: '32%',
			rowHeader: true,
			sortValue: (team) => team.name
		},
		{
			key: 'date-created',
			label: 'Date Created',
			width: '22%',
			cellVerticalAlignment: 'top',
			sortValue: (team) => sortableTimestampValue(team.dateCreated)
		},
		{
			key: 'date-joined',
			label: 'Date Joined',
			width: '22%',
			cellVerticalAlignment: 'top',
			sortValue: (team) => sortableTimestampValue(team.dateJoined)
		},
		{
			key: 'roster',
			label: 'Roster',
			width: '12%',
			cellVerticalAlignment: 'top',
			sortValue: (team) => team.rosterSize
		},
		{
			key: 'status',
			label: 'Status',
			width: '12%',
			cellVerticalAlignment: 'top',
			sortValue: (team) => team.status
		}
	];

	function captainLabel(captainName: string | null | undefined): string {
		return captainName?.trim() || 'No Captain';
	}

	function formatDateTime(value: string | null | undefined): string {
		if (!value) return 'TBD';
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD';
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function sortableTimestampValue(value: string | null | undefined): number | null {
		if (!value) return null;
		const parsed = parseDateTooltipValue(value);
		if (!parsed || Number.isNaN(parsed.getTime())) return null;
		return parsed.getTime();
	}

	function isApprovedStatus(status: string | null | undefined): boolean {
		return (status?.trim().toLowerCase() ?? '') === 'active';
	}

	function statusLabel(status: string | null | undefined): string {
		return isApprovedStatus(status) ? 'Approved' : 'Waitlist';
	}

	function statusBadgeClass(status: string | null | undefined): string {
		return isApprovedStatus(status) ? 'badge-secondary-outlined' : 'badge-primary-outlined';
	}
</script>

<DataTable {columns} {rows} {caption} {defaultSort}>
	{#snippet emptyBody()}
		<tr class="bg-neutral-25">
			<td colspan={columns.length} class="px-2 py-10 text-center text-sm italic text-neutral-700">
				{#if hasSearchQuery}
					{emptySearchMessage}
				{:else}
					{emptyMessage}
				{/if}
			</td>
		</tr>
	{/snippet}

	{#snippet cell(row, column)}
		{@const teamRow = row as TeamPlacementTableRow}
		{@const Icon = icon}
		{@const href = teamHref?.(teamRow)}
		{#if column.key === 'team'}
			<div class="flex items-center gap-2">
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
					aria-hidden="true"
				>
					<Icon class="h-5 w-5" />
				</div>
				<div class="min-w-0">
					<p class="font-sans text-sm font-bold text-neutral-950">
						{#if href}
							<a
								{href}
								class="underline-offset-2 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:underline"
							>
								{teamRow.name}
							</a>
						{:else}
							{teamRow.name}
						{/if}
					</p>
					<p class="mt-0 font-sans text-[11px] font-normal leading-tight text-neutral-700">
						{captainLabel(teamRow.captainName)}
					</p>
					{#if teamRow.description}
						<div class="mt-1 max-w-full overflow-x-auto pb-1 scrollbar-thin">
							<p
								class="min-w-max font-sans text-xs leading-snug whitespace-nowrap text-neutral-700"
							>
								{teamRow.description}
							</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if column.key === 'date-created'}
			<p class="font-sans text-xs leading-snug text-neutral-950">
				<DateHoverText
					display={formatDateTime(teamRow.dateCreated)}
					value={teamRow.dateCreated}
					includeTime
					wrapperClass="inline"
				/>
			</p>
		{:else if column.key === 'date-joined'}
			<p class="font-sans text-xs leading-snug text-neutral-950">
				<DateHoverText
					display={formatDateTime(teamRow.dateJoined)}
					value={teamRow.dateJoined}
					includeTime
					wrapperClass="inline"
				/>
			</p>
		{:else if column.key === 'roster'}
			<p class="font-sans text-xs leading-snug text-neutral-950">
				{teamRow.rosterSize} /
				{#if typeof maxPlayers === 'number'}
					{maxPlayers}
				{:else}
					<span class="text-sm leading-none" aria-label="No max players">&infin;</span>
				{/if}
			</p>
		{:else if column.key === 'status'}
			<span class={`${statusBadgeClass(teamRow.status)} text-xs uppercase tracking-wide`}>
				{statusLabel(teamRow.status)}
			</span>
		{/if}
	{/snippet}
</DataTable>
