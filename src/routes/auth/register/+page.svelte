<script lang="ts">
	import IconEye from '@tabler/icons-svelte/icons/eye';
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';

	let { data, form } = $props<{
		data: {
			next: string;
		};
		form?: {
			error?: string;
			next?: string;
			email?: string;
			firstName?: string;
			lastName?: string;
		};
	}>();

	let showPassword = $state(false);
	let showInviteKey = $state(false);
	let nextValue = $state('');
	let firstNameValue = $state('');
	let lastNameValue = $state('');
	let emailValue = $state('');

	$effect(() => {
		nextValue = form?.next ?? data.next;
		firstNameValue = form?.firstName ?? '';
		lastNameValue = form?.lastName ?? '';
		emailValue = form?.email ?? '';
	});
</script>

<svelte:head>
	<title>Register | PlayIMs</title>
</svelte:head>

<div class="min-h-screen bg-secondary-500 flex items-center justify-center px-4 py-10">
	<div class="w-full max-w-md bg-white border border-neutral-200 p-6">
		<h1 class="text-2xl font-bold text-primary-950 mb-2">Create account</h1>
		<p class="text-sm text-secondary-900 mb-6">
			Registration currently requires an invite key from a PlayIMs administrator.
		</p>

		{#if form?.error}
			<p class="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 p-2">{form.error}</p>
		{/if}

		<form method="POST" class="space-y-4">
			<!-- Preserve safe post-register destination from server-side validation. -->
			<input type="hidden" name="next" value={nextValue} />

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<label class="block">
					<span class="block text-sm font-medium text-secondary-900 mb-1">First name</span>
					<input
						class="input-secondary w-full"
						type="text"
						name="firstName"
						bind:value={firstNameValue}
					/>
				</label>

				<label class="block">
					<span class="block text-sm font-medium text-secondary-900 mb-1">Last name</span>
					<input
						class="input-secondary w-full"
						type="text"
						name="lastName"
						bind:value={lastNameValue}
					/>
				</label>
			</div>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Email</span>
				<input
					class="input-secondary w-full"
					type="email"
					name="email"
					bind:value={emailValue}
					required
				/>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Password</span>
				<div class="relative">
					<input
						class="input-secondary w-full pr-10"
						type={showPassword ? 'text' : 'password'}
						name="password"
						required
					/>
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-700 hover:text-secondary-900 cursor-pointer"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						tabindex="-1"
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}
							<IconEye class="w-5 h-5" />
						{:else}
							<IconEyeOff class="w-5 h-5" />
						{/if}
					</button>
				</div>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Confirm password</span>
				<div class="relative">
					<input
						class="input-secondary w-full pr-10"
						type={showPassword ? 'text' : 'password'}
						name="confirmPassword"
						required
					/>
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-700 hover:text-secondary-900 cursor-pointer"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						tabindex="-1"
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}
							<IconEye class="w-5 h-5" />
						{:else}
							<IconEyeOff class="w-5 h-5" />
						{/if}
					</button>
				</div>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Invite key</span>
				<div class="relative">
					<input
						class="input-secondary w-full pr-10"
						type={showInviteKey ? 'text' : 'password'}
						name="inviteKey"
						required
					/>
					<button
						type="button"
						class="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-700 hover:text-secondary-900 cursor-pointer"
						aria-label={showInviteKey ? 'Hide invite key' : 'Show invite key'}
						tabindex="-1"
						onclick={() => (showInviteKey = !showInviteKey)}
					>
						{#if showInviteKey}
							<IconEye class="w-5 h-5" />
						{:else}
							<IconEyeOff class="w-5 h-5" />
						{/if}
					</button>
				</div>
			</label>

			<button class="button-secondary w-full" type="submit">Create account</button>
		</form>

		<p class="mt-4 text-sm text-secondary-900">
			Already registered?
			<a class="text-primary-700 hover:underline" href="/auth/login">Sign in</a>
		</p>
	</div>
</div>
