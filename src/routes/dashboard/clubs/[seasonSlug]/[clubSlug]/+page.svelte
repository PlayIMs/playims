<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { IconCrosshair, IconTarget } from '@tabler/icons-svelte';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import DataTable from '$lib/components/DataTable.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import SplitAddAction from '$lib/components/dashboard/SplitAddAction.svelte';
	import DataTableLinkedLabel from '$lib/components/data-table/DataTableLinkedLabel.svelte';
	import type { DataTableColumn } from '$lib/components/data-table.js';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { mergeDashboardNavigationLabels, type DashboardNavKey } from '$lib/dashboard/navigation';
	import { toast } from '$lib/toasts';
	import type { PageData } from './$types';

	interface DropdownOption {
		value: string;
		label: string;
	}

	type ClubOption = PageData['clubOptions'][number];
	type ClubLeague = PageData['leagues'][number];
	type OfficerTitle = PageData['officerTitles'][number];
	type MemberOption = PageData['members'][number];

	interface LeagueRow {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		statusLabel: string;
		statusClass: string;
	}

	const FORM_DROPDOWN_BUTTON_CLASS =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';

	let { data } = $props<{ data: PageData }>();

	const pageLabel = $derived.by(
		() =>
			mergeDashboardNavigationLabels(
				(data?.navigationLabels ?? {}) as Partial<Record<DashboardNavKey, string>>
			).clubSports
	);

	let searchQuery = $state('');
	let submittingLeague = $state(false);
	let submittingTitle = $state(false);
	let submittingOfficer = $state(false);
	let createLeaguePanelElement = $state<HTMLDivElement | null>(null);
	let createTitlePanelElement = $state<HTMLDivElement | null>(null);
	let assignOfficerPanelElement = $state<HTMLDivElement | null>(null);
	let leagueForm = $state({ name: '', slug: '', gender: '' });
	let titleForm = $state({ name: '', slug: '', scope: 'club' });
	let officerForm = $state({ titleId: '', userId: '' });

	const breadcrumbSegments = $derived.by((): BreadcrumbSegment[] => [
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
			options: data.clubOptions.map((option: ClubOption) => ({
				value: option.href,
				label: option.label
			}))
		}
	]);

	const filteredLeagues = $derived.by<LeagueRow[]>(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		return data.leagues
			.filter((league: ClubLeague) => {
				if (!normalizedQuery) return true;
				return `${league.name} ${league.description ?? ''}`.toLowerCase().includes(normalizedQuery);
			})
			.map((league: ClubLeague) => ({
				id: league.id,
				name: league.name,
				slug: league.slug,
				description: league.description,
				statusLabel: league.isLocked ? 'Locked' : league.isActive ? 'Active' : 'Inactive',
				statusClass: league.isLocked
					? 'badge-primary-outlined text-xs uppercase tracking-wide'
					: 'badge-secondary-outlined px-2 py-0.5 text-xs'
			}));
	});

	const assignableTitles = $derived.by<DropdownOption[]>(() =>
		data.officerTitles
			.filter((title: OfficerTitle) => title.scope === 'club' || title.scope === 'both')
			.map((title: OfficerTitle) => ({
				value: title.id,
				label: title.name
			}))
	);

	const memberOptions = $derived.by<DropdownOption[]>(() =>
		data.members.map((member: MemberOption) => ({
			value: member.id,
			label: member.label
		}))
	);

	$effect(() => {
		if (!officerForm.titleId && assignableTitles[0]?.value) {
			officerForm.titleId = assignableTitles[0].value;
		}
		if (!officerForm.userId && memberOptions[0]?.value) {
			officerForm.userId = memberOptions[0].value;
		}
	});

	const clubLeagueColumns = $derived.by<DataTableColumn<LeagueRow>[]>(() => [
		{
			key: 'league',
			label: 'League',
			width: '58%',
			rowHeader: true
		},
		{
			key: 'notes',
			label: 'Notes',
			width: '24%'
		},
		{
			key: 'status',
			label: 'Status',
			width: '18%',
			cellTextAlignment: 'center'
		}
	]);

	const addActionOptions = [
		{ value: 'league', label: 'Add league' },
		{ value: 'title', label: 'Add officer title' },
		{ value: 'officer', label: 'Assign officer' }
	];

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

	function scrollToPanel(panelElement: HTMLElement | null): void {
		panelElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function submitLeague(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!data.club) return;
		submittingLeague = true;
		try {
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
				toast.error(payload.error ?? 'Unable to create club league.', {
					title: data.club?.name ?? pageLabel
				});
				return;
			}
			toast.success('Club league created.', {
				title: data.club?.name ?? pageLabel
			});
			leagueForm = { name: '', slug: '', gender: '' };
			await invalidateAll();
		} catch {
			toast.error('Unable to create club league.', {
				title: data.club?.name ?? pageLabel
			});
		} finally {
			submittingLeague = false;
		}
	}

	async function submitTitle(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!data.club) return;
		submittingTitle = true;
		try {
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
				toast.error(payload.error ?? 'Unable to create officer title.', {
					title: data.club?.name ?? pageLabel
				});
				return;
			}
			toast.success('Officer title created.', {
				title: data.club?.name ?? pageLabel
			});
			titleForm = { name: '', slug: '', scope: 'club' };
			await invalidateAll();
		} catch {
			toast.error('Unable to create officer title.', {
				title: data.club?.name ?? pageLabel
			});
		} finally {
			submittingTitle = false;
		}
	}

	async function submitOfficer(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!data.club || !data.season) return;
		submittingOfficer = true;
		try {
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
				toast.error(payload.error ?? 'Unable to assign club officer.', {
					title: data.club?.name ?? pageLabel
				});
				return;
			}
			toast.success('Club officer assigned.', {
				title: data.club?.name ?? pageLabel
			});
			officerForm = {
				titleId: assignableTitles[0]?.value ?? '',
				userId: memberOptions[0]?.value ?? ''
			};
			await invalidateAll();
		} catch {
			toast.error('Unable to assign club officer.', {
				title: data.club?.name ?? pageLabel
			});
		} finally {
			submittingOfficer = false;
		}
	}
