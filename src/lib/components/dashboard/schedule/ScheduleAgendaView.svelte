<script lang="ts">
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ScheduleEventCard from './ScheduleEventCard.svelte';
	import {
		buildScheduleAgendaBuckets,
		type ScheduleEventRecord,
		type ScheduleManageAction
	} from '$lib/utils/schedule-page.js';

	interface Props {
		events: ScheduleEventRecord[];
		startDate?: string | null;
		endDate?: string | null;
		emptyMessage?: string;
		canManageEvents?: boolean;
		deleteConfirmEventId?: string | null;
		deleteConfirmSubmitting?: boolean;
		onManageAction?: (action: ScheduleManageAction, event: ScheduleEventRecord) => void;
		onDeleteCancel?: () => void;
		onDeleteConfirm?: () => void;
	}

	let {
		events,
		startDate = null,
		endDate = null,
		emptyMessage = 'No scheduled events fall within this range.',
		canManageEvents = false,
		deleteConfirmEventId = null,
		deleteConfirmSubmitting = false,
		onManageAction,
		onDeleteCancel,
		onDeleteConfirm
	}: Props = $props();

	const agendaBuckets = $derived.by(() =>
		buildScheduleAgendaBuckets(events, {
			startDate: startDate ?? undefined,
			endDate: endDate ?? undefined
		})
	);
</script>

{#if agendaBuckets.length === 0}
	<div class="border border-neutral-950 bg-white p-6 text-center">
		<p class="text-sm font-sans text-neutral-950">{emptyMessage}</p>
	</div>
{:else}
	<div class="space-y-4">
		{#each agendaBuckets as bucket (bucket.dateKey)}
			<section class="border border-neutral-950 bg-white">
				<header class="border-b border-neutral-950 bg-neutral-50 px-4 py-3">
					<h3 class="text-lg font-bold font-serif text-neutral-950">
						<DateHoverText display={bucket.label} value={bucket.dateKey} />
					</h3>
					<p class="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-950">
						{bucket.events.length} scheduled event{bucket.events.length === 1 ? '' : 's'}
					</p>
				</header>

				<div class="space-y-3 p-4">
					{#each bucket.events as event (event.id)}
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
				</div>
			</section>
		{/each}
	</div>
{/if}
