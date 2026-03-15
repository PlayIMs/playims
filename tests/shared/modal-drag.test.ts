/*
Brief description:
This file verifies the shared modal drag clamping helper used by draggable wizard panels.

Deeper explanation:
Wizard dialogs can be dragged around the viewport, but they must still respect protected screen
areas such as page padding and the installed PWA title-bar region. These tests lock the clamp math
to a predictable contract so shared wizard behavior does not let panels slide underneath the PWA
chrome while still preserving the normal viewport bounds.

Summary of tests:
1. It keeps the panel below a reserved top title-bar clearance area.
2. It still clamps horizontal and bottom movement to the regular viewport bounds.
*/

import { describe, expect, it } from 'vitest';
import { clampModalTranslate } from '../../src/lib/components/modals/modal-drag';

describe('modal drag clamp helper', () => {
	it('keeps draggable modals below the reserved pwa title-bar clearance', () => {
		// this protects installed-pwa wizard drags from disappearing under the top app chrome.
		expect(
			clampModalTranslate({
				nextX: 0,
				nextY: -120,
				currentX: 0,
				currentY: 0,
				panelRect: {
					left: 120,
					right: 520,
					top: 100,
					bottom: 420
				},
				boundsRect: {
					left: 0,
					right: 800,
					top: 0,
					bottom: 600
				},
				insets: {
					top: 16,
					right: 16,
					bottom: 16,
					left: 16
				},
				topClearance: 44
			})
		).toEqual({
			x: 0,
			y: -40
		});
	});

	it('still clamps modal movement to the regular viewport edges', () => {
		// this proves the new top clearance does not break the existing boundary rules elsewhere.
		expect(
			clampModalTranslate({
				nextX: 300,
				nextY: 260,
				currentX: 0,
				currentY: 0,
				panelRect: {
					left: 80,
					right: 480,
					top: 120,
					bottom: 440
				},
				boundsRect: {
					left: 0,
					right: 800,
					top: 0,
					bottom: 600
				},
				insets: {
					top: 16,
					right: 16,
					bottom: 16,
					left: 16
				},
				topClearance: 0
			})
		).toEqual({
			x: 300,
			y: 144
		});
	});
});
