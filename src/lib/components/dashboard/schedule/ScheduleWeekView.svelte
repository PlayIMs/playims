<script lang="ts">
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ScheduleEventCard from './ScheduleEventCard.svelte';
	import { buildWeekScheduleDays, type ScheduleEventRecord } from '$lib/utils/schedule-page.js';

	interface Props {
		events: ScheduleEventRecord[];
		anchorDate: string;
	}

	let { events, anchorDate }: Props = $props();

	const weekDays = $derived.by(() => buildWeekScheduleDays(events, anchorDate));
</script>

<div class="overflow-x-auto border border-neutral-950 bg-white scrollbar-thin">
	<div class="grid min-w-[74rem] grid-cols-7">
		{#each weekDays as day, index (day.dateKey)}
			<section
				class={index === weekDays.length - 1 ? 'min-w-0' : 'min-w-0 border-r border-neutral-950'}
			>
				<header class="border-b border-neutral-950 bg-neutral-50 px-3 py-3">
					<p class="text-sm font-bold font-serif text-neutral-950">
						<DateHoverText display={day.label} value={day.dateKey} />
					</p>
					<p class="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-950">
						{day.events.length} event{day.events.length === 1 ? '' : 's'}
					</p>
				</header>

				<div class="min-h-[28rem] space-y-2 p-3 align-top">
					{#if day.events.length === 0}
						<div
							class="border border-dashed border-neutral-300 bg-neutral-25 p-3 text-xs text-neutral-900"
						>
							No scheduled events.
						</div>
					{:else}
						{#each day.events as event (event.id)}
							<ScheduleEventCard {event} compact />
						{/each}
					{/if}
				</div>
			</section>
		{/each}
	</div>
</div>
