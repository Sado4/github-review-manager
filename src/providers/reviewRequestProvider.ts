import * as vscode from "vscode";
import { getConfig } from "../services/configService";
import { GitHubService } from "../services/githubService";
import { NotificationService } from "../services/notificationService";

import type { RepositoryNode, ReviewRequest, StatusBarInfo } from "../types";

type TreeItem = ReviewRequest | RepositoryNode;

export class ReviewRequestProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | undefined> =
		new vscode.EventEmitter<TreeItem | undefined | null | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | undefined> =
		this._onDidChangeTreeData.event;

	private reviewRequests: ReviewRequest[] = [];
	private githubService: GitHubService;
	private notificationService: NotificationService;
	private statusBarItem: vscode.StatusBarItem;
	private repositoryNodes: RepositoryNode[] = [];

	constructor() {
		this.githubService = new GitHubService();
		this.notificationService = new NotificationService();
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.statusBarItem.command = "workbench.view.extension.githubReviewManager";
		this.initializeServices();
	}

	private async initializeServices(): Promise<void> {
		const config = await getConfig();
		if (config.token) {
			this.githubService.updateToken(config.token);
		}
	}

	refresh(): void {
		this.initializeServices();
		this.fetchReviewRequests();
	}

	getTreeItem(element: TreeItem): vscode.TreeItem {
		// Repository node case
		if ("reviewRequests" in element) {
			return this.createRepositoryTreeItem(element);
		}

		// Review request case
		return this.createReviewRequestTreeItem(element);
	}

	private createRepositoryTreeItem(repositoryNode: RepositoryNode): vscode.TreeItem {
		const item = new vscode.TreeItem(
			repositoryNode.repository,
			vscode.TreeItemCollapsibleState.Expanded,
		);

		const count = repositoryNode.reviewRequests.length;
		item.description = `${count} review${count !== 1 ? "s" : ""}`;
		item.tooltip = `${repositoryNode.repository} - ${count} pending review request${count !== 1 ? "s" : ""}`;
		item.iconPath = new vscode.ThemeIcon("repo");
		item.contextValue = "repositoryNode";

		return item;
	}

	private createReviewRequestTreeItem(element: ReviewRequest): vscode.TreeItem {
		const relevantTime = this.getRelevantTime(element);
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

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		if (!element) {
			// Root level - decide whether to group by repository or not
			const config = await getConfig();

			if (config.groupByRepository) {
				return this.repositoryNodes;
			} else {
				return this.reviewRequests;
			}
		}

		// Repository node child elements (review requests)
		if ("reviewRequests" in element) {
			return element.reviewRequests;
		}

		// Review requests have no child elements
		return [];
	}

	private createTooltip(element: ReviewRequest): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString();
		const relevantTime = this.getRelevantTime(element);
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
		const diffDays = this.getDaysFromNow(dateString);

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

	private getRelevantTime(element: ReviewRequest): string {
		return element.updatedAt > element.createdAt ? element.updatedAt : element.createdAt;
	}

	private getDaysFromNow(dateString: string): number {
		const now = new Date();
		const date = new Date(dateString);
		const diffMs = now.getTime() - date.getTime();
		return Math.floor(diffMs / (1000 * 60 * 60 * 24));
	}

	private groupByRepository(requests: ReviewRequest[]): RepositoryNode[] {
		const repositoryMap = new Map<string, ReviewRequest[]>();

		// Group by repository
		for (const request of requests) {
			if (!repositoryMap.has(request.repository)) {
				repositoryMap.set(request.repository, []);
			}
			repositoryMap.get(request.repository)!.push(request);
		}

		// Create RepositoryNode array and sort by repository name
		return Array.from(repositoryMap.entries())
			.map(([repository, reviewRequests]) => ({
				repository,
				reviewRequests: reviewRequests.sort((a, b) => {
					// Sort by urgency (time-based)
					const timeA = this.getRelevantTime(a);
					const timeB = this.getRelevantTime(b);
					return new Date(timeB).getTime() - new Date(timeA).getTime();
				}),
			}))
			.sort((a, b) => a.repository.localeCompare(b.repository));
	}

	private async fetchReviewRequests(): Promise<void> {
		if (!this.githubService.isConfigured()) {
			this.notificationService.showTokenConfigurationError();
			await this.updateStatusBar();
			return;
		}

		try {
			const previousIds = new Set(this.reviewRequests.map((r) => r.id));
			let allRequests = await this.githubService.fetchReviewRequests();

			const config = await getConfig();

			// Apply repository filter if configured
			const originalCount = allRequests.length;
			if (config.repositoryFilter.length > 0) {
				allRequests = allRequests.filter((request) =>
					config.repositoryFilter.includes(request.repository),
				);

				console.log(
					`GitHub Review Manager: Repository filter applied - showing ${allRequests.length}/${originalCount} requests from repositories: ${config.repositoryFilter.join(", ")}`,
				);
			}

			this.reviewRequests = allRequests;

			// Group by repository
			this.repositoryNodes = this.groupByRepository(allRequests);

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
			await this.updateStatusBar();
		} catch (error) {
			console.error("Error fetching review requests:", error);
			this.notificationService.showApiError();
			await this.updateStatusBar();
		}
	}

	private async updateStatusBar(): Promise<void> {
		const statusInfo = this.getStatusBarInfo();
		const config = await getConfig();
		const isFiltered = config.repositoryFilter.length > 0;

		if (statusInfo.total > 0) {
			// Simple count display with filter indicator
			const filterText = isFiltered ? " 📁" : "";
			this.statusBarItem.text = `$(git-pull-request) ${statusInfo.total}${filterText}`;
			this.statusBarItem.command = "workbench.view.extension.githubReviewManager";

			// Enhanced tooltip with filter info
			const tooltipParts = [];

			if (isFiltered) {
				tooltipParts.push(`🔍 Filtered: ${statusInfo.total} review requests`);
				tooltipParts.push(`📁 Repositories: ${config.repositoryFilter.join(", ")}`);
				tooltipParts.push("");
			} else {
				tooltipParts.push(`${statusInfo.total} review requests pending`);
			}

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

			if (isFiltered) {
				tooltipParts.push(
					"",
					"💡 Tip: Go to Settings > GitHub Review Manager > Repository Filter to modify",
				);
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
			const filterText = isFiltered ? " 📁" : "";
			this.statusBarItem.text = `$(git-pull-request) 0${filterText}`;

			let tooltip = "No pending review requests\nClick to refresh or open review list";
			if (isFiltered) {
				tooltip = `🔍 No pending review requests in filtered repositories\n📁 Filtering: ${config.repositoryFilter.join(", ")}\n\n💡 Tip: Go to Settings > GitHub Review Manager > Repository Filter to modify\n\nClick to refresh or open review list`;
			}

			this.statusBarItem.tooltip = tooltip;
			this.statusBarItem.command = "workbench.view.extension.githubReviewManager";
			this.statusBarItem.backgroundColor = undefined;
			this.statusBarItem.show();
		} else {
			this.statusBarItem.text = `$(git-pull-request) Not configured`;
			this.statusBarItem.tooltip = [
				"GitHub Review Manager - Token Required",
				"",
				"📋 To get started:",
				"1. Click here to show setup options",
				"2. Choose 'Generate Token' to create a new one",
				"3. Generate a Classic token with 'repo' scope",
				"4. Come back and choose 'I already have a token'",
				"5. Paste your token when prompted",
				"",
				"💡 Classic tokens work with ALL repositories",
				"   (personal, organizations, private repos)",
				"",
				"🔄 Lost the popup? Reload VS Code or click here again",
			].join("\n");
			this.statusBarItem.command = "githubReviewManager.setupFromStatusBar";
			this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
			this.statusBarItem.show();
		}
	}

	private getStatusBarInfo(): StatusBarInfo {
		// Calculate urgency levels
		const urgentRequests = this.reviewRequests.filter((r) => {
			const relevantTime = this.getRelevantTime(r);
			const diffDays = this.getDaysFromNow(relevantTime);
			return diffDays >= 7; // 1+ week
		});

		const highRequests = this.reviewRequests.filter((r) => {
			const relevantTime = this.getRelevantTime(r);
			const diffDays = this.getDaysFromNow(relevantTime);
			return diffDays >= 3 && diffDays < 7; // 3-6 days
		});

		const mediumRequests = this.reviewRequests.filter((r) => {
			const relevantTime = this.getRelevantTime(r);
			const diffDays = this.getDaysFromNow(relevantTime);
			return diffDays >= 1 && diffDays < 3; // 1-2 days
		});

		const newRequests = this.reviewRequests.filter((r) => {
			const relevantTime = this.getRelevantTime(r);
			const diffDays = this.getDaysFromNow(relevantTime);
			return diffDays < 1; // Same day
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
