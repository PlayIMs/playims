<script lang="ts">
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import HeaderHierarchyTabs from '$lib/components/navigation/HeaderHierarchyTabs.svelte';
	import OfferingsTable from '$lib/components/OfferingsTable.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import type { HeaderHierarchySegment } from '$lib/components/navigation/header-hierarchy.js';
	import type { OfferingsTableColumn } from '$lib/components/offerings-table.js';
	import {
		IconBallAmericanFootball,
		IconBallBaseball,
		IconBallBasketball,
		IconBallFootball,
		IconBallTennis,
		IconBallVolleyball,
		IconCrosshair,
		IconShip,
		IconTarget,
		IconUsers
	} from '@tabler/icons-svelte';

	type StandingsRow = NonNullable<PageData['standings']>[number];
	type TeamRow = NonNullable<PageData['teams']>[number];
	type WaitlistTeamRow = NonNullable<PageData['waitlistTeams']>[number];
	type OfferingHierarchyOption = NonNullable<PageData['offeringOptions']>[number];
	type LeagueHierarchyOption = NonNullable<PageData['leagueOptions']>[number];
	type DivisionHierarchyOption = NonNullable<PageData['divisionOptions']>[number];
	type StandingsDisplayRow = {
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
		hasPostedStandings: boolean;
	};

	let { data } = $props<{ data: PageData }>();
	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).offerings
	);

	let searchQuery = $state('');

	function normalizeSearchValue(value: string | null | undefined): string {
		return value?.trim().toLowerCase() ?? '';
	}

	function matchesSearchTerm(values: Array<string | null | undefined>, query: string): boolean {
		if (!query) return true;
		return values.some((value) => normalizeSearchValue(value).includes(query));
	}

	function approvalBadgeLabel(isApproved: boolean): string {
		return isApproved ? 'Approved' : 'Unapproved';
	}

	function approvalBadgeClass(isApproved: boolean): string {
		return isApproved ? 'badge-secondary-outlined' : 'badge-primary-outlined';
	}

	function sportIconFor(offeringName: string, sportName: string | null | undefined) {
		const key = `${offeringName} ${sportName ?? ''}`.trim().toLowerCase();
		if (key.includes('flag football')) return IconBallAmericanFootball;
		if (key.includes('basketball')) return IconBallBasketball;
		if (key.includes('soccer')) return IconBallFootball;
		if (key.includes('volleyball')) return IconBallVolleyball;
		if (key.includes('spikeball')) return IconCrosshair;
		if (key.includes('pickleball')) return IconBallTennis;
		if (key.includes('cornhole')) return IconTarget;
		if (key.includes('battleship')) return IconShip;
		if (key.includes('softball') || key.includes('baseball')) return IconBallBaseball;
		return IconBallFootball;
	}

	function captainLabel(captainName: string | null | undefined): string {
		return captainName?.trim() || 'No Captain';
	}

	function hasRosterLimit(): boolean {
		return typeof data.offering?.maxPlayers === 'number';
	}

	function formatDateTime(value: string | null | undefined): string {
		if (!value) return 'TBD';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'TBD';
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function parseWinPctValue(value: string | null | undefined): number {
		if (!value) return Number.NEGATIVE_INFINITY;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
	}

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
		if (forfeits === null && forgoes === null) return '- / -';
		return `${formatStandingCell(forfeits)} / ${formatStandingCell(forgoes)}`;
	}

	function formatRecord(
		wins: number | null | undefined,
		losses: number | null | undefined,
		ties: number | null | undefined
	): string {
		if (wins === null && losses === null && ties === null) return '-----';
		return `${formatStandingCell(wins)}-${formatStandingCell(losses)}-${formatStandingCell(ties)}`;
	}

	const normalizedSearchQuery = $derived.by(() => normalizeSearchValue(searchQuery));

	const HeaderIcon = $derived.by(() =>
		sportIconFor(data.offering?.name ?? data.league?.name ?? 'League', data.offering?.sport ?? null)
	);
	function offeringHref(): string {
		const seasonSlug = data.season?.slug?.trim();
		const offeringSlug = data.offering?.slug?.trim();
		if (!seasonSlug || !offeringSlug) return '/dashboard/offerings';
		return `/dashboard/offerings/${seasonSlug}/${offeringSlug}`;
	}

	function leagueHref(): string {
		const baseOfferingHref = offeringHref();
		const leagueSlug = data.league?.slug?.trim() || data.league?.id?.trim();
		if (!leagueSlug || baseOfferingHref === '/dashboard/offerings') return baseOfferingHref;
		return `${baseOfferingHref}/${leagueSlug}`;
	}

	function divisionHref(): string {
		const baseLeagueHref = leagueHref();
		const divisionSlug = data.division?.slug?.trim() || data.division?.id?.trim();
		if (!divisionSlug || baseLeagueHref === '/dashboard/offerings') return baseLeagueHref;
		return `${baseLeagueHref}/${divisionSlug}`;
	}

	const hierarchySegments = $derived.by<HeaderHierarchySegment[]>(() => {
		if (!data.offering || !data.league || !data.division) return [];

		const currentOfferingHref = offeringHref();
		const currentLeagueHref = leagueHref();
		const currentDivisionHref = divisionHref();

		return [
			{
				key: 'offerings',
				label: pageLabel,
				href: '/dashboard/offerings',
				currentValue: currentDivisionHref,
				menuAriaLabel: 'Offerings list',
				options: [],
				showMenu: false
			},
			{
				key: 'offering',
				label: data.offering.name,
				href: currentOfferingHref,
				currentValue: currentOfferingHref,
				menuAriaLabel: 'Switch offering',
				options: (data.offeringOptions ?? []).map((option: OfferingHierarchyOption) => ({
					value: option.href,
					label: option.label
				}))
			},
			{
				key: 'league',
				label: data.league.name,
				href: currentLeagueHref,
				currentValue: currentLeagueHref,
				menuAriaLabel: 'Switch league',
				options: (data.leagueOptions ?? []).map((option: LeagueHierarchyOption) => ({
					value: option.href,
					label: option.label
				}))
			},
			{
				key: 'division',
				label: data.division.name,
				href: currentDivisionHref,
				currentValue: currentDivisionHref,
				menuAriaLabel: 'Switch division',
				options: (data.divisionOptions ?? []).map((option: DivisionHierarchyOption) => ({
					value: option.href,
					label: option.label
				}))
			}
		];
	});

	const standingsRows = $derived.by<StandingsDisplayRow[]>(() => {
		const standingsByTeamId = new Map<string, StandingsRow>(
			data.standings.map((row: StandingsRow) => [row.teamId, row])
		);
		const rows: StandingsDisplayRow[] = data.teams.map((team: TeamRow) => {
			const standing = standingsByTeamId.get(team.id);
			return {
				rank: 0,
				teamId: team.id,
				teamName: team.name,
				wins: standing?.wins ?? null,
				losses: standing?.losses ?? null,
				ties: standing?.ties ?? null,
				points: standing?.points ?? null,
				winPct: standing?.winPct ?? null,
				streak: standing?.streak ?? null,
				sportsmanshipRating: null,
				forfeits: null,
				forgoes: null,
				hasPostedStandings: Boolean(standing)
			};
		});

		for (const standing of data.standings) {
			if (rows.some((row) => row.teamId === standing.teamId)) continue;
			rows.push({
				rank: 0,
				teamId: standing.teamId,
				teamName: standing.teamName,
				wins: standing.wins,
				losses: standing.losses,
				ties: standing.ties,
				points: standing.points,
				winPct: standing.winPct,
				streak: standing.streak,
				sportsmanshipRating: null,
				forfeits: null,
				forgoes: null,
				hasPostedStandings: true
			});
		}

		return rows
			.sort((a, b) => {
				if (a.hasPostedStandings !== b.hasPostedStandings) {
					return a.hasPostedStandings ? -1 : 1;
				}
				if ((b.points ?? Number.NEGATIVE_INFINITY) !== (a.points ?? Number.NEGATIVE_INFINITY)) {
					return (b.points ?? Number.NEGATIVE_INFINITY) - (a.points ?? Number.NEGATIVE_INFINITY);
				}
				const winPctDiff = parseWinPctValue(b.winPct) - parseWinPctValue(a.winPct);
				if (winPctDiff !== 0) return winPctDiff;
				if ((b.wins ?? Number.NEGATIVE_INFINITY) !== (a.wins ?? Number.NEGATIVE_INFINITY)) {
					return (b.wins ?? Number.NEGATIVE_INFINITY) - (a.wins ?? Number.NEGATIVE_INFINITY);
				}
				return a.teamName.localeCompare(b.teamName);
			})
			.map((row, index) => ({
				...row,
				rank: index + 1
			}));
	});

	const visibleStandings = $derived.by<StandingsDisplayRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return standingsRows;
		return standingsRows.filter((row: StandingsDisplayRow) =>
			matchesSearchTerm(
				[
					String(row.rank),
					row.teamName,
					formatStandingCell(row.wins),
					formatStandingCell(row.losses),
					formatStandingCell(row.ties),
					formatStandingCell(row.points),
					row.winPct,
					formatStreak(row.streak),
					row.sportsmanshipRating,
					formatForfeitSummary(row.forfeits, row.forgoes)
				],
				query
			)
		);
	});

	const visibleTeams = $derived.by<TeamRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return data.teams;
		return data.teams.filter((team: TeamRow) =>
			matchesSearchTerm(
				[
					team.name,
					team.slug,
					team.captainName,
					team.description,
					formatDateTime(team.dateCreated),
					formatDateTime(team.dateJoined),
					formatDateTime(team.dateRegistered),
					String(team.rosterSize)
				],
				query
			)
		);
	});

	const visibleWaitlistTeams = $derived.by<WaitlistTeamRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return data.waitlistTeams;
		return data.waitlistTeams.filter((team: WaitlistTeamRow) =>
			matchesSearchTerm(
				[
					team.name,
					team.slug,
					team.description,
					formatDateTime(team.dateRegistered),
					String(team.rosterSize)
				],
				query
			)
		);
	});

	const hasSearchQuery = $derived.by(() => normalizedSearchQuery.length > 0);

	const standingsColumns = $derived.by<OfferingsTableColumn[]>(() => [
		{
			key: 'rank',
			label: 'RNK',
			headerTooltipText: 'Rank',
			widthClass: 'w-[8%]',
			headerClass: 'px-0 text-center tracking-wide',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		},
		{
			key: 'team',
			label: 'Team',
			headerTooltipText: 'Team',
			widthClass: 'w-[30%]',
			rowHeader: true
		},
		{
			key: 'record',
			label: 'W-L-T',
			headerTooltipText: 'Wins-Losses-Ties',
			widthClass: 'w-[12%]',
			headerClass: 'px-0 text-center tracking-wide',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		},
		{
			key: 'points',
			label: 'PTS',
			headerTooltipText: 'Points',
			widthClass: 'w-[10%]',
			headerClass: 'px-0 text-center',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		},
		{
			key: 'pct',
			label: 'PTS%',
			headerTooltipText: 'Points Percentage',
			widthClass: 'w-[10%]',
			headerClass: 'px-0 text-center',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		},
		{
			key: 'streak',
			label: 'STRK',
			headerTooltipText: 'Win-Loss-Tie Streak',
			widthClass: 'w-[10%]',
			headerClass: 'px-0 text-center',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		},
		{
			key: 'sportsmanship',
			label: 'SR',
			headerTooltipText: 'Sportsmanship Rating',
			widthClass: 'w-[10%]',
			headerClass: 'px-0 text-center',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		},
		{
			key: 'forfeits',
			label: 'FFs',
			headerTooltipText: 'Forfeits / Forgoes',
			widthClass: 'w-[12%]',
			headerClass: 'px-0 text-center normal-case tracking-wide',
			cellClass: 'px-0 align-middle text-center tabular-nums'
		}
	]);

	const teamsColumns = $derived.by<OfferingsTableColumn[]>(() => [
		{
			key: 'team',
			label: 'Team',
			widthClass: 'w-[32%]',
			rowHeader: true
		},
		{
			key: 'date-created',
			label: 'Date Created',
			widthClass: 'w-[22%]',
			cellClass: 'align-top'
		},
		{
			key: 'date-joined',
			label: 'Date Joined',
			widthClass: 'w-[22%]',
			cellClass: 'align-top'
		},
		{
			key: 'roster',
			label: 'Roster',
			widthClass: 'w-[12%]',
			cellClass: 'align-top'
		},
		{
			key: 'status',
			label: 'Status',
			widthClass: 'w-[12%]',
			cellClass: 'align-top'
		}
	]);

	const waitlistColumns = $derived.by<OfferingsTableColumn[]>(() => [
		{
			key: 'team',
			label: 'Team',
			widthClass: 'w-[48%]',
			rowHeader: true
		},
		{
			key: 'status',
			label: 'Status',
			widthClass: 'w-[16%]',
			cellClass: 'align-top'
		},
		{
			key: 'roster',
			label: 'Roster',
			widthClass: 'w-[14%]',
			cellClass: 'align-top'
		},
		{
			key: 'registration',
			label: 'Team Registration',
			widthClass: 'w-[22%]',
			cellClass: 'align-top'
		}
	]);
