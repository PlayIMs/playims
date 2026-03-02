<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from '$lib/toasts';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let password = $state('');
	let confirmPassword = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let submitting = $state(false);
	let error = $state('');
	let lastErrorToast = $state('');

	$effect(() => {
		firstName = data.invite?.firstName ?? '';
		lastName = data.invite?.lastName ?? '';
		error = data.error ?? '';
	});

	async function acceptInvite(): Promise<void> {
		submitting = true;
		error = '';
		try {
			const response = await fetch('/api/member-invites/accept', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					password,
					confirmPassword,
					firstName: firstName || null,
					lastName: lastName || null
				})
			});
			const payload = (await response.json()) as { success: boolean; error?: string };
			if (!response.ok || !payload.success) {
				error = payload.error ?? 'Unable to accept invite.';
				return;
			}
			await goto('/dashboard');
		} catch {
			error = 'Unable to accept invite.';
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		const message = error.trim();
		if (!message) {
			lastErrorToast = '';
			return;
		}

		if (message === lastErrorToast) {
			return;
		}

		lastErrorToast = message;
		toast.error(message, {
			id: 'accept-member-invite-error',
			title: 'Accept member invite'
		});
	});
</script>

<svelte:head>
	<title>Accept Member Invite - PlayIMs</title>
</svelte:head>

<div class="min-h-screen bg-neutral p-4 lg:p-8">
		<div class="mx-auto max-w-3xl space-y-4 border-4 border-secondary bg-neutral-400 p-4 lg:p-6">
			<h1 class="text-3xl font-bold font-serif text-neutral-950">Accept Member Invite</h1>

			{#if data.invite}
			<div class="grid gap-3 lg:grid-cols-2">
				<div class="border-2 border-secondary-300 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Organization</p>
					<p class="mt-1 text-base font-semibold text-neutral-950">{data.invite.clientName}</p>
				</div>
				<div class="border-2 border-secondary-300 bg-white p-3">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Role</p>
					<p class="mt-1 text-base capitalize text-neutral-950">{data.invite.role}</p>
				</div>
				<div class="border-2 border-secondary-300 bg-white p-3 lg:col-span-2">
					<p class="text-[11px] font-bold uppercase tracking-wide text-neutral-950">Email</p>
					<p class="mt-1 text-base text-neutral-950">{data.invite.email}</p>
				</div>
			</div>

			<form
				class="space-y-4"
				onsubmit={(event) => {
					event.preventDefault();
					void acceptInvite();
				}}
			>
				<div class="grid gap-4 lg:grid-cols-2">
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="invite-first-name">First Name</label>
						<input id="invite-first-name" class="input-secondary" type="text" bind:value={firstName} />
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="invite-last-name">Last Name</label>
						<input id="invite-last-name" class="input-secondary" type="text" bind:value={lastName} />
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="invite-password">Password</label>
						<input id="invite-password" class="input-secondary" type="password" bind:value={password} />
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-semibold text-neutral-950" for="invite-confirm-password">Confirm Password</label>
						<input id="invite-confirm-password" class="input-secondary" type="password" bind:value={confirmPassword} />
					</div>
				</div>
				<button type="submit" class="button-secondary cursor-pointer" disabled={submitting}>
					{submitting ? 'Finishing Setup...' : 'Accept Invite'}
				</button>
			</form>
		{/if}
	</div>
</div>
