import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock vscode module before importing ConfigService
vi.mock("vscode", () => {
	const mockWorkspaceConfiguration = {
		get: vi.fn(),
	};

	const mockWorkspace = {
		getConfiguration: vi.fn().mockReturnValue(mockWorkspaceConfiguration),
		onDidChangeConfiguration: vi.fn(),
	};

	return {
		workspace: mockWorkspace,
	};
});

import { getConfig, onConfigChange } from "./configService";

// Get references to the mocked functions
const vscode = await import("vscode");
const mockWorkspace = vscode.workspace as unknown as {
	getConfiguration: () => { get: ReturnType<typeof vi.fn> };
	onDidChangeConfiguration: ReturnType<typeof vi.fn>;
};
const mockWorkspaceConfiguration = mockWorkspace.getConfiguration();

describe("ConfigService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getConfig", () => {
		it("should return default configuration when no values are set", () => {
			mockWorkspaceConfiguration.get.mockImplementation(
				(_key: string, defaultValue: unknown) => defaultValue,
			);

			const config = getConfig();

			expect(config).toEqual({
				token: "",
				refreshInterval: 300,
				showNotifications: true,
				playSound: true,
			});
		});

		it("should return configuration values from workspace", () => {
			mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
				switch (key) {
					case "token":
						return "test-token";
					case "refreshInterval":
						return 600;
					case "showNotifications":
						return false;
					case "playSound":
						return false;
					default:
						return undefined;
				}
			});

			const config = getConfig();

			expect(config).toEqual({
				token: "test-token",
				refreshInterval: 600,
				showNotifications: false,
				playSound: false,
			});
		});

		it("should enforce minimum refresh interval", () => {
			mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: unknown) => {
				if (key === "refreshInterval") {
					return 30; // Below minimum
				}
				return defaultValue;
			});

			const config = getConfig();

			expect(config.refreshInterval).toBe(60); // Should be enforced to minimum
		});
	});

	describe("onConfigChange", () => {
		it("should register configuration change listener", () => {
			const callback = vi.fn();
			const mockDisposable = { dispose: vi.fn() };
			mockWorkspace.onDidChangeConfiguration.mockReturnValue(mockDisposable);

			const disposable = onConfigChange(callback);

			expect(mockWorkspace.onDidChangeConfiguration).toHaveBeenCalledWith(expect.any(Function));
			expect(disposable).toBe(mockDisposable);
		});

		it("should call callback when configuration changes", () => {
			const callback = vi.fn();
			let changeHandler: (e: { affectsConfiguration: (key: string) => boolean }) => void;

			mockWorkspace.onDidChangeConfiguration.mockImplementation((handler) => {
				changeHandler = handler;
				return { dispose: vi.fn() };
			});

			onConfigChange(callback);

			// Simulate configuration change
			const mockEvent = {
				affectsConfiguration: vi.fn().mockReturnValue(true),
			};
			changeHandler!(mockEvent);

			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("githubReviewManager");
			expect(callback).toHaveBeenCalled();
		});

		it("should not call callback when unrelated configuration changes", () => {
			const callback = vi.fn();
			let changeHandler: (e: { affectsConfiguration: (key: string) => boolean }) => void;

			mockWorkspace.onDidChangeConfiguration.mockImplementation((handler) => {
				changeHandler = handler;
				return { dispose: vi.fn() };
			});

			onConfigChange(callback);

			// Simulate unrelated configuration change
			const mockEvent = {
				affectsConfiguration: vi.fn().mockReturnValue(false),
			};
			changeHandler!(mockEvent);

			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("githubReviewManager");
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
