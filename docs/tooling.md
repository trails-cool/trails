# Development Tooling

This project is built using AI-assisted, spec-driven development. Here are the
main tools used in the development workflow.

## cmux

**Native macOS terminal for AI coding agents**

- Website: https://cmux.dev
- GitHub: https://github.com/manaflow-ai/cmux

cmux is a native macOS terminal app purpose-built for running AI coding agents
like Claude Code. It provides vertical tabs, split panes, and smart
notifications that show which panes need attention — ideal for running multiple
Claude Code sessions in parallel across different parts of the monorepo.

Key features we use:
- Split panes for Planner and Journal development side by side
- Notification badges when a Claude Code session needs input
- Native performance (Swift/AppKit, not Electron)

## Claude Code

**AI coding assistant (CLI)**

- Website: https://claude.ai/claude-code
- Docs: https://docs.anthropic.com/en/docs/claude-code

Claude Code is the primary development tool for this project. It reads the
codebase, understands the architecture (via `CLAUDE.md`), and implements
features from OpenSpec tasks.

Key integrations:
- `CLAUDE.md` at repo root provides project context
- OpenSpec slash commands (`/opsx:propose`, `/opsx:apply`, etc.)
- Crit integration for code review

## Crit

**Inline code review tool**

- GitHub: https://github.com/tomasz-tomczyk/crit

Crit provides browser-based inline review for files and diffs. It's used in
the development workflow for reviewing architecture plans, specs, and code
changes before committing.

How we use it:
- Review architecture and design documents with inline comments
- Claude Code addresses review comments and re-opens for another round
- Iterate until the reviewer clicks "Finish Review" with no comments (approved)

Usage:
```bash
crit <file>              # Review a specific file
crit                     # Review git diff (uncommitted or branch changes)
crit share <file>        # Share a review via URL
```

## OpenSpec

**AI-native spec-driven development**

- Website: https://openspec.dev
- GitHub: https://github.com/Fission-AI/OpenSpec

OpenSpec structures the development workflow around specifications. Each feature
starts as a "change" with four artifacts:

1. **proposal.md** — Why this change is needed and what capabilities it adds
2. **design.md** — Technical decisions and architecture
3. **specs/** — Testable requirements with WHEN/THEN scenarios
4. **tasks.md** — Implementation checklist

Workflow:
```bash
# Propose a new feature (generates all artifacts)
/opsx:propose "add route sharing"

# Implement tasks from a change
/opsx:apply

# Archive when done
/opsx:archive
```

OpenSpec files live in `openspec/` at the repo root. The current active change
is `openspec/changes/phase-1-mvp/`.

## How They Work Together

```
1. Plan          cmux + Claude Code + Crit
                 Draft architecture → review with Crit → iterate

2. Specify       Claude Code + OpenSpec
                 /opsx:propose → generates proposal, design, specs, tasks

3. Implement     cmux + Claude Code + OpenSpec
                 /opsx:apply → Claude Code works through tasks
                 Run multiple sessions in cmux split panes

4. Review        Crit
                 Review changes in browser → address comments → approve

5. Ship          Claude Code
                 Commit, push, deploy
```
