<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		cancelLabel: string;
	}

	let { open, title, message, confirmLabel, cancelLabel }: Props = $props();

	const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();
</script>

<ModalShell
	{open}
	closeAriaLabel="Close unsaved changes confirmation"
	panelClass="w-full max-w-xl bg-neutral-400 border-4 border-secondary"
	on:requestClose={() => dispatch('cancel')}
>
	<div class="p-5 border-b border-secondary">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">{title}</h3>
	</div>
	<div class="p-5 space-y-4">
		<p class="font-sans text-neutral-950">{message}</p>
		<div class="flex items-center justify-end gap-3 pt-2">
			<button type="button" class="button-secondary cursor-pointer" onclick={() => dispatch('cancel')}>
				{cancelLabel}
			</button>
			<button
				type="button"
				class="button-secondary-outlined border-error-700 text-error-700 hover:bg-error-50 cursor-pointer"
				onclick={() => dispatch('confirm')}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</ModalShell>
