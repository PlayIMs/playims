<script lang="ts">
	import { IconCopy, IconKey } from '@tabler/icons-svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import { toast } from '$lib/toasts';

	interface Props {
		open: boolean;
		email: string;
		memberName: string;
		temporaryPassword: string;
		onClose: () => void;
	}

	let { open, email, memberName, temporaryPassword, onClose }: Props = $props();

	async function copyValue(value: string, label: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copied.`, {
				id: `member-credentials:${label}`
			});
		} catch {
			toast.error(`Unable to copy the ${label.toLowerCase()} right now.`, {
				id: `member-credentials:${label}:error`
			});
		}
	}
</script>

<ModalShell {open} closeAriaLabel="Close temporary credentials modal" on:requestClose={onClose}>
	<div class="border-b border-neutral-950 bg-neutral-600/66 px-4 py-3">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">Temporary Credentials</h3>
	</div>
	<div class="space-y-4 overflow-y-auto bg-neutral p-4">
		<div class="flex items-start gap-3 border-2 border-neutral-950 bg-white p-4">
			<IconKey class="mt-0.5 h-6 w-6 shrink-0 text-secondary-900" />
			<div class="space-y-2 text-sm text-neutral-950">
				<p class="font-semibold">{memberName} now has an active PlayIMs account.</p>
				<p>
					This temporary password is shown only now. Share it securely with the member and remind
					them they must change it the first time they sign in.
				</p>
			</div>
		</div>

		<div class="grid gap-4 lg:grid-cols-2">
			<div class="space-y-2 border-2 border-neutral-950 bg-white p-4">
				<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Email</p>
				<p class="break-all text-sm text-neutral-950">{email}</p>
				<button
					type="button"
					class="button-secondary-outlined inline-flex cursor-pointer items-center gap-2"
					onclick={() => void copyValue(email, 'Email')}
				>
					<IconCopy class="h-4 w-4" />
					Copy Email
				</button>
			</div>
			<div class="space-y-2 border-2 border-neutral-950 bg-white p-4">
				<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">
					Temporary Password
				</p>
				<p class="break-all font-mono text-sm text-neutral-950">{temporaryPassword}</p>
				<button
					type="button"
					class="button-primary inline-flex cursor-pointer items-center gap-2"
					onclick={() => void copyValue(temporaryPassword, 'Temporary password')}
				>
					<IconCopy class="h-4 w-4" />
					Copy Password
				</button>
			</div>
		</div>
	</div>
</ModalShell>
