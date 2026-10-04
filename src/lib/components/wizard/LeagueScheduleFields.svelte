<script lang="ts">
	import DateTimeInput from '$lib/components/DateTimeInput.svelte';

	interface Schedule {
		regStartDate: string;
		regEndDate: string;
		seasonStartDate: string;
		seasonEndDate: string;
	}
	interface Props {
		schedule: Schedule;
		idPrefix: string;
		registrationPrefix?: string;
		minYear?: number;
		maxYear?: number;
		errors?: Record<string, string>;
		onRegistrationFocus?: (field: 'regStartDate' | 'regEndDate') => void;
	}
	let {
		schedule = $bindable(),
		idPrefix,
		registrationPrefix = 'Team',
		minYear,
		maxYear,
		errors = {},
		onRegistrationFocus
	}: Props = $props();
</script>

<!-- Column grouping keeps the visual layout and natural keyboard order in agreement. -->
<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	<div class="space-y-4">
		<DateTimeInput
			id={`${idPrefix}-reg-start`}
			label={`${registrationPrefix} Registration Opens`}
			bind:value={schedule.regStartDate}
			{minYear}
			{maxYear}
			autofocus
			error={errors['league.regStartDate']}
			onDateFocus={() => onRegistrationFocus?.('regStartDate')}
		/>
		<DateTimeInput
			id={`${idPrefix}-reg-end`}
			label={`${registrationPrefix} Registration Deadline`}
			bind:value={schedule.regEndDate}
			{minYear}
			{maxYear}
			defaultTime="23:59"
			error={errors['league.regEndDate']}
			onDateFocus={() => onRegistrationFocus?.('regEndDate')}
		/>
	</div>
	<div class="space-y-4">
		<DateTimeInput
			id={`${idPrefix}-season-start`}
			label="Season Starts"
			bind:value={schedule.seasonStartDate}
			{minYear}
			{maxYear}
			error={errors['league.seasonStartDate']}
		/>
		<DateTimeInput
			id={`${idPrefix}-season-end`}
			label="Season Ends"
			bind:value={schedule.seasonEndDate}
			{minYear}
			{maxYear}
			defaultTime="23:59"
			error={errors['league.seasonEndDate']}
		/>
	</div>
</div>
