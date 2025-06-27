import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ReviewRequest } from "../types";
import { getConfig } from "./configService";
import { GitHubService } from "./githubService";

export interface ProjectRules {
	rulesContent: string;
	rulesFile: string;
}

export interface ReviewContext {
	prInfo: ReviewRequest;
	diff: string;
	projectRules: ProjectRules | null;
	prDescription: string;
}

export class AIReviewService {
	private githubService: GitHubService;

	constructor() {
		this.githubService = new GitHubService();
		this.initializeService();
	}

	private async initializeService(): Promise<void> {
		const config = await getConfig();
		if (config.token) {
			this.githubService.updateToken(config.token);
		}
	}

	async requestAIReview(reviewRequest: ReviewRequest): Promise<void> {
		try {
			// Ensure token is configured before starting
			await this.initializeService();

			if (!this.githubService.isConfigured()) {
				throw new Error(
					"GitHub token not configured. Please set your token in the extension settings.",
				);
			}

			let reviewResult: string = "";

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `AI Review for PR #${reviewRequest.id}`,
					cancellable: false,
				},
				async (progress) => {
					progress.report({ increment: 10, message: "Gathering PR information..." });

					const context = await this.gatherReviewContext(reviewRequest);

					progress.report({ increment: 30, message: "Preparing review request..." });

					const reviewPrompt = this.buildReviewPrompt(context);

					progress.report({ increment: 20, message: "Requesting AI review..." });

					reviewResult = await this.executeClaudeCodeReview(reviewPrompt);

					// Skip saving if clipboard review was used
					if (reviewResult === "CLIPBOARD_REVIEW_COMPLETED") {
						progress.report({ increment: 40, message: "Complete!" });
						return;
					}

					progress.report({ increment: 30, message: "Saving review results..." });

					await this.saveReviewResult(reviewRequest, reviewResult);

					progress.report({ increment: 10, message: "Complete!" });
				},
			);

