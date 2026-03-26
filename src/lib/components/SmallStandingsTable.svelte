<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import type {
		DataTableColumn,
		DataTableHeaderTextTransform
	} from '$lib/components/data-table.js';
	import type { ComponentType, SvelteComponent } from 'svelte';

	type IconComponent = ComponentType<SvelteComponent<{ class?: string }>>;

	interface StandingsRow {
		rank: number;
		teamId: string;
		teamName: string;
		wins: number | null;
		losses: number | null;
		ties: number | null;
		points: number | null;
		winPct: string | null;
		streak: string | null;
		sportsmanshipRating: string | null;
		forfeits: number | null;
		forgoes: number | null;
	}

	interface Props {
		rows: StandingsRow[];
		icon: IconComponent;
		caption: string;
		hasSearchQuery?: boolean;
		emptySearchMessage?: string;
		emptyMessage?: string;
		teamHrefByTeamId?: (teamId: string) => string | undefined;
		highlightTeamId?: string | null;
		onlyHighlightTeamName?: boolean;
	}

	let {
		rows,
		icon,
		caption,
		hasSearchQuery = false,
		emptySearchMessage = 'No standings rows match this search.',
		emptyMessage = 'No standings posted yet.',
		teamHrefByTeamId,
		highlightTeamId = null,
		onlyHighlightTeamName = false
	}: Props = $props();

	function teamNameClass(teamId: string): string {
		const shouldBold = onlyHighlightTeamName ? highlightTeamId === teamId : true;
		return shouldBold ? 'font-bold' : 'font-normal';
	}

	const SMALL_STANDINGS_HEADER_TEXT_TRANSFORM: DataTableHeaderTextTransform = 'uppercase';

	function createSmallStandingsColumn(column: DataTableColumn): DataTableColumn {
		return {
			headerTextTransform: SMALL_STANDINGS_HEADER_TEXT_TRANSFORM,
			...column
		};
	}

	const columns: DataTableColumn[] = [
		createSmallStandingsColumn({
			key: 'rank',
			label: 'RNK',
			headerHoverTooltipText: 'Rank',
			width: '7%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			cellPaddingLeft: '12px',
			tabularNumbers: true
		}),
		createSmallStandingsColumn({
			key: 'team',
			label: 'Team',
			width: '28%',
			rowHeader: true,
			headerPaddingRight: '0px',
			cellPaddingRight: '0px'
		}),
		createSmallStandingsColumn({
			key: 'record',
			label: 'W-L-T',
			headerHoverTooltipText: 'Wins-Losses-Ties',
			width: '12%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			tabularNumbers: true
		}),
		createSmallStandingsColumn({
			key: 'points',
			label: 'PTS',
			headerHoverTooltipText: 'Points',
			width: '8%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			tabularNumbers: true
		}),
		createSmallStandingsColumn({
			key: 'pct',
			label: 'PTS%',
			headerHoverTooltipText: 'Points Percentage',
			width: '8%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			tabularNumbers: true
		}),
		createSmallStandingsColumn({
			key: 'streak',
			label: 'STRK',
			headerHoverTooltipText: 'Win/Loss/Tie Streak',
			width: '8%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			tabularNumbers: true
		}),
		createSmallStandingsColumn({
			key: 'sportsmanship',
			label: 'SBR',
			headerHoverTooltipText: 'Sporting Behavior Rating',
			width: '8%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			tabularNumbers: true
		}),
		createSmallStandingsColumn({
			key: 'forfeits',
			label: 'FFS',
			headerHoverTooltipText: 'Forfeits / Forgoes',
			width: '10%',
			headerTextAlignment: 'center',
			cellTextAlignment: 'center',
			cellVerticalAlignment: 'middle',
			tabularNumbers: true
		})
	];

	function formatStandingCell(value: number | string | null | undefined): string {
		if (value === null || value === undefined) return '-';
		if (typeof value === 'string' && value.trim().length === 0) return '-';
		return String(value);
	}

	function formatStreak(value: string | null | undefined): string {
		if (!value) return '-';
		const trimmed = value.trim().toUpperCase();
		if (!trimmed || trimmed === '--') return '-';
		const prefixMatch = /^([WLT])\s*(\d+)$/.exec(trimmed);
		if (prefixMatch) {
			return `${prefixMatch[2]}${prefixMatch[1]}`;
		}
		const suffixMatch = /^(\d+)\s*([WLT])$/.exec(trimmed);
		if (suffixMatch) {
			return `${suffixMatch[1]}${suffixMatch[2]}`;
		}
		return trimmed;
	}

	function formatForfeitSummary(
		forfeits: number | null | undefined,
		forgoes: number | null | undefined
	): string {
		return `${formatStandingCell(forfeits)} / ${formatStandingCell(forgoes)}`;
	}
</script>

<DataTable {columns} {rows} {caption} tableClass="w-full table-fixed border-collapse">
	{#snippet emptyBody()}
		<tr class="bg-neutral-25">
			<td colspan={columns.length} class="px-2 py-8 text-center text-sm italic text-neutral-700">
				{#if hasSearchQuery}
					{emptySearchMessage}
				{:else}
					{emptyMessage}
				{/if}
			</td>
		</tr>
	{/snippet}

	{#snippet cell(row, column)}
		{@const standingsRow = row as StandingsRow}
		{@const Icon = icon}
		{#if column.key === 'rank'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{standingsRow.rank}
			</p>
		{:else if column.key === 'team'}
			{@const teamHref = teamHrefByTeamId?.(standingsRow.teamId)}
			<div class="flex min-w-0 items-center gap-1.5">
				<div
					class="flex h-5 w-5 shrink-0 items-center justify-center bg-primary text-white"
					aria-hidden="true"
				>
					<Icon class="h-3 w-3" />
				</div>
				<HoverTooltip
					text={standingsRow.teamName}
					case="preserve"
					wrapperClass="block min-w-0 flex-1"
				>
					{#if teamHref}
						<a
							href={teamHref}
							class={`block w-full truncate font-sans text-xs text-neutral-950 underline-offset-2 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:underline ${teamNameClass(standingsRow.teamId)}`}
						>
							{standingsRow.teamName}
						</a>
					{:else}
						<p
							class={`block w-full truncate font-sans text-xs text-neutral-950 ${teamNameClass(standingsRow.teamId)}`}
						>
							{standingsRow.teamName}
						</p>
					{/if}
				</HoverTooltip>
			</div>
		{:else if column.key === 'record'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{formatStandingCell(standingsRow.wins)}-{formatStandingCell(
					standingsRow.losses
				)}-{formatStandingCell(standingsRow.ties)}
			</p>
		{:else if column.key === 'points'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{formatStandingCell(standingsRow.points)}
			</p>
		{:else if column.key === 'pct'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{formatStandingCell(standingsRow.winPct)}
			</p>
		{:else if column.key === 'streak'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{formatStreak(standingsRow.streak)}
			</p>
		{:else if column.key === 'sportsmanship'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{formatStandingCell(standingsRow.sportsmanshipRating)}
			</p>
		{:else if column.key === 'forfeits'}
			<p class="w-full text-center font-sans text-xs leading-snug text-neutral-950 tabular-nums">
				{formatForfeitSummary(standingsRow.forfeits, standingsRow.forgoes)}
			</p>
		{/if}
	{/snippet}
</DataTable>
