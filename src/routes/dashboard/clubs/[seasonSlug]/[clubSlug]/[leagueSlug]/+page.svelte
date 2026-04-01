<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let teamForm = $state({ name: '', slug: '', teamColor: '' });
	let teamError = $state('');
	let teamMessage = $state('');

	const breadcrumbSegments = $derived.by(
		(): BreadcrumbSegment[] => [
			{
				key: 'clubs',
				label: 'Club Sports',
				href: '/dashboard/clubs',
				menuAriaLabel: 'Club sports',
				currentValue: '/dashboard/clubs',
				options: [{ value: '/dashboard/clubs', label: 'Club Sports' }],
				showMenu: false
			},
			{
				key: 'club',
				label: data.club?.name ?? 'Club',
				href: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`,
				menuAriaLabel: 'Club',
				currentValue: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`,
				options: [
					{
						value: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`,
						label: data.club?.name ?? 'Club'
					}
				],
				showMenu: false
			},
			{
				key: 'league',
				label: data.league?.name ?? 'League',
				href: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}/${data.league?.slug ?? ''}`,
				menuAriaLabel: 'League',
				currentValue: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}/${data.league?.slug ?? ''}`,
				options: [
					{
						value: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}/${data.league?.slug ?? ''}`,
						label: data.league?.name ?? 'League'
					}
				],
				showMenu: false
			}
		]
	);

	const filteredTeams = $derived.by(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		if (!normalizedQuery) return data.teams;
		return data.teams.filter((team) =>
			`${team.name} ${team.teamColor ?? ''}`.toLowerCase().includes(normalizedQuery)
		);
	});

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

	async function submitTeam(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		teamError = '';
		teamMessage = '';
		const response = await fetch(
			`/api/club-sports/leagues/${data.season.slug}/${data.league.slug}/management`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					team: {
						name: teamForm.name,
						slug: normalizeSlug(teamForm.slug || teamForm.name),
						description: null,
						teamColor: teamForm.teamColor || null,
						isActive: true
					}
				})
			}
		);
		const payload = await response.json();
		if (!response.ok || !payload.success) {
			teamError = payload.error ?? 'Unable to create team.';
			return;
		}
		teamMessage = 'Team created.';
		teamForm = { name: '', slug: '', teamColor: '' };
		await invalidateAll();
	}
</script>

<PageTitle pageTitle={data.league?.name ?? 'Club League'} />

<div class="space-y-6">
	<section class="border-2 border-neutral-950 bg-white">
		<div class="border-b border-neutral-950 bg-neutral-100 p-5">
			<Breadcrumb segments={breadcrumbSegments} />
			<div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div class="space-y-2">
					<p class="text-xs font-bold uppercase tracking-[0.24em] text-secondary-700">{data.club?.name}</p>
					<h1 class="font-heading text-3xl text-neutral-950">{data.league?.name}</h1>
					<p class="max-w-3xl text-sm text-neutral-800">{data.league?.description ?? 'League teams, schedules, and league operations.'}</p>
				</div>
				<DashboardSearchLauncher variant="compact" />
			</div>
		</div>
		<div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="space-y-4">
				<SearchInput id="club-team-search" label="Search club teams" bind:value={searchQuery} placeholder="Search teams" />
				<div class="grid gap-4 xl:grid-cols-2">
					{#each filteredTeams as team (team.id)}
						<a class="border-2 border-neutral-950 bg-neutral p-4 hover:bg-secondary-50" href={`/dashboard/clubs/${data.season.slug}/${data.club.slug}/${data.league.slug}/${team.slug}`}>
							<div class="flex items-start justify-between gap-4">
								<div>
									<h2 class="text-xl font-semibold text-neutral-950">{team.name}</h2>
									<p class="mt-1 text-sm text-neutral-800">{team.rosterSize} active roster spot{team.rosterSize === 1 ? '' : 's'}</p>
								</div>
								{#if team.teamColor}
									<span class="border border-neutral-950 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-900">
										{team.teamColor}
									</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>

				<div class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-200 p-4">
						<h2 class="dashboard-section-title text-neutral-950">League Schedule</h2>
					</div>
					<div class="space-y-3 p-4">
						{#each data.schedule as game (game.id)}
							<div class="border border-neutral-950 bg-white p-3">
								<div class="flex items-start justify-between gap-4">
									<div>
										<p class="font-semibold text-neutral-950">{game.opponentName}</p>
										<p class="text-sm text-neutral-800">{game.scheduledStartAt ?? 'Date TBD'}</p>
									</div>
									<span class="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-700">{game.status}</span>
								</div>
								{#if game.resultLabel}
									<p class="mt-2 text-sm text-neutral-900">{game.resultLabel}</p>
								{/if}
							</div>
						{/each}
						{#if data.schedule.length === 0}
							<p class="text-sm text-neutral-800">No league events scheduled yet.</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="space-y-4">
				<DashboardSidebarPanel title="Create Team">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitTeam}>
							<input class="input-secondary" bind:value={teamForm.name} placeholder="D1 Team" required />
							<input class="input-secondary" bind:value={teamForm.slug} placeholder="Team slug" />
							<input class="input-secondary" bind:value={teamForm.teamColor} placeholder="Team color" />
							<button class="btn-primary w-full" type="submit">Create team</button>
							{#if teamError}<p class="text-sm text-primary-800">{teamError}</p>{/if}
							{#if teamMessage}<p class="text-sm text-secondary-900">{teamMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>
			</div>
		</div>
	</section>
</div>
