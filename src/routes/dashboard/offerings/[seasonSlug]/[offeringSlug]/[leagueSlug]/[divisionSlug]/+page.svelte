<script lang="ts">
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import {
		IconArrowLeft,
		IconCalendar,
		IconChartBar,
		IconLock,
		IconLockOpen,
		IconUsers
	} from '@tabler/icons-svelte';

	let { data } = $props<{ data: PageData }>();

	function divisionMetaLine(): string {
		if (!data.division) return '';
		return [data.division.dayOfWeek, data.division.gameTime, data.division.location]
			.filter(Boolean)
			.join(' / ');
	}

	function standingsDifferential(row: NonNullable<PageData['standings']>[number]): string {
		const value = row.pointsFor - row.pointsAgainst;
		return value > 0 ? `+${value}` : `${value}`;
	}

	function leagueHref(): string {
		if (!data.season?.slug || !data.offering?.slug || !data.league?.slug) {
			return '/dashboard/offerings';
		}
		return `/dashboard/offerings/${data.season.slug}/${data.offering.slug}/${data.league.slug}`;
	}
</script>

<svelte:head>
	<title>{data.division?.name ?? 'Division'} - PlayIMs</title>
	<meta
		name="description"
		content="Division details including teams, standings, and placeholder schedule and stats sections."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="bg-neutral">
		<div class="border-b border-secondary-300 bg-neutral-600/66 p-4">
			<div class="flex items-center gap-3 py-2 lg:py-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<IconUsers class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
				>
					{data.division?.name ?? 'Division'}
				</h1>
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-4">
		<div class="flex flex-wrap items-center gap-2">
			<a
				href={leagueHref()}
				class="button-secondary-outlined inline-flex items-center gap-2 cursor-pointer"
			>
				<IconArrowLeft class="h-4 w-4" />
				<span>Back to {data.league?.name ?? 'League'}</span>
			</a>
			{#if data.offering}
				<span
					class="border border-secondary-300 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950"
				>
					{data.offering.name}
				</span>
			{/if}
			{#if data.division}
				<span
					class="border border-secondary-300 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950"
				>
					{data.division.maxTeams ?? data.teams.length} team capacity
				</span>
			{/if}
		</div>

		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.division}
			<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
				<div class="order-1 space-y-4">
					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">Standings</h2>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm text-neutral-950">
								<thead class="border-b border-secondary-300 bg-neutral-50">
									<tr>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Team</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">W-L-T</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">PF</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">PA</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">Diff</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">Pts</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">Pct</th>
										<th class="px-2 py-2 text-right font-bold uppercase tracking-wide">Streak</th>
									</tr>
								</thead>
								<tbody>
									{#if data.standings.length > 0}
										{#each data.standings as row, index}
											<tr class={index % 2 === 0 ? 'bg-white' : 'bg-neutral-25'}>
												<td class="px-3 py-2 font-semibold">{row.teamName}</td>
												<td class="px-2 py-2 text-right">{row.wins}-{row.losses}-{row.ties}</td>
												<td class="px-2 py-2 text-right">{row.pointsFor}</td>
												<td class="px-2 py-2 text-right">{row.pointsAgainst}</td>
												<td class="px-2 py-2 text-right">{standingsDifferential(row)}</td>
												<td class="px-2 py-2 text-right">{row.points}</td>
												<td class="px-2 py-2 text-right">{row.winPct}</td>
												<td class="px-2 py-2 text-right">{row.streak}</td>
											</tr>
										{/each}
									{:else}
										<tr>
											<td colspan="8" class="px-3 py-10 text-center italic text-neutral-700">
												No standings posted yet.
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</section>

					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">Teams</h2>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm text-neutral-950">
								<thead class="border-b border-secondary-300 bg-neutral-50">
									<tr>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Team</th>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Status</th>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Roster</th>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Registered</th
										>
									</tr>
								</thead>
								<tbody>
									{#if data.teams.length > 0}
										{#each data.teams as team, index}
											<tr class={index % 2 === 0 ? 'bg-white' : 'bg-neutral-25'}>
												<td class="px-3 py-3 align-top">
													<p class="font-semibold">{team.name}</p>
													{#if team.description}
														<p class="mt-1 text-xs text-neutral-700">{team.description}</p>
													{/if}
												</td>
												<td class="px-3 py-3 align-top">Division</td>
												<td class="px-3 py-3 align-top">{team.rosterSize}</td>
												<td class="px-3 py-3 align-top">
													<DateHoverText
														display={team.dateRegistered
															? new Date(team.dateRegistered).toLocaleString()
															: 'TBD'}
														value={team.dateRegistered}
														includeTime
													/>
												</td>
											</tr>
										{/each}
									{:else}
										<tr>
											<td colspan="4" class="px-3 py-10 text-center italic text-neutral-700">
												No active teams in this division yet.
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</section>

					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">Division Waitlist</h2>
						</div>
						<div class="p-4">
							{#if data.waitlistTeams.length > 0}
								<ul class="space-y-2 text-sm text-neutral-950">
									{#each data.waitlistTeams as team}
										<li class="border border-secondary-300 bg-neutral-25 px-3 py-2">
											<span class="font-semibold">{team.name}</span> ({team.rosterSize} players)
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-sm italic text-neutral-700">
									No waitlisted teams for this division.
								</p>
							{/if}
						</div>
					</section>
				</div>

				<aside class="order-2 space-y-4">
					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 px-3 py-2">
							<h2 class="text-xl font-serif font-bold text-neutral-950">Division Info</h2>
						</div>
						<div class="space-y-3 p-3 text-sm text-neutral-950">
							<div class="border-b border-secondary-200 pb-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">League</p>
								<p class="mt-1">{data.league?.name ?? 'Unknown league'}</p>
							</div>
							<div class="border-b border-secondary-200 pb-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Schedule Slot
								</p>
								<p class="mt-1">{divisionMetaLine() || 'Not scheduled yet.'}</p>
							</div>
							<div class="border-b border-secondary-200 pb-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Start Date
								</p>
								<p class="mt-1">
									<DateHoverText
										display={data.division.startDate
											? new Date(data.division.startDate).toLocaleDateString()
											: 'TBD'}
										value={data.division.startDate}
									/>
								</p>
							</div>
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Status</p>
								<p class="mt-1 inline-flex items-center gap-2">
									{#if data.division.isLocked}
										<IconLock class="h-4 w-4" />
										<span>Locked</span>
									{:else}
										<IconLockOpen class="h-4 w-4" />
										<span>Unlocked</span>
									{/if}
								</p>
							</div>
						</div>
					</section>

					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">Division Overview</h2>
						</div>
						<div class="p-5">
							<p class="text-base leading-7 text-neutral-950">
								{data.division.description ??
									'This division detail page is ready for deeper schedule, stats, and team management work.'}
							</p>
						</div>
					</section>

					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 bg-secondary-700/65 px-3 py-2 text-white">
							<div class="flex items-center gap-2">
								<IconCalendar class="h-4 w-4" />
								<h2 class="text-lg font-serif font-bold">Schedule</h2>
							</div>
						</div>
						<div class="p-4 text-sm leading-6 text-neutral-950">
							<p>Schedule placeholder.</p>
							<p class="mt-2 text-neutral-700">
								Game dates, locations, and matchup cards can be added here next.
							</p>
						</div>
					</section>

					<section class="border-2 border-secondary-300 bg-white">
						<div class="border-b border-secondary-300 bg-secondary-700/65 px-3 py-2 text-white">
							<div class="flex items-center gap-2">
								<IconChartBar class="h-4 w-4" />
								<h2 class="text-lg font-serif font-bold">Stats</h2>
							</div>
						</div>
						<div class="p-4 text-sm leading-6 text-neutral-950">
							<p>Stats placeholder.</p>
							<p class="mt-2 text-neutral-700">
								Division leaders, scoring totals, and trend summaries can live here later.
							</p>
						</div>
					</section>
				</aside>
			</div>
		{/if}
	</div>
</div>
