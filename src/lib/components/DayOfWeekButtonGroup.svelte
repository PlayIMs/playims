<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { DIVISION_DAY_OPTIONS, formatDivisionDays } from '$lib/utils/division-schedule-inference.js';

	interface Props {
		selectedValues: string[];
		disabled?: boolean;
		allowClear?: boolean;
		fieldClass?: string;
		gridClass?: string;
		buttonClass?: string;
		selectedButtonClass?: string;
		unselectedButtonClass?: string;
	}

	let {
		selectedValues,
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

	function handleToggle(nextValue: string): void {
		if (disabled) return;

		const currentValues = selectedValues;
		const hasValue = currentValues.includes(nextValue);
		const nextValues = hasValue
			? currentValues.filter((value) => value !== nextValue)
			: [...currentValues, nextValue];
		dispatch('change', {
			value: allowClear || nextValues.length > 0 ? formatDivisionDays(nextValues) : ''
		});
	}
</script>

<div class={fieldClass} role="group" aria-label="Division days selector">
	<div class={gridClass}>
		{#each DIVISION_DAY_OPTIONS as option}
			{@const selected = selectedValues.includes(option.value)}
			<button
				type="button"
				class={`${buttonClass} ${selected ? selectedButtonClass : unselectedButtonClass}`}
				aria-pressed={selected}
				aria-label={`${selected ? 'Selected ' : ''}${option.value}${allowClear ? ', click to toggle' : ''}`}
				{disabled}
				onclick={() => {
					handleToggle(option.value);
				}}
			>
				<span aria-hidden="true">{option.shortLabel}</span>
				<span class="sr-only">{option.value}</span>
			</button>
		{/each}
	</div>
</div>
