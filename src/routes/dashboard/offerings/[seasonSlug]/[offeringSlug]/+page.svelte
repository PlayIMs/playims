<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import OfferingsTable from '$lib/components/OfferingsTable.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
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
		IconTarget
	} from '@tabler/icons-svelte';

	type OfferingLeagueRow = NonNullable<PageData['leagues']>[number];
	type OfferingDivisionRow = OfferingLeagueRow['divisions'][number];
	type OfferingType = 'league' | 'tournament';

	interface DropdownOption {
		value: string;
		label: string;
		statusLabel?: string;
		separatorBefore?: boolean;
		disabled?: boolean;
		tooltip?: string;
		disabledTooltip?: string;
	}

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');

	function normalizeAuthRole(
		value: string | null | undefined
	): 'participant' | 'manager' | 'admin' | 'dev' {
		const normalized = value?.trim().toLowerCase();
		if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
			return normalized;
		}
		return 'participant';
	}

	const canManageOffering = $derived.by(() => {
		const role = normalizeAuthRole(data?.authMode?.effectiveRole);
		return role === 'manager' || role === 'admin' || role === 'dev';
	});

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

	function toTitleCase(value: string | null | undefined): string | null {
		const normalized = value?.trim();
		if (!normalized) return null;
		return normalized
			.split(/[\s_-]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function offeringType(): OfferingType {
		return data.offering?.type?.trim().toLowerCase() === 'tournament' ? 'tournament' : 'league';
	}

	function entryUnitSingular(): 'league' | 'group' {
		return offeringType() === 'tournament' ? 'group' : 'league';
	}

	function entryUnitPlural(): 'leagues' | 'groups' {
		return offeringType() === 'tournament' ? 'groups' : 'leagues';
	}

	function entryUnitTitleSingular(): 'League' | 'Group' {
		return offeringType() === 'tournament' ? 'Group' : 'League';
	}

	function leagueStatusFor(league: OfferingLeagueRow) {
		if (!league.isActive || league.isLocked) {
			return {
				label: 'Closed',
				className: 'border border-primary-700 bg-primary text-white'
			};
		}

		const now = Date.now();
		const start = league.regStartDate ? Date.parse(league.regStartDate) : Number.NaN;
		const end = league.regEndDate ? Date.parse(league.regEndDate) : Number.NaN;
		if (Number.isFinite(start) && start > now) {
			return {
				label: 'Upcoming',
				className: 'border border-secondary-500 bg-white text-neutral-950'
			};
		}
		if (Number.isFinite(end) && end < now) {
			return {
				label: 'Closed',
				className: 'border border-primary-700 bg-primary text-white'
			};
		}

		return {
			label: 'Open',
			className: 'border border-secondary-500 bg-secondary text-white'
		};
	}

	function divisionStatusFor(division: OfferingDivisionRow) {
		if (division.isLocked) {
			return {
				label: 'Locked',
				className: 'border border-primary-700 bg-primary text-white'
			};
		}
		if (typeof division.maxTeams === 'number' && division.teamCount >= division.maxTeams) {
			if (division.waitlistCount > 0) {
				return {
					label: 'Waitlist',
					className: 'border border-primary-700 bg-white text-primary-800'
				};
			}
			return {
				label: 'Full',
				className: 'border border-neutral-950 bg-white text-neutral-950'
			};
		}
		return {
			label: 'Open',
			className: 'border border-secondary-500 bg-secondary text-white'
		};
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

	function normalizeSearchValue(value: string | null | undefined): string {
		return value?.trim().toLowerCase() ?? '';
	}

	function matchesSearchTerm(values: Array<string | null | undefined>, query: string): boolean {
		if (!query) return true;
		return values.some((value) => normalizeSearchValue(value).includes(query));
	}

	function leagueMetaLine(league: OfferingLeagueRow): string {
		return `${toTitleCase(league.gender) ?? 'Open'} / ${toTitleCase(league.skillLevel) ?? 'All Levels'}`;
	}

	function divisionMetaLine(division: OfferingDivisionRow): string {
		return [division.dayOfWeek, division.gameTime, division.location].filter(Boolean).join(' / ');
	}

	function divisionCapacityLabel(division: OfferingDivisionRow): string {
		if (typeof division.maxTeams === 'number') {
			return `${division.teamCount} / ${division.maxTeams} teams`;
		}
		return `${division.teamCount} teams`;
	}

	function leagueHref(league: OfferingLeagueRow): string {
		const seasonSlug = data.season?.slug?.trim();
		const offeringSlug = data.offering?.slug?.trim();
		const leagueSlug = league.slug?.trim() || league.id;
		if (!seasonSlug || !offeringSlug || !leagueSlug) return '/dashboard/offerings';
		return `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}`;
	}

	function offeringSeasonHref(
		seasonSlug: string | null | undefined,
		offeringSlug: string | null | undefined
	): string {
		const normalizedSeasonSlug = seasonSlug?.trim();
		const normalizedOfferingSlug = offeringSlug?.trim();
		if (!normalizedSeasonSlug || !normalizedOfferingSlug) {
			return '/dashboard/offerings';
		}
		return `/dashboard/offerings/${normalizedSeasonSlug}/${normalizedOfferingSlug}`;
	}

	function divisionHref(league: OfferingLeagueRow, division: OfferingDivisionRow): string {
		const seasonSlug = data.season?.slug?.trim();
		const offeringSlug = data.offering?.slug?.trim();
		const leagueSlug = league.slug?.trim() || league.id;
		const divisionSlug = division.slug?.trim() || division.id;
		if (!seasonSlug || !offeringSlug || !leagueSlug || !divisionSlug) return leagueHref(league);
		return `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}/${divisionSlug}`;
	}

	function buildOfferingsBoardHref(action?: 'create-league'): string {
		const params = new URLSearchParams();
		const seasonSlug = data.season?.slug?.trim();
		const view = offeringType() === 'tournament' ? 'tournaments' : 'leagues';
		if (seasonSlug && !data.season?.isCurrent) {
			params.set('season', seasonSlug);
		}
		params.set('view', view);
		if (action === 'create-league' && data.offering?.id) {
			params.set('action', 'create-league');
			params.set('offeringId', data.offering.id);
		}

		const query = params.toString();
		return query ? `/dashboard/offerings?${query}` : '/dashboard/offerings';
	}

	async function openCreateEntryFlow(): Promise<void> {
		await goto(buildOfferingsBoardHref('create-league'));
	}

	async function handleAddAction(action: string): Promise<void> {
		if (action === 'create-division') {
			const targetLeague = visibleLeagues[0] ?? data.leagues[0] ?? null;
			if (targetLeague) {
				await goto(leagueHref(targetLeague));
			}
			return;
		}
		await openCreateEntryFlow();
	}

	function leagueMatchesSearch(league: OfferingLeagueRow, query: string): boolean {
		return matchesSearchTerm(
			[
				league.name,
				league.slug,
				league.description,
				leagueMetaLine(league),
				leagueStatusFor(league).label,
				formatDateTime(league.regStartDate),
				formatDateTime(league.regEndDate)
			],
			query
		);
	}

	function divisionMatchesSearch(division: OfferingDivisionRow, query: string): boolean {
		return matchesSearchTerm(
			[
				division.name,
				division.slug,
				division.description,
				divisionMetaLine(division),
				divisionStatusFor(division).label,
				divisionCapacityLabel(division),
				String(division.waitlistCount),
				formatDate(division.startDate, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			],
			query
		);
	}

	function leagueVisibleTeamCount(league: OfferingLeagueRow): number {
		return league.divisions.reduce((sum, division) => sum + division.teamCount, 0);
	}

	function leagueVisibleWaitlistCount(league: OfferingLeagueRow): number {
		return league.divisions.reduce((sum, division) => sum + division.waitlistCount, 0);
	}

	const HeaderIcon = $derived.by(() =>
		sportIconFor(data.offering?.name ?? 'Offering', data.offering?.sport ?? null)
	);

	const normalizedSearchQuery = $derived.by(() => normalizeSearchValue(searchQuery));

	const visibleLeagues = $derived.by<OfferingLeagueRow[]>(() => {
		const query = normalizedSearchQuery;
		if (!query) return data.leagues;

		return data.leagues.flatMap((league: OfferingLeagueRow) => {
			const showAllDivisions = leagueMatchesSearch(league, query);
			const matchingDivisions = showAllDivisions
				? league.divisions
				: league.divisions.filter((division: OfferingDivisionRow) =>
						divisionMatchesSearch(division, query)
					);

			if (!showAllDivisions && matchingDivisions.length === 0) {
				return [];
			}

			return [
				{
					...league,
					divisions: matchingDivisions,
					divisionCount: matchingDivisions.length,
					teamCount: matchingDivisions.reduce((sum, division) => sum + division.teamCount, 0),
					waitlistCount: matchingDivisions.reduce(
						(sum, division) => sum + division.waitlistCount,
						0
					)
				}
			];
		});
	});

	const hasSearchQuery = $derived.by(() => normalizedSearchQuery.length > 0);

	function seasonHistoryStatusLabel(season: NonNullable<PageData['seasonHistory']>[number]): string {
		if (season.isCurrent) return 'CURRENT';
		const today = new Date().toISOString().slice(0, 10);
		return season.startDate > today ? 'FUTURE' : 'PAST';
	}

	const seasonHistoryDropdownOptions = $derived.by<DropdownOption[]>(() =>
		(data.seasonHistory ?? []).map((season: NonNullable<PageData['seasonHistory']>[number]) => ({
			value: offeringSeasonHref(season.seasonSlug, season.offeringSlug),
			label: season.seasonName,
			statusLabel: seasonHistoryStatusLabel(season)
		}))
	);

	const selectedSeasonHistoryValue = $derived.by(() =>
		offeringSeasonHref(data.season?.slug, data.offering?.slug)
	);

	async function handleSeasonHistoryChange(value: string): Promise<void> {
		if (!value || value === selectedSeasonHistoryValue) return;
		await goto(value);
	}

	const entryAddActionOptions = $derived.by<DropdownOption[]>(() => [
		{
			value: 'create-league',
			label: 'Add League',
			statusLabel: 'Create a new league in this offering'
		},
		{
			value: 'create-division',
			label: 'Add Division',
			statusLabel:
				data.leagues.length > 0
					? 'Open the first league shown so you can add a division there'
					: 'Add a league before creating a division',
			disabled: data.leagues.length === 0
		}
	]);

	const divisionTableColumns = $derived.by<OfferingsTableColumn[]>(() => [
		{
			key: 'division',
			label: 'Division',
			widthClass: 'w-[34%]',
			rowHeader: true
		},
		{
			key: 'status',
			label: 'Status',
			widthClass: 'w-[14%]',
			cellClass: 'align-top'
		},
		{
			key: 'teams',
			label: 'Teams',
			widthClass: 'w-[16%]',
			cellClass: 'align-top'
		},
		{
			key: 'schedule',
			label: 'Schedule Slot',
			widthClass: 'w-[24%]',
			cellClass: 'align-top'
		},
		{
			key: 'start-date',
			label: 'Start Date',
			widthClass: 'w-[12%]',
			cellClass: 'align-top'
		}
	]);
</script>

<svelte:head>
	<title>{data.offering?.name ?? 'Offering'} - PlayIMs</title>
	<meta
		name="description"
		content="Offering details and all leagues available within this season offering."
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
					<HeaderIcon class="h-7 w-7 lg:h-8 lg:w-8" />
				</div>
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
				>
					{data.offering?.name ?? 'Offering'}
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

		{#if data.offering}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.offering.name}
								</h2>
								<ListboxDropdown
									options={seasonHistoryDropdownOptions}
									value={selectedSeasonHistoryValue}
									ariaLabel="Offering season history"
									buttonClass="button-secondary-outlined px-3 py-1 text-sm font-semibold text-neutral-950 cursor-pointer inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
									emptyText="No other seasons available."
									disabled={seasonHistoryDropdownOptions.length <= 1}
									on:change={(event) => {
										void handleSeasonHistoryChange(event.detail.value);
									}}
								/>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.leagueCount}
									{entryUnitPlural()}
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.divisionCount} divisions
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.openCount} open
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.summary.closedCount} closed
								</span>
								{#if canManageOffering}
									<SplitAddAction
										options={entryAddActionOptions}
										on:click={() => {
											void openCreateEntryFlow();
										}}
										on:action={(event) => {
											void handleAddAction(event.detail.value);
										}}
									/>
								{/if}
							</div>
						</div>
						<SearchInput
							id="offering-search"
							label={`Search ${entryUnitPlural()} and divisions`}
							value={searchQuery}
							placeholder={`Search ${entryUnitSingular()}, division, schedule, or location`}
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel={`Clear ${entryUnitSingular()} and division search`}
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="min-h-[34rem]">
						{#if visibleLeagues.length === 0}
							<div class="p-4">
								<div
									class={`space-y-2 border p-4 ${hasSearchQuery ? 'border-warning-300 bg-warning-50' : 'border-neutral-950 bg-white'}`}
								>
									<h3 class="text-xl font-bold font-serif text-neutral-950">
										{#if hasSearchQuery}
											No matches found
										{:else}
											No {entryUnitPlural()} yet
										{/if}
									</h3>
									<p class="text-sm font-sans text-neutral-950">
										{#if hasSearchQuery}
											No {entryUnitPlural()} or divisions match "{searchQuery.trim()}".
										{:else}
											No {entryUnitPlural()} exist for this offering yet.
										{/if}
									</p>
								</div>
							</div>
						{:else}
							<div class="divide-y divide-neutral-950">
								{#each visibleLeagues as league}
									<section class="space-y-3 p-4">
										<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<a
														href={leagueHref(league)}
														class="text-2xl font-bold font-serif text-neutral-950 hover:underline"
													>
														{league.name}
													</a>
													<span
														class="badge-secondary-outlined px-1.5 py-0 text-[10px] uppercase tracking-wide"
													>
														{entryUnitTitleSingular()}
													</span>
												</div>
												<p class="mt-1 text-sm text-neutral-900">{leagueMetaLine(league)}</p>
												{#if league.description}
													<p class="mt-1 text-sm leading-6 text-neutral-950">
														{league.description}
													</p>
												{/if}
											</div>
											<div class="flex flex-wrap items-center gap-1">
												<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
													{league.divisions.length} divisions
												</span>
												<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
													{leagueVisibleTeamCount(league)} teams
												</span>
												{#if leagueVisibleWaitlistCount(league) > 0}
													<span class="badge-primary-outlined text-xs uppercase tracking-wide">
														{leagueVisibleWaitlistCount(league)} waitlist
													</span>
												{/if}
												<span
													class={`${leagueStatusFor(league).className} px-2 py-0.5 text-xs font-bold uppercase tracking-wide`}
												>
													{leagueStatusFor(league).label}
												</span>
											</div>
										</div>

										<OfferingsTable
											columns={divisionTableColumns}
											rows={league.divisions}
											caption={`${league.name} divisions table`}
										>
											{#snippet emptyBody()}
												<tr class="bg-neutral-25">
													<td
														colspan={divisionTableColumns.length}
														class="px-2 py-10 text-center text-sm italic text-neutral-700"
													>
														No divisions exist for this {entryUnitSingular()} yet.
													</td>
												</tr>
											{/snippet}

											{#snippet cell(division, column)}
												{@const offeringDivision = division as OfferingDivisionRow}
												{@const divisionStatus = divisionStatusFor(offeringDivision)}
												{#if column.key === 'division'}
													<div class="flex items-center gap-2">
														<div
															class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
															aria-hidden="true"
														>
															<HeaderIcon class="h-5 w-5" />
														</div>
														<div class="min-w-0">
															<a
																href={divisionHref(league, offeringDivision)}
																class="font-sans text-sm font-bold text-neutral-950 hover:underline"
															>
																{offeringDivision.name}
															</a>
															{#if offeringDivision.description}
																<p class="mt-1 font-sans text-xs leading-snug text-neutral-700">
																	{offeringDivision.description}
																</p>
															{/if}
														</div>
													</div>
												{:else if column.key === 'status'}
													<span
														class={`${divisionStatus.className} px-2 py-1 text-xs font-bold uppercase tracking-wide`}
													>
														{divisionStatus.label}
													</span>
												{:else if column.key === 'teams'}
													<div class="space-y-1 font-sans text-xs leading-snug text-neutral-950">
														<p>{divisionCapacityLabel(offeringDivision)}</p>
														{#if offeringDivision.waitlistCount > 0}
															<p class="text-neutral-700">
																{offeringDivision.waitlistCount} waitlist
															</p>
														{/if}
													</div>
												{:else if column.key === 'schedule'}
													<p class="font-sans text-xs leading-snug text-neutral-950">
														{divisionMetaLine(offeringDivision) || 'Not scheduled yet.'}
													</p>
												{:else if column.key === 'start-date'}
													<p class="font-sans text-xs leading-snug text-neutral-950">
														<DateHoverText
															display={formatDate(offeringDivision.startDate, {
																month: 'short',
																day: 'numeric',
																year: 'numeric'
															})}
															value={offeringDivision.startDate}
														/>
													</p>
												{/if}
											{/snippet}
										</OfferingsTable>
									</section>
								{/each}
							</div>
						{/if}
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-6">
					<DashboardSidebarPanel title="Offering Snapshot">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Season
									</p>
									<p class="mt-1 font-semibold">{data.season?.name ?? 'TBD'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										Type: {toTitleCase(data.offering.type) ?? 'League'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Sport
									</p>
									<p class="mt-1 font-semibold">{data.offering.sport ?? 'Not specified'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										Roster: {data.offering.minPlayers ?? 'TBD'} min / {data.offering.maxPlayers ??
											'TBD'} max
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Description
									</p>
									<p class="mt-1 leading-6">
										{data.offering.description ?? 'No offering description has been added yet.'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Rulebook
									</p>
									{#if data.offering.rulebookUrl}
										<a
											href={data.offering.rulebookUrl}
											target="_blank"
											rel="noreferrer"
											class="mt-1 inline-flex font-semibold text-secondary-900 underline underline-offset-2"
										>
											Open rulebook
										</a>
									{:else}
										<p class="mt-1">No rulebook linked yet.</p>
									{/if}
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title={`${entryUnitTitleSingular()} Snapshot`}>
						{#snippet content()}
							{#if visibleLeagues.length === 0}
								<p class="text-sm font-sans text-neutral-950">
									{#if hasSearchQuery}
										No {entryUnitPlural()} match this search right now.
									{:else}
										No {entryUnitPlural()} are available yet.
									{/if}
								</p>
							{:else}
								<div class="space-y-3">
									{#each visibleLeagues as league}
										{@const leagueStatus = leagueStatusFor(league)}
										<a
											href={leagueHref(league)}
											class="block border border-neutral-950 bg-white p-3 transition-colors hover:bg-neutral-25"
										>
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<p class="font-serif text-lg font-bold text-neutral-950">
														{league.name}
													</p>
													<p
														class="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-800"
													>
														{leagueMetaLine(league)}
													</p>
												</div>
												<div class="flex flex-col items-end gap-1">
													<span
														class={`${leagueStatus.className} px-2 py-0.5 text-xs font-bold uppercase tracking-wide`}
													>
														{leagueStatus.label}
													</span>
													<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
														{league.divisions.length} divisions
													</span>
													<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
														{leagueVisibleTeamCount(league)} teams
													</span>
												</div>
											</div>
										</a>
									{/each}
								</div>
							{/if}
						{/snippet}
					</DashboardSidebarPanel>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				Offering details are not available right now.
			</div>
		{/if}
	</div>
</div>