</script>

<PageTitle pageTitle={data.club?.name ?? pageLabel} />

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
						aria-hidden="true"
					>
						<IconTarget class="h-7 w-7 lg:h-8 lg:w-8" />
					</div>
					<div class="relative min-w-0">
						<h1
							class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
						>
							{data.club?.name ?? 'Club'}
						</h1>
						{#if breadcrumbSegments.length > 0}
							<div class="absolute left-0 top-[calc(100%+0.09rem)] z-10">
								<Breadcrumb segments={breadcrumbSegments} class="max-w-[min(100vw-7rem,100%)]" />
							</div>
						{/if}
					</div>
				</div>
				<DashboardSearchLauncher wrapperClass="lg:pt-1" />
			</div>
		</div>
	</header>

	<div class="space-y-4 px-4 lg:px-6">
		{#if data.error}
			<div class="border-2 border-warning-300 bg-warning-50 p-4 text-sm text-neutral-950">
				{data.error}
			</div>
		{/if}

		{#if data.club}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.season?.name ?? 'Club season'}
								</h2>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.leagues.length} leagues
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.officers.club.length} club officers
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.officerTitles.length} active titles
								</span>
								<SplitAddAction
									options={addActionOptions}
									on:click={() => {
										scrollToPanel(createLeaguePanelElement);
									}}
									on:action={(event) => {
										if (event.detail.value === 'title') {
											scrollToPanel(createTitlePanelElement);
											return;
										}
										if (event.detail.value === 'officer') {
											scrollToPanel(assignOfficerPanelElement);
											return;
										}
										scrollToPanel(createLeaguePanelElement);
									}}
								/>
							</div>
						</div>
						<SearchInput
							id="club-league-search"
							label="Search club leagues"
							value={searchQuery}
							placeholder="Search league or notes"
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel="Clear club league search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="min-h-[26rem] p-4">
						<DataTable
							columns={clubLeagueColumns}
							rows={filteredLeagues}
							caption={`${data.club.name} leagues table`}
							defaultSort={{ columnKey: 'league', direction: 'asc' }}
						>
							{#snippet emptyBody()}
								<tr class="bg-neutral-25">
									<td
										colspan={clubLeagueColumns.length}
										class="px-4 py-10 text-center text-sm italic text-neutral-700"
									>
										{#if searchQuery.trim()}
											No leagues match "{searchQuery.trim()}".
										{:else}
											No leagues have been added to this club yet.
										{/if}
									</td>
								</tr>
							{/snippet}

							{#snippet cell(row, column)}
								{@const leagueRow = row as LeagueRow}
								{#if column.key === 'league'}
									<DataTableLinkedLabel
										label={leagueRow.name}
										href={`/dashboard/clubs/${data.season.slug}/${data.club.slug}/${leagueRow.slug}`}
										icon={IconCrosshair}
									/>
								{:else if column.key === 'notes'}
									<p class="text-sm leading-6 text-neutral-950">
										{leagueRow.description ?? 'Teams, schedules, and league officers live here.'}
									</p>
								{:else if column.key === 'status'}
									<span class={leagueRow.statusClass}>{leagueRow.statusLabel}</span>
								{/if}
							{/snippet}
						</DataTable>
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-4">
					<DashboardSidebarPanel title="Club Snapshot">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Season
									</p>
									<p class="mt-1 font-semibold">{data.season?.name ?? 'TBD'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.club.sport ?? 'Club sport'} club sport
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Description
									</p>
									<p class="mt-1 leading-6">
										{data.club.description ?? 'No club description has been added yet.'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Leadership coverage
									</p>
									<p class="mt-1 font-semibold">
										{data.officers.club.length} current club officer assignments
									</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.officers.team.length} team-level officer assignments are already attached under
										this club.
									</p>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="Club Leadership">
						{#snippet content()}
							{#if data.officers.club.length === 0}
								<p class="text-sm font-sans text-neutral-950">
									No club officers have been assigned yet.
								</p>
							{:else}
								<div class="space-y-3 text-sm text-neutral-950">
									{#each data.officers.club as officer (officer.id)}
										<div class="border border-neutral-950 bg-white p-3">
											<p class="font-semibold text-neutral-950">{officer.title}</p>
											<p class="mt-1 text-neutral-700">{officer.memberName}</p>
										</div>
									{/each}
								</div>
							{/if}
						{/snippet}
					</DashboardSidebarPanel>

					<div bind:this={createLeaguePanelElement}>
						<DashboardSidebarPanel title="Add League">
							{#snippet content()}
								<form class="space-y-3" onsubmit={submitLeague}>
									<div>
										<label for="club-league-name" class="block text-sm text-neutral-950 mb-1"
											>League name</label
										>
										<input
											id="club-league-name"
											class="input-secondary"
											bind:value={leagueForm.name}
											placeholder="Women's League"
											required
										/>
									</div>
									<div>
										<label for="club-league-slug" class="block text-sm text-neutral-950 mb-1"
											>League slug</label
										>
										<input
											id="club-league-slug"
											class="input-secondary"
											bind:value={leagueForm.slug}
											placeholder="womens-league"
										/>
									</div>
									<div>
										<label for="club-league-gender" class="block text-sm text-neutral-950 mb-1"
											>League label</label
										>
										<input
											id="club-league-gender"
											class="input-secondary"
											bind:value={leagueForm.gender}
											placeholder="Women's, Men's, or Mixed"
										/>
									</div>
									<button
										class="button-primary w-full justify-center px-4 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
										type="submit"
										disabled={submittingLeague}
									>
										{submittingLeague ? 'Creating...' : 'Create league'}
									</button>
								</form>
							{/snippet}
						</DashboardSidebarPanel>
					</div>

					<div bind:this={createTitlePanelElement}>
						<DashboardSidebarPanel title="Add Officer Title">
							{#snippet content()}
								<form class="space-y-3" onsubmit={submitTitle}>
									<div>
										<label for="officer-title-name" class="block text-sm text-neutral-950 mb-1"
											>Title name</label
										>
										<input
											id="officer-title-name"
											class="input-secondary"
											bind:value={titleForm.name}
											placeholder="Travel Coordinator"
											required
										/>
									</div>
									<div>
										<label for="officer-title-slug" class="block text-sm text-neutral-950 mb-1"
											>Title slug</label
										>
										<input
											id="officer-title-slug"
											class="input-secondary"
											bind:value={titleForm.slug}
											placeholder="travel-coordinator"
										/>
									</div>
									<div>
										<p class="block text-sm text-neutral-950 mb-1">Title scope</p>
										<ListboxDropdown
											options={[
												{ value: 'club', label: 'Club only' },
												{ value: 'team', label: 'Team only' },
												{ value: 'both', label: 'Club and team' }
											]}
											value={titleForm.scope}
											ariaLabel="Select the officer title scope"
											buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
											on:change={(event) => {
												titleForm.scope = event.detail.value;
											}}
										/>
									</div>
									<button
										class="button-primary w-full justify-center px-4 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
										type="submit"
										disabled={submittingTitle}
									>
										{submittingTitle ? 'Creating...' : 'Create title'}
									</button>
								</form>
							{/snippet}
						</DashboardSidebarPanel>
					</div>

					<div bind:this={assignOfficerPanelElement}>
						<DashboardSidebarPanel title="Assign Club Officer">
							{#snippet content()}
								<form class="space-y-3" onsubmit={submitOfficer}>
									<div>
										<p class="block text-sm text-neutral-950 mb-1">Officer title</p>
										<ListboxDropdown
											options={assignableTitles}
											value={officerForm.titleId}
											ariaLabel="Select a club officer title"
											buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
											disabled={assignableTitles.length === 0}
											on:change={(event) => {
												officerForm.titleId = event.detail.value;
											}}
										/>
									</div>
									<div>
										<p class="block text-sm text-neutral-950 mb-1">Member</p>
										<ListboxDropdown
											options={memberOptions}
											value={officerForm.userId}
											ariaLabel="Select a club officer"
											buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
											disabled={memberOptions.length === 0}
											on:change={(event) => {
												officerForm.userId = event.detail.value;
											}}
										/>
									</div>
									<button
										class="button-primary w-full justify-center px-4 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
										type="submit"
										disabled={submittingOfficer ||
											assignableTitles.length === 0 ||
											memberOptions.length === 0}
									>
										{submittingOfficer ? 'Assigning...' : 'Assign officer'}
									</button>
								</form>
							{/snippet}
						</DashboardSidebarPanel>
					</div>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				Club details are not available right now.
			</div>
		{/if}
	</div>
</div>
