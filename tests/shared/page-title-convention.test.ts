/*
Brief description:
This file verifies that route components do not define raw document title tags directly.

Deeper explanation:
The app now uses the shared PageTitle component so every page follows the same `PlayIMs - Page Title - Org Name`
format. This test acts as a guardrail for future work by scanning route components and failing if a new
handwritten `<title>` tag appears, which would bypass the shared naming convention.

Summary of tests:
1. It verifies that Svelte route files do not contain direct `<title>` tags.
*/

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routesDirectory = join(process.cwd(), 'src', 'routes');

const collectSvelteRouteFiles = (directory: string): string[] => {
	// this keeps the rule scoped to route components, where page titles are expected to be declared.
	const entries = readdirSync(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectSvelteRouteFiles(fullPath));
			continue;
		}

		if (entry.isFile() && fullPath.endsWith('.svelte')) {
			files.push(fullPath);
		}
	}

	return files;
};

describe('page title convention', () => {
	it('prevents direct title tags in route components so PageTitle stays the single source of truth', () => {
		// reading from disk here is intentional because this is a repository policy check, not a runtime test.
		const routeFiles = collectSvelteRouteFiles(routesDirectory).filter((filePath) =>
			statSync(filePath).isFile()
		);
		const filesWithDirectTitles = routeFiles.filter((filePath) =>
			readFileSync(filePath, 'utf8').includes('<title>')
		);

		expect(filesWithDirectTitles).toEqual([]);
	});
});
