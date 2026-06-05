---
name: rtk
description: Rust Token Killer (Codex CLI) の使用ガイドラインです。常にシェルコマンドを実行する際は rtk プレフィックスを付与します。
---

# RTK - Rust Token Killer (Codex CLI)

> [!IMPORTANT]
> **AI Agent Instructions (Antigravity 2.0)**:
> You MUST always prefix your shell/terminal command executions (e.g. `pnpm`, `git`, `wrangler`, etc.) with `rtk` (e.g. `rtk pnpm install`, `rtk git diff`), as this project enforces token-optimized CLI proxying. Do NOT skip or run raw commands directly unless explicitly bypassed with `rtk proxy <cmd>`.

**Usage**: Token-optimized CLI proxy for shell commands.

## Rule

Always prefix shell commands with `rtk`.

Examples:

```bash
rtk git status
rtk cargo test
rtk npm run build
rtk pytest -q
```

## Meta Commands

```bash
rtk gain            # Token savings analytics
rtk gain --history  # Recent command savings history
rtk proxy <cmd>     # Run raw command without filtering
```

## Verification

```bash
rtk --version
rtk gain
which rtk
```