			// Only show completion message for CLI reviews (not clipboard reviews)
			if (reviewResult !== "CLIPBOARD_REVIEW_COMPLETED") {
				vscode.window
					.showInformationMessage(`AI review completed for PR #${reviewRequest.id}`, "Open Review")
					.then((action) => {
						if (action === "Open Review") {
							this.openReviewFile(reviewRequest);
						}
					});
			}
		} catch (error) {
			console.error("AI Review failed:", error);
			vscode.window.showErrorMessage(
				`AI Review failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async gatherReviewContext(reviewRequest: ReviewRequest): Promise<ReviewContext> {
		const [diff, prDescription, projectRules] = await Promise.all([
			this.githubService.fetchPRDiff(reviewRequest),
			this.githubService.fetchPRDescription(reviewRequest),
			this.findProjectRules(),
		]);

		return {
			prInfo: reviewRequest,
			diff,
			projectRules,
			prDescription,
		};
	}

	private async findProjectRules(): Promise<ProjectRules | null> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			console.warn("No workspace folder found, skipping project rules detection");
			return null;
		}

		const rulesFiles = [
			".cursor/rules/rules.md",
			".cursor/rules.md",
			"CLAUDE.md",
			"CODING_GUIDELINES.md",
			"DEVELOPMENT.md",
			"CONTRIBUTING.md",
		];

		for (const rulesFile of rulesFiles) {
			const rulesPath = path.join(workspaceFolder.uri.fsPath, rulesFile);
			try {
				if (fs.existsSync(rulesPath)) {
					const rulesContent = fs.readFileSync(rulesPath, "utf-8");
					return {
						rulesContent,
						rulesFile: rulesFile,
					};
				}
			} catch (error) {
				console.warn(`Could not read rules file ${rulesFile}:`, error);
			}
		}

		return null;
	}

	private buildReviewPrompt(context: ReviewContext): string {
		const isJapanese = this.detectJapanese(context.prInfo.title, context.prDescription);

		if (isJapanese) {
			return this.buildJapanesePrompt(context);
		} else {
			return this.buildEnglishPrompt(context);
		}
	}

	private detectJapanese(title: string, description: string): boolean {
		// Check for Japanese characters (Hiragana, Katakana, Kanji)
		const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
		const text = `${title} ${description}`;

		// Check if Japanese characters exist
		const hasJapanese = japaneseRegex.test(text);

		// Additionally check for common Japanese words/patterns
		const japanesePatterns = [
			/を|が|の|に|は|で|と|から|まで|より/, // Japanese particles
			/です|である|だ|ます|する|した|される/, // Japanese verb endings
			/こと|もの|ため|について|において/, // Common Japanese words
		];

		const hasJapanesePatterns = japanesePatterns.some((pattern) => pattern.test(text));

		return hasJapanese || hasJapanesePatterns;
	}

	private buildEnglishPrompt(context: ReviewContext): string {
		let prompt = `# PR Review Request

## PR Information
- **Title**: ${context.prInfo.title}
- **Repository**: ${context.prInfo.repository}
- **Author**: ${context.prInfo.author}
- **PR URL**: ${context.prInfo.url}
- **Status**: ${context.prInfo.draft ? "Draft" : "Ready for Review"}

## PR Description
${context.prDescription || "No description provided"}

## Changes Overview
- **Files Changed**: ${context.prInfo.changedFiles}
- **Additions**: ${context.prInfo.additions}
- **Deletions**: ${context.prInfo.deletions}

`;

		if (context.projectRules) {
			prompt += `## Project Rules (from ${context.projectRules.rulesFile})
${context.projectRules.rulesContent}

`;
		}

		prompt += `## Code Changes
\`\`\`diff
${context.diff}
\`\`\`

## Review Request
Please provide a comprehensive code review for this pull request. Consider:

1. **Code Quality**: Check for best practices, maintainability, and readability
2. **Potential Issues**: Identify bugs, security concerns, or performance problems
3. **Project Compliance**: Ensure the changes follow the project rules and conventions${context.projectRules ? " mentioned above" : ""}
4. **Suggestions**: Provide constructive feedback and improvement suggestions
5. **Testing**: Comment on test coverage and testing approach

Please structure your review with clear sections and actionable feedback. Format your response in clear, readable markdown with proper headings and bullet points.`;

		return prompt;
	}

	private buildJapanesePrompt(context: ReviewContext): string {
		let prompt = `# PRレビュー依頼

## PR情報
- **タイトル**: ${context.prInfo.title}
- **リポジトリ**: ${context.prInfo.repository}
- **作成者**: ${context.prInfo.author}
- **PR URL**: ${context.prInfo.url}
- **ステータス**: ${context.prInfo.draft ? "ドラフト" : "レビュー準備完了"}

## PR説明
${context.prDescription || "説明がありません"}

## 変更概要
- **変更ファイル数**: ${context.prInfo.changedFiles}
- **追加行数**: ${context.prInfo.additions}
- **削除行数**: ${context.prInfo.deletions}

`;

		if (context.projectRules) {
			prompt += `## プロジェクトルール (${context.projectRules.rulesFile}より)
${context.projectRules.rulesContent}

`;
		}

		prompt += `## コード変更内容
\`\`\`diff
${context.diff}
\`\`\`

## レビュー依頼
このプルリクエストについて、包括的なコードレビューをお願いします。以下の観点から確認してください：

1. **コード品質**: ベストプラクティス、保守性、可読性の確認
2. **潜在的な問題**: バグ、セキュリティ上の懸念、パフォーマンスの問題の特定
3. **プロジェクト準拠**: ${context.projectRules ? "上記の" : ""}プロジェクトルールや規約への準拠確認
4. **改善提案**: 建設的なフィードバックと改善案の提供
5. **テスト**: テストカバレッジとテストアプローチについてのコメント

明確なセクション分けと実行可能なフィードバックで構造化してください。読みやすいマークダウン形式で、適切な見出しと箇条書きを使用してレスポンスをフォーマットしてください。`;

		return prompt;
	}

	private async executeClaudeCodeReview(prompt: string): Promise<string> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		let tempDir: string;

		if (!workspaceFolder) {
			// Use OS temp directory if no workspace is open
			const os = require("node:os");
			tempDir = path.join(os.tmpdir(), "github-review-manager");
		} else {
			tempDir = path.join(workspaceFolder.uri.fsPath, ".temp");
		}
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const tempFile = path.join(tempDir, `ai-review-prompt-${timestamp}.md`);

		try {
			fs.writeFileSync(tempFile, prompt);

			const method = await vscode.window.showQuickPick(
				[
					{
						label: "$(terminal) Use Claude Code CLI",
						description: "Automatically execute claude command",
						detail: "Requires claude CLI to be installed and configured",
					},
					{
						label: "$(clippy) Copy to Clipboard",
						description: "Copy review prompt to clipboard",
						detail: "Paste directly into Claude Code - most convenient method",
					},
				],
				{
					placeHolder: "Choose how to request AI review",
					ignoreFocusOut: true,
				},
			);

			if (!method) {
				fs.unlinkSync(tempFile);
				throw new Error("AI review cancelled by user");
			}

			if (method.label.includes("CLI")) {
				return await this.executeCLIReview(tempFile);
			} else {
				return await this.executeClipboardReview(tempFile, prompt);
			}
		} catch (error) {
			if (fs.existsSync(tempFile)) {
				fs.unlinkSync(tempFile);
			}
			throw error;
		}
	}

	private async executeCLIReview(tempFile: string): Promise<string> {
		return new Promise((resolve, reject) => {
			let command = "claude";
			// Check if claude is available in PATH first
			child_process.exec("which claude", (error, stdout) => {
				if (!error && stdout.trim()) {
					command = stdout.trim();
				}

				child_process.exec(
					`"${command}" "${tempFile}"`,
					{
						timeout: 60000, // 60 second timeout
						maxBuffer: 1024 * 1024 * 10, // 10MB buffer
						env: {
							...process.env,
							PATH: `${process.env.PATH}:${process.env.HOME}/.nodenv/shims:${process.env.HOME}/.nodenv/bin`,
						},
					},
					(error, stdout, stderr) => {
						fs.unlinkSync(tempFile);

						if (error) {
							reject(
								new Error(
									`Claude CLI failed: ${error.message}\n\nTip: Try the "Manual Copy & Paste" method instead, which is more reliable.\n\nFor CLI usage, ensure Claude CLI is properly installed and accessible in your PATH.`,
								),
							);
							return;
						}

						if (stderr) {
							console.warn("Claude CLI stderr:", stderr);
						}

						if (!stdout || stdout.trim().length < 50) {
							reject(new Error("Claude CLI returned insufficient response"));
							return;
						}

						resolve(stdout.trim());
					},
				);
			});
		});
	}

	private async executeClipboardReview(tempFile: string, prompt: string): Promise<string> {
		try {
			// Copy prompt to clipboard
			await vscode.env.clipboard.writeText(prompt);

			// Clean up temp file
			fs.unlinkSync(tempFile);

			// Show success message with instructions
			await vscode.window.showInformationMessage(
				"Review prompt copied to clipboard!",
				{
					modal: false,
					detail:
						"The AI review prompt has been copied to your clipboard.\n\nNext steps:\n1. Paste the prompt into Claude Code\n2. Claude will provide the review automatically\n\nNo need to paste the response back - you're all set!",
				},
				"Got it!",
			);

			// Return empty string to indicate completion without further processing
			return "CLIPBOARD_REVIEW_COMPLETED";
		} catch (error) {
			fs.unlinkSync(tempFile);
			throw new Error(
				`Failed to copy to clipboard: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async saveReviewResult(
		reviewRequest: ReviewRequest,
		reviewResult: string,
	): Promise<void> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		let reviewsDir: string;

		if (!workspaceFolder) {
			// Use OS temp directory if no workspace is open
			const os = require("node:os");
			reviewsDir = path.join(os.tmpdir(), "github-review-manager", "reviews");
		} else {
			reviewsDir = path.join(workspaceFolder.uri.fsPath, "reviews");
		}
		if (!fs.existsSync(reviewsDir)) {
			fs.mkdirSync(reviewsDir, { recursive: true });
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const repoName = reviewRequest.repository.replace("/", "-");
		const fileName = `PR-${repoName}-${reviewRequest.id}-${timestamp}.md`;
		const filePath = path.join(reviewsDir, fileName);

		// Format the review result for better readability
		const formattedReviewResult = this.formatReviewResult(reviewResult);

		const isJapanese = this.detectJapanese(reviewRequest.title, "");

		const reviewContent = isJapanese
			? this.createJapaneseReviewFile(reviewRequest, formattedReviewResult)
			: this.createEnglishReviewFile(reviewRequest, formattedReviewResult);

		fs.writeFileSync(filePath, reviewContent);

		// Auto-cleanup old files if enabled
		await this.performAutoCleanup(reviewsDir);
	}

	private async performAutoCleanup(reviewsDir: string): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration("githubReviewManager.aiReview");
			const autoCleanup = config.get<boolean>("autoCleanup", true);
			const retentionDays = config.get<number>("retentionDays", 30);

			if (!autoCleanup) return;

			const files = fs.readdirSync(reviewsDir);
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

			let deletedCount = 0;

			for (const file of files) {
				// 厳格な安全チェック: 拡張機能が生成したファイルのみを対象
				const extensionFilePattern = /^PR-.+-\d+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/;
				if (!extensionFilePattern.test(file)) continue;

				const filePath = path.join(reviewsDir, file);
				const stats = fs.statSync(filePath);

				if (stats.mtime < cutoffDate) {
					fs.unlinkSync(filePath);
					deletedCount++;
				}
			}

			if (deletedCount > 0) {
				console.log(
					`GitHub Review Manager: Cleaned up ${deletedCount} old review files (older than ${retentionDays} days)`,
				);
			}
		} catch (error) {
			console.warn("GitHub Review Manager: Auto-cleanup failed:", error);
		}
	}

	private formatReviewResult(reviewResult: string): string {
		// Clean up the review result for better markdown formatting
		let formatted = reviewResult.trim();

		// Remove leading/trailing whitespace from each line
		formatted = formatted
			.split("\n")
			.map((line) => line.trim())
			.join("\n");

		// Fix common formatting issues from Claude Code output
		// Remove excessive spaces
		formatted = formatted.replace(/\s{2,}/g, " ");

		// Ensure proper line breaks after headings
		formatted = formatted.replace(/^(#{1,6}.*?)$/gm, "$1\n");

		// Add proper spacing before headings (except at start)
		formatted = formatted.replace(/([^\n])\n(#{1,6})/gm, "$1\n\n$2");

		// Ensure proper spacing around code blocks
		formatted = formatted.replace(/```(\w*)\n/g, "\n```$1\n");
		formatted = formatted.replace(/\n```$/gm, "\n```\n");
		formatted = formatted.replace(/([^`])\n```/g, "$1\n\n```");

		// Ensure proper spacing around lists
		formatted = formatted.replace(/([^\n])\n([-*+]|\d+\.)\s/g, "$1\n\n$2 ");

		// Fix bullet points and numbered lists formatting
		formatted = formatted.replace(/^([-*+]|\d+\.)\s*/gm, "\n$1 ").trim();

		// Add spacing around emphasis (**, *, etc.)
		formatted = formatted.replace(/([^*])\*\*([^*]+)\*\*([^*])/g, "$1 **$2** $3");
		formatted = formatted.replace(/([^*])\*([^*]+)\*([^*])/g, "$1 *$2* $3");

		// Fix paragraph spacing
		formatted = formatted.replace(/([.!?])\s*\n([A-Z])/g, "$1\n\n$2");

		// Clean up multiple line breaks but preserve intentional formatting
		formatted = formatted.replace(/\n{4,}/g, "\n\n\n");
		formatted = formatted.replace(/\n{3}/g, "\n\n");

		// Ensure sections are properly separated
		const sections = [
			"## 総合評価",
			"## Overall Assessment",
			"## 優秀な点",
			"## Strengths",
			"## コード品質",
			"## Code Quality",
			"## 改善提案",
			"## Areas for Improvement",
			"## 改善点",
			"## セキュリティ",
			"## Security",
			"## テスト",
			"## Testing",
			"## アクション",
			"## Action Items",
			"## 結論",
			"## Conclusion",
		];

		sections.forEach((section) => {
			const regex = new RegExp(
				`([^\\n])\\n(${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
				"g",
			);
			formatted = formatted.replace(regex, "$1\n\n$2");
		});

		return formatted;
	}

	private createEnglishReviewFile(reviewRequest: ReviewRequest, reviewResult: string): string {
		return `# AI Code Review: ${reviewRequest.title}

## PR Information

| Field | Value |
|-------|-------|
| Repository | ${reviewRequest.repository} |
| PR Number | #${reviewRequest.id} |
| Author | ${reviewRequest.author} |
| URL | [View PR](${reviewRequest.url}) |
| Status | ${reviewRequest.draft ? "Draft" : "Ready for Review"} |
| Generated | ${new Date().toLocaleString()} |

## Change Statistics

| Metric | Count |
|--------|-------|
| Files Changed | ${reviewRequest.changedFiles} |
| Lines Added | +${reviewRequest.additions} |
| Lines Deleted | -${reviewRequest.deletions} |
| Review Comments | ${reviewRequest.reviewComments} |

---

${reviewResult}

---

*Generated by GitHub Review Manager AI Review Feature*
`;
	}

	private createJapaneseReviewFile(reviewRequest: ReviewRequest, reviewResult: string): string {
		return `# AIコードレビュー: ${reviewRequest.title}

## PR情報

| 項目 | 値 |
|------|-----|
| リポジトリ | ${reviewRequest.repository} |
| PR番号 | #${reviewRequest.id} |
| 作成者 | ${reviewRequest.author} |
| URL | [PRを確認](${reviewRequest.url}) |
| ステータス | ${reviewRequest.draft ? "ドラフト" : "レビュー準備完了"} |
| 生成日時 | ${new Date().toLocaleString("ja-JP")} |

## 変更統計

| 項目 | 数 |
|------|-----|
| 変更ファイル数 | ${reviewRequest.changedFiles} |
| 追加行数 | +${reviewRequest.additions} |
| 削除行数 | -${reviewRequest.deletions} |
| レビューコメント数 | ${reviewRequest.reviewComments} |

---

${reviewResult}

---

*GitHub Review Manager AIレビュー機能により生成*
`;
	}

	private async openReviewFile(reviewRequest: ReviewRequest): Promise<void> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		let reviewsDir: string;

		if (!workspaceFolder) {
			// Use OS temp directory if no workspace is open
			const os = require("node:os");
			reviewsDir = path.join(os.tmpdir(), "github-review-manager", "reviews");
		} else {
			reviewsDir = path.join(workspaceFolder.uri.fsPath, "reviews");
		}
		const repoName = reviewRequest.repository.replace("/", "-");
		const pattern = `PR-${repoName}-${reviewRequest.id}-*.md`;

		try {
			const files = fs.readdirSync(reviewsDir);
			const reviewFile = files.find((file) => file.match(pattern.replace("*", ".*")));

			if (reviewFile) {
				const filePath = path.join(reviewsDir, reviewFile);
				const document = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(document);
			}
		} catch (error) {
			console.error("Could not open review file:", error);
		}
	}
}
