# Designer Data Validation And Balance Fast Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stronger designer-data health check and faster balance-analysis iteration tools before Chapter 3 content expands.

**Architecture:** Extend the existing workbook validator instead of adding a second validation path. Keep `analyzeBalance.mjs` as the single balance entry point, adding sample-budget aliases, stage filters, and previous-report diff output without changing combat simulation behavior.

**Tech Stack:** TypeScript, Vitest, Node ESM scripts, XLSX, existing designer workbook parsers.

---

### Task 1: Designer Data Health Summary

**Files:**
- Modify: `src/game/data/designerDataValidator.ts`
- Modify: `src/game/data/designerDataValidator.test.ts`
- Modify: `scripts/validateDesignerData.mjs`

- [ ] Add a validation summary to `DesignerDataValidationResult` with workbook row counts, stage count, placement count, issue counts by severity/code, and warning support.
- [ ] Add non-fatal warnings for stage openings without placements, stages without `strategyTips` after tutorial chapters, and stage records that have no opening config.
- [ ] Render a concise CLI health summary before listing errors.
- [ ] Verify with `npx vitest run src/game/data/designerDataValidator.test.ts`.

### Task 2: Balance Analysis Budget And Diff

**Files:**
- Modify: `scripts/analyzeBalance.mjs`
- Create: `src/game/balance/balanceReportDiff.ts`
- Create: `src/game/balance/balanceReportDiff.test.ts`
- Modify: `src/game/balance/analyzeBalanceTemplate.test.ts`

- [ ] Support `--quick` as an alias for `--sample=quick`.
- [ ] Support `--budget=quick|normal|full`; `normal` should sit between current quick and full.
- [ ] Support `--stage=<id>` as an alias for `--stages=<id>`.
- [ ] Before writing the new report, compare against the previous slug JSON if present and generate a short Markdown diff file.
- [ ] Print the selected budget and diff output path in CLI output.
- [ ] Verify with focused Vitest tests and a quick single-stage analyze run.

### Task 3: Final Verification

**Files:**
- No additional files.

- [ ] Run `npm run test -- src/game/data/designerDataValidator.test.ts src/game/balance/balanceReportDiff.test.ts src/game/balance/analyzeBalanceTemplate.test.ts`.
- [ ] Run `npm run validate:designer-data`.
- [ ] Run `npm run analyze:balance -- --stage=WestFall-1 --quick`.
- [ ] Report changed files and output paths.
