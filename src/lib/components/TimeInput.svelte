<script lang="ts">
	import { untrack } from 'svelte';
	import FieldError from './FieldError.svelte';
	import InputEntryHint from './InputEntryHint.svelte';
	import {
		displayTime,
		formatTimeEntry,
		maskedCaret,
		parseTimeEntry,
		completeTimeEntry,
		guardEntryKey,
		isTimeEntryAllowed,
		timeSelectionRange,
		timeSegmentEdit
	} from './date-time-entry.js';
	interface Props {
		id: string;
		value: string;
		defaultTime?: string;
		label: string;
		error?: string;
	}
	let { id, value = $bindable(''), defaultTime = '00:00', label, error }: Props = $props();
	let draft = $state(untrack(() => displayTime(value || defaultTime)));
	let invalid = $state(false);
	let editing = $state(false);
	const visibleError = $derived(!editing && (invalid ? 'Enter a valid time.' : error));
	let ownValue: string | undefined;
	function selectSegment(input: HTMLInputElement, caret = input.selectionStart ?? 0) {
		const range = timeSelectionRange(input.value, caret);
		if (range) input.setSelectionRange(range.start, range.end);
	}
	function handleKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (/^[\dap]$/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
			const next = timeSegmentEdit(
				draft,
				input.selectionStart ?? 0,
				input.selectionEnd ?? 0,
				event.key
			);
			event.preventDefault();
			if (next) {
				draft = next.value;
				invalid = false;
				ownValue = parseTimeEntry(draft) ?? draft;
				value = ownValue;
				input.value = draft;
				input.setSelectionRange(next.start, next.end);
			}
			return;
		}
		if (
			(event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey
		) {
			const range = timeSelectionRange(
				input.value,
				input.selectionStart ?? 0,
				event.key === 'ArrowLeft' ? -1 : 1
			);
			if (range) {
				event.preventDefault();
				input.setSelectionRange(range.start, range.end);
			}
			return;
		}
		guardEntryKey(event, 'time');
	}
	$effect(() => {
		const external = value;
		if (external === ownValue) return;
		draft = displayTime(external || defaultTime);
		invalid = false;
	});
	function edit(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const raw = input.value;
		if (!isTimeEntryAllowed(raw)) {
			input.value = draft;
			return;
		}
		const formatted = formatTimeEntry(raw);
		const caret = maskedCaret(raw, input.selectionStart ?? raw.length, formatted);
		draft = formatted;
		invalid = false;
		ownValue = parseTimeEntry(formatted) ?? formatted;
		value = ownValue;
		if (raw !== formatted) {
			input.value = formatted;
			input.setSelectionRange(caret, caret);
		}
	}
	function finish() {
		editing = false;
		const parsed = completeTimeEntry(draft, defaultTime);
		invalid = !parsed;
		if (parsed) {
			ownValue = parsed;
			value = parsed;
			draft = displayTime(parsed);
		}
	}
</script>

<div class="modal-field">
	<label for={id} class="mb-1 block text-sm font-sans text-neutral-950">At</label>
	<div class="input-entry-shell">
		<input
			{id}
			type="text"
			aria-placeholder="HH:MM AM"
			class="input-secondary py-2 text-sm"
			aria-label={`${label} time`}
			aria-invalid={visibleError ? 'true' : undefined}
			aria-describedby={visibleError ? `${id}-invalid` : undefined}
			autocomplete="off"
			value={draft}
			oninput={edit}
			onfocus={(event) => {
				editing = true;
				const input = event.currentTarget;
				queueMicrotask(() => {
					if (document.activeElement === input) selectSegment(input, 0);
				});
			}}
			onmouseup={(event) => {
				const input = event.currentTarget;
				queueMicrotask(() => {
					if (document.activeElement === input) selectSegment(input);
				});
			}}
			onkeydown={handleKeydown}
			onblur={finish}
		/>
		<InputEntryHint value={draft} kind="time" />
	</div>
	<FieldError id={`${id}-invalid`} message={visibleError || undefined} />
</div>
