# Change Log

All notable changes to the "github-review-manager" extension will be documented in this file.

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
