<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface DayOption {
		shortLabel: string;
		value: string;
		aliases: string[];
	}

	interface Props {
		value: string;
		disabled?: boolean;
		allowClear?: boolean;
		fieldClass?: string;
		gridClass?: string;
		buttonClass?: string;
		selectedButtonClass?: string;
		unselectedButtonClass?: string;
	}

	const DAY_OPTIONS: DayOption[] = [
		{ shortLabel: 'Mon', value: 'Monday', aliases: ['mon', 'monday'] },
		{ shortLabel: 'Tue', value: 'Tuesday', aliases: ['tue', 'tues', 'tuesday'] },
		{ shortLabel: 'Wed', value: 'Wednesday', aliases: ['wed', 'wednesday'] },
		{ shortLabel: 'Thu', value: 'Thursday', aliases: ['thu', 'thur', 'thurs', 'thursday'] },
		{ shortLabel: 'Fri', value: 'Friday', aliases: ['fri', 'friday'] },
		{ shortLabel: 'Sat', value: 'Saturday', aliases: ['sat', 'saturday'] },
		{ shortLabel: 'Sun', value: 'Sunday', aliases: ['sun', 'sunday'] }
	];

	let {
		value,
		disabled = false,
		allowClear = true,
		fieldClass = 'border-2 border-secondary-400 bg-white p-2 text-neutral-950 focus-within:border-secondary-500 focus-within:shadow-[0_0_0_1px_var(--color-secondary-500)]',
		gridClass = 'grid grid-cols-4 gap-2 sm:grid-cols-7',
		buttonClass = 'min-h-10 border-2 px-2 py-2 text-center font-sans text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:shadow-[0_0_0_1px_var(--color-secondary-600)] disabled:cursor-not-allowed disabled:opacity-50',
		selectedButtonClass = 'border-secondary-700 bg-secondary-600 text-white',
		unselectedButtonClass = 'border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50'
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { value: string };
	}>();

	function normalizedValue(source: string): string {
		const candidate = source.trim().toLowerCase();
		if (!candidate) return '';

		const matchedDay = DAY_OPTIONS.find((option) => option.aliases.includes(candidate));
		return matchedDay?.value ?? source.trim();
	}

	const resolvedValue = $derived.by(() => normalizedValue(value));

	function handleSelect(nextValue: string): void {
		if (disabled) return;

		const currentValue = normalizedValue(value);
		dispatch('change', {
			value: allowClear && currentValue === nextValue ? '' : nextValue
		});
	}
</script>

<div class={fieldClass} role="group" aria-label="Day of week selector">
	<div class={gridClass}>
		{#each DAY_OPTIONS as option}
			{@const selected = resolvedValue === option.value}
			<button
				type="button"
				class={`${buttonClass} ${selected ? selectedButtonClass : unselectedButtonClass}`}
				aria-pressed={selected}
				aria-label={`${option.value}${allowClear ? ', click again to clear' : ''}`}
				{disabled}
				onclick={() => {
					handleSelect(option.value);
				}}
			>
				<span aria-hidden="true">{option.shortLabel}</span>
				<span class="sr-only">{option.value}</span>
			</button>
		{/each}
	</div>
</div>
