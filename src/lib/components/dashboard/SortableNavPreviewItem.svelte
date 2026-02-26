<script lang="ts">
	import IconGripVertical from '@tabler/icons-svelte/icons/grip-vertical';
	import IconRoute from '@tabler/icons-svelte/icons/route';
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import type { DashboardNavKey } from '$lib/dashboard/navigation';

	let {
		tabKey,
		label,
		href,
		index,
		disabled,
		group = 'dashboard-navigation-preview'
	} = $props<{
		tabKey: DashboardNavKey;
		label: string;
		href: string;
		index: number;
		disabled: boolean;
		group?: string;
	}>();

	const sortable = useSortable({
		id: () => tabKey,
		index: () => index,
		group: () => group,
		data: () => ({ tabKey }),
		disabled: () => disabled,
		transition: () => ({
			duration: 280,
			easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
			idle: true
		})
	});
</script>

<li
	{@attach sortable.ref}
	class="border border-secondary-300 bg-neutral px-2 py-2 flex items-center gap-2 min-h-11 transition-colors duration-150"
>
	<button
		type="button"
		{@attach sortable.handleRef}
		class="h-9 w-9 shrink-0 inline-flex items-center justify-center border border-secondary-300 bg-white text-secondary-800 disabled:cursor-not-allowed disabled:opacity-50"
		aria-label={`Reorder ${label}`}
		disabled={disabled}
	>
		<IconGripVertical class="w-4 h-4" />
	</button>
	<span class="text-sm text-neutral-950 font-semibold truncate flex-1">{label}</span>
	{#if href !== '#'}
		<IconRoute class="w-4 h-4 text-secondary-700 shrink-0" />
	{/if}
</li>
