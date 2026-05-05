# Skyblur Spec Workflow

This project is ready to use `spec-workflow` through the MCP tools.

## Dashboard

- Dashboard: http://localhost:5000
- Current project root: `/Users/usounds/Program/Skyblur`

## Required Flow

Use the MCP `spec_workflow_guide` first, then follow the workflow exactly:

1. Requirements: `.spec-workflow/specs/{spec-name}/requirements.md`
2. Design: `.spec-workflow/specs/{spec-name}/design.md`
3. Tasks: `.spec-workflow/specs/{spec-name}/tasks.md`
4. Implementation logs: `.spec-workflow/specs/{spec-name}/Implementation Logs/`

Each document phase requires a dashboard approval request. Do not proceed to the
next phase until the approval is approved and the request is deleted.

## Project Rules

- Feature/spec names should be kebab-case.
- Write requirements, design, tasks, steering documents, and implementation logs
  in Japanese unless the user explicitly requests another language.
- Use one active spec at a time.
- Prefix all shell commands with `rtk`.
- Run Next.js builds with privileged execution.
- Use ICM before work for recall and after significant work for persistent context.
- Use Serena for code navigation where it is helpful.

## Existing State

- Default templates are present in `.spec-workflow/templates/`.
- Custom templates can be added in `.spec-workflow/user-templates/`.
- No project steering documents are currently authored; create them only when
  explicitly requested.
