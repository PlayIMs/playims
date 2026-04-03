<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { IconCalendar, IconCrosshair, IconTarget } from '@tabler/icons-svelte';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import DataTable from '$lib/components/DataTable.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import DataTableLinkedLabel from '$lib/components/data-table/DataTableLinkedLabel.svelte';
	import type { DataTableColumn } from '$lib/components/data-table.js';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { toast } from '$lib/toasts';
	import type { PageData } from './$types';

	type Team = PageData['teams'][number];
	type Schedule = PageData['schedule'][number];

	interface TeamRow {
		id: string;
		name: string;
		slug: string;
		rosterSize: number;
		teamColor: string | null;
	}

	interface ScheduleRow {
		id: string;
		opponentName: string;
		scheduledStartAt: string | null;
		status: string;
		resultLabel: string | null;
	}

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let submittingTeam = $state(false);
	let createTeamPanelElement = $state<HTMLDivElement | null>(null);
	let teamForm = $state({ name: '', slug: '', teamColor: '' });

	const breadcrumbSegments = $derived.by((): BreadcrumbSegment[] => [
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
	]);

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

	function parseDateValue(value: string | null | undefined): Date | null {
		if (!value) return null;
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed;
	}

	function formatDateTime(value: string | null | undefined): string {
		const parsed = parseDateValue(value);
		if (!parsed) return 'Date TBD';
		return parsed.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function scrollToPanel(panelElement: HTMLElement | null): void {
		panelElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const filteredTeams = $derived.by<TeamRow[]>(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		return data.teams.filter((team: Team) => {
			if (!normalizedQuery) return true;
			return `${team.name} ${team.teamColor ?? ''}`.toLowerCase().includes(normalizedQuery);
		});
	});

	const filteredSchedule = $derived.by<ScheduleRow[]>(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		return data.schedule.filter((game: Schedule) => {
			if (!normalizedQuery) return true;
			return `${game.opponentName} ${game.status} ${game.resultLabel ?? ''}`
				.toLowerCase()
				.includes(normalizedQuery);
		});
	});

	const teamTableColumns = $derived.by<DataTableColumn<TeamRow>[]>(() => [
		{
			key: 'team',
			label: 'Team',
			width: '50%',
			rowHeader: true
		},
		{
			key: 'roster',
			label: 'Roster',
			width: '18%',
			cellTextAlignment: 'center'
		},
		{
			key: 'color',
			label: 'Team color',
			width: '32%'
		}
	]);

	const scheduleTableColumns = $derived.by<DataTableColumn<ScheduleRow>[]>(() => [
		{
			key: 'opponent',
			label: 'Opponent',
			width: '34%',
			rowHeader: true
		},
		{
			key: 'date',
			label: 'Scheduled',
			width: '30%'
		},
		{
			key: 'status',
			label: 'Status',
			width: '16%',
			cellTextAlignment: 'center'
		},
		{
			key: 'result',
			label: 'Result',
			width: '20%'
		}
	]);

	async function submitTeam(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!data.league || !data.season) return;
		submittingTeam = true;
		try {
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
				toast.error(payload.error ?? 'Unable to create team.', {
					title: data.league?.name ?? 'Club league'
				});
				return;
			}
			toast.success('Team created.', {
				title: data.league?.name ?? 'Club league'
			});
			teamForm = { name: '', slug: '', teamColor: '' };
			await invalidateAll();
		} catch {
			toast.error('Unable to create team.', {
				title: data.league?.name ?? 'Club league'
			});
		} finally {
			submittingTeam = false;
		}
	}
</script>

