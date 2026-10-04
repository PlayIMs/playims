<script lang="ts">
	interface Props {
		message?: string;
		id?: string;
	}
	let { message, id }: Props = $props();
</script>

{#if message}
	<p
		{id}
		class="modal-field-error mt-0.5 text-xs text-error-700"
		title={message}
		aria-live="polite"
	>
		{message}
	</p>
{/if}
