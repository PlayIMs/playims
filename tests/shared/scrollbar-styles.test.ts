/*
Brief description:
This file verifies the compiled global scrollbar styles.

Deeper explanation:
Tailwind and the scrollbar plugin share utility names. Native scrollbar properties
can override custom WebKit rendering after a dependency update, even when CSS builds
successfully. These checks compile the real stylesheet with the installed compiler.

Summary of tests:
1. It verifies that Chromium retains custom rendering despite native utilities.
2. It verifies that square thumbs and hidden arrow buttons survive compilation.
*/

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let css: string;

beforeAll(async () => {
	// resolve the compiler used by vite so upgrades exercise the actual dependency chain.
	const require = createRequire(import.meta.url);
	const viteRequire = createRequire(require.resolve('@tailwindcss/vite'));
	const { compile } = viteRequire('@tailwindcss/node');
	const compiler = await compile(await readFile(resolve('src/app.css'), 'utf8'), {
		base: resolve('src'),
		onDependency: () => {}
	});
	css = compiler.build(['scrollbar-thin', 'scrollbar-thumb-primary-700']);
});

describe('compiled scrollbar styles', () => {
	it('protects custom rendering from native scrollbar utilities', () => {
		expect(css).toMatch(/@supports selector\(::-webkit-scrollbar\)/);
		expect(css).toMatch(/scrollbar-color:\s*auto\s*!important/);
		expect(css).toMatch(/scrollbar-width:\s*auto\s*!important/);
		// custom rendering still needs the plugin's thumb colors and size rules.
		expect(css).toContain('var(--scrollbar-thumb)');
		expect(css).toContain('::-webkit-scrollbar');
	});

	it('keeps square scrollbar parts and hides native arrow buttons', () => {
		expect(css).toMatch(/::-webkit-scrollbar-corner\s*\{\s*border-radius:\s*0/);
		expect(css).toMatch(/::-webkit-scrollbar-button\s*\{\s*display:\s*none/);
	});
});
