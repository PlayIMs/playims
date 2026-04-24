<script lang="ts">
	import ScheduleEventCard from './ScheduleEventCard.svelte';
	import {
		getEventsForDate,
		type ScheduleEventRecord,
		type ScheduleManageAction
	} from '$lib/utils/schedule-page.js';

	interface Props {
		events: ScheduleEventRecord[];
		dateKey: string;
		canManageEvents?: boolean;
		deleteConfirmEventId?: string | null;
		deleteConfirmSubmitting?: boolean;
		onManageAction?: (action: ScheduleManageAction, event: ScheduleEventRecord) => void;
		onDeleteCancel?: () => void;
		onDeleteConfirm?: () => void;
	}

	let {
		events,
		dateKey,
		canManageEvents = false,
		deleteConfirmEventId = null,
		deleteConfirmSubmitting = false,
		onManageAction,
		onDeleteCancel,
		onDeleteConfirm
	}: Props = $props();

	const dayEvents = $derived.by(() => getEventsForDate(events, dateKey));
</script>

{#if dayEvents.length === 0}
	<div class="border border-neutral-950 bg-white p-6 text-center">
		<p class="text-sm font-sans text-neutral-950">No scheduled events fall on this day.</p>
	</div>
{:else}
	<div class="space-y-3">
		{#each dayEvents as event (event.id)}
			<ScheduleEventCard
				{event}
				showTime
				{canManageEvents}
				{deleteConfirmEventId}
				{deleteConfirmSubmitting}
				{onManageAction}
				{onDeleteCancel}
				{onDeleteConfirm}
			/>
		{/each}
	</div>
{/if}
