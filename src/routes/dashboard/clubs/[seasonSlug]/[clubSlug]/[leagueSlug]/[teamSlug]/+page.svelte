<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { IconCalendar, IconShip, IconTarget } from '@tabler/icons-svelte';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import DataTable from '$lib/components/DataTable.svelte';
	import DashboardSearchLauncher from '$lib/components/dashboard/DashboardSearchLauncher.svelte';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import type { DataTableColumn } from '$lib/components/data-table.js';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { toast } from '$lib/toasts';
	import type { PageData } from './$types';

	interface DropdownOption {
		value: string;
		label: string;
	}

	type OfficerTitle = PageData['officerTitles'][number];
	type MemberOption = PageData['members'][number];
	type RosterEntry = PageData['roster'][number];
	type ScheduleEntry = PageData['schedule'][number];

	const FORM_DROPDOWN_BUTTON_CLASS =
		'w-full border-2 border-secondary-400 bg-white px-4 py-2 text-base leading-6 font-normal text-neutral-950 cursor-pointer inline-flex items-center justify-between gap-2 hover:bg-white focus:outline-none focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-0 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-500)] disabled:cursor-not-allowed disabled:opacity-60';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let assignmentForm = $state({ titleId: '', userId: '' });
	let submittingAssignment = $state(false);
	let assignOfficerPanelElement = $state<HTMLDivElement | null>(null);

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
		},
		{
			key: 'team',
			label: data.team?.name ?? 'Team',
			href: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}/${data.league?.slug ?? ''}/${data.team?.slug ?? ''}`,
			menuAriaLabel: 'Team',
			currentValue: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}/${data.league?.slug ?? ''}/${data.team?.slug ?? ''}`,
			options: [
				{
					value: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}/${data.league?.slug ?? ''}/${data.team?.slug ?? ''}`,
					label: data.team?.name ?? 'Team'
				}
			],
			showMenu: false
		}
	]);

	const assignableTitles = $derived.by<DropdownOption[]>(() =>
		data.officerTitles
			.filter((title: OfficerTitle) => title.scope === 'team' || title.scope === 'both')
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
		if (!assignmentForm.titleId && assignableTitles[0]?.value) {
			assignmentForm.titleId = assignableTitles[0].value;
		}
		if (!assignmentForm.userId && memberOptions[0]?.value) {
			assignmentForm.userId = memberOptions[0].value;
		}
	});

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

	const filteredRoster = $derived.by(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		return data.roster.filter((rosterMember: RosterEntry) => {
			if (!normalizedQuery) return true;
			return `${rosterMember.displayName} ${rosterMember.rosterStatus}`
				.toLowerCase()
				.includes(normalizedQuery);
		});
	});

	const filteredSchedule = $derived.by(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		return data.schedule.filter((game: ScheduleEntry) => {
			if (!normalizedQuery) return true;
			return `${game.opponentName} ${game.status} ${game.resultLabel ?? ''}`
				.toLowerCase()
				.includes(normalizedQuery);
		});
	});

	const rosterColumns = $derived.by<DataTableColumn<(typeof data.roster)[number]>[]>(() => [
		{
			key: 'member',
			label: 'Member',
			width: '42%',
			rowHeader: true
		},
		{
			key: 'status',
			label: 'Status',
			width: '18%',
			cellTextAlignment: 'center'
		},
		{
			key: 'joined',
			label: 'Joined',
			width: '40%'
		}
	]);

	const scheduleColumns = $derived.by<DataTableColumn<(typeof data.schedule)[number]>[]>(() => [
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

	async function submitAssignment(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!data.team || !data.club || !data.league || !data.season) return;
		submittingAssignment = true;
		try {
			const response = await fetch('/api/club-sports/officer-assignments', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					assignment: {
						titleId: assignmentForm.titleId,
						userId: assignmentForm.userId,
						clubSeasonId: data.season.id,
						clubId: data.club.id,
						clubLeagueId: data.league.id,
						clubTeamId: data.team.id
					}
				})
			});
			const payload = await response.json();
			if (!response.ok || !payload.success) {
				toast.error(payload.error ?? 'Unable to assign team officer.', {
					title: data.team?.name ?? 'Club team'
				});
				return;
			}
			toast.success('Team officer assigned.', {
				title: data.team?.name ?? 'Club team'
			});
			await invalidateAll();
		} catch {
			toast.error('Unable to assign team officer.', {
				title: data.team?.name ?? 'Club team'
			});
		} finally {
			submittingAssignment = false;
		}
	}
</script>

<PageTitle pageTitle={data.team?.name ?? 'Club Team'} />

<div class="dashboard-page-shell">
	<header class="bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
				<div class="flex items-center gap-3">
					<div
						class="bg-primary text-white border-2 border-primary-700 flex h-[2.75rem] w-[2.75rem] items-center justify-center lg:h-[3.4rem] lg:w-[3.4rem]"
						aria-hidden="true"
					>
						<IconShip class="h-7 w-7 lg:h-8 lg:w-8" />
					</div>
					<div class="relative min-w-0">
						<h1
							class="text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950"
						>
							{data.team?.name ?? 'Team'}
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

		{#if data.team}
			<div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
				<section class="min-w-0 border-2 border-neutral-950 bg-neutral">
					<div class="space-y-3 border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-2xl font-bold font-serif text-neutral-950">
									{data.league?.name ?? 'League'}
								</h2>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
								<span class="border border-secondary-300 px-2 py-1">
									{data.roster.length} rostered
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.schedule.length} events
								</span>
								<span class="border border-secondary-300 px-2 py-1">
									{data.officers.team.length} team officers
								</span>
								<button
									type="button"
									class="button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
									onclick={() => {
										scrollToPanel(assignOfficerPanelElement);
									}}
								>
									+ Assign Officer
								</button>
							</div>
						</div>
						<SearchInput
							id="club-team-detail-search"
							label="Search roster and schedule"
							value={searchQuery}
							placeholder="Search member, status, opponent, or result"
							autocomplete="off"
							wrapperClass="relative"
							iconClass="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-950"
							inputClass="input-secondary py-1 pl-10 pr-10 text-sm disabled:cursor-not-allowed"
							clearButtonClass="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-950 hover:text-secondary-900"
							clearIconClass="h-4 w-4"
							clearAriaLabel="Clear team detail search"
							on:input={(event) => {
								searchQuery = event.detail.value;
							}}
						/>
					</div>

					<div class="divide-y divide-neutral-950">
						<section class="space-y-3 p-4">
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-2xl font-bold font-serif text-neutral-950">Roster</h3>
								<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
									{filteredRoster.length} showing
								</span>
							</div>
							<DataTable
								columns={rosterColumns}
								rows={filteredRoster}
								caption={`${data.team.name} roster table`}
								defaultSort={{ columnKey: 'member', direction: 'asc' }}
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={rosterColumns.length}
											class="px-4 py-10 text-center text-sm italic text-neutral-700"
										>
											{#if searchQuery.trim()}
												No roster entries match "{searchQuery.trim()}".
											{:else}
												No roster members have been added yet.
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(row, column)}
									{@const rosterMember = row as (typeof data.roster)[number]}
									{#if column.key === 'member'}
										<div class="flex min-w-0 items-center gap-2">
											<div
												class="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white"
											>
												<IconTarget class="h-5 w-5" />
											</div>
											<div class="min-w-0">
												<p class="font-sans text-sm font-bold text-neutral-950">
													{rosterMember.displayName}
												</p>
											</div>
										</div>
									{:else if column.key === 'status'}
										<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
											{rosterMember.rosterStatus}
										</span>
									{:else if column.key === 'joined'}
										<DateHoverText
											display={formatDateTime(rosterMember.dateJoined)}
											value={rosterMember.dateJoined}
											includeTime
											wrapperClass="inline"
										/>
									{/if}
								{/snippet}
							</DataTable>
						</section>

						<section class="space-y-3 p-4">
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-2xl font-bold font-serif text-neutral-950">Schedule</h3>
								<span class="badge-secondary-outlined px-2 py-0.5 text-xs">
									{filteredSchedule.length} showing
								</span>
							</div>
							<DataTable
								columns={scheduleColumns}
								rows={filteredSchedule}
								caption={`${data.team.name} schedule table`}
							>
								{#snippet emptyBody()}
									<tr class="bg-neutral-25">
										<td
											colspan={scheduleColumns.length}
											class="px-4 py-10 text-center text-sm italic text-neutral-700"
										>
											{#if searchQuery.trim()}
												No schedule entries match "{searchQuery.trim()}".
											{:else}
												No team events have been scheduled yet.
											{/if}
										</td>
									</tr>
								{/snippet}

								{#snippet cell(row, column)}
									{@const game = row as (typeof data.schedule)[number]}
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
					<DashboardSidebarPanel title="Team Snapshot">
						{#snippet content()}
							<div class="space-y-3 text-sm text-neutral-950">
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Club and league
									</p>
									<p class="mt-1 font-semibold">{data.club?.name ?? 'Club'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.league?.name ?? 'League'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Team details
									</p>
									<p class="mt-1 font-semibold">{data.team.teamColor ?? 'No team color set'}</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.team.description ?? 'No team description has been added yet.'}
									</p>
								</div>
								<div class="border border-neutral-950 bg-white p-3">
									<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
										Activity
									</p>
									<p class="mt-1 font-semibold">{data.roster.length} rostered members</p>
									<p class="mt-1 text-xs text-neutral-700">
										{data.schedule.length} scheduled events are attached to this team.
									</p>
								</div>
							</div>
						{/snippet}
					</DashboardSidebarPanel>

					<DashboardSidebarPanel title="Club Officers">
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

					<DashboardSidebarPanel title="Team Officers">
						{#snippet content()}
							{#if data.officers.team.length === 0}
								<p class="text-sm font-sans text-neutral-950">
									No team officers have been assigned yet.
								</p>
							{:else}
								<div class="space-y-3 text-sm text-neutral-950">
									{#each data.officers.team as officer (officer.id)}
										<div class="border border-neutral-950 bg-white p-3">
											<p class="font-semibold text-neutral-950">{officer.title}</p>
											<p class="mt-1 text-neutral-700">{officer.memberName}</p>
										</div>
									{/each}
								</div>
							{/if}
						{/snippet}
					</DashboardSidebarPanel>

					<div bind:this={assignOfficerPanelElement}>
						<DashboardSidebarPanel title="Assign Team Officer">
							{#snippet content()}
								<form class="space-y-3" onsubmit={submitAssignment}>
									<div>
										<p class="block text-sm text-neutral-950 mb-1">Officer title</p>
										<ListboxDropdown
											options={assignableTitles}
											value={assignmentForm.titleId}
											ariaLabel="Select a team officer title"
											buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
											disabled={assignableTitles.length === 0}
											on:change={(event) => {
												assignmentForm.titleId = event.detail.value;
											}}
										/>
									</div>
									<div>
										<p class="block text-sm text-neutral-950 mb-1">Member</p>
										<ListboxDropdown
											options={memberOptions}
											value={assignmentForm.userId}
											ariaLabel="Select a team officer"
											buttonClass={FORM_DROPDOWN_BUTTON_CLASS}
											disabled={memberOptions.length === 0}
											on:change={(event) => {
												assignmentForm.userId = event.detail.value;
											}}
										/>
									</div>
									<button
										class="button-primary w-full justify-center px-4 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
										type="submit"
										disabled={submittingAssignment ||
											assignableTitles.length === 0 ||
											memberOptions.length === 0}
									>
										{submittingAssignment ? 'Assigning...' : 'Assign officer'}
									</button>
								</form>
							{/snippet}
						</DashboardSidebarPanel>
					</div>
				</aside>
			</div>
		{:else}
			<div class="border-2 border-neutral-950 bg-white p-6 text-sm text-neutral-950">
				Team details are not available right now.
			</div>
		{/if}
	</div>
</div>
