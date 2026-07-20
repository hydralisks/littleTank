# Strategy Tips Sensitivity Design

## Goal

Add an internal diagnostic flow that measures how much the learning AI pass rate drops on story chapters 1-2 when stage `strategyTips` are lightly ignored, fully ignored, or intentionally violated.

## Scope

The first version covers `RingingDeeps-1` through `RingingDeeps-6` and `WestFall-1` through `WestFall-6`. It is an internal balance/planning report only. It must not change player-facing UI, normal story balance reports, runtime combat behavior, or designer workbooks.

## Approach

The diagnostic compares four learning AI runs for each stage:

- `baseline`: current learning AI behavior with strategy-tip build candidates and normal tip-aware tactical filtering.
- `low_attention`: keeps the original tips visible to tactical filtering, but removes strategy-tip-prioritized build candidates.
- `ignored`: clears `strategyTips` for the learning run and removes strategy-tip-prioritized build candidates.
- `violated`: clears `strategyTips`, removes or penalizes mechanically detectable tip-aligned build/tactic choices, and falls back to `ignored` when no reliable violation target exists.

Each degraded mode is compared against `baseline` by absolute pass-rate drop in percentage points and relative drop. The main dependency label uses the `ignored` drop:

- `low`: ignored drop below 10pp.
- `medium`: ignored drop from 10pp to below 25pp.
- `high`: ignored drop from 25pp to below 45pp.
- `critical`: ignored drop at least 45pp, or baseline is meaningfully passable while ignored is near zero.

## Tip Signal Classification

The analyzer does not attempt broad natural-language understanding. It classifies only explicit, mechanically useful signals:

- passive-heavy build direction: mentions passive talents, tier 2, giving up active skills, or freeing points.
- interrupt/control priority: mentions interrupt, control, channeling, or enemy cast names.
- defensive timing: mentions damage reduction, Shield Wall, Ignore Pain, Shield Block, or enemy burst windows.
- spell reflect: mentions Shield Reflection, reflect, lightning, missile, or spell handling.
- priority kill/focus: mentions priority kill, focus fire, high-damage enemies, healers, or low-health finishing.
- AOE/positioning: mentions Revenge, AOE, group damage, or covering more targets.
- mechanic chain: mentions linked mechanics such as Wax Statue and Shadow Hoe.
- resource/absorb upkeep: mentions rage, absorb coverage, or Ignore Pain uptime.

These signals drive violated-mode exclusions and report notes.

## Data Flow

1. Load story designer workbooks read-only.
2. For each target stage, run the same fixed-AI phase used by the current balance analyzer once to obtain ordinary build candidates.
3. Build the learning candidate set for each attention mode.
4. Run `runLearningStageBalanceAnalysis` with the same sample budget for each mode.
5. Store only compact result data: selected builds, selected strategies, best pass rate, drop values, labels, and notes.
6. Write Markdown and compact JSON reports under `reports/strategy_tips/story/`.

## Report Output

Generate:

- `reports/strategy_tips/story/第一章策略提示敏感性.md`
- `reports/strategy_tips/story/第二章策略提示敏感性.md`
- Optional compact JSON files with the same basename.

Markdown starts with a concise summary of high-dependency stages, then a per-stage comparison table and brief notes explaining which strategy-tip signals were detected.

## Runtime Controls

The script supports `--quick`, `--sample=normal`, and `--sample=full`, matching existing analyzer vocabulary. The default is `normal`, because each stage runs multiple learning passes. Designers can rerun high-variance stages with `--sample=full`.

## Non-Goals

- Do not expose this diagnostic to players.
- Do not change default `npm run analyze:balance` conclusions.
- Do not overwrite or regenerate files under `public/`.
- Do not require trace JSON by default.
