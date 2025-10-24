# Change Log

All notable changes to the "github-review-manager" extension will be documented in this file.

## [0.0.42] - 2025-10-24

### ✨ Enhanced AI Review with Existing Review Context

#### 🎯 **Context-Aware AI Reviews**
- **Existing Review Integration**: AI review prompts now include all existing review comments and discussions
- **Duplicate Prevention**: AI can avoid repeating points already made by other reviewers
- **Review Continuity**: Build upon existing discussions and feedback threads
- **Complete Context**: Includes both review summaries (approve/request changes/comment) and line-level comments

#### 🔧 **Improved Merge Commit Filtering**
- **Enhanced Detection**: Added commit message-based filtering in addition to parent count checking
- **Pattern Matching**: Filters out "Merge branch", "Merge pull request", and "Merge remote-tracking branch" commits
- **Cleaner Diffs**: Even more reliable exclusion of merge-related changes from AI review prompts
- **Debug Logging**: Added logging to track how many merge commits were filtered

#### 📊 **Review Data Structure**
- **Comprehensive Review Info**: Captures review state, author, timestamp, and full comment text
- **Line-Level Comments**: Includes file path, line number, diff hunk, and comment body
- **Multi-Language Support**: Properly formatted timestamps for both English and Japanese prompts

## [0.0.41] - 2025-06-28

### 🔧 Major Improvements - AI Review Enhancement

#### 🎯 **Smart Merge Commit Filtering**
- **Enhanced Diff Generation**: Automatically filters out merge commits to focus on actual code changes
- **Universal Base Branch Support**: Works correctly with any base branch (main, develop, feature branches)
- **Clean Code Review**: Eliminates noise from branch synchronization commits
- **Fallback Mechanism**: Graceful fallback to original method if filtering fails

#### 📝 **Improved User Experience**
- **Better Command Naming**: Changed "Request AI Review" → "Generate AI Review Prompt"
- **Universal AI Tool Support**: Updated messaging to work with any AI tool (Claude, ChatGPT, Gemini, etc.)
- **Clearer Instructions**: "Paste it into your preferred AI tool for review"
- **Simplified Workflow**: Removed progress bars and complex dialogs for streamlined experience

#### 🧹 **Code Cleanup & Optimization**
- **Removed Unused Features**: Eliminated project rules detection that was reading from wrong workspace
- **Streamlined Prompts**: Cleaner, more focused review prompts without irrelevant context
- **Better Error Messages**: More descriptive error messages for troubleshooting
- **Simplified Architecture**: Removed complex CLI integration for more reliable clipboard-only approach

#### 🎨 **UI/UX Improvements**
- **Context Menu**: Updated right-click menu text for clarity
- **Notification Messages**: Better wording for cross-platform AI tool compatibility
- **User Guidance**: Clear instructions on what to do with generated prompts

### 🔄 **Technical Changes**
- **GitHub API Integration**: Enhanced commit filtering using GitHub REST API
- **Diff Comparison**: Smart diff generation between base branch and non-merge commits
- **Error Handling**: Improved error handling with fallback mechanisms
- **Performance**: Reduced complexity by removing unused file management features

### 📱 **User Benefits**
- **Cleaner Reviews**: Focus on actual code changes, not merge commit noise
- **Flexibility**: Works with any AI tool, not just Claude
- **Reliability**: Simplified approach reduces potential failure points
- **Efficiency**: One-click prompt generation with immediate clipboard copy

## [0.0.40] - 2025-06-27

### 🤖 Major Feature - AI Review Integration

- **AI Code Review Feature**: Comprehensive AI-powered code review integration with Claude Code
  - Right-click any PR item to request detailed AI code reviews
  - Automatic context gathering: PR info, description, diff, and project rules
  - Smart project rules detection from `.cursor/rules/`, `CLAUDE.md`, `CONTRIBUTING.md`, etc.
  - Intelligent language detection for Japanese/English review output

### 🎯 Review Methods

- **📋 Clipboard Integration (Recommended)**: Copy formatted review prompts to clipboard for direct pasting into Claude Code
- **🔧 CLI Integration**: Automatic execution via `claude` command if installed locally
- **📱 Flexible Workflow**: Choose the method that fits your development environment

### 🌍 Multi-language Support

- **Japanese Language Detection**: Automatic detection of Japanese PR content with localized review prompts
- **English Language Support**: International project support with English review templates
- **Smart Context Switching**: Detects language from PR titles and descriptions using character analysis

### 📁 File Management