</script>

<svelte:head>
	<title>{data.division?.name ?? 'Division'} - PlayIMs</title>
	<meta
		name="description"
		content="Division details including teams, standings, and waitlist management."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
					aria-hidden="true"
				>
					<IconUsers class="h-7 w-7 lg:h-8 lg:w-8" />
				</div>
				<div class="relative min-w-0">
					<h1
						class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
					>
						{data.division?.name ?? 'Division'}
					</h1>
					{#if hierarchySegments.length > 0}
						<div class="absolute left-0 top-[calc(100%+0.2rem)] z-10">
							<HeaderHierarchyTabs segments={hierarchySegments} class="max-w-[min(100vw-7rem,100%)]" />
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="space-y-4 px-4 lg:px-6">
		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.division}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.division.name}
								</h2>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{visibleStandings.length} standings rows
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{visibleTeams.length} active teams
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{visibleWaitlistTeams.length} waitlist
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.division.maxTeams ?? data.teams.length} team capacity
								</span>
							</div>
						</div>
						<SearchInput
							id="division-search"
							label="Search standings and teams"
							value={searchQuery}
							placeholder="Search team, record, roster, or waitlist"
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel="Clear division search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="min-h-[34rem]">
						{#if visibleStandings.length === 0 && visibleTeams.length === 0 && visibleWaitlistTeams.length === 0}
							<div class="p-4">
								<div
									class={`space-y-2 border p-4 ${hasSearchQuery ? 'border-warning-300 bg-warning-50' : 'border-neutral-950 bg-white'}`}
								>
									<h3 class="text-xl font-bold font-serif text-neutral-950">
										{#if hasSearchQuery}
											No matches found
										{:else}
											No division data yet
										{/if}
									</h3>
									<p class="text-sm font-sans text-neutral-950">
										{#if hasSearchQuery}
											No standings, teams, or waitlist entries match "{searchQuery.trim()}".
										{:else}
											This division does not have standings, active teams, or waitlist entries yet.
										{/if}
									</p>
								</div>
							</div>
						{:else}
							<div class="divide-y divide-neutral-950">
								<section class="space-y-3 p-4">
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<h2 class="text-2xl font-bold font-serif text-neutral-950">Teams</h2>
											</div>
										</div>
										<div class="flex flex-wrap items-center gap-1">
											<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
												{visibleTeams.reduce((sum, team) => sum + team.rosterSize, 0)} rostered players
											</span>
										</div>
									</div>

									<OfferingsTable
										columns={teamsColumns}
										rows={visibleTeams}
										caption="Division active teams table"
									>
										{#snippet emptyBody()}
											<tr class="bg-neutral-25">
												<td
													colspan={teamsColumns.length}
													class="px-2 py-10 text-center text-sm italic text-neutral-700"
												>
													{#if hasSearchQuery}
														No active teams match this search.
													{:else}
														No active teams in this division yet.
													{/if}
												</td>
											</tr>
										{/snippet}

										{#snippet cell(team, column)}
											{@const activeTeam = team as TeamRow}
											{#if column.key === 'team'}
												<div class="flex items-center gap-2">
													<div
														class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
														aria-hidden="true"
													>
														<HeaderIcon class="h-5 w-5" />
													</div>
													<div class="min-w-0">
														<p class="font-sans text-sm font-bold text-neutral-950">
															{activeTeam.name}
														</p>
														<p
															class="mt-0 font-sans text-[11px] font-normal leading-tight text-neutral-700"
														>
															{captainLabel(activeTeam.captainName)}
														</p>
														{#if activeTeam.description}
															<div class="mt-1 max-w-full overflow-x-auto pb-1 scrollbar-thin">
																<p
																	class="min-w-max font-sans text-xs leading-snug whitespace-nowrap text-neutral-700"
																>
																	{activeTeam.description}
																</p>
															</div>
														{/if}
													</div>
												</div>
											{:else if column.key === 'date-created'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													<DateHoverText
														display={formatDateTime(activeTeam.dateCreated)}
														value={activeTeam.dateCreated}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{:else if column.key === 'date-joined'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													<DateHoverText
														display={formatDateTime(activeTeam.dateJoined)}
														value={activeTeam.dateJoined}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{:else if column.key === 'roster'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													{activeTeam.rosterSize} /
													{#if hasRosterLimit()}
														{data.offering?.maxPlayers}
													{:else}
														<span class="text-sm leading-none" aria-label="No max players">
															&infin;
														</span>
													{/if}
												</p>
											{:else if column.key === 'status'}
												<span
													class={`${approvalBadgeClass(activeTeam.status === 'active')} text-xs uppercase tracking-wide`}
												>
													{approvalBadgeLabel(activeTeam.status === 'active')}
												</span>
											{/if}
										{/snippet}
									</OfferingsTable>
								</section>

								<section class="space-y-3 p-4">
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<h2 class="text-2xl font-bold font-serif text-neutral-950">Waitlist</h2>
											</div>
											<p class="mt-1 text-sm text-neutral-900">
												{visibleWaitlistTeams.length} waitlist team{visibleWaitlistTeams.length ===
												1
													? ''
													: 's'} showing
											</p>
										</div>
									</div>

									<OfferingsTable
										columns={waitlistColumns}
										rows={visibleWaitlistTeams}
										caption="Division waitlist table"
									>
										{#snippet emptyBody()}
											<tr class="bg-neutral-25">
												<td
													colspan={waitlistColumns.length}
													class="px-2 py-10 text-center text-sm italic text-neutral-700"
												>
													{#if hasSearchQuery}
														No waitlist teams match this search.
													{:else}
														No waitlisted teams for this division.
													{/if}
												</td>
											</tr>
										{/snippet}

										{#snippet cell(team, column)}
											{@const waitlistTeam = team as WaitlistTeamRow}
											{#if column.key === 'team'}
												<div class="min-w-0">
													<p class="font-sans text-sm font-bold text-neutral-950">
														{waitlistTeam.name}
													</p>
													{#if waitlistTeam.description}
														<p class="mt-1 font-sans text-xs leading-snug text-neutral-700">
															{waitlistTeam.description}
														</p>
													{/if}
												</div>
											{:else if column.key === 'status'}
												<span class="badge-primary-outlined text-xs uppercase tracking-wide">
													Waitlist
												</span>
											{:else if column.key === 'roster'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													{waitlistTeam.rosterSize}
												</p>
											{:else if column.key === 'registration'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													<DateHoverText
														display={formatDateTime(waitlistTeam.dateRegistered)}
														value={waitlistTeam.dateRegistered}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{/if}
										{/snippet}
									</OfferingsTable>
								</section>
							</div>
						{/if}
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-6">
					<DashboardSidebarPanel title="Standings" contentClass="space-y-3 p-4">
						{#snippet content()}
							<OfferingsTable
								columns={standingsColumns}
								rows={visibleStandings}
								caption="Division standings table"
								tableClass="w-full table-fixed border-collapse"
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={standingsColumns.length}
											class="px-2 py-8 text-center text-sm italic text-neutral-700"
										>
											{#if hasSearchQuery}
												No standings rows match this search.
											{:else}
												No standings posted yet.
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(row, column)}
									{@const standingsRow = row as StandingsDisplayRow}
									{#if column.key === 'rank'}
										<div class="flex w-full justify-center">
											<p class="font-sans text-xs leading-snug text-neutral-950">
												{standingsRow.rank}
											</p>
										</div>
									{:else if column.key === 'team'}
										<div class="flex items-center gap-2 min-w-0">
											<div
												class="flex h-6 w-6 shrink-0 items-center justify-center bg-primary text-white"
												aria-hidden="true"
											>
												<HeaderIcon class="h-3.5 w-3.5" />
											</div>
											<div class="min-w-0">
												<HoverTooltip
													text={standingsRow.teamName}
													maxWidthClass="max-w-72"
													wrapperClass="block min-w-0"
												>
													<p
														class="truncate font-sans text-sm font-bold leading-tight text-neutral-950"
													>
														{standingsRow.teamName}
													</p>
												</HoverTooltip>
											</div>
										</div>
									{:else if column.key === 'record'}
										<div class="flex w-full justify-center">
											<p
												class="inline-block w-[5ch] text-center font-sans text-xs leading-none whitespace-nowrap text-neutral-950"
											>
												{formatRecord(standingsRow.wins, standingsRow.losses, standingsRow.ties)}
											</p>
										</div>
									{:else if column.key === 'points'}
										<div class="flex w-full justify-center">
											<p class="font-sans text-xs leading-snug text-neutral-950 tabular-nums">
												{formatStandingCell(standingsRow.points)}
											</p>
										</div>
									{:else if column.key === 'pct'}
										<div class="flex w-full justify-center">
											<p class="font-sans text-xs leading-snug text-neutral-950 tabular-nums">
												{formatStandingCell(standingsRow.winPct)}
											</p>
										</div>
									{:else if column.key === 'streak'}
										<div class="flex w-full justify-center">
											<p class="font-sans text-xs leading-snug text-neutral-950 tabular-nums">
												{formatStreak(standingsRow.streak)}
											</p>
										</div>
									{:else if column.key === 'sportsmanship'}
										<div class="flex w-full justify-center">
											<p class="font-sans text-xs leading-snug text-neutral-950 tabular-nums">
												{formatStandingCell(standingsRow.sportsmanshipRating)}
											</p>
										</div>
									{:else if column.key === 'forfeits'}
										<div class="flex w-full justify-center">
											<p
												class="inline-block w-[5ch] text-center font-sans text-xs leading-none whitespace-nowrap text-neutral-950"
											>
												{formatForfeitSummary(standingsRow.forfeits, standingsRow.forgoes)}
											</p>
										</div>
									{/if}
								{/snippet}
							</OfferingsTable>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="Division Overview">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Description
									</p>
									<p class="mt-1 leading-6">
										{data.division.description ??
											'This division detail page is ready for deeper schedule, stats, and team management work.'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Current Counts
									</p>
									<p class="mt-1">Standings rows: {data.standings.length}</p>
									<p>Active teams: {data.teams.length}</p>
									<p>Waitlist teams: {data.waitlistTeams.length}</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Next Layer
									</p>
									<p class="mt-1 leading-6">
										This page now mirrors the other offerings pages. Schedule, advanced stats, and
										matchup cards can be added into this same shell later.
									</p>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				Division details are not available right now.
			</div>
		{/if}
	</div>
</div>
