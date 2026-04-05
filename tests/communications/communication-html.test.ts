/*
Brief description:
This file verifies communications HTML sanitization and plain-text extraction for rich editor content.

Deeper explanation:
Communication drafts store both TipTap JSON and sanitized HTML. The HTML copy still matters for future
delivery, exports, and compatibility rendering, so these tests protect two goals at once: preserve the
rich editor formatting the app intentionally supports, and strip dangerous markup or URLs that could
turn stored message content into an injection vector later.

Summary of tests:
1. It verifies that supported rich editor tags and safe style attributes are preserved.
2. It verifies that dangerous tags and javascript URLs are stripped from stored HTML.
*/

import { describe, expect, it } from 'vitest';

import {
	communicationHtmlToPlainText,
	sanitizeCommunicationHtml
} from '../../src/lib/server/communications/html.js';

describe('communication html sanitization', () => {
	it('preserves supported rich editor formatting', () => {
		// this locks the html features the communications editor currently exposes in the toolbar.
		const sanitized = sanitizeCommunicationHtml(
			[
				'<h1>Heading</h1>',
				'<p><span style="font-family:Bitter, serif;font-size:22px;color:#2563eb;background-color:#eedbce">Styled</span></p>',
				'<ul style="list-style-type:square"><li>Bullet</li></ul>',
				'<ol style="list-style-type:lower-alpha"><li>Numbered</li></ol>',
				'<p><mark>Highlight</mark> <s>Strike</s> <u>Underline</u></p>',
				'<img src="data:image/png;base64,abc123" alt="Poster" title="Poster" />',
				'<table><tbody><tr><th colspan="2">Head</th></tr><tr><td>One</td><td>Two</td></tr></tbody></table>'
			].join('')
		);

		expect(sanitized).toContain('<h1>Heading</h1>');
		expect(sanitized).toContain('font-family:Bitter, serif');
		expect(sanitized).toContain('font-size:22px');
		expect(sanitized).toContain('color:#2563eb');
		expect(sanitized).toContain('background-color:#eedbce');
		expect(sanitized).toContain('<ul style="list-style-type:square">');
		expect(sanitized).toContain('<ol style="list-style-type:lower-alpha">');
		expect(sanitized).toContain('<mark>Highlight</mark>');
		expect(sanitized).toContain('<s>Strike</s>');
		expect(sanitized).toContain('<u>Underline</u>');
		expect(sanitized).toContain('<img src="data:image/png;base64,abc123" alt="Poster" title="Poster" />');
		expect(sanitized).toContain('<table>');
		expect(sanitized).toContain('<th colspan="2">Head</th>');
		expect(communicationHtmlToPlainText(sanitized)).toContain('Heading');
	});

	it('removes dangerous markup and URLs', () => {
		// stored html should never keep executable script or javascript url payloads.
		const sanitized = sanitizeCommunicationHtml(
			'<p>Hello</p><script>alert(1)</script><a href="javascript:alert(2)">Bad link</a><img src="javascript:alert(3)" alt="Bad" />'
		);

		expect(sanitized).toContain('<p>Hello</p>');
		expect(sanitized).not.toContain('<script');
		expect(sanitized).not.toContain('javascript:alert');
		expect(sanitized).toContain('<a');
		expect(sanitized).not.toContain('<img');
	});
});
