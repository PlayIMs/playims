<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).clubSports
	);

	let searchQuery = $state('');
	let seasonForm = $state({
		name: '',
		slug: '',
		startDate: '',
		endDate: '',
		isCurrent: true
	});
	let clubForm = $state({
		clubSeasonId: '',
		name: '',
		slug: '',
		sport: ''
	});
	let leagueForm = $state({
		clubId: '',
		name: '',
		slug: '',
		gender: ''
	});
	let seasonMessage = $state('');
	let clubMessage = $state('');
	let leagueMessage = $state('');
	let seasonError = $state('');
	let clubError = $state('');
	let leagueError = $state('');
	let submittingSeason = $state(false);
	let submittingClub = $state(false);
	let submittingLeague = $state(false);

	const availableClubs = $derived.by(() => {
		const byId = new Map<string, { id: string; name: string }>();
		for (const activity of data.activities) {
			if (!activity.clubId || byId.has(activity.clubId)) continue;
			byId.set(activity.clubId, { id: activity.clubId, name: activity.clubName });
		}
		return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
	});

	$effect(() => {
		if (!clubForm.clubSeasonId && data.seasons[0]?.id) {
			clubForm.clubSeasonId = data.currentSeasonId ?? data.seasons[0].id;
		}
		if (!leagueForm.clubId && availableClubs[0]?.id) {
			leagueForm.clubId = availableClubs[0].id;
		}
	});

	const filteredActivities = $derived.by(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		if (!normalizedQuery) return data.activities;
		return data.activities.filter((activity) =>
			`${activity.clubName} ${activity.leagueName} ${activity.seasonName}`
				.toLowerCase()
				.includes(normalizedQuery)
		);
	});

	const seasonSummary = $derived.by(() =>
		data.seasons.map((season) => ({
			...season,
			clubCount: data.activities.filter((activity) => activity.seasonId === season.id).length
		}))
	);

	function normalizeSlug(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	async function submitSeason(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		submittingSeason = true;
		seasonError = '';
		seasonMessage = '';
		const response = await fetch('/api/club-sports/seasons', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				season: {
					...seasonForm,
					slug: normalizeSlug(seasonForm.slug || seasonForm.name),
					isActive: true
				},
				copy: {
					enabled: false,
					sourceSeasonIds: []
				}
			})
		});
		const payload = await response.json();
		if (!response.ok || !payload.success) {
			seasonError = payload.error ?? 'Unable to create club season.';
			submittingSeason = false;
			return;
		}
		seasonMessage = 'Club season created.';
		seasonForm = { name: '', slug: '', startDate: '', endDate: '', isCurrent: true };
		await invalidateAll();
		submittingSeason = false;
	}

	async function submitClub(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		submittingClub = true;
		clubError = '';
		clubMessage = '';
		const response = await fetch('/api/club-sports/clubs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				club: {
					clubSeasonId: clubForm.clubSeasonId,
					name: clubForm.name,
					slug: normalizeSlug(clubForm.slug || clubForm.name),
					sport: clubForm.sport || null,
					description: null,
					imageUrl: null,
					isActive: true
				},
				leagues: []
			})
		});
		const payload = await response.json();
		if (!response.ok || !payload.success) {
			clubError = payload.error ?? 'Unable to create club.';
			submittingClub = false;
			return;
		}
		clubMessage = 'Club created.';
		clubForm = {
			clubSeasonId: data.currentSeasonId ?? data.seasons[0]?.id ?? '',
			name: '',
			slug: '',
			sport: ''
		};
		await invalidateAll();
		submittingClub = false;
	}

	async function submitLeague(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		submittingLeague = true;
		leagueError = '';
		leagueMessage = '';
		const response = await fetch('/api/club-sports/leagues', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				clubId: leagueForm.clubId,
				leagues: [
					{
						name: leagueForm.name,
						slug: normalizeSlug(leagueForm.slug || leagueForm.name),
						stackOrder: 1,
						description: null,
						gender: leagueForm.gender || null,
						regStartDate: null,
						regEndDate: null,
						seasonStartDate: null,
						seasonEndDate: null,
						isActive: true,
						isLocked: false,
						imageUrl: null
					}
				]
			})
		});
		const payload = await response.json();
		if (!response.ok || !payload.success) {
			leagueError = payload.error ?? 'Unable to create league.';
			submittingLeague = false;
			return;
		}
		leagueMessage = 'League created.';
		leagueForm = { clubId: availableClubs[0]?.id ?? '', name: '', slug: '', gender: '' };
		await invalidateAll();
		submittingLeague = false;
	}
</script>

<PageTitle pageTitle={pageLabel} />

