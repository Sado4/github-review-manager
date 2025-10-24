import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ReviewRequest } from "../types";
import { getConfig } from "./configService";
import { GitHubService, type PRReviewsData } from "./githubService";

export interface ProjectRules {
	rulesContent: string;
	rulesFile: string;
}

export interface ReviewContext {
	prInfo: ReviewRequest;
	diff: string;
	projectRules: ProjectRules | null;
	prDescription: string;
	reviews: PRReviewsData;
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

			const context = await this.gatherReviewContext(reviewRequest);
			const reviewPrompt = this.buildReviewPrompt(context);
			await this.executeClaudeCodeReview(reviewPrompt);
		} catch (error) {
			console.error("AI Review prompt generation failed:", error);
			vscode.window.showErrorMessage(
				`AI Review prompt generation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async gatherReviewContext(reviewRequest: ReviewRequest): Promise<ReviewContext> {
		const [diff, prDescription, projectRules, reviews] = await Promise.all([
			this.githubService.fetchPRDiff(reviewRequest),
			this.githubService.fetchPRDescription(reviewRequest),
			this.findProjectRules(),
			this.githubService.fetchPRReviews(reviewRequest),
		]);

		return {
			prInfo: reviewRequest,
			diff,
			projectRules,
			prDescription,
			reviews,
		};
	}

	private async findProjectRules(): Promise<ProjectRules | null> {
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

		// Add existing reviews section
		if (context.reviews.reviews.length > 0 || context.reviews.reviewComments.length > 0) {
			prompt += `## Existing Reviews

`;

			if (context.reviews.reviews.length > 0) {
				prompt += `### Review Summaries (${context.reviews.reviews.length} review(s))
`;
				for (const review of context.reviews.reviews) {
					prompt += `
**${review.user}** (${review.state}) - ${new Date(review.submittedAt).toLocaleString()}
${review.body ? `> ${review.body}\n` : "_No comment_\n"}
`;
				}
			}

			if (context.reviews.reviewComments.length > 0) {
				prompt += `
### Line Comments (${context.reviews.reviewComments.length} comment(s))
`;
				for (const comment of context.reviews.reviewComments) {
					prompt += `
**${comment.user}** on \`${comment.path}\`${comment.line ? `:${comment.line}` : ""} - ${new Date(comment.createdAt).toLocaleString()}
\`\`\`
${comment.diffHunk}
\`\`\`
> ${comment.body}

`;
				}
			}

			prompt += "\n";
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
${context.reviews.reviews.length > 0 || context.reviews.reviewComments.length > 0 ? "6. **Existing Reviews**: Take into account the existing reviews and comments above. Avoid repeating points already made, and consider building upon or addressing those discussions." : ""}

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

		// Add existing reviews section
		if (context.reviews.reviews.length > 0 || context.reviews.reviewComments.length > 0) {
			prompt += `## 既存のレビュー

`;

			if (context.reviews.reviews.length > 0) {
				prompt += `### レビューサマリー (${context.reviews.reviews.length}件)
`;
				for (const review of context.reviews.reviews) {
					prompt += `
**${review.user}** (${review.state}) - ${new Date(review.submittedAt).toLocaleString("ja-JP")}
${review.body ? `> ${review.body}\n` : "_コメントなし_\n"}
`;
				}
			}

			if (context.reviews.reviewComments.length > 0) {
				prompt += `
### 行コメント (${context.reviews.reviewComments.length}件)
`;
				for (const comment of context.reviews.reviewComments) {
					prompt += `
**${comment.user}** の \`${comment.path}\`${comment.line ? `:${comment.line}` : ""} へのコメント - ${new Date(comment.createdAt).toLocaleString("ja-JP")}
\`\`\`
${comment.diffHunk}
\`\`\`
> ${comment.body}

`;
				}
			}

			prompt += "\n";
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
${context.reviews.reviews.length > 0 || context.reviews.reviewComments.length > 0 ? "6. **既存レビュー**: 上記の既存レビューやコメントを考慮してください。既に指摘されている点の重複を避け、それらの議論を踏まえた上での追加の観点を提供してください。" : ""}

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

			// Copy prompt to clipboard automatically
			await vscode.env.clipboard.writeText(prompt);
			fs.unlinkSync(tempFile);

			const action = await vscode.window.showInformationMessage(
				"AI review prompt generated and copied to clipboard! Paste it into your preferred AI tool for review.",
				"Open Claude.ai",
				"Done",
			);

			if (action === "Open Claude.ai") {
				vscode.env.openExternal(vscode.Uri.parse("https://claude.ai"));
			}

			return "AI review prompt generated and copied to clipboard. Please paste into your preferred AI tool to get the review.";
		} catch (error) {
			if (fs.existsSync(tempFile)) {
				fs.unlinkSync(tempFile);
			}
			throw error;
		}
	}
}
