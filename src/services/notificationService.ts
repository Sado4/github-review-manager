import * as vscode from "vscode";
import type { ReviewRequest } from "../types";

export class NotificationService {
	async showNewReviewNotification(newRequests: ReviewRequest[]): Promise<void> {
		if (newRequests.length === 0) {
			return;
		}

		const message =
			newRequests.length === 1
				? `New review request: ${newRequests[0].title}`
				: `${newRequests.length} new review requests`;

		// Play notification sound immediately when popup is shown
		this.playNotificationSound();

		const action = await vscode.window.showInformationMessage(message, "View PR", "Open List");

		if (action === "View PR" && newRequests.length === 1) {
			// Open the specific PR in browser
			vscode.env.openExternal(vscode.Uri.parse(newRequests[0].url));
		} else if (action === "View PR") {
			// Open the review manager view
			vscode.commands.executeCommand("workbench.view.extension.githubReviewManager");
		} else if (action === "Open List") {
			// Open the review manager view
			vscode.commands.executeCommand("workbench.view.extension.githubReviewManager");
		}
	}

	playNotificationSound(): void {
		try {
			// Use a softer approach that doesn't interfere with current audio
			if (process.platform === "darwin") {
				// macOS - use a gentle notification sound without changing system volume
				const { exec } = require("node:child_process");
				exec("afplay /System/Library/Sounds/Glass.aiff", (error: Error | null) => {
					if (error) {
						// Fallback to Ping if Glass is not available
						exec("afplay /System/Library/Sounds/Ping.aiff");
					}
				});
			} else if (process.platform === "win32") {
				// Windows - use a gentle notification sound
				const { exec } = require("node:child_process");
				exec('powershell -c "[console]::beep(800,200)"');
			} else {
				// Linux - use a gentle notification sound
				const { exec } = require("node:child_process");
				exec('paplay /usr/share/sounds/alsa/Side_Left.wav 2>/dev/null || echo ""');
			}
		} catch (error) {
			console.error("Error playing notification sound:", error);
		}
	}

	showTokenConfigurationError(): void {
		const message =
			"GitHub token not configured. Generate a Classic Personal Access Token with 'repo' scope for full repository access.";
		vscode.window.showErrorMessage(message, "Generate Token").then((selection) => {
			if (selection === "Generate Token") {
				vscode.env.openExternal(
					vscode.Uri.parse(
						"https://github.com/settings/tokens/new?scopes=repo&description=GitHub%20Review%20Manager",
					),
				);
			}
		});
	}

	showApiError(): void {
		vscode.window.showErrorMessage(
			"Failed to fetch review requests. Check your GitHub token and network connection.",
		);
	}
}
