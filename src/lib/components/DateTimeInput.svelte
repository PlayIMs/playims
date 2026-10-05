<script lang="ts">
	import DatePicker from './DatePicker.svelte';
	import TimeInput from './TimeInput.svelte';
	import { parseDisplayPickerValue } from './date-picker.js';
	import { parseTimeEntry } from './date-time-entry.js';
	import { replaceDateTimePart, splitDateTimeValue } from './date-time-parts.js';

	interface Props {
		id: string;
		label: string;
		value: string;
		defaultTime?: string;
		minYear?: number;
		maxYear?: number;
		autofocus?: boolean;
		error?: string;
		onDateFocus?: () => void;
	}
	let {
		id,
		label,
		value = $bindable(''),
		defaultTime = '00:00',
		minYear,
		maxYear,
		autofocus = false,
		error,
		onDateFocus
	}: Props = $props();
	const parts = $derived(splitDateTimeValue(value));
	const dateError = $derived(
		error && !parseDisplayPickerValue(parts.date, 'date') ? 'Enter a valid date.' : undefined
	);
	const timeError = $derived(
		error && !parseTimeEntry(parts.time || defaultTime) ? 'Enter a valid time.' : undefined
	);
</script>

<div>
	<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)] items-end gap-3">
		<div class="modal-field">
			<label for={id} class="mb-1 block text-sm font-sans text-neutral-950"
				>{label} <span class="text-error-700">*</span></label
			>
			<DatePicker
				{id}
				type="date"
				{minYear}
				{maxYear}
				calendarButtonTabIndex={-1}
				inputClass="input-secondary py-2 text-sm"
				error={dateError}
				data-wizard-autofocus={autofocus || undefined}
				aria-invalid={dateError ? 'true' : undefined}
				aria-describedby={dateError ? `${id}-error` : undefined}
				bind:value={
					() => parts.date,
					(date) => (value = replaceDateTimePart(value, 'date', date, defaultTime))
				}
				on:focus={() => onDateFocus?.()}
			/>
		</div>
		<TimeInput
			id={`${id}-time`}
			{label}
			{defaultTime}
			error={timeError}
			bind:value={
				() => parts.time, (time) => (value = replaceDateTimePart(value, 'time', time, defaultTime))
			}
		/>
	</div>
</div>
