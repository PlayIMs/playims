<script lang="ts">
	import { IconLock, IconLockOpen } from '@tabler/icons-svelte';
	import { breadcrumbStats, type BreadcrumbMetadata } from './breadcrumb.js';

	let {
		summary
	}: {
		summary?: BreadcrumbMetadata;
	} = $props();

	const stats = $derived(summary ? breadcrumbStats(summary) : []);
</script>

{#if stats.length > 0 || typeof summary?.isLocked === 'boolean'}
	<span
		class="listbox-dropdown-option-muted inline-flex shrink-0 items-center gap-3 text-[10px] font-normal uppercase tracking-wide"
	>
		{#if summary?.isLocked === true}
			<IconLock class="h-4 w-4 opacity-50" aria-label="Locked division" />
		{:else if summary?.isLocked === false}
			<IconLockOpen class="h-4 w-4 opacity-50" aria-label="Unlocked division" />
		{/if}
		{#each stats as stat}
			<span class="inline-flex items-center gap-1">
				<span>{stat.label}</span>
				{#if stat.kind === 'unlocked'}
					<IconLockOpen class="h-4 w-4 opacity-50" aria-label="Unlocked divisions" />
				{:else if stat.kind === 'locked'}
					<IconLock class="h-4 w-4" aria-label="Locked divisions" />
				{/if}
			</span>
		{/each}
	</span>
{/if}
