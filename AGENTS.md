# Working Agreements

- For simple, bounded, low-risk delegated tasks, prefer the `cheap_worker` custom subagent.
- Reserve the default main agent or higher-cost agents for architecture work, complex debugging, critical code paths, and ambiguous tasks.
- Ask delegated agents to stop and report back instead of improvising when scope expands or the task becomes high risk.
- Keep delegated tasks narrow, with explicit file ownership and clear acceptance criteria.

## Public Asset And Designer Data Safety

- Do not run commands that generate or overwrite files under `public/` unless the user explicitly asks for that exact generation step.
- In particular, do not run `npm run generate:designer-data` or `node scripts/generateDesignerWorkbooks.mjs` by default.
- Treat files under `public/designer-data/` as user/planner-owned working content. Reading them is allowed; regenerating or overwriting them requires explicit user approval.
- This rule also applies to public art/resource sample generators if added later.
