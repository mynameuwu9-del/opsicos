# Contributing to Opsicos

Thank you for your interest in contributing to Opsicos! We welcome contributions from the community to help make this project even better.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Style Guide](#style-guide)

---

## Code of Conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and inclusive experience for everyone.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/opsicos.git
   cd opsicos
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/mynameuwu9-del/opsicos.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Fill in your values
   ```

---

## Development Setup

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- A Discord Application with a bot token

### Running Locally

```bash
npm run dev
```

This starts the server with `nodemon` for automatic restarts on code changes.

---

## Making Changes

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** — follow the [Style Guide](#style-guide)

3. **Test your changes** thoroughly:
   - Ensure the server starts without errors
   - Test any modified API endpoints
   - Verify Discord bot features if applicable

4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add new AI model provider support"
   ```

---

## Pull Request Process

1. **Update your branch** with the latest from upstream:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** against the `main` branch

4. In your PR description, include:
   - A clear summary of the changes
   - The motivation or issue being addressed
   - Any breaking changes
   - Screenshots for UI changes

5. **Wait for review** — a maintainer will review your PR

---

## Reporting Issues

When reporting a bug, please include:

- **Description**: Clear description of the issue
- **Steps to reproduce**: Numbered steps to reproduce the behavior
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Environment**: Node.js version, OS, MongoDB version
- **Logs**: Relevant error messages or console output

---

## Style Guide

### JavaScript

- Use `const` and `let` — never `var`
- Use `async/await` over raw Promises where possible
- Use descriptive variable and function names
- Add JSDoc comments for public functions
- Handle errors gracefully with try/catch

### Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `style:` | Code style (formatting, semicolons, etc.) |
| `refactor:` | Code restructuring without behavior changes |
| `perf:` | Performance improvements |
| `test:` | Adding or modifying tests |
| `chore:` | Maintenance tasks |

### File Organization

- **Routes** go in `src/routes/`
- **Services** (business logic) go in `src/services/`
- **Models** (Mongoose schemas) go in `src/models/`
- **Middleware** goes in `src/middleware/`
- **Utilities** go in `src/utils/`
- **Static files** go in `public/`

---

## ⚠️ Important Notes

- **Never commit secrets** — all credentials must be loaded from environment variables
- **Never commit `.env` files** — they are in `.gitignore` for a reason
- **Adding a new AI model?** Update three places:
  1. `src/services/a4fService.js` — display name maps
  2. `src/models/Bot.js` — `selectedModel` and `displayModelName` enums
  3. Custom provider config (if applicable)

---

Thank you for contributing! 🎉
