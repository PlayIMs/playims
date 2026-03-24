<script lang="ts">
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SmallStandingsTable from '$lib/components/SmallStandingsTable.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import type { DataTableColumn } from '$lib/components/data-table.js';
	import {
		createLocalChatMessage,
		summarizeTeamRosterCounts,
		type LocalChatMessage
	} from '$lib/team-page-ui.js';
	import {
		IconBallAmericanFootball,
		IconBallBaseball,
		IconBallBasketball,
		IconBallFootball,
		IconBallTennis,
		IconBallVolleyball,
		IconCalendar,
		IconCrosshair,
		IconMailPlus,
		IconMessageCircle,
		IconShip,
		IconTarget,
		IconUserCheck,
		IconUserPlus,
		IconUsers
	} from '@tabler/icons-svelte';

	type RosterRow = PageData['roster'][number];
	type ScheduleRow = PageData['schedule'][number];
	type TeamOption = PageData['teamOptions'][number];
	type OfferingOption = PageData['offeringOptions'][number];
	type LeagueOption = PageData['leagueOptions'][number];
	type DivisionOption = PageData['divisionOptions'][number];

	let { data } = $props<{ data: PageData }>();
	let localChatDraft = $state('');
	let localChatMessages = $state<LocalChatMessage[]>([]);
	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).offerings
	);

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

	function teamHref(): string {
		const baseDivisionHref = divisionHref();
		const teamSlug = data.team?.slug?.trim() || data.team?.id?.trim();
		if (!teamSlug || baseDivisionHref === '/dashboard/offerings') return baseDivisionHref;
		return `${baseDivisionHref}/${encodeURIComponent(teamSlug)}`;
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

	function formatGameWindow(startAt: string | null | undefined, endAt: string | null | undefined): string {
		if (!startAt && !endAt) return 'TBD';
		if (!startAt && endAt) return `Until ${formatDateTime(endAt)}`;
		if (startAt && !endAt) return formatDateTime(startAt);
		const startDisplay = formatDateTime(startAt);
		const endDisplay = formatDateTime(endAt);
		if (startDisplay === 'TBD' || endDisplay === 'TBD') return startDisplay;
		return `${startDisplay} - ${endDisplay}`;
	}

	function statusBadgeClass(status: string): string {
		const normalized = status.trim().toLowerCase();
		if (
			normalized.includes('final') ||
			normalized.includes('completed') ||
			normalized.includes('cancel')
		) {
			return 'badge-secondary-outlined';
		}
		return 'badge-primary-outlined';
	}

	function formatChatTimestamp(value: string): string {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '';
		return parsed.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function sendLocalChatMessage() {
		const message = createLocalChatMessage(localChatDraft);
		if (!message) return;
		localChatMessages = [...localChatMessages, message];
		localChatDraft = '';
	}

	const HeaderIcon = $derived.by(() =>
		sportIconFor(data.offering?.name ?? data.team?.name ?? 'Team', data.offering?.sport ?? null)
	);
	const currentTeamHref = $derived.by(() => teamHref());
	const standingsTeamHrefByTeamId = $derived.by(
		() => (teamId: string): string | undefined => {
			const standingRow = data.standings.find(
				(row: PageData['standings'][number]) => row.teamId === teamId
			);
			if (!standingRow) return undefined;
			return (data.teamOptions ?? []).find(
				(option: TeamOption) => option.label === standingRow.teamName
			)?.href;
		}
	);
	const breadcrumbSegments = $derived.by<BreadcrumbSegment[]>(() => {
		if (!data.offering || !data.league || !data.division || !data.team) return [];
		const currentOfferingHref = offeringHref();
		const currentLeagueHref = leagueHref();
		const currentDivisionHref = divisionHref();
		const currentTeam = currentTeamHref;

		return [
			{
				key: 'offerings',
				label: pageLabel,
				href: '/dashboard/offerings',
				currentValue: currentTeam,
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
				searchEnabled: false,
				options: (data.offeringOptions ?? []).map((option: OfferingOption) => ({
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
				options: (data.leagueOptions ?? []).map((option: LeagueOption) => ({
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
				options: (data.divisionOptions ?? []).map((option: DivisionOption) => ({
					value: option.href,
					label: option.label
				}))
			},
			{
				key: 'team',
				label: data.team.name,
				href: currentTeam,
				currentValue: currentTeam,
				menuAriaLabel: 'Switch team',
				options: (data.teamOptions ?? []).map((option: TeamOption) => ({
					value: option.href,
					label: option.label
				}))
			}
		];
	});
	const includeBreadcrumbSeasonContext = $derived.by(() => data.season?.isCurrent === false);
	const breadcrumbSeasonLabel = $derived.by(() =>
		includeBreadcrumbSeasonContext ? (data.season?.name ?? null) : null
	);
	const breadcrumbSeasonSlug = $derived.by(() =>
		includeBreadcrumbSeasonContext ? (data.season?.slug ?? null) : null
	);

	const rosterColumns = $derived.by<DataTableColumn[]>(() => [
		{ key: 'player', label: 'Player', width: '34%', rowHeader: true },
		{ key: 'email', label: 'Email', width: '28%' },
		{ key: 'role', label: 'Role', width: '14%', cellVerticalAlignment: 'top' },
		{ key: 'status', label: 'Status', width: '10%', cellVerticalAlignment: 'top' },
		{ key: 'joined', label: 'Joined', width: '14%', cellVerticalAlignment: 'top' }
	]);
	const scheduleColumns = $derived.by<DataTableColumn[]>(() => [
		{ key: 'game', label: 'Game', width: '28%', rowHeader: true },
		{ key: 'time', label: 'Time', width: '28%', cellVerticalAlignment: 'top' },
		{ key: 'location', label: 'Location', width: '20%', cellVerticalAlignment: 'top' },
		{ key: 'result', label: 'Result', width: '12%', cellVerticalAlignment: 'top' },
		{ key: 'status', label: 'Status', width: '12%', cellVerticalAlignment: 'top' }
	]);
	const rosterSummary = $derived.by(() =>
		summarizeTeamRosterCounts(data.roster.map((player: RosterRow) => player.rosterStatus))
	);
</script>

<PageTitle pageTitle={data.team?.name ?? 'Team'} />

<svelte:head>
	<meta
		name="description"
		content="Team detail page with roster, standings snapshot, overview, team chat, and schedule."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 flex h-11 w-11 items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
					aria-hidden="true"
				>
					<IconUsers class="h-7 w-7 lg:h-8 lg:w-8" />
				</div>
				<div class="relative min-w-0">
					<h1
						class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
					>
						{data.team?.name ?? 'Team'}
					</h1>
					{#if breadcrumbSegments.length > 0}
							<div class="absolute left-0 top-[calc(100%+0.09rem)] z-10">
							<Breadcrumb
								segments={breadcrumbSegments}
								class="max-w-[min(100vw-7rem,100%)]"
								seasonLabel={breadcrumbSeasonLabel}
								seasonSlug={breadcrumbSeasonSlug}
								includeSeasonContext={includeBreadcrumbSeasonContext}
							/>
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

		{#if data.team}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.team.name}
								</h2>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.roster.length} rostered players
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.schedule.length} scheduled games
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.team.teamStatus}
								</span>
							</div>
						</div>
					</div>

					<div class="divide-y divide-neutral-950">
						<section class="space-y-3 p-4">
							<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<div class="min-w-0">
									<h3 class="text-2xl font-bold font-serif text-neutral-950">Roster</h3>
									<p class="mt-1 text-sm text-neutral-900">
										Current active players for this team.
									</p>
								</div>
							</div>
			<DataTable
								columns={rosterColumns}
								rows={data.roster}
								caption="Team roster table"
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={rosterColumns.length}
											class="px-2 py-10 text-center text-sm italic text-neutral-700"
										>
											No rostered players yet.
										</td>
									</tr>
								{/snippet}
								{#snippet cell(row, column)}
									{@const player = row as RosterRow}
									{#if column.key === 'player'}
										<p class="font-sans text-sm font-bold text-neutral-950">{player.displayName}</p>
									{:else if column.key === 'email'}
										<p class="font-sans text-xs leading-snug text-neutral-950">
											{player.email ?? '-'}
										</p>
									{:else if column.key === 'role'}
										<span class="badge-secondary-outlined text-xs uppercase tracking-wide">
											{player.roleLabel}
										</span>
									{:else if column.key === 'status'}
										<span class="badge-primary-outlined text-xs uppercase tracking-wide">
											{player.rosterStatus}
										</span>
									{:else if column.key === 'joined'}
										<p class="font-sans text-xs leading-snug text-neutral-950">
											<DateHoverText
												display={formatDateTime(player.dateJoined)}
												value={player.dateJoined}
												includeTime
												wrapperClass="inline"
											/>
										</p>
									{/if}
								{/snippet}
			</DataTable>
						</section>

						<section class="space-y-3 p-4">
							<div class="min-w-0">
								<h3 class="text-2xl font-bold font-serif text-neutral-950">Game Schedule</h3>
								<p class="mt-1 text-sm text-neutral-900">
									Upcoming and completed games for {data.team.name}.
								</p>
							</div>
			<DataTable
								columns={scheduleColumns}
								rows={data.schedule}
								caption="Team schedule table"
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={scheduleColumns.length}
											class="px-2 py-10 text-center text-sm italic text-neutral-700"
										>
											No scheduled games yet.
										</td>
									</tr>
								{/snippet}
								{#snippet cell(row, column)}
									{@const game = row as ScheduleRow}
									{#if column.key === 'game'}
										<div class="min-w-0">
											<p class="font-sans text-sm font-bold text-neutral-950">
												vs {game.opponentName}
											</p>
											<p class="font-sans text-[11px] leading-snug text-neutral-700">
												{game.isHome ? 'Home' : 'Away'}
												{#if game.weekLabel}
													. {game.weekLabel}
												{/if}
											</p>
										</div>
									{:else if column.key === 'time'}
										<p class="font-sans text-xs leading-snug text-neutral-950">
											{formatGameWindow(game.scheduledStartAt, game.scheduledEndAt)}
										</p>
									{:else if column.key === 'location'}
										<p class="font-sans text-xs leading-snug text-neutral-950">{game.location}</p>
									{:else if column.key === 'result'}
										<p class="font-sans text-xs leading-snug text-neutral-950">
											{game.resultLabel}
										</p>
									{:else if column.key === 'status'}
										<span class={`${statusBadgeClass(game.status)} text-xs uppercase tracking-wide`}>
											{game.status}
										</span>
									{/if}
								{/snippet}
			</DataTable>
						</section>
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-6">
					<DashboardSidebarPanel title="Division Standings" contentClass="space-y-3 p-4">
						{#snippet content()}
							<SmallStandingsTable
								rows={data.standings}
								icon={HeaderIcon}
								caption="Division standings table"
								teamHrefByTeamId={standingsTeamHrefByTeamId}
								highlightTeamId={data.team.id}
								onlyHighlightTeamName
								emptyMessage="No standings posted yet."
							/>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="Team Overview">
						{#snippet content()}
							<div class="space-y-2.5 text-[13px] text-neutral-950">
								<div class="border border-neutral-950 bg-white p-2.5">
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
										<div class="min-w-0">
											<div class="flex items-start gap-2">
												<IconCalendar class="mt-0.5 h-4 w-4 shrink-0 text-secondary-700" />
												<div class="min-w-0">
													<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
														Registered
													</p>
													<p class="mt-0.5 leading-tight">
														<DateHoverText
															display={formatDateTime(data.team.dateRegistered ?? data.team.createdAt)}
															value={data.team.dateRegistered ?? data.team.createdAt}
															includeTime
															wrapperClass="inline"
														/>
													</p>
												</div>
											</div>
										</div>
										<div
											class="min-w-0 border-t border-secondary-200 pt-2 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
										>
											<div class="flex items-start gap-2">
												<IconCalendar class="mt-0.5 h-4 w-4 shrink-0 text-secondary-700" />
												<div class="min-w-0">
													<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
														Joined Division
													</p>
													<p class="mt-0.5 leading-tight">
														<DateHoverText
															display={formatDateTime(data.team.dateJoinedDivision ?? data.team.createdAt)}
															value={data.team.dateJoinedDivision ?? data.team.createdAt}
															includeTime
															wrapperClass="inline"
														/>
													</p>
												</div>
											</div>
										</div>
										<div
											class="min-w-0 border-t border-secondary-200 pt-2 sm:border-t-0 sm:pt-0"
										>
											<div class="flex items-start gap-2">
												<IconUsers class="mt-0.5 h-4 w-4 shrink-0 text-secondary-700" />
												<div class="min-w-0">
													<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
														Total Roster Players
													</p>
													<p class="mt-0.5 leading-tight">{rosterSummary.totalRosterPlayers}</p>
												</div>
											</div>
										</div>
										<div
											class="min-w-0 border-t border-secondary-200 pt-2 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
										>
											<div class="flex items-start gap-2">
												<IconMailPlus class="mt-0.5 h-4 w-4 shrink-0 text-secondary-700" />
												<div class="min-w-0">
													<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
														Pending Invitations
													</p>
													<p class="mt-0.5 leading-tight">{rosterSummary.pendingInvitations}</p>
												</div>
											</div>
										</div>
										<div class="min-w-0 sm:border-l-0 sm:pl-0">
											<div class="flex items-start gap-2">
												<IconUserPlus class="mt-0.5 h-4 w-4 shrink-0 text-secondary-700" />
												<div class="min-w-0">
													<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
														Free Agents
													</p>
													<p class="mt-0.5 leading-tight">
														{data.team.doesAcceptFreeAgents ? 'Accepting' : 'Not accepting'}
													</p>
												</div>
											</div>
										</div>
										<div class="min-w-0 sm:border-l sm:pl-2">
											<div class="flex items-start gap-2">
												<IconUserCheck class="mt-0.5 h-4 w-4 shrink-0 text-secondary-700" />
												<div class="min-w-0">
													<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
														Auto-Accept Members
													</p>
													<p class="mt-0.5 leading-tight">
														{data.team.isAutoAcceptMembers ? 'Enabled' : 'Disabled'}
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="Team Chat">
						{#snippet content()}
							<div class="space-y-2.5 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white">
									<div class="flex items-center gap-2 border-b border-secondary-200 bg-neutral-25 px-3 py-2">
										<IconMessageCircle class="h-4 w-4 shrink-0 text-secondary-700" />
										<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
											Local Preview Chat
										</p>
									</div>
									<div class="max-h-52 space-y-2 overflow-y-auto px-3 py-2">
										{#if localChatMessages.length === 0}
											<p class="text-xs leading-5 text-neutral-700">
												No local messages yet. Type and send below to preview chat UI.
											</p>
										{:else}
											{#each localChatMessages as message (message.id)}
												<div class="border border-secondary-200 bg-neutral-25 px-2.5 py-2">
													<div class="flex items-center justify-between gap-2">
														<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
															{message.sender}
														</p>
														<p class="text-[11px] text-neutral-700">
															{formatChatTimestamp(message.createdAtIso)}
														</p>
													</div>
													<p class="mt-1 text-xs leading-5 text-neutral-950">{message.text}</p>
												</div>
											{/each}
										{/if}
									</div>
									<form
										class="space-y-2 border-t border-secondary-200 bg-white px-3 py-2.5"
										onsubmit={(event) => {
											event.preventDefault();
											sendLocalChatMessage();
										}}
									>
										<label
											for="team-local-chat-message"
											class="text-[11px] font-bold uppercase tracking-wide text-neutral-950"
										>
											Message
										</label>
										<textarea
											id="team-local-chat-message"
											class="textarea-secondary min-h-18 w-full resize-y text-xs"
											placeholder="Type a message for local preview..."
											bind:value={localChatDraft}
										></textarea>
										<div class="flex justify-end">
											<button type="submit" class="button-primary px-3 py-1 text-xs">
												Send
											</button>
										</div>
									</form>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				Team details are not available right now.
			</div>
		{/if}
	</div>
</div>
