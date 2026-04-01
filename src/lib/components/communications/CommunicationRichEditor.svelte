<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
	import Color from '@tiptap/extension-color';
	import {
		IconArrowBackUp,
		IconArrowForwardUp,
		IconBlockquote,
		IconBold,
		IconClearFormatting,
		IconColorFilter,
		IconH1,
		IconItalic,
		IconLink,
		IconList,
		IconListNumbers,
		IconUnderline
	} from '@tabler/icons-svelte';

	interface EditorPayload {
		html: string;
		json: Record<string, unknown> | null;
		text: string;
	}

	interface Props {
		initialHtml?: string;
		initialJson?: Record<string, unknown> | null;
		editable?: boolean;
		onChange?: ((payload: EditorPayload) => void) | null;
	}

	let {
		initialHtml = '',
		initialJson = null,
		editable = true,
		onChange = null
	}: Props = $props();

	let editorHost = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let linkPanelOpen = $state(false);
	let linkValue = $state('');
	let textColor = $state('#14213d');
	let highlightColor = $state('#eedbce');
	let lastAppliedSignature = $state('');

	const buildSignature = (html: string, json: Record<string, unknown> | null): string =>
		JSON.stringify({ html, json });

	const emitChange = (): void => {
		if (!editor) {
			return;
		}
		onChange?.({
			html: editor.getHTML(),
			json: editor.getJSON() as Record<string, unknown>,
			text: editor.getText()
		});
	};

	const applyContentIfNeeded = (): void => {
		if (!editor) {
			return;
		}
		const nextSignature = buildSignature(initialHtml, initialJson);
		if (nextSignature === lastAppliedSignature) {
			return;
		}

		lastAppliedSignature = nextSignature;
		if (initialJson) {
			editor.commands.setContent(initialJson, { emitUpdate: false });
			return;
		}
		editor.commands.setContent(initialHtml || '<p></p>', { emitUpdate: false });
	};

	onMount(() => {
		if (!editorHost) {
			return;
		}

		editor = new Editor({
			element: editorHost,
			editable,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [2, 3]
					}
				}),
				Underline,
				TextStyle,
				Color,
				Highlight.configure({ multicolor: true }),
				Link.configure({
					openOnClick: false,
					autolink: true,
					defaultProtocol: 'https'
				})
			],
			content: initialJson ?? initialHtml ?? '<p></p>',
			onUpdate: () => {
				emitChange();
			}
		});
		lastAppliedSignature = buildSignature(initialHtml, initialJson);

		return () => {
			editor?.destroy();
			editor = null;
		};
	});

	onDestroy(() => {
		editor?.destroy();
		editor = null;
	});

	$effect(() => {
		if (!editor) {
			return;
		}
		editor.setEditable(editable);
	});

	$effect(() => {
		applyContentIfNeeded();
	});

	function runCommand(command: () => void): void {
		if (!editor || !editable) {
			return;
		}
		command();
	}

	function toggleHeading(): void {
		runCommand(() => {
			if (!editor) {
				return;
			}
			const chain = editor.chain().focus();
			if (editor.isActive('heading', { level: 2 })) {
				chain.setParagraph().run();
				return;
			}
			chain.toggleHeading({ level: 2 }).run();
		});
	}

	function toggleLinkPanel(): void {
		if (!editor || !editable) {
			return;
		}
		linkValue = editor.getAttributes('link').href ?? '';
		linkPanelOpen = !linkPanelOpen;
	}

	function applyLink(): void {
		runCommand(() => {
			if (!editor) {
				return;
			}
			const value = linkValue.trim();
			if (!value) {
				editor.chain().focus().unsetLink().run();
				linkPanelOpen = false;
				return;
			}
			editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
			linkPanelOpen = false;
		});
	}

	function applyTextColor(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		textColor = value;
		runCommand(() => {
			editor?.chain().focus().setColor(value).run();
		});
	}

	function applyHighlightColor(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		highlightColor = value;
		runCommand(() => {
			editor?.chain().focus().setHighlight({ color: value }).run();
		});
	}

	const toolbarButtonClass = (active = false): string =>
		[
			'button-neutral-outlined min-h-9 min-w-9 px-2 py-2 text-xs font-semibold cursor-pointer justify-center',
			active ? 'bg-secondary-100 border-secondary-700' : ''
		].join(' ');
</script>

