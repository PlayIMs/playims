<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
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
	let leagueForm = $state({ name: '', slug: '', gender: '' });
	let titleForm = $state({ name: '', slug: '', scope: 'club' });
	let officerForm = $state({ titleId: '', userId: '' });
	let leagueError = $state('');
	let titleError = $state('');
	let officerError = $state('');
	let leagueMessage = $state('');
	let titleMessage = $state('');
	let officerMessage = $state('');

	const breadcrumbSegments = $derived.by(
		(): BreadcrumbSegment[] => [
			{
				key: 'clubs',
				label: pageLabel,
				href: '/dashboard/clubs',
				menuAriaLabel: 'Navigate club sports pages',
				currentValue: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`,
				options: [{ value: '/dashboard/clubs', label: pageLabel }],
				showMenu: false
			},
			{
				key: 'club',
				label: data.club?.name ?? 'Club',
				href: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`,
				menuAriaLabel: 'Navigate clubs in this season',
				currentValue: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`,
				options: data.clubOptions.map((option) => ({ value: option.href, label: option.label }))
			}
		]
	);

	const filteredLeagues = $derived.by(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		if (!normalizedQuery) return data.leagues;
		return data.leagues.filter((league) =>
			`${league.name} ${league.description ?? ''}`.toLowerCase().includes(normalizedQuery)
		);
	});

	const assignableTitles = $derived.by(() =>
		data.officerTitles.filter((title) => title.scope === 'club' || title.scope === 'both')
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

	async function submitLeague(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		leagueError = '';
		leagueMessage = '';
		const response = await fetch('/api/club-sports/leagues', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				clubId: data.club.id,
				leagues: [
					{
						name: leagueForm.name,
						slug: normalizeSlug(leagueForm.slug || leagueForm.name),
						stackOrder: data.leagues.length + 1,
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
			return;
		}
		leagueMessage = 'League created.';
		leagueForm = { name: '', slug: '', gender: '' };
		await invalidateAll();
	}

	async function submitTitle(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		titleError = '';
		titleMessage = '';
		const response = await fetch('/api/club-sports/officer-titles', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				title: {
					clubId: data.club.id,
					name: titleForm.name,
					slug: normalizeSlug(titleForm.slug || titleForm.name),
					scope: titleForm.scope,
					isActive: true
				}
			})
		});
		const payload = await response.json();
		if (!response.ok || !payload.success) {
			titleError = payload.error ?? 'Unable to create officer title.';
			return;
		}
		titleMessage = 'Officer title created.';
		titleForm = { name: '', slug: '', scope: 'club' };
		await invalidateAll();
	}

	async function submitOfficer(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		officerError = '';
		officerMessage = '';
		const response = await fetch('/api/club-sports/officer-assignments', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				assignment: {
					titleId: officerForm.titleId,
					userId: officerForm.userId,
					clubSeasonId: data.season.id,
					clubId: data.club.id
				}
			})
		});
		const payload = await response.json();
		if (!response.ok || !payload.success) {
			officerError = payload.error ?? 'Unable to assign officer.';
			return;
		}
		officerMessage = 'Officer assigned.';
		officerForm = { titleId: assignableTitles[0]?.id ?? '', userId: data.members[0]?.id ?? '' };
		await invalidateAll();
	}

	$effect(() => {
		if (!officerForm.titleId && assignableTitles[0]?.id) {
			officerForm.titleId = assignableTitles[0].id;
		}
		if (!officerForm.userId && data.members[0]?.id) {
			officerForm.userId = data.members[0].id;
		}
	});
</script>

<PageTitle pageTitle={data.club?.name ?? pageLabel} />

<div class="space-y-6">
	<section class="border-2 border-neutral-950 bg-white">
		<div class="border-b border-neutral-950 bg-neutral-100 p-5">
			<Breadcrumb segments={breadcrumbSegments} />
			<div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div class="space-y-2">
					<p class="text-xs font-bold uppercase tracking-[0.24em] text-secondary-700">{data.season?.name}</p>
					<h1 class="font-heading text-3xl text-neutral-950">{data.club?.name}</h1>
					<p class="max-w-3xl text-sm text-neutral-800">{data.club?.description ?? 'Club overview and league structure.'}</p>
				</div>
				<DashboardSearchLauncher variant="compact" />
			</div>
		</div>
		<div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="space-y-4">
				<SearchInput id="club-league-search" label="Search club leagues" bind:value={searchQuery} placeholder="Search leagues" />
				<div class="grid gap-4 xl:grid-cols-2">
					{#each filteredLeagues as league (league.id)}
						<a class="border-2 border-neutral-950 bg-neutral p-4 hover:bg-secondary-50" href={`/dashboard/clubs/${data.season.slug}/${data.club.slug}/${league.slug}`}>
							<div class="flex items-start justify-between gap-4">
								<div>
									<h2 class="text-xl font-semibold text-neutral-950">{league.name}</h2>
									<p class="mt-1 text-sm text-neutral-800">{league.description ?? 'League page with teams, schedules, and league operations.'}</p>
								</div>
								<span class={`border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${league.isLocked ? 'border-primary-600 bg-primary-100 text-primary-900' : 'border-secondary-400 bg-white text-secondary-900'}`}>
									{league.isLocked ? 'Locked' : 'Active'}
								</span>
							</div>
						</a>
					{/each}
				</div>
			</div>

			<div class="space-y-4">
				<DashboardSidebarPanel title="Club Leadership">
					{#snippet content()}
						<div class="space-y-3 text-sm">
							{#each data.officers.club as officer (officer.id)}
								<div class="border border-neutral-950 bg-white p-3">
									<p class="font-semibold text-neutral-950">{officer.title}</p>
									<p class="text-neutral-800">{officer.memberName}</p>
								</div>
							{/each}
							{#if data.officers.club.length === 0}
								<p class="text-neutral-800">No club officers assigned yet.</p>
							{/if}
						</div>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Add League">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitLeague}>
							<input class="input-secondary" bind:value={leagueForm.name} placeholder="Women's League" required />
							<input class="input-secondary" bind:value={leagueForm.slug} placeholder="League slug" />
							<input class="input-secondary" bind:value={leagueForm.gender} placeholder="Gender label" />
							<button class="btn-primary w-full" type="submit">Create league</button>
							{#if leagueError}<p class="text-sm text-primary-800">{leagueError}</p>{/if}
							{#if leagueMessage}<p class="text-sm text-secondary-900">{leagueMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Create Officer Title">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitTitle}>
							<input class="input-secondary" bind:value={titleForm.name} placeholder="Travel Coordinator" required />
							<input class="input-secondary" bind:value={titleForm.slug} placeholder="Title slug" />
							<select class="select-secondary" bind:value={titleForm.scope}>
								<option value="club">Club</option>
								<option value="team">Team</option>
								<option value="both">Both</option>
							</select>
							<button class="btn-primary w-full" type="submit">Create title</button>
							{#if titleError}<p class="text-sm text-primary-800">{titleError}</p>{/if}
							{#if titleMessage}<p class="text-sm text-secondary-900">{titleMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Assign Club Officer">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitOfficer}>
							<select class="select-secondary" bind:value={officerForm.titleId}>
								{#each assignableTitles as title (title.id)}
									<option value={title.id}>{title.name}</option>
								{/each}
							</select>
							<select class="select-secondary" bind:value={officerForm.userId}>
								{#each data.members as member (member.id)}
									<option value={member.id}>{member.label}</option>
								{/each}
							</select>
							<button class="btn-primary w-full" type="submit">Assign officer</button>
							{#if officerError}<p class="text-sm text-primary-800">{officerError}</p>{/if}
							{#if officerMessage}<p class="text-sm text-secondary-900">{officerMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>
			</div>
		</div>
	</section>
</div>
