import type { CommunicationEmailProvider, SendEmailMessageResult } from './provider.js';

type ResendProviderOptions = {
	apiKey: string;
	fromEmail: string;
	replyTo?: string | null;
	fetchImpl?: typeof fetch;
};

export class ResendCommunicationProvider implements CommunicationEmailProvider {
	private apiKey: string;
	private fromEmail: string;
	private replyTo: string | null;
	private fetchImpl: typeof fetch;

	constructor(options: ResendProviderOptions) {
		this.apiKey = options.apiKey;
		this.fromEmail = options.fromEmail;
		this.replyTo = options.replyTo ?? null;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async sendMessage(input: {
		to: string[];
		subject: string;
		html: string;
		text: string;
		replyTo?: string | null;
	}): Promise<SendEmailMessageResult> {
		const response = await this.fetchImpl('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: this.fromEmail,
				to: input.to,
				subject: input.subject,
				html: input.html,
				text: input.text,
				...(input.replyTo ?? this.replyTo ? { reply_to: input.replyTo ?? this.replyTo } : {})
			})
		});

		const payload = (await response.json().catch(() => null)) as
			| { id?: string; message?: string; error?: { message?: string } }
			| null;
		if (!response.ok) {
			const message =
				payload?.message ?? payload?.error?.message ?? 'Unable to send the communication email.';
			throw new Error(message);
		}

		return {
			providerMessageId: payload?.id?.trim() || null
		};
	}
}
