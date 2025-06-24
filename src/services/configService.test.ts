import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	clearToken,
	getConfig,
	getToken,
	initializeSecretStorage,
	onConfigChange,
	setToken,
} from "./configService";

// Mock vscode module before importing ConfigService
vi.mock("vscode", () => {
	const mockWorkspaceConfiguration = {
		get: vi.fn(),
		update: vi.fn(),
	};

	const mockWorkspace = {
		getConfiguration: vi.fn().mockReturnValue(mockWorkspaceConfiguration),
		onDidChangeConfiguration: vi.fn(),
	};

	const mockWindow = {
		showWarningMessage: vi.fn(),
	};

	const mockCommands = {
		executeCommand: vi.fn(),
	};

	return {
		workspace: mockWorkspace,
		window: mockWindow,
		commands: mockCommands,
		ConfigurationTarget: {
			Global: 1,
		},
		Disposable: {
			from: vi.fn().mockImplementation((...disposables) => ({
				dispose: () => disposables.forEach((d) => d?.dispose?.()),
			})),
		},
	};
});

// Get references to the mocked functions
const vscode = await import("vscode");
const mockWorkspace = vscode.workspace as unknown as {
	getConfiguration: () => { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
	onDidChangeConfiguration: ReturnType<typeof vi.fn>;
};
const mockWorkspaceConfiguration = mockWorkspace.getConfiguration();
const mockWindow = vscode.window as unknown as {
	showWarningMessage: ReturnType<typeof vi.fn>;
};

// Mock extension context with secret storage
const mockSecretStorage = {
	get: vi.fn(),
	store: vi.fn(),
	delete: vi.fn(),
	onDidChange: vi.fn(),
};

const mockContext = {
	secrets: mockSecretStorage,
} as unknown as Parameters<typeof initializeSecretStorage>[0];

describe("ConfigService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Initialize secret storage before each test
		initializeSecretStorage(mockContext);
	});

	describe("getConfig", () => {
		it("should return default configuration when no values are set", async () => {
			mockWorkspaceConfiguration.get.mockImplementation(
				(_key: string, defaultValue: unknown) => defaultValue,
			);
			mockSecretStorage.get.mockResolvedValue("");

			const config = await getConfig();

			expect(config).toEqual({
				token: "",
				refreshInterval: 300,
				showNotifications: true,
				playSound: true,
				groupByRepository: true,
				repositoryFilter: [],
			});
		});

		it("should return configuration values from workspace and secret storage", async () => {
			mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: unknown) => {
				switch (key) {
					case "token":
						return ""; // Legacy token should be empty
					case "refreshInterval":
						return 600;
					case "showNotifications":
						return false;
					case "playSound":
						return false;
					default:
						return defaultValue;
				}
			});
			mockSecretStorage.get.mockResolvedValue("secret-token");

			const config = await getConfig();

			expect(config).toEqual({
				token: "secret-token",
				refreshInterval: 600,
				showNotifications: false,
				playSound: false,
				groupByRepository: true,
				repositoryFilter: [],
			});
		});

		it("should enforce minimum refresh interval", async () => {
			mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: unknown) => {
				if (key === "refreshInterval") {
					return 30; // Below minimum
				}
				return defaultValue;
			});
			mockSecretStorage.get.mockResolvedValue("");

			const config = await getConfig();

			expect(config.refreshInterval).toBe(60); // Should be enforced to minimum
		});

		it("should validate and clean repository filter", async () => {
			mockWindow.showWarningMessage.mockResolvedValue(undefined);

			mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: unknown) => {
				if (key === "repositoryFilter") {
					return [
						"valid/repo1", // Valid
						"valid/repo-2", // Valid
						"invalid-repo", // Invalid: no slash
						"github.com/owner/repo", // Invalid: too many slashes
						"valid/repo_3", // Valid
						"", // Invalid: empty
						"   ", // Invalid: whitespace only
					];
				}
				return defaultValue;
			});
			mockSecretStorage.get.mockResolvedValue("");

			const config = await getConfig();

			// Should only include valid repositories
			expect(config.repositoryFilter).toEqual(["valid/repo1", "valid/repo-2", "valid/repo_3"]);

			// Should show warning for invalid entries
			expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining("Invalid repository formats"),
				"Open Settings",
			);
		});
	});

	describe("Token management", () => {
		it("should store token securely", async () => {
			await setToken("test-token");
			expect(mockSecretStorage.store).toHaveBeenCalledWith(
				"githubReviewManager.token",
				"test-token",
			);
		});

		it("should retrieve token from secret storage", async () => {
			mockSecretStorage.get.mockResolvedValue("stored-token");
			const token = await getToken();
			expect(token).toBe("stored-token");
		});

		it("should clear token from secret storage", async () => {
			await clearToken();
			expect(mockSecretStorage.delete).toHaveBeenCalledWith("githubReviewManager.token");
		});

		it("should return empty string when no token is stored", async () => {
			mockSecretStorage.get.mockResolvedValue(undefined);
			const token = await getToken();
			expect(token).toBe("");
		});
	});

	describe("onConfigChange", () => {
		it("should register configuration change listener", () => {
			const callback = vi.fn();
			const mockConfigDisposable = { dispose: vi.fn() };
			const mockSecretDisposable = { dispose: vi.fn() };
			mockWorkspace.onDidChangeConfiguration.mockReturnValue(mockConfigDisposable);
			mockSecretStorage.onDidChange.mockReturnValue(mockSecretDisposable);

			const disposable = onConfigChange(callback);

			expect(mockWorkspace.onDidChangeConfiguration).toHaveBeenCalledWith(expect.any(Function));
			expect(disposable).toBeDefined();
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
