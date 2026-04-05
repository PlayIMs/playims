/*
Brief description:
This file verifies how the communication service chooses between local history-only sending and live email delivery.

Deeper explanation:
The communications page needs a safe default while email delivery is not enabled. These tests protect the service
factory so "Send Now" can move a draft into sent history without actually contacting an email provider unless the
project explicitly opts into live delivery.

Summary of tests:
1. It verifies that the default provider records a sent message locally without an external provider id.
2. It verifies that explicit resend delivery mode selects the Resend provider when credentials exist.
*/

import { describe, expect, it, vi } from 'vitest';

const resendInstances: Array<{ options: Record<string, unknown> }> = [];

vi.mock('../../src/lib/server/communications/resend.js', () => ({
	ResendCommunicationProvider: class MockResendCommunicationProvider {
		options: Record<string, unknown>;

		constructor(options: Record<string, unknown>) {
			this.options = options;
			resendInstances.push({ options });
		}

		async sendMessage() {
			return { providerMessageId: 'resend-test-id' };
		}
	}
}));

import { createCommunicationEmailProvider } from '../../src/lib/server/communications/index.js';

describe('communication service factory', () => {
	it('defaults to local history-only sending when live delivery is not enabled', async () => {
		// the current product requirement is "record as sent" without emailing anyone yet.
		const provider = createCommunicationEmailProvider({
			platform: {
				env: {}
			}
		} as any);

		await expect(
			provider.sendMessage({
				to: ['alex@playims.test'],
				subject: 'League update',
				html: '<p>Hello</p>',
				text: 'Hello'
			})
		).resolves.toEqual({ providerMessageId: null });
		expect(resendInstances).toHaveLength(0);
	});

	it('uses the resend provider only when delivery mode explicitly enables it', async () => {
		// this keeps future live delivery opt-in instead of accidentally turning on when env vars exist.
		const provider = createCommunicationEmailProvider({
			platform: {
				env: {
					COMMUNICATION_DELIVERY_MODE: 'resend',
					RESEND_API_KEY: 'resend-api-key',
					COMMUNICATION_FROM_EMAIL: 'hello@playims.test',
					COMMUNICATION_REPLY_TO_EMAIL: 'support@playims.test'
				}
			}
		} as any);

		await expect(
			provider.sendMessage({
				to: ['alex@playims.test'],
				subject: 'League update',
				html: '<p>Hello</p>',
				text: 'Hello'
			})
		).resolves.toEqual({ providerMessageId: 'resend-test-id' });
		expect(resendInstances).toHaveLength(1);
		expect(resendInstances[0]?.options).toMatchObject({
			apiKey: 'resend-api-key',
			fromEmail: 'hello@playims.test',
			replyTo: 'support@playims.test'
		});
	});
});
