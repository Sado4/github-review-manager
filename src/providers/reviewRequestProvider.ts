import * as vscode from "vscode";
import { getConfig } from "../services/configService";
import { GitHubService } from "../services/githubService";
import { NotificationService } from "../services/notificationService";
import type { ReviewRequest, StatusBarInfo } from "../types";

export class ReviewRequestProvider implements vscode.TreeDataProvider<ReviewRequest> {
	private _onDidChangeTreeData: vscode.EventEmitter<ReviewRequest | undefined | null | undefined> =
		new vscode.EventEmitter<ReviewRequest | undefined | null | undefined>();
	readonly onDidChangeTreeData: vscode.Event<ReviewRequest | undefined | null | undefined> =
		this._onDidChangeTreeData.event;

	private reviewRequests: ReviewRequest[] = [];
	private githubService: GitHubService;
	private notificationService: NotificationService;
	private statusBarItem: vscode.StatusBarItem;

	constructor() {
		this.githubService = new GitHubService();
		this.notificationService = new NotificationService();
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.statusBarItem.command = "workbench.view.extension.githubReviewManager";
		this.initializeServices();
	}

	private initializeServices(): void {
		const config = getConfig();
		if (config.token) {
			this.githubService.updateToken(config.token);
		}
	}

	refresh(): void {
		this.initializeServices();
		this.fetchReviewRequests();
	}

	getTreeItem(element: ReviewRequest): vscode.TreeItem {
		// Use updatedAt as a proxy for when review was likely requested
		// (closer to when you were actually asked to review)
		const relevantTime =
			element.updatedAt > element.createdAt ? element.updatedAt : element.createdAt;
		const timeEmoji = this.getTimeEmoji(relevantTime);

		// Use emoji + title for compact display
		const item = new vscode.TreeItem(
			`${timeEmoji} ${element.title}`,
			vscode.TreeItemCollapsibleState.None,
		);

		// Simplified description for narrow sidebar
		const draftText = element.draft ? " [Draft]" : "";
		const mergeableText = element.mergeable === false ? " [⚡]" : ""; // Shorter conflict indicator

		item.description = `${element.repository}${draftText}${mergeableText}`;

		item.tooltip = this.createTooltip(element);
		item.command = {
			command: "githubReviewManager.openPR",
			title: "Open PR",
			arguments: [element],
		};

		item.contextValue = "reviewRequest";
		item.iconPath = this.getIconForRequest(element);

		return item;
	}

	getChildren(element?: ReviewRequest): Thenable<ReviewRequest[]> {
		if (!element) {
			return Promise.resolve(this.reviewRequests);
		}
		return Promise.resolve([]);
	}

	private createTooltip(element: ReviewRequest): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString();
		const relevantTime =
			element.updatedAt > element.createdAt ? element.updatedAt : element.createdAt;
		const timeAgo = this.getTimeAgo(relevantTime);
		const timeEmoji = this.getTimeEmoji(relevantTime);
		const createdDate = new Date(element.createdAt).toLocaleDateString();
		const updatedDate = new Date(element.updatedAt).toLocaleDateString();
		const createdTime = new Date(element.createdAt).toLocaleTimeString();
		const updatedTime = new Date(element.updatedAt).toLocaleTimeString();

		// Priority indicator
		tooltip.appendMarkdown(`## ${timeEmoji} **PR #${element.id}**: ${element.title}\n\n`);

		// Time info prominently displayed
		tooltip.appendMarkdown(`📅 **PR Created**: ${createdDate} ${createdTime}\n`);

		if (element.updatedAt > element.createdAt) {
			tooltip.appendMarkdown(`⏰ **Last Activity**: ${timeAgo} (${updatedDate} ${updatedTime})\n`);
		} else {
			tooltip.appendMarkdown(`⏰ **Waiting for**: ${timeAgo}\n`);
		}
		tooltip.appendMarkdown(`\n`);

		// Repository and author info
		tooltip.appendMarkdown(`📁 **Repository**: ${element.repository}\n`);
		tooltip.appendMarkdown(`👤 **Author**: ${element.author}\n\n`);