- **Organized Storage**: Reviews saved in `reviews/` folder with clear naming: `PR-{repo}-{number}-{timestamp}.md`
- **Rich Formatting**: Structured markdown output with tables, sections, and comprehensive PR statistics
- **Auto-cleanup**: Configurable retention period (default 30 days) with bulletproof safety validation

### ⚙️ Configuration Options

- **Retention Control**: `githubReviewManager.aiReview.retentionDays` (1-365 days)
- **Auto-cleanup Toggle**: `githubReviewManager.aiReview.autoCleanup` (enabled by default)
- **Safety Validation**: Strict pattern matching ensures only extension-generated files are managed

### 🔄 Integration Benefits

- **Context-Aware Reviews**: Includes project-specific rules and guidelines automatically
- **One-Click Workflow**: From PR list to comprehensive AI review in seconds
- **Safe File Handling**: Bulletproof cleanup with regex validation prevents accidental deletions
- **Developer-Friendly**: Works seamlessly with existing Claude Code workflows

## [0.0.32] - 2025-06-25

### 🎨 Improved - User Interface
- **Enhanced Token Management UI**: Moved "Clear GitHub Token" from right-click context menu to title bar icons
  - Both "Set GitHub Token" 🔑 and "Clear GitHub Token" 🗑️ are now easily accessible as toolbar icons
  - Improved user experience with more intuitive token management workflow
  - Eliminated confusion from having token management actions in item context menus

### 🔧 Technical
- **Menu Structure Optimization**: Streamlined menu configuration for better UI consistency
- **Better Command Organization**: Token management commands now properly grouped in navigation toolbar

## [0.0.3] - 2025-06-25

### 🎉 Update: Enhanced Security & Repository Management

This release represents a significant upgrade with improved security, better organization, and powerful filtering capabilities.

### 🔐 Added - Security Enhancements
- **Secure Token Storage**: Moved from workspace settings to VS Code's encrypted Secret Storage API
- **Token Management Commands**: 
  - `Set GitHub Token` - Secure token input with validation
  - `Clear GitHub Token` - Safe token removal
  - `Setup from Status Bar` - User-friendly guided setup flow
- **Classic Token Validation**: Automatic validation for `ghp_` format tokens
- **Enhanced Security Documentation**: Clear guidance on why Classic tokens are recommended

### 🔍 Added - Repository Filtering
- **Repository Filter Setting**: Focus on specific repositories only
  - Format: `["owner/repo1", "owner/repo2"]`
  - Smart validation with user-friendly error messages
  - Automatic cleanup of invalid entries
- **Filter Status Indicator**: 📁 icon in status bar when filtering is active
- **Enhanced Tooltips**: Shows which repositories are being filtered
- **Configuration Examples**: Detailed examples for work/personal/mixed scenarios

### 📁 Added - Repository Organization
- **Group by Repository**: New tree view organization (default: enabled)
  - Groups review requests under repository nodes
  - Shows review count per repository
  - Maintains priority sorting within groups
- **Flexible Display**: Option to disable grouping for flat list view

### 🎨 Enhanced - User Experience
- **Improved Status Bar**:
  - Filter indicator (📁) when active
  - Enhanced tooltips with setup instructions
  - Better color coding and context
- **Smart Configuration**:
  - Detailed setup instructions in tooltips
  - Validation with helpful error messages
  - Direct links to GitHub token generation
- **Better Error Handling**:
  - User-friendly validation messages
  - Automatic correction of common mistakes
  - Guided resolution workflows

### 🔧 Technical Improvements
- **Async/Await Architecture**: Modern asynchronous patterns throughout
- **Enhanced Type Safety**: Better TypeScript definitions and validation
- **Comprehensive Testing**: Updated test suite covering new features
- **Code Organization**: Improved separation of concerns and modularity

### 📚 Documentation
- **Token Comparison Table**: Classic vs Fine-grained tokens explanation
- **Configuration Examples**: Detailed use cases and setup instructions
- **Enhanced README**: Comprehensive feature documentation and troubleshooting

### 🔄 Changed
- **Token Configuration**: Removed legacy workspace setting (automatically migrated)
- **Default Behavior**: Repository grouping now enabled by default
- **Status Bar Commands**: Improved command routing and user guidance

### 🛡️ Security
- **Encrypted Storage**: All tokens now stored in VS Code's secure storage
- **No Plaintext Tokens**: Removed token storage from workspace configuration
- **Validation**: Input validation prevents common security mistakes

---

## [0.0.21] - 2025-06-21

### Added

- Added screenshots to README.md and updated explanations.

## [0.0.2] - 2025-06-21

### Added

- Fixing issues that don't work in VSCode

## [0.0.1] - 2025-06-21

### Added

- Initial release of GitHub Review Manager
- Basic GitHub review request monitoring
