// Simple test script to verify D1 REST API connection
// Run with: node test-db.js

import { config } from 'dotenv';
config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
	console.error('Missing required environment variables. Please check your .env file.');
	console.error('Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN');
	process.exit(1);
}

async function testD1Connection() {
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}`;

	try {
		console.log('Testing D1 REST API connection...');
		console.log('Account ID:', CLOUDFLARE_ACCOUNT_ID);
		console.log('Database ID:', CLOUDFLARE_DATABASE_ID);

		const response = await fetch(`${baseUrl}/query`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				sql: 'SELECT name FROM sqlite_master WHERE type="table";'
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const result = await response.json();

		if (result.success) {
			console.log('✅ Connection successful!');
			console.log(
				'Tables found:',
				result.result[0].results.map((row) => row.name)
			);

			// Test clients table
			const clientsResponse = await fetch(`${baseUrl}/query`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sql: 'SELECT COUNT(*) as count FROM clients;'
				})
			});

			if (clientsResponse.ok) {
				const clientsResult = await clientsResponse.json();
				if (clientsResult.success) {
					console.log('Clients count:', clientsResult.result[0].results[0].count);
				}
			}

			// Test users table
			const usersResponse = await fetch(`${baseUrl}/query`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sql: 'SELECT COUNT(*) as count FROM users;'
				})
			});

			if (usersResponse.ok) {
				const usersResult = await usersResponse.json();
				if (usersResult.success) {
					console.log('Users count:', usersResult.result[0].results[0].count);
				}
			}
		} else {
			console.error('❌ D1 API Error:', result.errors);
		}
	} catch (error) {
		console.error('❌ Connection failed:', error.message);
	}
}

testD1Connection();
