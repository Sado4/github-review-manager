import { describe, expect, it, vi } from "vitest";

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
	},
	commands: {
		registerCommand: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn(),
		onDidChangeConfiguration: vi.fn(),
	},
	ExtensionContext: vi.fn(),
}));

describe("Extension Test Suite", () => {
	it("should run basic array operations", () => {
		expect([1, 2, 3].indexOf(5)).toBe(-1);
		expect([1, 2, 3].indexOf(0)).toBe(-1);
	});

	it("should have access to mocked vscode API", async () => {
		const vscode = await import("vscode");
		expect(vscode.window.showInformationMessage).toBeDefined();
		expect(vscode.commands.registerCommand).toBeDefined();
	});
});
