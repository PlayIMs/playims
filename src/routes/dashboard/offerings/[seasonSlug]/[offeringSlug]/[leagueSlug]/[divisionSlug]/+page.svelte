<script lang="ts">
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import OfferingsTable from '$lib/components/OfferingsTable.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import type { OfferingsTableColumn } from '$lib/components/offerings-table.js';
	import { IconArrowLeft, IconLock, IconLockOpen, IconUsers } from '@tabler/icons-svelte';

	type StandingsRow = NonNullable<PageData['standings']>[number];
	type TeamRow = NonNullable<PageData['teams']>[number];
	type WaitlistTeamRow = NonNullable<PageData['waitlistTeams']>[number];

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');

	function divisionMetaLine(): string {
		if (!data.division) return '';
		return [data.division.dayOfWeek, data.division.gameTime, data.division.location]
			.filter(Boolean)
			.join(' / ');
	}

	function standingsDifferential(row: StandingsRow): string {
		const value = row.pointsFor - row.pointsAgainst;
		return value > 0 ? `+${value}` : `${value}`;
	}

	function leagueHref(): string {
		if (!data.season?.slug || !data.offering?.slug || !data.league?.slug) {
			return '/dashboard/offerings';
		}
		return `/dashboard/offerings/${data.season.slug}/${data.offering.slug}/${data.league.slug}`;
	}

	function normalizeSearchValue(value: string | null | undefined): string {
		return value?.trim().toLowerCase() ?? '';
	}

	function matchesSearchTerm(values: Array<string | null | undefined>, query: string): boolean {
		if (!query) return true;
		return values.some((value) => normalizeSearchValue(value).includes(query));
	}

	function formatDate(
		value: string | null | undefined,
		options?: Intl.DateTimeFormatOptions
	): string {
		if (!value) return 'TBD';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'TBD';
		return parsed.toLocaleDateString('en-US', options);
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

	const normalizedSearchQuery = $derived.by(() => normalizeSearchValue(searchQuery));

	const visibleStandings = $derived.by<StandingsRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return data.standings;
		return data.standings.filter((row: StandingsRow) =>
			matchesSearchTerm(
				[
					row.teamName,
					String(row.wins),
					String(row.losses),
					String(row.ties),
					String(row.points),
					String(row.pointsFor),
					String(row.pointsAgainst),
					row.winPct,
					row.streak
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
					team.description,
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
			key: 'team',
			label: 'Team',
			widthClass: 'w-[28%]',
			rowHeader: true
		},
		{
			key: 'record',
			label: 'W-L-T',
			widthClass: 'w-[12%]',
			cellClass: 'align-top'
		},
		{
			key: 'for',
			label: 'PF',
			widthClass: 'w-[10%]',
			cellClass: 'align-top'
		},
		{
			key: 'against',
			label: 'PA',
			widthClass: 'w-[10%]',
			cellClass: 'align-top'
		},
		{
			key: 'diff',
			label: 'Diff',
			widthClass: 'w-[10%]',
			cellClass: 'align-top'
		},
		{
			key: 'points',
			label: 'Pts',
			widthClass: 'w-[10%]',
			cellClass: 'align-top'
		},
		{
			key: 'pct',
			label: 'Pct',
			widthClass: 'w-[10%]',
			cellClass: 'align-top'
		},
		{
			key: 'streak',
			label: 'Streak',
			widthClass: 'w-[10%]',
			cellClass: 'align-top'
		}
	]);

	const teamsColumns = $derived.by<OfferingsTableColumn[]>(() => [
		{
			key: 'team',
			label: 'Team',
			widthClass: 'w-[42%]',
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
			widthClass: 'w-[28%]',
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
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
				>
					{data.division?.name ?? 'Division'}
				</h1>
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
								<a
									href={leagueHref()}
									class="button-secondary-outlined inline-flex items-center gap-2 cursor-pointer"
								>
									<IconArrowLeft class="h-4 w-4" />
									<span>Back to {data.league?.name ?? 'League'}</span>
								</a>
								{#if data.league}
									<span
										class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
									>
										{data.league.name}
									</span>
								{/if}
								{#if data.offering}
									<span
										class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
									>
										{data.offering.name}
									</span>
								{/if}
								<span
									class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
								>
									Division
								</span>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 bg-white px-2 py-1">
									{visibleStandings.length} standings rows
								</span>
								<span class="border border-secondary-300 bg-white px-2 py-1">
									{visibleTeams.length} active teams
								</span>
								<span class="border border-secondary-300 bg-white px-2 py-1">
									{visibleWaitlistTeams.length} waitlist
								</span>
								<span class="border border-secondary-300 bg-white px-2 py-1">
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
												<h2 class="text-2xl font-bold font-serif text-neutral-950">Standings</h2>
												<span
													class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
												>
													Rankings
												</span>
											</div>
											<p class="mt-1 text-sm text-neutral-900">
												{visibleStandings.length} of {data.standings.length} teams in the table
											</p>
										</div>
									</div>

									<OfferingsTable
										columns={standingsColumns}
										rows={visibleStandings}
										caption="Division standings table"
									>
										{#snippet emptyBody()}
											<tr class="bg-neutral-25">
												<td
													colspan={standingsColumns.length}
													class="px-2 py-10 text-center text-sm italic text-neutral-700"
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
											{@const standingsRow = row as StandingsRow}
											{#if column.key === 'team'}
												<div class="min-w-0">
													<p class="font-sans text-sm font-bold text-neutral-950">
														{standingsRow.teamName}
													</p>
												</div>
											{:else if column.key === 'record'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsRow.wins}-{standingsRow.losses}-{standingsRow.ties}
												</p>
											{:else if column.key === 'for'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsRow.pointsFor}
												</p>
											{:else if column.key === 'against'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsRow.pointsAgainst}
												</p>
											{:else if column.key === 'diff'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsDifferential(standingsRow)}
												</p>
											{:else if column.key === 'points'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsRow.points}
												</p>
											{:else if column.key === 'pct'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsRow.winPct}
												</p>
											{:else if column.key === 'streak'}
												<p class="text-right font-sans text-xs leading-snug text-neutral-950">
													{standingsRow.streak}
												</p>
											{/if}
										{/snippet}
									</OfferingsTable>
								</section>

								<section class="space-y-3 p-4">
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<h2 class="text-2xl font-bold font-serif text-neutral-950">Teams</h2>
												<span
													class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
												>
													Active
												</span>
											</div>
											<p class="mt-1 text-sm text-neutral-900">
												{visibleTeams.length} active team{visibleTeams.length === 1 ? '' : 's'}
												showing
											</p>
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
												<div class="min-w-0">
													<p class="font-sans text-sm font-bold text-neutral-950">
														{activeTeam.name}
													</p>
													{#if activeTeam.description}
														<p class="mt-1 font-sans text-xs leading-snug text-neutral-700">
															{activeTeam.description}
														</p>
													{/if}
												</div>
											{:else if column.key === 'status'}
												<span class="badge-secondary-outlined text-xs uppercase tracking-wide">
													Division
												</span>
											{:else if column.key === 'roster'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													{activeTeam.rosterSize}
												</p>
											{:else if column.key === 'registration'}
												<p class="font-sans text-xs leading-snug text-neutral-950">
													<DateHoverText
														display={formatDateTime(activeTeam.dateRegistered)}
														value={activeTeam.dateRegistered}
														includeTime
														wrapperClass="inline"
													/>
												</p>
											{/if}
										{/snippet}
									</OfferingsTable>
								</section>

								<section class="space-y-3 p-4">
									<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<h2 class="text-2xl font-bold font-serif text-neutral-950">
													Division Waitlist
												</h2>
												<span
													class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
												>
													Waitlist
												</span>
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
					<DashboardSidebarPanel title="Division Snapshot">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										League
									</p>
									<p class="mt-1 font-semibold">{data.league?.name ?? 'Unknown league'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										Offering: {data.offering?.name ?? 'Unknown offering'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Schedule Slot
									</p>
									<p class="mt-1 font-semibold">{divisionMetaLine() || 'Not scheduled yet.'}</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Start Date
									</p>
									<p class="mt-1">
										<DateHoverText
											display={formatDate(data.division.startDate, {
												month: 'short',
												day: 'numeric',
												year: 'numeric'
											})}
											value={data.division.startDate}
										/>
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Status
									</p>
									<p class="mt-1 inline-flex items-center gap-2">
										{#if data.division.isLocked}
											<IconLock class="h-4 w-4" />
											<span>Locked</span>
										{:else}
											<IconLockOpen class="h-4 w-4" />
											<span>Unlocked</span>
										{/if}
									</p>
									<p class="mt-1 text-xs text-neutral-700">
										Capacity: {data.division.maxTeams ?? data.teams.length} teams
									</p>
								</div>
							</div>
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
