<script lang="ts">
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import { IconLockOpen } from '@tabler/icons-svelte';

	interface OverrideDialogState {
		divisionName: string;
		term: 'locked' | 'full';
	}

	interface Props {
		open: boolean;
		dialogState: OverrideDialogState | null;
		submitting: boolean;
		actionLabel: 'Add' | 'Move';
		onRequestClose: () => void;
		onConfirm: () => void;
		onConfirmAndUnlock?: (() => void) | null;
	}

	let {
		open,
		dialogState,
		submitting,
		actionLabel,
		onRequestClose,
		onConfirm,
		onConfirmAndUnlock = null
	}: Props = $props();
</script>

<ModalShell
	{open}
	closeAriaLabel={`Close ${actionLabel.toLowerCase()} override confirmation`}
	panelClass="w-full max-w-md border-4 border-secondary bg-neutral-400 overflow-hidden"
	paddingClass="p-0"
	on:requestClose={() => {
		if (submitting) return;
		onRequestClose();
	}}
>
	{#if dialogState}
		<div class="bg-white">
			<div class="border-b border-neutral-950 px-4 py-3">
				<p class="text-sm leading-5 text-neutral-950">
					{#if dialogState.term === 'full'}
						<span class="font-semibold">{dialogState.divisionName}</span> is full.
						{actionLabel} this team anyway as a manual override?
					{:else}
						<span class="font-semibold">{dialogState.divisionName}</span> is locked.
						Do you want to {actionLabel.toLowerCase()} this team anyway?
					{/if}
				</p>
			</div>
			<div class="flex items-center justify-end gap-2 bg-neutral px-4 py-3">
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center border-2 border-secondary-500 bg-white px-2.5 text-[11px] font-semibold leading-none text-neutral-950 cursor-pointer hover:bg-secondary-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-500 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting}
					onclick={onRequestClose}
				>
					Cancel
				</button>
				{#if dialogState.term === 'locked'}
					<button
						type="button"
						class="inline-flex h-8 items-center justify-center border-2 border-secondary-500 bg-white px-2.5 text-[11px] font-semibold leading-none text-neutral-950 cursor-pointer hover:bg-secondary-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-500 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={submitting}
						onclick={onConfirm}
					>
						{actionLabel}
					</button>
					<button
						type="button"
						class="inline-flex h-8 items-center justify-center gap-1 border border-primary-600 bg-primary-500 px-2.5 text-[11px] font-semibold leading-none cursor-pointer hover:bg-primary-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
										style:color="var(--color-primary-foreground)"
						disabled={submitting}
						onclick={() => {
							onConfirmAndUnlock?.();
						}}
					>
						<IconLockOpen class="h-3.5 w-3.5" />
						<span>{actionLabel} and Unlock</span>
					</button>
				{:else}
					<button
						type="button"
						class="inline-flex h-8 items-center justify-center border border-primary-600 bg-primary-500 px-2.5 text-[11px] font-semibold leading-none cursor-pointer hover:bg-primary-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
										style:color="var(--color-primary-foreground)"
						disabled={submitting}
						onclick={onConfirm}
					>
						{actionLabel}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</ModalShell>
