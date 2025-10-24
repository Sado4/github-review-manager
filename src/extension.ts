import * as vscode from "vscode";
import { ReviewRequestProvider } from "./providers/reviewRequestProvider";
import { AIReviewService } from "./services/aiReviewService";
import {
	clearToken,
	getConfig,
	initializeSecretStorage,
	onConfigChange,
	setToken,
} from "./services/configService";
import type { ReviewRequest } from "./types";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Initialize secret storage
	initializeSecretStorage(context);

	const provider = new ReviewRequestProvider();
	const aiReviewService = new AIReviewService();

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
			vscode.commands.executeCommand("workbench.action.openSettings", "githubReviewManager");
		},
	);

	// Token management commands
	const setTokenCommand = vscode.commands.registerCommand(
		"githubReviewManager.setToken",
		async () => {
			const token = await vscode.window.showInputBox({
				prompt: "Enter your GitHub Personal Access Token (Classic)",
				password: true,
				placeHolder: "ghp_...",
				validateInput: (value) => {
					if (!value) {
						return "Token cannot be empty";
					}
					if (!value.startsWith("ghp_")) {
						return "Invalid token format. Please use a Classic Personal Access Token (ghp_...)";
					}
					return null;
				},
			});

			if (token) {
				await setToken(token);
				vscode.window.showInformationMessage("GitHub token has been saved securely.");
				provider.refresh();
			}
		},
	);

	const clearTokenCommand = vscode.commands.registerCommand(
		"githubReviewManager.clearToken",
		async () => {
			const result = await vscode.window.showWarningMessage(
				"Are you sure you want to clear the GitHub token?",
				{ modal: true },
				"Yes",
				"No",
			);

			if (result === "Yes") {
				await clearToken();
				vscode.window.showInformationMessage("GitHub token has been cleared.");
				provider.refresh();
			}
		},
	);

	// AI Review command
	const requestAIReviewCommand = vscode.commands.registerCommand(
		"githubReviewManager.requestAIReview",
		async (reviewRequest: ReviewRequest) => {
			await aiReviewService.requestAIReview(reviewRequest);
		},
	);

	// Status bar command that shows helpful popup first
	const setupFromStatusBarCommand = vscode.commands.registerCommand(
		"githubReviewManager.setupFromStatusBar",
		async () => {
			const action = await vscode.window.showInformationMessage(
				"GitHub Review Manager needs a Classic Personal Access Token with 'repo' scope to access your review requests.",
				"Generate Token",
				"I already have a token",
			);

			if (action === "Generate Token") {
				vscode.env.openExternal(
					vscode.Uri.parse(
						"https://github.com/settings/tokens/new?scopes=repo&description=GitHub%20Review%20Manager",
					),
				);
			} else if (action === "I already have a token") {
				vscode.commands.executeCommand("githubReviewManager.setToken");
			}
		},
	);

	// Listen for configuration changes
	const configChangeListener = onConfigChange(() => {
		provider.refresh();
	});

	// Set up periodic refresh
	const config = await getConfig();
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
		setTokenCommand,
		clearTokenCommand,
		requestAIReviewCommand,
		setupFromStatusBarCommand,
		configChangeListener,
		provider,
		{ dispose: () => clearInterval(intervalId) },
	);
}

export function deactivate(): void {
	// Extension cleanup
}
