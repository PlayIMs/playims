<script lang="ts">
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ScheduleEventCard from './ScheduleEventCard.svelte';
	import { getEventsForDate, type ScheduleEventRecord } from '$lib/utils/schedule-page.js';

	interface Props {
		events: ScheduleEventRecord[];
		dateKey: string;
	}

	let { events, dateKey }: Props = $props();

	const dayEvents = $derived.by(() => getEventsForDate(events, dateKey));

	function formatTimeLabel(value: string | null): string {
		if (!value) return 'Time not set';

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Time not set';

		return parsed.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

{#if dayEvents.length === 0}
	<div class="border border-neutral-950 bg-white p-6 text-center">
		<p class="text-sm font-sans text-neutral-950">No scheduled events fall on this day.</p>
	</div>
{:else}
	<div class="space-y-3">
		{#each dayEvents as event (event.id)}
			<div class="grid gap-3 md:grid-cols-[7.5rem_minmax(0,1fr)] md:items-start">
				<div
					class="border border-neutral-950 bg-neutral-50 px-3 py-2 text-center md:sticky md:top-4"
				>
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Start</p>
					<p class="mt-1 text-sm font-bold font-serif text-neutral-950">
						<DateHoverText
							display={formatTimeLabel(event.scheduledStartAt)}
							value={event.scheduledStartAt}
							includeTime
						/>
					</p>
				</div>
				<ScheduleEventCard {event} showTime={false} />
			</div>
		{/each}
	</div>
{/if}
