<script lang="ts">
	import { IconCalendar, IconClock, IconMapPin } from '@tabler/icons-svelte';
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import type { ScheduleEventRecord } from '$lib/utils/schedule-page.js';

	interface Props {
		event: ScheduleEventRecord;
		compact?: boolean;
		showDate?: boolean;
		showTime?: boolean;
	}

	let { event, compact = false, showDate = false, showTime = true }: Props = $props();

	function formatDateLabel(value: string | null): string {
		if (!value) return 'Date not set';

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Date not set';

		return parsed.toLocaleDateString('en-US', {
			weekday: compact ? 'short' : 'long',
			month: compact ? 'short' : 'long',
			day: 'numeric',
			year: compact ? undefined : 'numeric'
		});
	}

	function formatTimeRange(start: string | null, end: string | null): string {
		if (!start) return 'Time not set';

		const startDate = new Date(start);
		if (Number.isNaN(startDate.getTime())) return 'Time not set';

		const startText = startDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		if (!end) return startText;

		const endDate = new Date(end);
		if (Number.isNaN(endDate.getTime())) return startText;

		const endText = endDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});

		return `${startText} - ${endText}`;
	}

	function statusBadgeClass(status: ScheduleEventRecord['status']): string {
		if (status === 'in_progress') return 'badge-primary';
		if (status === 'completed') return 'badge-secondary';
		if (status === 'cancelled') return 'badge-error';
		if (status === 'postponed') return 'badge-warning';
		return 'badge-neutral-outlined';
	}
</script>

<article
	class={`border border-neutral-950 bg-white ${compact ? 'p-2.5 space-y-2' : 'p-3 space-y-3'}`}
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 space-y-1">
			{#if event.scheduledStartAt}
				{#if showTime || showDate}
					<div class="flex flex-wrap items-center gap-2 text-xs font-sans text-neutral-950">
						{#if showTime}
							<span class="inline-flex items-center gap-1">
								<IconClock class="h-3.5 w-3.5 shrink-0" />
								<DateHoverText
									display={formatTimeRange(event.scheduledStartAt, event.scheduledEndAt)}
									value={event.scheduledStartAt}
									endValue={event.scheduledEndAt}
									includeTime
									wrapperClass="inline"
								/>
							</span>
						{/if}
						{#if showDate}
							<span class="inline-flex items-center gap-1">
								<IconCalendar class="h-3.5 w-3.5 shrink-0" />
								<DateHoverText
									display={formatDateLabel(event.scheduledStartAt)}
									value={event.scheduledStartAt}
									wrapperClass="inline"
								/>
							</span>
						{/if}
					</div>
				{/if}
			{:else}
				<span class="badge-warning text-[11px] uppercase tracking-wide">Unscheduled</span>
			{/if}

			<h3 class={`${compact ? 'text-sm' : 'text-base'} font-bold font-serif text-neutral-950`}>
				{event.matchup}
			</h3>
			<p class="text-xs text-neutral-950 font-sans">
				{event.offeringName} - {event.leagueName} - {event.divisionName}
			</p>
		</div>

		<div class="flex max-w-[12rem] flex-wrap justify-end gap-1">
			{#if event.score}
				<span class="badge-secondary text-[11px] uppercase tracking-wide">{event.score}</span>
			{/if}
			{#if event.isPostseason}
				<span class="badge-primary-outlined text-[11px] uppercase tracking-wide">Postseason</span>
			{/if}
			<span class={`${statusBadgeClass(event.status)} text-[11px] uppercase tracking-wide`}>
				{event.statusLabel}
			</span>
		</div>
	</div>

	<div class={`grid gap-2 text-xs text-neutral-950 ${compact ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
		<p class="inline-flex items-start gap-1.5">
			<IconMapPin class="mt-0.5 h-3.5 w-3.5 shrink-0" />
			<span>{event.location}</span>
		</p>
		{#if event.roundLabel || event.weekNumber !== null}
			<p>
				{#if event.roundLabel}
					<span>{event.roundLabel}</span>
				{/if}
				{#if event.roundLabel && event.weekNumber !== null}
					<span> - </span>
				{/if}
				{#if event.weekNumber !== null}
					<span>Week {event.weekNumber}</span>
				{/if}
			</p>
		{/if}
	</div>

	{#if event.notes}
		<p class="text-xs text-neutral-900 font-sans">{event.notes}</p>
	{/if}
</article>