		// Status information
		const statusIcon = element.draft ? "📝" : "✅";
		const statusText = element.draft ? "Draft" : "Ready for Review";
		tooltip.appendMarkdown(`${statusIcon} **Status**: ${statusText}\n`);

		if (element.mergeable !== null) {
			const mergeIcon = element.mergeable ? "✅" : "⚠️";
			const mergeText = element.mergeable ? "Ready to merge" : "Has conflicts";
			tooltip.appendMarkdown(`${mergeIcon} **Mergeable**: ${mergeText}\n`);
		}

		// Change statistics
		tooltip.appendMarkdown(`\n📊 **Changes**:\n`);
		tooltip.appendMarkdown(`- ➕ ${element.additions} additions\n`);
		tooltip.appendMarkdown(`- ➖ ${element.deletions} deletions\n`);
		tooltip.appendMarkdown(`- 📄 ${element.changedFiles} files modified\n`);

		if (element.reviewComments > 0) {
			tooltip.appendMarkdown(`- 💬 ${element.reviewComments} review comments\n`);
		}

		// Quick actions
		tooltip.appendMarkdown(`\n🔗 [**Open PR in Browser**](${element.url})\n`);
		tooltip.appendMarkdown(`📋 **Full URL**: ${element.url}`);

		return tooltip;
	}

	private getIconForRequest(element: ReviewRequest): vscode.ThemeIcon | vscode.Uri {
		// Try to use user avatar if available
		if (element.authorAvatarUrl) {
			return vscode.Uri.parse(element.authorAvatarUrl);
		}

		// Fallback to theme icons
		if (element.draft) {
			return new vscode.ThemeIcon("git-pull-request-draft");
		} else if (element.mergeable === false) {
			return new vscode.ThemeIcon("git-pull-request", new vscode.ThemeColor("errorForeground"));
		} else {
			return new vscode.ThemeIcon("git-pull-request");
		}
	}

	private getTimeAgo(dateString: string): string {
		const now = new Date();
		const created = new Date(dateString);
		const diffMs = now.getTime() - created.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) {
			return `${diffDays}d ago`;
		} else if (diffHours > 0) {
			return `${diffHours}h ago`;
		} else {
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			return `${diffMinutes}m ago`;
		}
	}

	private getTimeEmoji(dateString: string): string {
		const now = new Date();
		const created = new Date(dateString);
		const diffMs = now.getTime() - created.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays >= 7) {
			return "🚨"; // Urgent: 1 week+
		} else if (diffDays >= 3) {
			return "🔥"; // High priority: 3+ days
		} else if (diffDays >= 1) {
			return "⚠️"; // Medium priority: 1+ days
		} else {
			return "🆕"; // New: Same day
		}
	}

	private async fetchReviewRequests(): Promise<void> {
		if (!this.githubService.isConfigured()) {
			this.notificationService.showTokenConfigurationError();
			this.updateStatusBar();
			return;
		}

		try {
			const previousIds = new Set(this.reviewRequests.map((r) => r.id));
			this.reviewRequests = await this.githubService.fetchReviewRequests();

			const config = getConfig();
			const newRequests = this.reviewRequests.filter((r) => !previousIds.has(r.id));

			if (newRequests.length > 0) {
				if (config.showNotifications) {
					await this.notificationService.showNewReviewNotification(newRequests);
				} else if (config.playSound) {
					// Only play sound if notifications are disabled
					this.notificationService.playNotificationSound();
				}
			}

			vscode.commands.executeCommand(
				"setContext",
				"githubReviewManager.hasRequests",
				this.reviewRequests.length > 0,
			);
			this._onDidChangeTreeData.fire(undefined);
			this.updateStatusBar();
		} catch (error) {
			console.error("Error fetching review requests:", error);
			this.notificationService.showApiError();
			this.updateStatusBar();
		}
	}

	private updateStatusBar(): void {
		const statusInfo = this.getStatusBarInfo();

		if (statusInfo.total > 0) {
			// Simple count display
			this.statusBarItem.text = `$(git-pull-request) ${statusInfo.total}`;
			this.statusBarItem.command = "workbench.view.extension.githubReviewManager";

			// Enhanced tooltip with priority breakdown only
			const tooltipParts = [`${statusInfo.total} review requests pending`];

			// Add urgency breakdown
			if (statusInfo.urgent > 0) {
				tooltipParts.push(`🚨 Critical: ${statusInfo.urgent} (1+ week old)`);
			}
			if (statusInfo.high > 0) {
				tooltipParts.push(`🔥 Urgent: ${statusInfo.high} (3+ days old)`);
			}
			if (statusInfo.medium > 0) {
				tooltipParts.push(`⚠️ Attention: ${statusInfo.medium} (1+ days old)`);
			}
			if (statusInfo.new > 0) {
				tooltipParts.push(`🆕 New: ${statusInfo.new} (today)`);
			}

			tooltipParts.push("", "Click to open review list");

			this.statusBarItem.tooltip = tooltipParts.join("\n");

			// Simple background color logic
			if (statusInfo.high > 0 || statusInfo.urgent > 0) {
				// Red if any review is 3+ days old
				this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
			} else {
				// Yellow if any review requests exist
				this.statusBarItem.backgroundColor = new vscode.ThemeColor(
					"statusBarItem.warningBackground",
				);
			}

			this.statusBarItem.show();
		} else if (this.githubService.isConfigured()) {
			this.statusBarItem.text = `$(git-pull-request) 0`;
			this.statusBarItem.tooltip =
				"No pending review requests\nClick to refresh or open review list";
			this.statusBarItem.command = "workbench.view.extension.githubReviewManager";
			this.statusBarItem.backgroundColor = undefined;
			this.statusBarItem.show();
		} else {
			this.statusBarItem.text = `$(git-pull-request) Not configured`;
			this.statusBarItem.tooltip =
				"GitHub Personal Access Token not configured.\nClick to set up 'repo' scope token to view review requests.";
			this.statusBarItem.command = "githubReviewManager.openSettings";
			this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
			this.statusBarItem.show();
		}
	}

	private getStatusBarInfo(): StatusBarInfo {
		const now = new Date();

		// Calculate urgency levels
		const urgentRequests = this.reviewRequests.filter((r) => {
			const relevantTime = r.updatedAt > r.createdAt ? r.updatedAt : r.createdAt;
			const diffDays = Math.floor(
				(now.getTime() - new Date(relevantTime).getTime()) / (1000 * 60 * 60 * 24),
			);
			return diffDays >= 7; // 1+ week
		});

		const highRequests = this.reviewRequests.filter((r) => {
			const relevantTime = r.updatedAt > r.createdAt ? r.updatedAt : r.createdAt;
			const diffDays = Math.floor(
				(now.getTime() - new Date(relevantTime).getTime()) / (1000 * 60 * 60 * 24),
			);
			return diffDays >= 3 && diffDays < 7; // 3-6 days
		});

		const mediumRequests = this.reviewRequests.filter((r) => {
			const relevantTime = r.updatedAt > r.createdAt ? r.updatedAt : r.createdAt;
			const diffDays = Math.floor(
				(now.getTime() - new Date(relevantTime).getTime()) / (1000 * 60 * 60 * 24),
			);
			return diffDays >= 1 && diffDays < 3; // 1-2 days
		});

		const newRequests = this.reviewRequests.filter((r) => {
			const relevantTime = r.updatedAt > r.createdAt ? r.updatedAt : r.createdAt;
			const diffDays = Math.floor(
				(now.getTime() - new Date(relevantTime).getTime()) / (1000 * 60 * 60 * 24),
			);
			return diffDays < 1; // today
		});

		return {
			total: this.reviewRequests.length,
			urgent: urgentRequests.length,
			high: highRequests.length,
			medium: mediumRequests.length,
			new: newRequests.length,
		};
	}

	dispose(): void {
		this.statusBarItem?.dispose();
	}
}
