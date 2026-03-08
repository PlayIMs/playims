<script lang="ts">
	import DateHoverText from '$lib/components/DateHoverText.svelte';
	import ModalShell from '$lib/components/modals/ModalShell.svelte';
	import type { MemberDetail } from '$lib/members/types.js';
	import { toast } from '$lib/toasts';

	interface Props {
		open: boolean;
		member: MemberDetail | null;
		loading?: boolean;
		error?: string;
		onClose: () => void;
	}

	let { open, member, loading = false, error = '', onClose }: Props = $props();
	let lastErrorToast = $state('');

	$effect(() => {
		const message = error.trim();
		if (!message) {
			lastErrorToast = '';
			return;
		}

		const signature = `${open ? 'open' : 'closed'}:${message}`;
		if (signature === lastErrorToast) {
			return;
		}

		lastErrorToast = signature;
		toast.error(message, {
			id: 'member-detail-error',
			title: 'Member details'
		});
	});

	function formatDisplayDateTime(value: string | null): string {
		if (!value) return '--';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '--';
		return parsed.toLocaleString();
	}
</script>

<ModalShell
	{open}
	panelClass="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden border-4 border-secondary bg-neutral-400 lg:max-h-[calc(100vh-3rem)]"
	on:requestClose={onClose}
>
	<div class="border-b border-secondary px-4 py-3">
		<h3 class="text-2xl font-bold font-serif text-neutral-950">Member Details</h3>
	</div>
	<div class="space-y-4 overflow-y-auto bg-neutral-400 p-4">
		{#if loading}
			<p class="text-sm text-neutral-950">Loading member details...</p>
		{:else if member}
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="border-2 border-neutral-950 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Name</p>
					<p class="mt-1 break-words text-base font-semibold text-neutral-950">{member.fullName}</p>
				</div>
				<div class="border-2 border-neutral-950 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Role</p>
					<p class="mt-1 text-base capitalize text-neutral-950">{member.role}</p>
				</div>
				<div class="border-2 border-neutral-950 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Email</p>
					<p class="mt-1 break-all text-base text-neutral-950">{member.email ?? '--'}</p>
				</div>
				<div class="border-2 border-neutral-950 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Student ID</p>
					<p class="mt-1 text-base text-neutral-950">{member.studentId ?? '--'}</p>
				</div>
				<div class="border-2 border-neutral-950 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Sex</p>
					<p class="mt-1 text-base text-neutral-950">{member.sex ?? '--'}</p>
				</div>
				<div class="border-2 border-neutral-950 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Last Active</p>
					<p class="mt-1 text-base text-neutral-950">
						<DateHoverText
							display={formatDisplayDateTime(member.lastActiveAt)}
							value={member.lastActiveAt}
							includeTime
						/>
					</p>
				</div>
			</div>
		{/if}
	</div>
</ModalShell>

