<script lang="ts">
	import { IconMapPin } from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
	import type { BreadcrumbSegment } from '$lib/components/navigation/breadcrumb.js';
	import type { ScheduleEventRecord, ScheduleManageAction } from '$lib/utils/schedule-page.js';

	interface Props {
		event: ScheduleEventRecord;
		compact?: boolean;
		showTime?: boolean;
		canManageEvents?: boolean;
		deleteConfirmEventId?: string | null;
		deleteConfirmSubmitting?: boolean;
		onManageAction?: (action: ScheduleManageAction, event: ScheduleEventRecord) => void;
		onDeleteCancel?: () => void;
		onDeleteConfirm?: () => void;
	}

	let {
		event,
		compact = false,
		showTime = true,
		canManageEvents = false,
		deleteConfirmEventId = null,
		deleteConfirmSubmitting = false,
		onManageAction,
		onDeleteCancel,
		onDeleteConfirm
	}: Props = $props();

	const deleteConfirmActive = $derived.by(() => deleteConfirmEventId === event.id);

	type ManageOption =
		| { value: ScheduleManageAction; label: string; persistOpenOnClick?: boolean }
		| {
				value: string;
				label: string;
				inlineSplitActions: {
					leftLabel: string;
					leftValue: string;
					leftAriaLabel?: string;
					leftKeepOpen?: boolean;
					leftClass?: string;
					leftDisabled?: boolean;
					rightLabel: string;
					rightValue: string;
					rightAriaLabel?: string;
					rightKeepOpen?: boolean;
					rightClass?: string;
					rightDisabled?: boolean;
					rowClass?: string;
				};
		  };

	function parseScoreParts(score: string | null): { home: string; away: string } | null {
		if (!score) return null;
		const match = score.match(/^(\d+)\s*-\s*(\d+)$/);
		if (!match) return null;
		return {
			home: match[1] ?? '',
			away: match[2] ?? ''
		};
	}

	const scoreParts = $derived.by(() => parseScoreParts(event.score));

	const manageOptions = $derived.by((): ManageOption[] => [
		{ value: 'enter-results', label: 'Enter Results' },
		{ value: 'edit', label: 'Edit Event' },
		{ value: 'duplicate', label: 'Duplicate Event' },
		deleteConfirmActive
			? {
					value: 'delete-confirm-row',
					label: 'Delete Event',
					inlineSplitActions: {
						leftLabel: 'Cancel',
						leftValue: 'delete-cancel',
						leftAriaLabel: 'Cancel delete',
						leftKeepOpen: true,
						leftClass: 'border-r border-neutral-950 bg-white text-neutral-950 hover:bg-neutral-50',
						leftDisabled: deleteConfirmSubmitting,
						rightLabel: 'Confirm Delete',
						rightValue: 'delete-confirm',
						rightAriaLabel: 'Confirm delete game',
						rightKeepOpen: false,
						rightClass: 'bg-error-700 text-white hover:bg-error-800',
						rightDisabled: deleteConfirmSubmitting,
						rowClass: 'h-10'
					}
				}
			: { value: 'delete', label: 'Delete Event', persistOpenOnClick: true }
	]);

	function formatStartTime(value: string | null): string {
		if (!value) return 'Time not set';

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Time not set';

		return parsed.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function offeringHref(event: ScheduleEventRecord): string {
		if (!event.seasonSlug || !event.offeringSlug) return '#';
		return `/dashboard/offerings/${event.seasonSlug}/${event.offeringSlug}`;
	}

	function leagueHref(event: ScheduleEventRecord): string {
		if (!event.seasonSlug || !event.offeringSlug || !event.leagueSlug) return '#';
		return `/dashboard/offerings/${event.seasonSlug}/${event.offeringSlug}/${event.leagueSlug}`;
	}

	function divisionHref(event: ScheduleEventRecord): string {
		if (!event.seasonSlug || !event.offeringSlug || !event.leagueSlug || !event.divisionSlug) {
			return '#';
		}

		return `/dashboard/offerings/${event.seasonSlug}/${event.offeringSlug}/${event.leagueSlug}/${event.divisionSlug}`;
	}

	function teamHref(
		event: ScheduleEventRecord,
		teamSlug: string | null | undefined,
		teamId: string | null | undefined
	): string {
		const teamSegment = teamSlug?.trim() || teamId?.trim();
		if (
			!event.seasonSlug ||
			!event.offeringSlug ||
			!event.leagueSlug ||
			!event.divisionSlug ||
			!teamSegment
		) {
			return '#';
		}

		return `/dashboard/offerings/${event.seasonSlug}/${event.offeringSlug}/${event.leagueSlug}/${event.divisionSlug}/${encodeURIComponent(teamSegment)}`;
	}

	const breadcrumbSegments = $derived.by<BreadcrumbSegment[]>(() => [
		{
			key: 'offering',
			label: event.offeringName,
			href: offeringHref(event),
			menuAriaLabel: `Open ${event.offeringName}`,
			currentValue: offeringHref(event),
			options: [],
			showMenu: false
		},
		{
			key: 'league',
			label: event.leagueName,
			href: leagueHref(event),
			menuAriaLabel: `Open ${event.leagueName}`,
			currentValue: leagueHref(event),
			options: [],
			showMenu: false
		},
		{
			key: 'division',
			label: event.divisionName,
			href: divisionHref(event),
			menuAriaLabel: `Open ${event.divisionName}`,
			currentValue: divisionHref(event),
			options: [],
			showMenu: false
		}
	]);

	function handleManageAction(action: string): void {
		if (action === 'delete-cancel') {
			onDeleteCancel?.();
			return;
		}
		if (action === 'delete-confirm') {
			onDeleteConfirm?.();
			return;
		}
		if (!onManageAction) return;
		if (
			action !== 'enter-results' &&
			action !== 'edit' &&
			action !== 'duplicate' &&
			action !== 'delete'
		)
			return;
		onManageAction(action, event);
	}
</script>

<article class={`border border-neutral-950 bg-white ${compact ? 'space-y-0' : 'space-y-0'}`}>
	<header
		class={`flex flex-col gap-2 border-b border-neutral-950 px-3 py-2 sm:flex-row sm:items-start sm:justify-between ${compact ? 'sm:gap-3' : 'sm:gap-4'}`}
	>
		<div class="min-w-0 overflow-hidden leading-0">
			<Breadcrumb segments={breadcrumbSegments} class="max-w-full" includeSeasonContext={false} />
		</div>

		<div class="flex flex-wrap items-center gap-1.5 sm:justify-end">
			{#if canManageEvents}
				<ListboxDropdown
					options={manageOptions}
					value=""
					mode="action"
					ariaLabel={`Manage ${event.matchup}`}
					align="right"
					placeholder="Manage"
					buttonClass="button-secondary-outlined min-h-6 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer inline-flex items-center justify-between gap-1"
					listClass="w-44"
					on:action={(managedEvent) => {
						handleManageAction(managedEvent.detail.value);
					}}
				/>
			{/if}
		</div>
	</header>

	<div
		class={`grid items-stretch gap-3 px-3 py-3 text-neutral-950 ${compact ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.9fr)_minmax(0,1fr)]'}`}
	>
		<div class={`min-w-0 ${compact ? 'text-center' : 'text-left'}`}>
			<div
				class={`flex min-w-0 items-center gap-3 ${compact ? 'justify-center' : 'justify-start'}`}
			>
				<div class="h-10 w-10 shrink-0 border border-neutral-950 bg-secondary-500"></div>
				<div class="min-w-0 space-y-1">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Away</p>
					<a
						href={teamHref(event, event.awayTeamSlug, event.awayTeamId)}
						class="block text-base font-bold leading-tight text-neutral-950 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none sm:text-lg"
					>
						{event.awayTeamName}
					</a>
				</div>
			</div>
		</div>

		<div class="min-w-0 text-center">
			<div class="flex min-w-0 items-center justify-center gap-3">
				{#if scoreParts}
					<span
						class={`${compact ? 'text-2xl' : 'text-3xl'} font-bold tabular-nums leading-none text-neutral-950`}
					>
						{scoreParts.home}
					</span>
				{/if}
				<div class="min-w-0 space-y-2 text-center">
					{#if event.scheduledStartAt && showTime}
						<p
							class={`${compact ? 'text-sm' : 'text-base'} font-bold uppercase tracking-wide text-neutral-950`}
						>
							<DateHoverText
								display={formatStartTime(event.scheduledStartAt)}
								value={event.scheduledStartAt}
								includeTime
								wrapperClass="inline"
							/>
						</p>
					{/if}
					<p
						class="inline-flex items-start justify-center gap-1.5 text-xs font-sans text-neutral-950"
					>
						<IconMapPin class="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>{event.location}</span>
					</p>
					{#if event.notes}
						<p class="text-xs font-sans text-neutral-900">{event.notes}</p>
					{/if}
				</div>
				{#if scoreParts}
					<span
						class={`${compact ? 'text-2xl' : 'text-3xl'} font-bold tabular-nums leading-none text-neutral-950`}
					>
						{scoreParts.away}
					</span>
				{/if}
			</div>
		</div>

		<div class={`min-w-0 ${compact ? 'text-center' : 'text-right'}`}>
			<div class={`flex min-w-0 items-center gap-3 ${compact ? 'justify-center' : 'justify-end'}`}>
				<div class="min-w-0 space-y-1">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Home</p>
					<a
						href={teamHref(event, event.homeTeamSlug, event.homeTeamId)}
						class="block text-base font-bold leading-tight text-neutral-950 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none sm:text-lg"
					>
						{event.homeTeamName}
					</a>
				</div>
				<div class="h-10 w-10 shrink-0 border border-neutral-950 bg-secondary-500"></div>
			</div>
		</div>
	</div>
</article>
