<script lang="ts">
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ScheduleEventCard from './ScheduleEventCard.svelte';
	import {
		buildMonthScheduleCells,
		getEventsForDate,
		type ScheduleEventRecord,
		type ScheduleManageAction
	} from '$lib/utils/schedule-page.js';

	interface Props {
		events: ScheduleEventRecord[];
		anchorDate: string;
		selectedDate: string;
		onSelectDate: (dateKey: string) => void;
		canManageEvents?: boolean;
		deleteConfirmEventId?: string | null;
		deleteConfirmSubmitting?: boolean;
		onManageAction?: (action: ScheduleManageAction, event: ScheduleEventRecord) => void;
		onDeleteCancel?: () => void;
		onDeleteConfirm?: () => void;
	}

	let {
		events,
		anchorDate,
		selectedDate,
		onSelectDate,
		canManageEvents = false,
		deleteConfirmEventId = null,
		deleteConfirmSubmitting = false,
		onManageAction,
		onDeleteCancel,
		onDeleteConfirm
	}: Props = $props();

	const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const monthCells = $derived.by(() => buildMonthScheduleCells(events, anchorDate));
	const selectedDayEvents = $derived.by(() => getEventsForDate(events, selectedDate));

	function monthPreviewClass(status: ScheduleEventRecord['status']): string {
		if (status === 'in_progress') return 'border-primary-600 bg-primary-100 text-primary-900';
		if (status === 'completed') return 'border-secondary-500 bg-secondary-100 text-secondary-900';
		if (status === 'cancelled') return 'border-error-500 bg-error-100 text-error-900';
		if (status === 'postponed') return 'border-warning-500 bg-warning-100 text-warning-900';
		return 'border-neutral-300 bg-neutral-50 text-neutral-950';
	}

	function selectedDayLabel(dateKey: string): string {
		const parsed = new Date(`${dateKey}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) return dateKey;

		return parsed.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-4">
	<div class="overflow-x-auto border border-neutral-950 bg-white scrollbar-thin">
		<div class="grid min-w-[62rem] grid-cols-7 border-b border-neutral-950 bg-neutral-50">
			{#each weekdayLabels as label}
				<div
					class="border-r border-neutral-950 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-950 last:border-r-0"
				>
					{label}
				</div>
			{/each}
		</div>

		<div class="grid min-w-[62rem] grid-cols-7">
			{#each monthCells as cell, index (cell.dateKey)}
				<article
					class={`min-h-[10rem] border-b border-r border-neutral-950 p-2 align-top ${
						index >= monthCells.length - 7 ? 'border-b-0' : ''
					} ${index % 7 === 6 ? 'border-r-0' : ''} ${
						cell.dateKey === selectedDate ? 'bg-primary-50' : 'bg-white'
					}`}
				>
					<div class="flex items-start justify-between gap-2">
						<button
							type="button"
							class={`inline-flex min-w-[2rem] items-center justify-center border px-2 py-1 text-xs font-bold cursor-pointer ${
								cell.dateKey === selectedDate
									? 'border-primary-700 bg-primary text-white'
									: cell.inCurrentMonth
										? 'border-neutral-950 bg-white text-neutral-950'
										: 'border-neutral-300 bg-neutral-50 text-neutral-700'
							}`}
							aria-label={`Show events for ${selectedDayLabel(cell.dateKey)}`}
							onclick={() => {
								onSelectDate(cell.dateKey);
							}}
						>
							<DateHoverText display={String(cell.dayNumber)} value={cell.dateKey} />
						</button>
						{#if cell.isToday}
							<span class="badge-primary-outlined text-[11px] uppercase tracking-wide">Today</span>
						{/if}
					</div>

					<div class="mt-2 space-y-1">
						{#each cell.events.slice(0, 3) as event (event.id)}
							<button
								type="button"
								class={`block w-full border px-2 py-1 text-left text-[11px] font-semibold cursor-pointer ${monthPreviewClass(event.status)}`}
								aria-label={`Show ${event.matchup} in the selected day details`}
								onclick={() => {
									onSelectDate(cell.dateKey);
								}}
							>
								<span class="block truncate">{event.matchup}</span>
							</button>
						{/each}

						{#if cell.events.length > 3}
							<button
								type="button"
								class="w-full border border-neutral-300 bg-neutral-25 px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-950 cursor-pointer"
								aria-label={`Show ${cell.events.length - 3} more events for ${selectedDayLabel(cell.dateKey)}`}
								onclick={() => {
									onSelectDate(cell.dateKey);
								}}
							>
								+{cell.events.length - 3} more
							</button>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</div>

	<section class="border border-neutral-950 bg-white">
		<div class="border-b border-neutral-950 bg-neutral-50 px-4 py-3">
			<h3 class="text-lg font-bold font-serif text-neutral-950">
				<DateHoverText display={selectedDayLabel(selectedDate)} value={selectedDate} />
			</h3>
			<p class="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-950">
				{selectedDayEvents.length} scheduled event{selectedDayEvents.length === 1 ? '' : 's'}
			</p>
		</div>

		<div class="space-y-3 p-4">
			{#if selectedDayEvents.length === 0}
				<p class="text-sm font-sans text-neutral-950">No scheduled events fall on this day.</p>
			{:else}
				{#each selectedDayEvents as event (event.id)}
					<ScheduleEventCard
						{event}
						{canManageEvents}
						{deleteConfirmEventId}
						{deleteConfirmSubmitting}
						{onManageAction}
						{onDeleteCancel}
						{onDeleteConfirm}
					/>
				{/each}
			{/if}
		</div>
	</section>
</div>
