# Stage Map Data Boundaries

## Rule

The campaign map must render only the handcrafted story stages from
`public/designer-data/stage_content.xlsx`.

Challenge stages from `public/designer-data/challenge_stage_content.xlsx` and
challenge encounters from
`public/designer-data/challenge_encounter_balance.xlsx` are available to the
challenge mode, but they must not replace or derive live runtime data from the
campaign mode.

## Incident

Challenge-mode work introduced dynamic stage loading for the original combined
`challenge.xlsx`.
The first fix made dynamic stage overrides merge into the global stage catalog
so challenge stages no longer deleted story stages. That still left one shared
problem: `StageSelectScreen` rendered campaign nodes from the global
`stageOrder`.

Because the global order can contain non-campaign stages, challenge stages and
old generated placeholder stages such as AI-authored map nodes could overlap
with RingingDeeps, WestFall, and Zul'Aman on the campaign map.

A later regression had the same shape in encounter data: the web workbook
loader applied `encounter_balance.xlsx` first, then applied
`challenge_encounter_balance.xlsx` with the reset-style
`applyEncounterWorkbookOverrides`. That reset the global encounter catalog back
to built-in defaults before adding challenge rows, so campaign opening fields
such as `buildRuleId` stopped reflecting the values from
`encounter_balance.xlsx`.

## Current Ownership

- `stageOrder`: global lookup order for every registered stage.
- `campaignStageOrder`: campaign-only order used by the main story map,
  campaign unlocks, and campaign next-stage progression.
- `campaignStageAreaOrder`: campaign-only area order used by campaign map
  captions.
- `stage_content.xlsx`: replaces the campaign order.
- `challenge_stage_content.xlsx`: appends stages to the global catalog with
  `updateCampaignOrder: false`; this file follows the `stage_content.xlsx`
  sheet model (`区域`, `关卡`, `图例`) and may carry challenge-only metadata
  columns such as recommended difficulty and source story stages.
- `challenge_encounter_balance.xlsx`: follows the `encounter_balance.xlsx`
  sheet model and owns challenge enemy placement, opening state, affix binding,
  and special-rule binding.

## Runtime Data Boundary

Campaign runtime data is loaded from:

- `stage_content.xlsx`
- `encounter_balance.xlsx`
- shared catalogs such as `enemy_data.xlsx` and `player_build.xlsx`

Challenge runtime data is loaded from:

- `challenge_stage_content.xlsx`
- `challenge_encounter_balance.xlsx`
- shared catalogs such as `enemy_data.xlsx` and `player_build.xlsx`

Challenge encounter rows must be appended with a `Challenge-` stage-id filter.
They must not be applied through the reset-style campaign loader, because that
would clear the campaign opening, placement, affix, and special-rule bindings.

Challenge stage unlocks and UI metadata must come from explicit fields in
`challenge_stage_content.xlsx`, such as `unlockedActiveSkillIdsCsv`,
`passiveTalentUnlockTier`, `recommendedDifficulty`, `allowedClassIdsCsv`, and
`enemySummary`. `sourceStageIdsCsv` is authoring reference only; runtime code
and balance analysis must not use it to derive challenge unlocks from campaign
stages.

AI-assisted challenge generation is an offline authoring step only. If it uses
campaign monsters or encounter patterns, it must copy the intended data into
`challenge_stage_content.xlsx` and `challenge_encounter_balance.xlsx`; shipped
runtime code must not infer challenge content directly from campaign tables.

## Guardrails

- Do not render the campaign map from `stageOrder`.
- Do not use `stageOrder` for campaign unlock indices.
- Do not call reset-style encounter loading for challenge workbooks after
  campaign encounter data has been loaded.
- Challenge encounter loading must use the append-only `Challenge-` boundary.
- Challenge stage loading must not infer any gameplay data from
  `sourceStageIdsCsv`; copy the needed values into challenge-owned columns
  during offline authoring instead.
- New non-story modes must either use their own explicit entry list or append
  with `updateCampaignOrder: false`.
- If future main-story chapters 4-6 are added, keep them in
  `stage_content.xlsx`. The campaign UI should page the main map by chapter
  groups, for example page 1 showing RingingDeeps, WestFall, and Zul'Aman.

## Regression Coverage

`src/ui/StageSelectScreen.test.ts` includes a regression test that loads story
dynamic stages, then challenge dynamic stages, and verifies the campaign map
still renders only the story stages.

`src/game/data/workbookLoader.test.ts` includes regression coverage that appends
challenge encounter data and verifies campaign build rules from
`encounter_balance.xlsx` are not changed.
