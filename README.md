# 📋 GitHub Review Manager

A Visual Studio Code extension that helps you monitor and manage GitHub pull request review requests with automatic updates, visual priority indicators, and smart notifications.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/Sado4.github-review-manager?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=Sado4.github-review-manager)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/Sado4.github-review-manager?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=Sado4.github-review-manager)

## ✨ Features

- **🎯 Smart Priority Display** - Visual priority indicators with emojis based on review urgency
- **👤 Author Avatars** - See reviewer profile pictures for quick identification
- **⏰ Time Tracking** - Shows time elapsed since last activity with urgency levels
- **🔔 Real-time Notifications** - Instant notifications with sound alerts for new review requests
- **📊 Detailed Information** - Rich tooltips with comprehensive PR details
- **🎮 Quick Actions** - One-click access to PRs and settings
- **📱 Compact Design** - Optimized for narrow sidebars with essential information
- **🔄 Auto-refresh** - Configurable update intervals (minimum 60 seconds)
- **📍 Multi-view Support** - Available in both Activity Bar and Explorer sidebar

## 🎨 Visual Priority System

The extension uses intelligent emoji indicators to show review urgency at a glance:

- 🆕 **New** - Same day (just requested)
- ⚠️ **Attention** - 1-2 days old
- 🔥 **Urgent** - 3-6 days old
- 🚨 **Critical** - 1 week+ old

### Display Format
```
🔥 Fix authentication bug    [username/repo] [Draft]
⚠️ Add new feature          [username/repo] [⚡]
🆕 Update documentation     [username/repo]
```

- `[Draft]` - Pull request is still in draft mode
- `[⚡]` - Merge conflicts detected

## 📸 Screenshots

![Screenshot showing the GitHub Review Manager in the Activity Bar with priority indicators and author avatars]

## 🚀 Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Configure your GitHub token**:
   - Open VS Code settings (`Ctrl/Cmd + ,`)
   - Search for "GitHub Review Manager"
   - Set your GitHub Personal Access Token with `repo` scope
   - [Generate a token here](https://github.com/settings/tokens)
3. **View your review requests** in the Activity Bar or Explorer sidebar

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `githubReviewManager.token` | GitHub Personal Access Token (requires `repo` scope) | `""` |
| `githubReviewManager.refreshInterval` | Auto-refresh interval in seconds | `300` (5 minutes) |
| `githubReviewManager.showNotifications` | Show notifications for new review requests | `true` |
| `githubReviewManager.playSound` | Play sound when new review requests arrive | `true` |

## 🎯 How It Works

The extension uses the GitHub Search API to find pull requests where you're requested as a reviewer:
- Searches for: `type:pr state:open review-requested:@me`
- Sorts by most recent activity (`updated` time) for relevant prioritization
- Fetches detailed information including author avatars, draft status, and change statistics
- Updates automatically based on your configured refresh interval
- Shows notifications with sound alerts for genuinely new review requests

## 📊 Rich Information Display

### Hover Tooltips
Hover over any review request to see comprehensive details:

```markdown
## 🔥 PR #123: Fix authentication bug

📅 PR Created: 2024-01-10 14:30:00
⏰ Last Activity: 2d ago (2024-01-18 16:45:00)

📁 Repository: username/awesome-project
👤 Author: developer-name

✅ Status: Ready for Review
⚠️ Mergeable: Has conflicts

📊 Changes:
- ➕ 45 additions
- ➖ 12 deletions
- 📄 5 files modified
- 💬 3 review comments

🔗 Open PR in Browser
```

### Smart Time Tracking
- Priority based on **last activity time** (more accurate than creation time)
- Shows both relative time ("2d ago") and exact timestamps
- Automatically removes completed reviews from the list

## 🔧 Commands

- `GitHub Review Manager: Refresh Review Requests` - Manually refresh the list
- `GitHub Review Manager: Open PR in Browser` - Open selected PR in your default browser

## 🎨 UI Components

### Activity Bar View
A dedicated sidebar showing all your pending review requests with:
- 👤 **Author avatars** for quick visual identification
- 🎯 **Priority emojis** indicating urgency level
- 📱 **Compact layout** optimized for narrow sidebars
- 🔄 **Smart sorting** by most recent activity

### Explorer Integration
Review requests also appear in the Explorer sidebar when you have pending items.

### Status Bar
Clean and intuitive status indicator:
- 📊 **Simple count display**: `$(git-pull-request) 3`
- 🎨 **Smart color coding**:
  - 🟡 Yellow - Any pending reviews
  - 🔴 Red - Reviews 3+ days old (urgent attention needed)
- 👆 **Click to open** review list or configuration
- 📋 **Detailed tooltip**: Urgency breakdown on hover

### Smart Notifications
- 🔔 **Instant alerts** when new reviews are requested
- 🔊 **Cross-platform sound** notifications
- 🎮 **Quick actions**: "View PR" and "Open List"
- ⏰ **Perfect timing**: sound plays with popup display

## 🔐 Privacy & Security

- Your GitHub token is stored securely in VS Code's configuration
- All API requests are made directly to GitHub - no third-party servers involved
- The extension only accesses pull requests where you're specifically requested as a reviewer

## 🐛 Troubleshooting

### "GitHub token not configured" error
Make sure you've set a valid GitHub Personal Access Token in the extension settings with `repo` scope.

### No review requests showing
- Verify your token has the correct permissions
- Check that you actually have pending review requests on GitHub
- Try refreshing manually using the refresh button

### Network/API errors
- Check your internet connection
- Verify your GitHub token is still valid
- GitHub API rate limits may apply - the extension respects these limits

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [GitHub Repository](https://github.com/Sado4/github-review-manager)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Sado4.github-review-manager)
- [Report Issues](https://github.com/Sado4/github-review-manager/issues)
