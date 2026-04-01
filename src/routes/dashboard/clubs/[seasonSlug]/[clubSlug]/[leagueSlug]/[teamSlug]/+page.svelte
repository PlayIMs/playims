<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import DashboardSidebarPanel from '$lib/components/dashboard/DashboardSidebarPanel.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let assignmentForm = $state({ titleId: '', userId: '' });
	let assignmentError = $state('');
	let assignmentMessage = $state('');

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
					{ value: `/dashboard/clubs/${data.season?.slug ?? ''}/${data.club?.slug ?? ''}`, label: data.club?.name ?? 'Club' }
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
		]
	);

	const assignableTitles = $derived.by(() =>
		data.officerTitles.filter((title) => title.scope === 'team' || title.scope === 'both')
	);

	$effect(() => {
		if (!assignmentForm.titleId && assignableTitles[0]?.id) {
			assignmentForm.titleId = assignableTitles[0].id;
		}
		if (!assignmentForm.userId && data.members[0]?.id) {
			assignmentForm.userId = data.members[0].id;
		}
	});

	async function submitAssignment(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		assignmentError = '';
		assignmentMessage = '';
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
			assignmentError = payload.error ?? 'Unable to assign officer.';
			return;
		}
		assignmentMessage = 'Team officer assigned.';
		await invalidateAll();
	}
</script>

<PageTitle pageTitle={data.team?.name ?? 'Club Team'} />

<div class="space-y-6">
	<section class="border-2 border-neutral-950 bg-white">
		<div class="border-b border-neutral-950 bg-neutral-100 p-5">
			<Breadcrumb segments={breadcrumbSegments} />
			<div class="mt-4 space-y-2">
				<p class="text-xs font-bold uppercase tracking-[0.24em] text-secondary-700">{data.league?.name}</p>
				<h1 class="font-heading text-3xl text-neutral-950">{data.team?.name}</h1>
				<p class="max-w-3xl text-sm text-neutral-800">{data.team?.description ?? 'Roster, officers, and schedule for this club team.'}</p>
			</div>
		</div>
		<div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="space-y-4">
				<div class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-200 p-4">
						<h2 class="dashboard-section-title text-neutral-950">Roster</h2>
					</div>
					<div class="space-y-3 p-4">
						{#each data.roster as rosterMember (rosterMember.id)}
							<div class="border border-neutral-950 bg-white p-3">
								<p class="font-semibold text-neutral-950">{rosterMember.displayName}</p>
								<p class="text-sm text-neutral-800">{rosterMember.rosterStatus}</p>
							</div>
						{/each}
						{#if data.roster.length === 0}
							<p class="text-sm text-neutral-800">No roster members assigned yet.</p>
						{/if}
					</div>
				</div>

				<div class="border-2 border-neutral-950 bg-neutral">
					<div class="border-b border-neutral-950 bg-neutral-200 p-4">
						<h2 class="dashboard-section-title text-neutral-950">Schedule</h2>
					</div>
					<div class="space-y-3 p-4">
						{#each data.schedule as game (game.id)}
							<div class="border border-neutral-950 bg-white p-3">
								<p class="font-semibold text-neutral-950">{game.opponentName}</p>
								<p class="text-sm text-neutral-800">{game.scheduledStartAt ?? 'Date TBD'}</p>
								<p class="mt-1 text-sm text-neutral-900">{game.resultLabel ?? game.status}</p>
							</div>
						{/each}
						{#if data.schedule.length === 0}
							<p class="text-sm text-neutral-800">No team events scheduled yet.</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="space-y-4">
				<DashboardSidebarPanel title="Club Officers">
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

				<DashboardSidebarPanel title="Team Officers">
					{#snippet content()}
						<div class="space-y-3 text-sm">
							{#each data.officers.team as officer (officer.id)}
								<div class="border border-neutral-950 bg-white p-3">
									<p class="font-semibold text-neutral-950">{officer.title}</p>
									<p class="text-neutral-800">{officer.memberName}</p>
								</div>
							{/each}
							{#if data.officers.team.length === 0}
								<p class="text-neutral-800">No team officers assigned yet.</p>
							{/if}
						</div>
					{/snippet}
				</DashboardSidebarPanel>

				<DashboardSidebarPanel title="Assign Team Officer">
					{#snippet content()}
						<form class="space-y-3" onsubmit={submitAssignment}>
							<select class="select-secondary" bind:value={assignmentForm.titleId}>
								{#each assignableTitles as title (title.id)}
									<option value={title.id}>{title.name}</option>
								{/each}
							</select>
							<select class="select-secondary" bind:value={assignmentForm.userId}>
								{#each data.members as member (member.id)}
									<option value={member.id}>{member.label}</option>
								{/each}
							</select>
							<button class="btn-primary w-full" type="submit">Assign officer</button>
							{#if assignmentError}<p class="text-sm text-primary-800">{assignmentError}</p>{/if}
							{#if assignmentMessage}<p class="text-sm text-secondary-900">{assignmentMessage}</p>{/if}
						</form>
					{/snippet}
				</DashboardSidebarPanel>
			</div>
		</div>
	</section>
</div>
