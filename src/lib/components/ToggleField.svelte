<script lang="ts">
	import { createEventDispatcher, type Snippet } from 'svelte';

	interface Props {
		id: string;
		label: string;
		checked: boolean;
		disabled?: boolean;
		labelPlacement?: 'left' | 'right';
		role?: 'switch' | undefined;
		fieldClass?: string;
		labelClass?: string;
		descriptionClass?: string;
		inputClass?: string;
		description?: Snippet;
		children?: Snippet;
	}

	let {
		id,
		label,
		checked,
		disabled = false,
		labelPlacement = 'right',
		role = 'switch',
		fieldClass = 'flex w-full min-h-[2.625rem] gap-3 border-2 border-secondary-400 bg-white px-4 py-2 text-neutral-950 focus-within:border-secondary-500 focus-within:shadow-[0_0_0_1px_var(--color-secondary-500)]',
		labelClass = 'text-base leading-6 font-normal text-neutral-950',
		descriptionClass = 'text-sm leading-6 text-neutral-950',
		inputClass = 'toggle-secondary shrink-0',
		description,
		children
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { checked: boolean };
	}>();

	const hasDescription = $derived.by(() => Boolean(description));
	const resolvedFieldClass = $derived.by(
		() => `${fieldClass} ${hasDescription ? 'items-start' : 'items-center'}`
	);
	const resolvedContentClass = $derived.by(
		() => `min-w-0 ${hasDescription ? 'space-y-1' : ''}`
	);

	function handleInput(event: Event): void {
		const nextChecked = (event.currentTarget as HTMLInputElement).checked;
		dispatch('change', { checked: nextChecked });
	}
</script>

<label for={id} class={resolvedFieldClass}>
	{#if labelPlacement === 'left'}
		<span class={resolvedContentClass}>
			<span class={`block ${labelClass}`}>{label}</span>
			{#if description}
				<span class={`block ${descriptionClass}`}>
					{@render description()}
				</span>
			{/if}
		</span>
	{/if}

	<input
		{id}
		type="checkbox"
		{disabled}
		{role}
		class={inputClass}
		checked={checked}
		oninput={handleInput}
	/>

	{#if labelPlacement === 'right'}
		<span class={resolvedContentClass}>
			<span class={`block ${labelClass}`}>{label}</span>
			{#if description}
				<span class={`block ${descriptionClass}`}>
					{@render description()}
				</span>
			{/if}
		</span>
	{/if}
</label>
