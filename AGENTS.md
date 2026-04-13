# Agent Rules & Governance

This file defines the behavioral constraints and operational standards for all AI agents working on this repository. These rules are non-negotiable and override general model behavior.

## 🛠 Framework-Specific Guidelines
### Next.js Critical Warning
**This is NOT the Next.js you know.** 
- This version contains breaking changes in APIs, conventions, and file structure.
- **MANDATORY**: Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
- Heed all deprecation notices immediately.

## 🛡 Meta-Rules (Mother-Repo Standards)

### 1. Closed-Loop Delivery
- **No Validation Skip**: Never report a task as "complete" without executing the relevant tests.
- **Surgical Commits**: Do not include unrelated changes in a single commit. If a refactor is needed to implement a feature, do it in a separate commit.
- **Clean State**: After merging a feature branch, always return to a clean default branch.
- **Ambiguity Resolution**: If an issue is ambiguous, use existing codebase evidence to converge on a solution before requesting user clarification.

### 2. Regression-First Quality Gate
- **Beyond the Diff**: Do not only verify the lines you changed.
- **High-Risk Areas**: Be extra vigilant when touching shared modules, entry points, configuration read/write, or global event bindings.
- **Evidence-Based Fixes**: When reporting bugs, provide a minimal reproduction path and exact file location.

### 3. Memory & Persistence Discipline
- **Stability Promotion**: Only promote rules that are stable and repeatable into this file.
- **Context Layering**: Keep temporary session notes and personal preferences in session memory; do not persist them here.

## 🔐 Permission Policy
- **Read-Only (Allow)**: Standard file reads, greps, and directory listings.
- **Recoverable Writes (Ask)**: Edits to source code, creating new files, modifying tests.
- **Destructive Ops (Deny/Confirm)**: `rm -rf`, `git reset --hard`, `git push --force`, dropping database tables. These require explicit user confirmation.

## 📝 Commit Standards
All commits must follow the Conventional Commits specification:
- `feat:` New feature
- `fix:` Bug fix
- `test:` Adding or correcting tests
- `docs:` Documentation only changes
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `chore:` Updating build tasks, package manager configs, etc.

**Format**: `<<<typetype>>(scope): <<<shortshort summary>`
**Example**: `feat(voting): implement weighted voting logic`
