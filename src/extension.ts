import * as vscode from "vscode";
import { ReviewRequestProvider } from "./providers/reviewRequestProvider";
import { getConfig, onConfigChange } from "./services/configService";
import type { ReviewRequest } from "./types";

export function activate(context: vscode.ExtensionContext): void {
	const provider = new ReviewRequestProvider();

	// Register tree views for both activity bar and explorer
	const treeViewMain = vscode.window.createTreeView("githubReviewRequestsMain", {
		treeDataProvider: provider,
		showCollapseAll: false,
	});

	const treeViewExplorer = vscode.window.createTreeView("githubReviewRequestsExplorer", {
		treeDataProvider: provider,
		showCollapseAll: false,
	});

	// Register commands
	const refreshCommand = vscode.commands.registerCommand("githubReviewManager.refresh", () => {
		provider.refresh();
	});

	const openPRCommand = vscode.commands.registerCommand(
		"githubReviewManager.openPR",
		(reviewRequest: ReviewRequest) => {
			vscode.env.openExternal(vscode.Uri.parse(reviewRequest.url));
		},
	);

	const openSettingsCommand = vscode.commands.registerCommand(
		"githubReviewManager.openSettings",
		() => {
			vscode.commands.executeCommand("workbench.action.openSettings", "githubReviewManager.token");
		},
	);

	// Listen for configuration changes
	const configChangeListener = onConfigChange(() => {
		provider.refresh();
	});

	// Set up periodic refresh
	const config = getConfig();
	const refreshInterval = config.refreshInterval * 1000;

	const intervalId = setInterval(() => {
		provider.refresh();
	}, refreshInterval);

	// Initial fetch with delay to reduce startup load
	setTimeout(() => {
		provider.refresh();
	}, 2000);

	context.subscriptions.push(
		treeViewMain,
		treeViewExplorer,
		refreshCommand,
		openPRCommand,
		openSettingsCommand,
		configChangeListener,
		provider,
		{ dispose: () => clearInterval(intervalId) },
	);
}

export function deactivate(): void {
	// Extension cleanup
}
