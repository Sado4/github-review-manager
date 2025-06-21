import * as vscode from "vscode";
import type { GitHubConfig } from "../types";

const CONFIG_KEY = "githubReviewManager";

export function getConfig(): GitHubConfig {
	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	return {
		token: config.get<string>("token", ""),
		refreshInterval: Math.max(config.get<number>("refreshInterval", 300), 60),
		showNotifications: config.get<boolean>("showNotifications", true),
		playSound: config.get<boolean>("playSound", true),
	};
}

export function onConfigChange(callback: () => void): vscode.Disposable {
	return vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration(CONFIG_KEY)) {
			callback();
		}
	});
}
