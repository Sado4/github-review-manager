export interface ReviewRequest {
	id: number;
	title: string;
	url: string;
	repository: string;
	author: string;
	authorAvatarUrl: string;
	createdAt: string;
	updatedAt: string;
	draft: boolean;
	mergeable: boolean | null;
	additions: number;
	deletions: number;
	changedFiles: number;
	reviewComments: number;
}

export interface GitHubConfig {
	token: string;
	refreshInterval: number;
	showNotifications: boolean;
	playSound: boolean;
}

export interface NotificationOptions {
	message: string;
	reviewRequest?: ReviewRequest;
	showSettings?: boolean;
}

export interface StatusBarInfo {
	total: number;
	urgent: number; // 1+ week old
	high: number; // 3+ days old
	medium: number; // 1+ days old
	new: number; // today
}
