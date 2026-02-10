<script lang="ts">
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
			<input type="hidden" name="next" value={form?.next ?? data.next} />

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<label class="block">
					<span class="block text-sm font-medium text-secondary-900 mb-1">First name</span>
					<input
						class="input-secondary w-full"
						type="text"
						name="firstName"
						value={form?.firstName ?? ''}
						autocomplete="given-name"
					/>
				</label>

				<label class="block">
					<span class="block text-sm font-medium text-secondary-900 mb-1">Last name</span>
					<input
						class="input-secondary w-full"
						type="text"
						name="lastName"
						value={form?.lastName ?? ''}
						autocomplete="family-name"
					/>
				</label>
			</div>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Email</span>
				<input
					class="input-secondary w-full"
					type="email"
					name="email"
					value={form?.email ?? ''}
					autocomplete="email"
					required
				/>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Password</span>
				<input
					class="input-secondary w-full"
					type="password"
					name="password"
					autocomplete="new-password"
					required
				/>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Confirm password</span>
				<input
					class="input-secondary w-full"
					type="password"
					name="confirmPassword"
					autocomplete="new-password"
					required
				/>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Invite key</span>
				<input class="input-secondary w-full" type="password" name="inviteKey" required />
			</label>

			<button class="button-secondary w-full" type="submit">Create account</button>
		</form>

		<p class="mt-4 text-sm text-secondary-900">
			Already registered?
			<a class="text-primary-700 hover:underline" href="/auth/login">Sign in</a>
		</p>
	</div>
</div>
