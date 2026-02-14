<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		step: number;
		lastStep: number;
		showBack: boolean;
		canGoNext: boolean;
		canSubmit: boolean;
		nextLabel: string;
		submitLabel: string;
		submittingLabel: string;
		isSubmitting: boolean;
	}

	let {
		step,
		lastStep,
		showBack,
		canGoNext,
		canSubmit,
		nextLabel,
		submitLabel,
		submittingLabel,
		isSubmitting
	}: Props = $props();

	const dispatch = createEventDispatcher<{ back: void; next: void }>();
</script>

<div class="pt-2 border-t border-secondary-300 flex justify-end">
	<div class="flex items-center gap-2 justify-end">
		{#if showBack}
			<button
				type="button"
				class="button-secondary-outlined cursor-pointer"
				onclick={() => dispatch('back')}
			>
				Back
			</button>
		{/if}
		{#if step < lastStep}
			<button
				type="button"
				class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={() => dispatch('next')}
				disabled={!canGoNext}
			>
				{nextLabel}
			</button>
		{:else}
			<button
				type="submit"
				class="button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={!canSubmit}
			>
				{isSubmitting ? submittingLabel : submitLabel}
			</button>
		{/if}
	</div>
</div>
