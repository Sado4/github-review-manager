import { Octokit } from "@octokit/rest";
import type { ReviewRequest } from "../types";

export class GitHubService {
	private octokit: Octokit | null = null;

	constructor(token?: string) {
		if (token) {
			this.octokit = new Octokit({ auth: token });
		}
	}

	updateToken(token: string): void {
		this.octokit = new Octokit({ auth: token });
	}

	isConfigured(): boolean {
		return this.octokit !== null;
	}

	async fetchReviewRequests(): Promise<ReviewRequest[]> {
		if (!this.octokit) {
			throw new Error("GitHub token not configured");
		}

		try {
			const { data: searchResults } = await this.octokit.rest.search.issuesAndPullRequests({
				q: "type:pr state:open review-requested:@me",
				sort: "updated",
				order: "desc",
			});

			const detailedRequests: ReviewRequest[] = [];

			for (const item of searchResults.items) {
				try {
					const [owner, repo] = item.repository_url.split("/").slice(-2);
					const { data: prDetail } = await this.octokit.rest.pulls.get({
						owner,
						repo,
						pull_number: item.number,
					});

					const { data: reviewComments } = await this.octokit.rest.pulls.listReviewComments({
						owner,
						repo,
						pull_number: item.number,
					});

					detailedRequests.push({
						id: item.number,
						title: item.title,
						url: item.html_url,
						repository: `${owner}/${repo}`,
						author: item.user?.login || "Unknown",
						authorAvatarUrl: item.user?.avatar_url || "",
						createdAt: item.created_at,
						updatedAt: item.updated_at,
						draft: prDetail.draft || false,
						mergeable: prDetail.mergeable,
						additions: prDetail.additions || 0,
						deletions: prDetail.deletions || 0,
						changedFiles: prDetail.changed_files || 0,
						reviewComments: reviewComments.length,
					});
				} catch (error) {
					console.error(`Error fetching details for PR #${item.number}:`, error);
					// Fallback to basic information
					detailedRequests.push({
						id: item.number,
						title: item.title,
						url: item.html_url,
						repository: item.repository_url.split("/").slice(-2).join("/"),
						author: item.user?.login || "Unknown",
						authorAvatarUrl: item.user?.avatar_url || "",
						createdAt: item.created_at,
						updatedAt: item.updated_at,
						draft: false,
						mergeable: null,
						additions: 0,
						deletions: 0,
						changedFiles: 0,
						reviewComments: 0,
					});
				}
			}

			return detailedRequests;
		} catch (error) {
			console.error("Error fetching review requests:", error);
			throw error;
		}
	}

	async fetchPRDiff(reviewRequest: ReviewRequest): Promise<string> {
		if (!this.octokit) {
			throw new Error("GitHub token not configured");
		}

		try {
			const [owner, repo] = reviewRequest.repository.split("/");

			// Get PR details to get base and head SHA
			const { data: prDetail } = await this.octokit.rest.pulls.get({
				owner,
				repo,
				pull_number: reviewRequest.id,
			});

			// Get commits to filter out merge commits
			const { data: commits } = await this.octokit.rest.pulls.listCommits({
				owner,
				repo,
				pull_number: reviewRequest.id,
			});

			// Filter out merge commits (commits with more than 1 parent)
			const nonMergeCommits = commits.filter((commit) => commit.parents.length <= 1);

			if (nonMergeCommits.length === 0) {
				return "No non-merge commits found in this PR.";
			}

			// Get diff from base to last non-merge commit
			const lastCommitSha = nonMergeCommits[nonMergeCommits.length - 1].sha;
			const { data: diff } = await this.octokit.rest.repos.compareCommits({
				owner,
				repo,
				base: prDetail.base.sha,
				head: lastCommitSha,
				mediaType: {
					format: "diff",
				},
			});

			return diff as unknown as string;
		} catch (error) {
			console.error(`Error fetching diff for PR #${reviewRequest.id}:`, error);
			// Fallback to original method if comparison fails
			try {
				const [owner, repo] = reviewRequest.repository.split("/");
				const { data: prDiff } = await this.octokit.rest.pulls.get({
					owner,
					repo,
					pull_number: reviewRequest.id,
					mediaType: {
						format: "diff",
					},
				});
				return prDiff as unknown as string;
			} catch (fallbackError) {
				console.error(`Fallback method also failed for PR #${reviewRequest.id}:`, fallbackError);
				throw new Error(
					`Failed to fetch PR diff: ${error instanceof Error ? error.message : String(error)}. Fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
				);
			}
		}
	}

	async fetchPRDescription(reviewRequest: ReviewRequest): Promise<string> {
		if (!this.octokit) {
			throw new Error("GitHub token not configured");
		}

		try {
			const [owner, repo] = reviewRequest.repository.split("/");
			const { data: prDetail } = await this.octokit.rest.pulls.get({
				owner,
				repo,
				pull_number: reviewRequest.id,
			});

			return prDetail.body || "";
		} catch (error) {
			console.error(`Error fetching description for PR #${reviewRequest.id}:`, error);
			throw error;
		}
	}
}