<div class="space-y-6">
	<section class="border-2 border-neutral-950 bg-white">
		<div class="flex flex-col gap-4 border-b border-neutral-950 bg-neutral-100 p-5 lg:flex-row lg:items-end lg:justify-between">
			<div class="space-y-2">
				<p class="text-xs font-bold uppercase tracking-[0.24em] text-secondary-700">Club Sports</p>
				<h1 class="font-heading text-3xl text-neutral-950">{pageLabel}</h1>
				<p class="max-w-3xl text-sm text-neutral-800">
					Manage yearly club seasons, league structures, multi-team clubs, officers, and schedule-first team pages.
				</p>
			</div>
			<DashboardSearchLauncher variant="compact" />
		</div>
		<div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="space-y-4">
				<SearchInput id="club-activity-search" label="Search club activities" bind:value={searchQuery} placeholder="Search clubs, leagues, or seasons" />
				<div class="grid gap-4 xl:grid-cols-2">
					{#each filteredActivities as activity (activity.id)}
						<a
							class="border-2 border-neutral-950 bg-neutral p-4 transition-colors duration-150 hover:bg-secondary-50"
							href={`/dashboard/clubs/${activity.seasonSlug}/${activity.clubSlug}`}
						>
							<div class="flex items-start justify-between gap-4">
								<div>
									<p class="text-xs font-bold uppercase tracking-[0.18em] text-secondary-700">{activity.seasonName}</p>
									<h2 class="mt-2 text-xl font-semibold text-neutral-950">{activity.clubName}</h2>
									<p class="mt-1 text-sm text-neutral-800">{activity.leagueName}</p>
								</div>
								<span class={`border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${activity.isLocked ? 'border-primary-600 bg-primary-100 text-primary-900' : 'border-secondary-400 bg-white text-secondary-900'}`}>
									{activity.isLocked ? 'Locked' : 'Open'}
								</span>
							</div>
							<div class="mt-4 flex items-center justify-between border-t border-neutral-950/20 pt-3 text-sm text-neutral-800">
								<span>{activity.teamCount} team{activity.teamCount === 1 ? '' : 's'}</span>
								<span>Open club</span>
							</div>
						</a>
					{/each}
					{#if filteredActivities.length === 0}
						<div class="border-2 border-dashed border-neutral-950 bg-neutral-50 p-6 text-sm text-neutral-800 xl:col-span-2">
							No club sports matched your search yet.
						</div>
					{/if}
				</div>
			</div>

			<div class="space-y-4">
				<DashboardSidebarPanel title="Season Boards">
					{#snippet content()}
						<div class="space-y-3 text-sm">
							{#each seasonSummary as season (season.id)}
								<div class="border border-neutral-950 bg-white p-3">
									<div class="flex items-center justify-between gap-3">
										<div>
											<p class="font-semibold text-neutral-950">{season.name}</p>
											<p class="text-xs uppercase tracking-[0.18em] text-secondary-700">
												{season.isCurrent ? 'Current season' : 'Historical season'}
											</p>
										</div>
										<span class="text-xs font-semibold text-neutral-800">{season.clubCount} club entries</span>
									</div>
								</div>
							{/each}
						</div>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Create Season">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitSeason}>
							<input class="input-secondary" bind:value={seasonForm.name} placeholder="2026-2027" required />
							<input class="input-secondary" bind:value={seasonForm.slug} placeholder="2026-2027 slug" />
							<input class="input-secondary" bind:value={seasonForm.startDate} type="date" required />
							<input class="input-secondary" bind:value={seasonForm.endDate} type="date" />
							<label class="flex items-center gap-2 text-sm text-neutral-900">
								<input class="checkbox-secondary" bind:checked={seasonForm.isCurrent} type="checkbox" />
								Set as current club season
							</label>
							<button class="btn-primary w-full" type="submit" disabled={submittingSeason}>Create season</button>
							{#if seasonError}<p class="text-sm text-primary-800">{seasonError}</p>{/if}
							{#if seasonMessage}<p class="text-sm text-secondary-900">{seasonMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Create Club">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitClub}>
							<select class="select-secondary" bind:value={clubForm.clubSeasonId}>
								{#each data.seasons as season (season.id)}
									<option value={season.id}>{season.name}</option>
								{/each}
							</select>
							<input class="input-secondary" bind:value={clubForm.name} placeholder="Ice Hockey" required />
							<input class="input-secondary" bind:value={clubForm.slug} placeholder="Club slug" />
							<input class="input-secondary" bind:value={clubForm.sport} placeholder="Sport label" />
							<button class="btn-primary w-full" type="submit" disabled={submittingClub}>Create club</button>
							{#if clubError}<p class="text-sm text-primary-800">{clubError}</p>{/if}
							{#if clubMessage}<p class="text-sm text-secondary-900">{clubMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Create League">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitLeague}>
							<select class="select-secondary" bind:value={leagueForm.clubId}>
								{#each availableClubs as club (club.id)}
									<option value={club.id}>{club.name}</option>
								{/each}
							</select>
							<input class="input-secondary" bind:value={leagueForm.name} placeholder="Men's League" required />
							<input class="input-secondary" bind:value={leagueForm.slug} placeholder="League slug" />
							<input class="input-secondary" bind:value={leagueForm.gender} placeholder="Gender label" />
							<button class="btn-primary w-full" type="submit" disabled={submittingLeague}>Create league</button>
							{#if leagueError}<p class="text-sm text-primary-800">{leagueError}</p>{/if}
							{#if leagueMessage}<p class="text-sm text-secondary-900">{leagueMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>
			</div>
		</div>
	</section>
</div>
