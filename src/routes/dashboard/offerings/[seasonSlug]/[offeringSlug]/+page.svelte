<script lang="ts">
	import type { PageData } from './$types';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import {
		IconBallAmericanFootball,
		IconBallBaseball,
		IconBallBasketball,
		IconBallFootball,
		IconBallTennis,
		IconBallVolleyball,
		IconCrosshair,
		IconLock,
		IconLockOpen,
		IconShip,
		IconTarget
	} from '@tabler/icons-svelte';

	let { data } = $props<{ data: PageData }>();

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

	function statusFor(league: NonNullable<PageData['leagues']>[number]) {
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

	const HeaderIcon = $derived.by(() =>
		sportIconFor(data.offering?.name ?? 'Offering', data.offering?.sport ?? null)
	);
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
					class="bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center"
					aria-hidden="true"
				>
					<HeaderIcon class="w-7 h-7 lg:w-8 lg:h-8" />
				</div>
				<h1
					class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
				>
					{data.offering?.name ?? 'Offering'}
				</h1>
			</div>
		</div>
	</header>

	<div class="px-4 lg:px-6 space-y-4">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex flex-wrap items-center gap-2">
				{#if data.season}
					<span
						class="border border-secondary-300 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950"
					>
						{data.season.name}
					</span>
				{/if}
				{#if data.offering?.sport}
					<span
						class="border border-secondary-300 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950"
					>
						{data.offering.sport}
					</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
				<span class="border border-secondary-300 bg-white px-2 py-1">
					{data.summary.leagueCount} leagues
				</span>
				<span class="border border-secondary-300 bg-white px-2 py-1">
					{data.summary.divisionCount} divisions
				</span>
				<span class="border border-secondary-300 bg-white px-2 py-1">
					{data.summary.openCount} open
				</span>
			</div>
		</div>

		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.offering}
			<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<div class="order-1 space-y-4">
					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">Leagues</h2>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm text-neutral-950">
								<thead class="border-b border-neutral-950 bg-neutral-50">
									<tr>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">League</th>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Status</th>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide"
											>Registration</th
										>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Season</th>
										<th class="px-3 py-2 text-left font-bold uppercase tracking-wide">Divisions</th>
									</tr>
								</thead>
								<tbody>
									{#if data.leagues.length > 0}
										{#each data.leagues as league, index}
											{@const status = statusFor(league)}
											<tr class={index % 2 === 0 ? 'bg-white' : 'bg-neutral-25'}>
												<td class="px-3 py-3 align-top">
													<a
														href={`/dashboard/offerings/${data.season?.slug}/${data.offering.slug}/${league.slug}`}
														class="font-semibold text-neutral-950 hover:underline"
													>
														{league.name}
													</a>
													<p class="mt-1 text-xs text-neutral-700">
														{toTitleCase(league.gender) ?? 'Open'} / {toTitleCase(
															league.skillLevel
														) ?? 'All Levels'}
													</p>
												</td>
												<td class="px-3 py-3 align-top">
													<span
														class={`px-2 py-1 text-xs font-bold uppercase tracking-wide ${status.className}`}
													>
														{status.label}
													</span>
												</td>
												<td class="px-3 py-3 align-top">
													<p>
														<DateHoverText
															display={league.regStartDate
																? new Date(league.regStartDate).toLocaleString()
																: 'TBD'}
															value={league.regStartDate}
															includeTime
														/>
													</p>
													<p class="mt-1">
														<DateHoverText
															display={league.regEndDate
																? new Date(league.regEndDate).toLocaleString()
																: 'TBD'}
															value={league.regEndDate}
															includeTime
														/>
													</p>
												</td>
												<td class="px-3 py-3 align-top">
													<DateHoverText
														display={league.seasonStartDate || league.seasonEndDate
															? 'View season dates'
															: 'TBD'}
														value={league.seasonStartDate}
														endValue={league.seasonEndDate}
													/>
												</td>
												<td class="px-3 py-3 align-top">{league.divisionCount}</td>
											</tr>
										{/each}
									{:else}
										<tr>
											<td colspan="5" class="px-3 py-10 text-center italic text-neutral-700">
												No leagues exist for this offering yet.
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</section>
				</div>

				<aside class="order-2 space-y-4">
					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 px-3 py-2">
							<h2 class="text-xl font-serif font-bold text-neutral-950">Offering Info</h2>
						</div>
						<div class="space-y-3 p-3 text-sm text-neutral-950">
							<div class="border-b border-secondary-200 pb-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Type</p>
								<p class="mt-1">{toTitleCase(data.offering.type) ?? 'League'}</p>
							</div>
							<div class="border-b border-secondary-200 pb-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Roster</p>
								<p class="mt-1">
									Min: {data.offering.minPlayers ?? 'TBD'} / Max: {data.offering.maxPlayers ??
										'TBD'}
								</p>
							</div>
							<div class="border-b border-secondary-200 pb-3">
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Season</p>
								<p class="mt-1">{data.season?.name ?? 'Unknown season'}</p>
							</div>
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
									Rulebook
								</p>
								{#if data.offering.rulebookUrl}
									<a
										href={data.offering.rulebookUrl}
										target="_blank"
										rel="noreferrer"
										class="mt-1 inline-flex text-sm font-semibold text-secondary-900 underline underline-offset-2"
									>
										Open rulebook
									</a>
								{:else}
									<p class="mt-1">No rulebook linked yet.</p>
								{/if}
							</div>
						</div>
					</section>
					<section class="border-2 border-neutral-950 bg-white">
						<div class="border-b border-neutral-950 bg-secondary-700/65 px-3 py-2 text-white">
							<h2 class="text-xl font-serif font-bold">Offering Description</h2>
						</div>
						<div class="p-5">
							<p class="text-base leading-7 text-neutral-950">
								{data.offering.description ?? 'No offering description has been added yet.'}
							</p>
						</div>
					</section>
				</aside>
			</div>
		{/if}
	</div>
</div>
