<script lang="ts">
	import { createEventDispatcher, type Snippet } from 'svelte';
	import { getToggleStatus } from '$lib/utils/toggle-status.js';

	interface Props {
		id: string;
		label: string;
		checked: boolean;
		onLabel?: string;
		offLabel?: string;
		statusText?: string;
		name?: string;
		value?: string;
		onchange?: (event: Event) => void;
		disabled?: boolean;
		role?: 'switch' | undefined;
		fieldClass?: string;
		labelClass?: string;
		descriptionClass?: string;
		inputClass?: string;
		onkeydown?: (event: KeyboardEvent) => void;
		description?: Snippet;
		children?: Snippet;
	}

	let {
		id,
		label,
		checked = $bindable(),
		onLabel = 'Enabled',
		offLabel = 'Disabled',
		statusText,
		name,
		value,
		onchange,
		disabled = false,
		role = 'switch',
		fieldClass = 'toggle-field-secondary flex w-full gap-2',
		labelClass = 'text-sm leading-5 font-normal',
		descriptionClass = 'text-sm leading-6 text-neutral-950',
		inputClass = 'toggle-secondary shrink-0',
		onkeydown,
		description,
		children
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { checked: boolean };
	}>();

	function handleInput(event: Event): void {
		const nextChecked = (event.currentTarget as HTMLInputElement).checked;
		checked = nextChecked;
		dispatch('change', { checked: nextChecked });
	}
</script>

<div class="min-w-0">
	<label for={id} class={`mb-1 block text-neutral-950 ${labelClass}`}>{label}</label>
	<label for={id} class={`${fieldClass} items-center`}>
		<input
			{id}
			{name}
			{value}
			type="checkbox"
			{disabled}
			{role}
			aria-label={label}
			aria-describedby={description ? `${id}-description` : undefined}
			class={inputClass}
			{checked}
			oninput={handleInput}
			{onchange}
			{onkeydown}
		/>
		<span class="text-sm leading-6"
			>{statusText ?? getToggleStatus(checked, onLabel, offLabel)}</span
		>
	</label>
	{#if description}
		<div id={`${id}-description`} class={`mt-1 ${descriptionClass}`}>
			{@render description()}
		</div>
	{/if}
</div>
