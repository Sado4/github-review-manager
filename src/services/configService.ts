import * as vscode from "vscode";
import type { Config } from "../types";

const CONFIG_KEY = "githubReviewManager";
const SECRET_TOKEN_KEY = "githubReviewManager.token";

let secretStorage: vscode.SecretStorage | null = null;

export function initializeSecretStorage(context: vscode.ExtensionContext): void {
	secretStorage = context.secrets;
}

export async function getConfig(): Promise<Config> {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	// Get token from secret storage
	const token = await getToken();

	// Enforce minimum refresh interval
	const refreshInterval = Math.max(config.get<number>("refreshInterval", 300), 60);

	// Validate and clean repository filter
	const rawRepositoryFilter = config.get<string[]>("repositoryFilter", []);
	const repositoryFilter = validateRepositoryFilter(rawRepositoryFilter);

	return {
		token,
		refreshInterval,
		showNotifications: config.get<boolean>("showNotifications", true),
		playSound: config.get<boolean>("playSound", true),
		groupByRepository: config.get<boolean>("groupByRepository", true),
		repositoryFilter,
	};
}

/**
 * Validate and clean repository filter array
 * @param rawFilter Raw filter array from configuration
 * @returns Cleaned array with valid repository names only
 */
function validateRepositoryFilter(rawFilter: string[]): string[] {
	const validRepositories: string[] = [];
	const invalidRepositories: string[] = [];

	for (const repo of rawFilter) {
		if (typeof repo === "string" && repo.trim()) {
			const trimmedRepo = repo.trim();
			// Validate format: owner/repository-name
			if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(trimmedRepo)) {
				validRepositories.push(trimmedRepo);
			} else {
				invalidRepositories.push(trimmedRepo);
			}
		}
	}

	// Show user-friendly error message for invalid repositories
	if (invalidRepositories.length > 0) {
		const message =
			invalidRepositories.length === 1
				? `Invalid repository format: "${invalidRepositories[0]}"`
				: `Invalid repository formats: ${invalidRepositories.map((r) => `"${r}"`).join(", ")}`;

		const detailMessage = `${message}\n\nPlease use format: owner/repository-name\n\nExamples:\n• github/docs\n• microsoft/vscode\n• my-company/api-server`;

		vscode.window.showWarningMessage(detailMessage, "Open Settings").then((selection) => {
			if (selection === "Open Settings") {
				vscode.commands.executeCommand(
					"workbench.action.openSettings",
					"githubReviewManager.repositoryFilter",
				);
			}
		});
	}

	return validRepositories;
}

export async function getToken(): Promise<string> {
	if (!secretStorage) {
		throw new Error("Secret storage not initialized");
	}
	return (await secretStorage.get(SECRET_TOKEN_KEY)) || "";
}

export async function setToken(token: string): Promise<void> {
	if (!secretStorage) {
		throw new Error("Secret storage not initialized");
	}
	await secretStorage.store(SECRET_TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
	if (!secretStorage) {
		throw new Error("Secret storage not initialized");
	}
	await secretStorage.delete(SECRET_TOKEN_KEY);
}

export function onConfigChange(callback: () => void): vscode.Disposable {
	const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration(CONFIG_KEY)) {
			callback();
		}
	});

	const secretListener = secretStorage?.onDidChange?.((e) => {
		if (e.key === SECRET_TOKEN_KEY) {
			callback();
		}
	});

	return vscode.Disposable.from(configListener, secretListener || { dispose: () => {} });
}
