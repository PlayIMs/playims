<script lang="ts">
	import { entryHint } from './date-time-entry.js';
	let { value, kind }: { value: string; kind: 'date' | 'time' } = $props();
</script>

<span class="input-entry-hint" aria-hidden="true"
	><span class="invisible">{value}</span><span>{entryHint(value, kind)}</span></span
>
