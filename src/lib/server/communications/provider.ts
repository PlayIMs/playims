export interface SendEmailMessageInput {
	to: string[];
	subject: string;
	html: string;
	text: string;
	replyTo?: string | null;
}

export interface SendEmailMessageResult {
	providerMessageId: string | null;
}

export interface CommunicationEmailProvider {
	sendMessage(input: SendEmailMessageInput): Promise<SendEmailMessageResult>;
}