<PageTitle pageTitle={data.league?.name ?? 'Club League'} />

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
						aria-hidden="true"
					>
						<IconCrosshair class="h-7 w-7 lg:h-8 lg:w-8" />
					</div>
					<div class="relative min-w-0">
						<h1
							class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
						>
							{data.league?.name ?? 'League'}
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

		{#if data.league}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.club?.name ?? 'Club'}
								</h2>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.teams.length} teams
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.schedule.length} events
								</span>
								<button
									type="button"
									class="button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
									onclick={() => {
										scrollToPanel(createTeamPanelElement);
									}}
								>
									+ Add Team
								</button>
							</div>
						</div>
						<SearchInput
							id="club-team-search"
							label="Search teams and schedule"
							value={searchQuery}
							placeholder="Search team, color, opponent, or result"
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel="Clear league search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="divide-y divide-neutral-950">
						<section class="space-y-3 p-4">
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-2xl font-bold font-serif text-neutral-950">Teams</h3>
								<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
									{filteredTeams.length} showing
								</span>
							</div>
							<DataTable
								columns={teamTableColumns}
								rows={filteredTeams}
								caption={`${data.league.name} teams table`}
								defaultSort={{ columnKey: 'team', direction: 'asc' }}
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={teamTableColumns.length}
											class="px-4 py-10 text-center text-sm italic text-neutral-700"
										>
											{#if searchQuery.trim()}
												No teams match "{searchQuery.trim()}".
											{:else}
												No teams have been added to this league yet.
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(row, column)}
									{@const teamRow = row as TeamRow}
									{#if column.key === 'team'}
										<DataTableLinkedLabel
											label={teamRow.name}
											href={`/dashboard/clubs/${data.season.slug}/${data.club.slug}/${data.league.slug}/${teamRow.slug}`}
											icon={IconTarget}
										/>
									{:else if column.key === 'roster'}
										<p class="text-sm font-semibold text-neutral-950">{teamRow.rosterSize}</p>
									{:else if column.key === 'color'}
										<p class="text-sm text-neutral-950">{teamRow.teamColor ?? 'Not set'}</p>
									{/if}
								{/snippet}
							</DataTable>
						</section>

						<section class="space-y-3 p-4">
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-2xl font-bold font-serif text-neutral-950">League Schedule</h3>
								<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
									{filteredSchedule.length} showing
								</span>
							</div>
							<DataTable
								columns={scheduleTableColumns}
								rows={filteredSchedule}
								caption={`${data.league.name} schedule table`}
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={scheduleTableColumns.length}
											class="px-4 py-10 text-center text-sm italic text-neutral-700"
										>
											{#if searchQuery.trim()}
												No schedule rows match "{searchQuery.trim()}".
											{:else}
												No league events have been scheduled yet.
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(row, column)}
									{@const game = row as ScheduleRow}
									{#if column.key === 'opponent'}
										<div class="flex min-w-0 items-center gap-2">
											<div
												class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
											>
												<IconCalendar class="h-5 w-5" />
											</div>
											<div class="min-w-0">
												<p class="font-sans text-sm font-bold text-neutral-950">
													{game.opponentName}
												</p>
											</div>
										</div>
									{:else if column.key === 'date'}
										<DateHoverText
											display={formatDateTime(game.scheduledStartAt)}
											value={game.scheduledStartAt}
											includeTime
											wrapperClass="inline"
										/>
									{:else if column.key === 'status'}
										<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
											{game.status}
										</span>
									{:else if column.key === 'result'}
										<p class="text-sm text-neutral-950">{game.resultLabel ?? 'Pending'}</p>
									{/if}
								{/snippet}
							</DataTable>
						</section>
					</div>
				</section>

				<aside class="w-full min-w-0 space-y-4">
					<DashboardSidebarPanel title="League Snapshot">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Season
									</p>
									<p class="mt-1 font-semibold">{data.season?.name ?? 'TBD'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.club?.name ?? 'Club'} club sport
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Description
									</p>
									<p class="mt-1 leading-6">
										{data.league.description ?? 'No league description has been added yet.'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Activity
									</p>
									<p class="mt-1 font-semibold">{data.teams.length} teams</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.schedule.length} schedule entries are attached to this league.
									</p>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="Team Snapshot">
						{#snippet content()}
							{#if filteredTeams.length === 0}
								<p class="text-sm font-sans text-neutral-950">
									{#if searchQuery.trim()}
										No teams match this search right now.
									{:else}
										No teams are available yet.
									{/if}
								</p>
							{:else}
								<div class="space-y-3">
									{#each filteredTeams as team (team.id)}
										<a
											class="block border border-neutral-950 bg-white p-3 transition-colors hover:bg-neutral-25"
											href={`/dashboard/clubs/${data.season.slug}/${data.club.slug}/${data.league.slug}/${team.slug}`}
										>
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<p class="font-serif text-lg font-bold text-neutral-950">{team.name}</p>
													<p class="mt-1 text-xs text-neutral-700">
														{team.rosterSize} active roster spots
													</p>
												</div>
												{#if team.teamColor}
													<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
														{team.teamColor}
													</span>
												{/if}
											</div>
										</a>
									{/each}
								</div>
							{/if}
						{/snippet}
					</DashboardSidebarPanel>

					<div bind:this={createTeamPanelElement}>
						<DashboardSidebarPanel title="Add Team">
							{#snippet content()}
								<form class="space-y-3" onsubmit={submitTeam}>
									<div>
										<label for="club-team-name" class="block text-sm text-neutral-950 mb-1"
											>Team name</label
										>
										<input
											id="club-team-name"
											class="input-secondary"
											bind:value={teamForm.name}
											placeholder="D1 Team"
											required
										/>
									</div>
									<div>
										<label for="club-team-slug" class="block text-sm text-neutral-950 mb-1"
											>Team slug</label
										>
										<input
											id="club-team-slug"
											class="input-secondary"
											bind:value={teamForm.slug}
											placeholder="d1-team"
										/>
									</div>
									<div>
										<label for="club-team-color" class="block text-sm text-neutral-950 mb-1"
											>Team color</label
										>
										<input
											id="club-team-color"
											class="input-secondary"
											bind:value={teamForm.teamColor}
											placeholder="Blue"
										/>
									</div>
									<button
										class="button-primary w-full justify-center px-4 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
										type="submit"
										disabled={submittingTeam}
									>
										{submittingTeam ? 'Creating...' : 'Create team'}
									</button>
								</form>
							{/snippet}
						</DashboardSidebarPanel>
					</div>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				League details are not available right now.
			</div>
		{/if}
	</div>
</div>