<div class="section-card p-3 space-y-3 communication-rich-editor">
	{#if editable}
		<div class="flex flex-wrap gap-2 border border-neutral-950 bg-neutral-50 p-2">
			<button type="button" class={toolbarButtonClass(editor?.isActive('bold') ?? false)} aria-label="Bold" onclick={() => runCommand(() => editor?.chain().focus().toggleBold().run())}>
				<IconBold class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('italic') ?? false)} aria-label="Italic" onclick={() => runCommand(() => editor?.chain().focus().toggleItalic().run())}>
				<IconItalic class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('underline') ?? false)} aria-label="Underline" onclick={() => runCommand(() => editor?.chain().focus().toggleUnderline().run())}>
				<IconUnderline class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('bulletList') ?? false)} aria-label="Bulleted list" onclick={() => runCommand(() => editor?.chain().focus().toggleBulletList().run())}>
				<IconList class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('orderedList') ?? false)} aria-label="Numbered list" onclick={() => runCommand(() => editor?.chain().focus().toggleOrderedList().run())}>
				<IconListNumbers class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('blockquote') ?? false)} aria-label="Blockquote" onclick={() => runCommand(() => editor?.chain().focus().toggleBlockquote().run())}>
				<IconBlockquote class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('heading', { level: 2 }) ?? false)} aria-label="Heading" onclick={toggleHeading}>
				<IconH1 class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass(editor?.isActive('link') ?? false)} aria-label="Hyperlink" onclick={toggleLinkPanel}>
				<IconLink class="h-4 w-4" />
			</button>
			<label class="button-neutral-outlined min-h-9 px-2 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-2">
				<IconColorFilter class="h-4 w-4" />
				<span>Text</span>
				<input class="h-5 w-5 cursor-pointer" type="color" value={textColor} oninput={applyTextColor} />
			</label>
			<label class="button-neutral-outlined min-h-9 px-2 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-2">
				<span class="inline-flex h-4 w-4 border border-neutral-950 bg-warning-100"></span>
				<span>Highlight</span>
				<input class="h-5 w-5 cursor-pointer" type="color" value={highlightColor} oninput={applyHighlightColor} />
			</label>
			<button type="button" class={toolbarButtonClass()} aria-label="Clear formatting" onclick={() => runCommand(() => editor?.chain().focus().unsetAllMarks().clearNodes().run())}>
				<IconClearFormatting class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass()} aria-label="Undo" onclick={() => runCommand(() => editor?.chain().focus().undo().run())}>
				<IconArrowBackUp class="h-4 w-4" />
			</button>
			<button type="button" class={toolbarButtonClass()} aria-label="Redo" onclick={() => runCommand(() => editor?.chain().focus().redo().run())}>
				<IconArrowForwardUp class="h-4 w-4" />
			</button>
		</div>

		{#if linkPanelOpen}
			<div class="border border-neutral-950 bg-white p-3 space-y-2">
				<label class="block text-sm font-sans text-neutral-950" for="communication-link-url">Link URL</label>
				<div class="flex flex-col gap-2 md:flex-row">
					<input id="communication-link-url" class="input-secondary min-h-10" type="url" bind:value={linkValue} placeholder="https://example.com" />
					<div class="flex gap-2">
						<button type="button" class="button-secondary-outlined px-3 py-2 cursor-pointer" onclick={applyLink}>Apply Link</button>
						<button
							type="button"
							class="button-neutral-outlined px-3 py-2 cursor-pointer"
							onclick={() => {
								linkPanelOpen = false;
								linkValue = '';
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<div class="border border-neutral-950 bg-white">
		<div bind:this={editorHost} class="editor-host min-h-[18rem] px-4 py-3"></div>
	</div>
</div>

<style>
	.communication-rich-editor :global(.ProseMirror) {
		min-height: 18rem;
		outline: none;
		color: var(--color-neutral-950);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.communication-rich-editor :global(.ProseMirror p) {
		margin: 0 0 0.85rem;
	}

	.communication-rich-editor :global(.ProseMirror h2) {
		font-family: 'Bitter', serif;
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1.1;
		margin: 0 0 0.85rem;
	}

	.communication-rich-editor :global(.ProseMirror h3) {
		font-family: 'Bitter', serif;
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.15;
		margin: 0 0 0.75rem;
	}

	.communication-rich-editor :global(.ProseMirror ul),
	.communication-rich-editor :global(.ProseMirror ol) {
		margin: 0 0 0.85rem 1.25rem;
	}

	.communication-rich-editor :global(.ProseMirror blockquote) {
		border-left: 4px solid var(--color-secondary-500);
		margin: 0 0 0.85rem;
		padding-left: 0.9rem;
		color: var(--color-neutral-800);
	}

	.communication-rich-editor :global(.ProseMirror a) {
		color: var(--color-primary-700);
		text-decoration: underline;
	}
</style>
