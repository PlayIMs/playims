<script lang="ts">
	import { IconEye, IconEyeOff, IconKey, IconLock } from '@tabler/icons-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

	let { data, form } = $props<{
		data: {
			next: string;
			email: string;
		};
		form?: {
			error?: string;
			next?: string;
		};
	}>();

	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);
	let newPassword = $state('');
	let confirmPassword = $state('');
	let nextValue = $state('');

	$effect(() => {
		nextValue = form?.next ?? data.next;
	});
</script>

<PageTitle pageTitle="Set Password" />

<svelte:head>
	<meta
		name="description"
		content="Finish your first-time PlayIMs sign-in by creating a permanent password."
	/>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="app-page-screen bg-secondary-500 flex items-center justify-center px-4 py-8">
	<div class="w-full max-w-lg border border-neutral-200 bg-white p-6 shadow-sm">
		<div class="space-y-3 border-b border-neutral-200 pb-5">
			<div class="flex items-center gap-3">
				<div
					class="bg-primary text-white border-2 border-primary-700 flex h-11 w-11 items-center justify-center"
					aria-hidden="true"
				>
					<IconKey class="h-5 w-5" />
				</div>
				<div>
					<h1 class="text-2xl font-bold text-primary-950">Create your new password</h1>
					<p class="text-sm text-secondary-900">
						Use a password only you know so we can finish activating this account.
					</p>
				</div>
			</div>

			<div class="border border-secondary-300 bg-secondary-100 px-3 py-2 text-sm text-secondary-950">
				<p class="font-semibold">First-time setup required</p>
				<p>
					You signed in with a temporary password for <strong>{data.email || 'your account'}</strong>.
					Create a new password to continue into PlayIMs.
				</p>
			</div>
		</div>

		<form method="POST" action="?/setPassword" class="mt-5 space-y-4">
			<input type="hidden" name="next" value={nextValue} />

			<label class="block">
				<span class="mb-1 block text-sm font-medium text-secondary-900">New password</span>
				<div class="relative">
					<input
						class="input-secondary w-full pr-10"
						type={showNewPassword ? 'text' : 'password'}
						name="newPassword"
						autocomplete="new-password"
						bind:value={newPassword}
						required
					/>
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-secondary-700 hover:text-secondary-900"
						aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
						tabindex="-1"
						onclick={() => (showNewPassword = !showNewPassword)}
					>
						{#if showNewPassword}
							<IconEye class="h-5 w-5" />
						{:else}
							<IconEyeOff class="h-5 w-5" />
						{/if}
					</button>
				</div>
			</label>

			<label class="block">
				<span class="mb-1 block text-sm font-medium text-secondary-900">Confirm password</span>
				<div class="relative">
					<input
						class="input-secondary w-full pr-10"
						type={showConfirmPassword ? 'text' : 'password'}
						name="confirmPassword"
						autocomplete="new-password"
						bind:value={confirmPassword}
						required
					/>
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-secondary-700 hover:text-secondary-900"
						aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
						tabindex="-1"
						onclick={() => (showConfirmPassword = !showConfirmPassword)}
					>
						{#if showConfirmPassword}
							<IconEye class="h-5 w-5" />
						{:else}
							<IconEyeOff class="h-5 w-5" />
						{/if}
					</button>
				</div>
			</label>

			<div class="rounded-sm border border-neutral-200 bg-neutral px-3 py-2 text-xs text-neutral-950">
				<div class="flex items-start gap-2">
					<IconLock class="mt-0.5 h-4 w-4 shrink-0" />
					<p>
						Choose at least 8 characters. After you save it, we will continue into the app and sign
						out any other active sessions for safety.
					</p>
				</div>
			</div>

			{#if form?.error}
				<p class="border border-primary-300 bg-primary-100 px-3 py-2 text-sm text-primary-950">
					{form.error}
				</p>
			{/if}

			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<button
					class="button-secondary w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
					type="submit"
					disabled={newPassword.length < 8 || confirmPassword.length < 8}
				>
					Continue to PlayIMs
				</button>
			</div>
		</form>

		<form method="POST" action="?/signOut" class="mt-3">
			<button type="submit" class="button-secondary-outlined w-full cursor-pointer sm:w-auto">
				Sign out instead
			</button>
		</form>
	</div>
</div>
