<script lang="ts">
	import type { Snippet } from 'svelte';
	import { IconX } from '@tabler/icons-svelte';

	interface Props {
		title: string;
		closeAriaLabel?: string;
		showCloseButton?: boolean;
		draggable?: boolean;
		onClose: () => void;
		children?: Snippet;
	}

	let {
		title,
		closeAriaLabel = 'Close modal',
		showCloseButton = true,
		draggable = false,
		onClose,
		children
	}: Props = $props();
</script>

<header
	class="modal-header"
	class:cursor-move={draggable}
	data-wizard-modal-drag-handle={draggable || undefined}
>
	<div class="modal-title-row">
		<h2 class="modal-title">{title}</h2>
		{#if showCloseButton}
			<button
				type="button"
				class="modal-close-button shrink-0"
				aria-label={closeAriaLabel}
				data-modal-drag-ignore
				onclick={onClose}
			>
				<IconX class="h-6 w-6" />
			</button>
		{/if}
	</div>
	{@render children?.()}
</header>
