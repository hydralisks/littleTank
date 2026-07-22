# DEVELOPMENT_HANDOFF

## Critical Agent Instruction: public/ generation is opt-in only

- Do not run commands that generate or overwrite files under `public/` unless the user explicitly asks for that exact generation step.
- In particular, do not run `npm run generate:designer-data` or `node scripts/generateDesignerWorkbooks.mjs` by default.
- Treat `public/designer-data/*.xlsx` and public art/resource samples as user/planner-owned working content. Read them when needed, but do not regenerate or overwrite them without explicit user approval.

## 2026-07-22 challenge progression snapshots

- New classes follow campaign-wide skill and talent progression; their trial challenges do not have a separate unlock track.
- Every three-challenge group explicitly copies the full progression state of the campaign boss stage that unlocked it:
  - Challenge 1~3 -> `RingingDeeps-6`: 5 cumulative active skills, passive tier 1, `standard_5slot`.
  - Challenge 4~6 -> `WestFall-6`: 10 cumulative active skills, passive tier 2, `8slot_0`.
  - Challenge 7~9 -> `Zul'Aman-6`: 16 cumulative active skills, passive tier 3, `8slot_2`.
- `public/designer-data/challenge_stage_content.xlsx` now stores those explicit active-skill, passive-tier, and build-rule snapshots. `public/designer-data/challenge_encounter_balance.xlsx` has matching opening `buildRuleId` values.
- Future challenge groups should copy the explicit snapshot from the sixth stage of their unlock chapter. Runtime must not infer it from `sourceStageIdsCsv`.
- Build-rule IDs such as `standard_5slot`, `8slot_0`, and `8slot_2` are approved as class-neutral progression templates. They own points, slots, hotkeys, and inheritance only.
- The selected `classId` separately filters legal skills, talents, and default presets. Default builds resolve by `(buildRuleId, classId)`, and build normalization must receive the class explicitly.
- `构筑规则定义.classId` should become an optional compatibility field during implementation; shared template rows should not remain bound to `warrior_t`.
- Class runtime lookup must be exact; missing classes or handlers block stage entry instead of silently falling back to Warrior.
- Bear T should compose the existing resource, status, skill, and talent registries. Blood DK secondary resources belong in an explicit discriminated `classRuntime`; recent-damage healing counts only effective post-mitigation health loss.
- New-class content targets 15~17 active skills and at least 20 passive talents. Passive tiers should favor an even `5 / 5 / 5 / 5` distribution, with larger pools remaining approximately balanced across tiers.
- Balance reports must be keyed by `(stageId, classId, buildRuleId)` and must never hide a weak class behind the best cross-class result.
- Trial-group targets: learning-AI difficulty within one label of Warrior per stage, three-stage average best-pass-rate delta within 15 percentage points, `<5%` versus Warrior `>=15%` as a tool-gap blocker, and `>=85%` versus Warrior `<=69%` as an overpowered blocker.
- Fixed AI, learning AI, delta analysis, and manual three-stage clears are all required before campaign enablement. Automated analysis remains read-only.
- Delivery phases are fixed: multi-class infrastructure first, complete Bear T second, Blood DK only after Bear is stable, then the intentionally unspecified fourth class for challenges 7~9.
- Formal approved design: `docs/superpowers/specs/2026-07-22-player-tank-class-expansion-design.md`.
- Class eligibility was not changed in this data sync because Bear T and Blood DK T definitions are not yet present in `player_build.xlsx`.
- Verification: designer-data validation passed with zero warnings; 32 workbook/build tests and 2 targeted challenge runtime tests passed.

## 2026-07-21 player tank expansion architecture baseline

- The first architecture section is approved and recorded in `docs/player-tank-class-expansion-handoff.md`.
- Canonical class IDs are `warrior_t`, `druid_bear_t`, and `dk_blood_t`. Class-specific content uses the matching prefix; semantically shared statuses such as `taunted` remain canonical shared definitions.
- Chapter 1 / Ringing Deeps remains Warrior-only. Every later class is introduced through one dedicated three-challenge trial group and unlocks for campaign Chapters 2+ only after clearing all three challenges with that class.
- Current groups are Bear T on challenges 1~3, Blood DK T on challenges 4~6, and the fourth class on challenges 7~9. Future classes should append challenge 10~12, 13~15, and so on instead of adding class-specific branching.
- Use the approved split: planner-authored combat content stays in `player_build.xlsx`; a runtime class registry owns technical capabilities; a trial policy owns three-stage groups; one stage-class availability service resolves UI and encounter eligibility.
- Expected save concepts are `challengeVictoriesByClass`, `campaignUnlockedClassIds`, `selectedClassId`, and `buildsByClassId`.
- Main-campaign clear markers additionally require `campaignVictoriesByClass`; challenge and campaign victories remain separate to avoid ambiguity when challenge content reuses stage templates.
- Legacy `build` migrates to `buildsByClassId.warrior_t`. Warrior remains the default selected and permanently available class. Missing class builds initialize from that class's own default build.
- Permanent unlocks are never removed by later trial-policy changes. On load, stored unlocks are unioned with classes whose current three-stage trial records are already complete.
- Victory recording, save migration, and unlock reconciliation must all be idempotent.
- Stage entry UI uses a fixed 4-by-3, 12-slot class grid filled top-to-bottom before moving right. Unavailable buttons remain invisible while their slots preserve layout space.
- This entry documents approved design only. No production code or planner workbook was changed.

## 2026-07-20 player tank class expansion handoff

- New class expansion entry document: `docs/player-tank-class-expansion-handoff.md`.
- The next recommended feature direction is to add new tank classes after `warrior_t`, starting with Guardian Druid / 熊T, then Blood Death Knight / 死亡骑士T.
- Design stance:
  - `warrior_t`: predictive shield tank, already implemented as the baseline.
  - `druid_bear_t`: first recommended new class because it can reuse the current rage resource and most survival/stat/telemetry systems.
  - `dk_blood_t`: second recommended new class because it likely needs a recent-damage healing window, Bone Shield style stacks, and possibly a secondary rune resource.
- Important boundary: do not make the new classes direct reskins of Warrior T. The handoff doc records expected strengths, weaknesses, candidate skills, passive themes, AI strategy needs, and validation points.
- No `public/designer-data` workbook was modified for this documentation handoff. The next implementation agent should first write tests and code/data-interface support, and only edit planner workbooks if the user explicitly asks for that step.

## 2026-07-16 Zul'Aman chapter 3 balance data sync

- Current web demo reads planner workbooks at runtime from `/designer-data/*.xlsx`; after planner tables are replaced, a browser refresh is enough for the Vite demo to load the newest Chapter 3 values. Restart the dev server only if browser/static caching is suspected.
- This sync keeps main campaign and challenge data separated:
  - Story: `stage_content.xlsx`, `encounter_balance.xlsx`, `enemy_data.xlsx`, `player_build.xlsx`.
  - Challenge: `challenge_stage_content.xlsx`, `challenge_encounter_balance.xlsx`.
- Do not run `npm run generate:designer-data` for Chapter 3 balance refreshes. The correct first check is `npm run validate:designer-data`.
- `soulSensitive_status` and `soulSensitive_p_status` are stackable to 5. Reapplying the debuff refreshes the full stack duration to the current workbook duration, now verified at 7000ms; all stacks expire together when that refreshed duration elapses.
- Chapter 3 development record: `docs/zulaman-chapter3-dev.md`.

## 2026-06-02 combat stats settlement V1 and release package

- Combat settlement V1 is implemented as a five-tab result panel:
  - `坦克承伤`
  - `压力来源`
  - `打断情况`
  - `造成伤害`
  - `治疗/吸收`
- The analytics layer is intentionally separate from the state mutation queue:
  - `EncounterEvent` remains the gameplay state event queue.
  - `EncounterRuntime.combatLog` is append-only telemetry for settlement and future reports.
  - `src/game/encounter/combatStats.ts` owns aggregation via `buildEncounterStats(state)`.
- Current telemetry integration covers:
  - player skill damage
  - player auto attack damage
  - party auto attack damage
  - player skill healing
  - absorb creation
  - enemy cast start/resolution
  - enemy cast tank damage
  - enemy cast party pressure
  - enemy cast interrupt/control handling
- Current limitations:
  - No last-seconds replay.
  - Absorb records creation only, not actual consumed absorb.
  - Effective healing and overhealing are not separated yet.
  - Status, affix, and stage-rule damage/pressure are the next telemetry coverage gap.
- Development document:
  - `docs/combat-stats-settlement-dev.md`
- Release produced on 2026-06-02:
  - Installer: `release/littleTank-demo-20260602-011619-x64-setup.exe`.
  - Web/standalone zip: `release/littleTank-demo-20260602-011619.zip`.
  - Tauri raw installer: `src-tauri/target/release/bundle/nsis/Little Tank_0.0.0_x64-setup.exe`.
- Verification:
  - `npm test` -> 31 files / 316 tests passed.
  - `npm run build` -> passed.
  - `npm run desktop:build` -> passed.

## 2026-05-27 WestFall release and balance handoff

- Combat changes already in this handoff window:
  - `topLeft2x2Enemy` area targeting must apply effects to every valid enemy inside the selected 2x2 footprint; this specifically covers the Warrior T `复仇` skill in `WestFall-1`.
  - Warrior T rage now uses 3 rage per second natural regeneration.
  - Rage from taking damage is `min(5, round(damage / 5))`, with a runtime cap of 10 rage per second from damage intake.
  - Auto-attack rage should continue to honor the `血涌` passive talent.
- Release packaging should use the current planner workbooks in `public/designer-data/*.xlsx` as input, but must not regenerate or overwrite them.
- Desktop packaging path:
  - `npm run build:desktop-data` creates `src-tauri/resources/desktop-data/game-data.ltpkg` and `src-tauri/src/generated_data_pack.rs` from the current planner workbooks.
  - `npm run desktop:build` runs Tauri and produces the NSIS installer at `src-tauri/target/release/bundle/nsis/Little Tank_0.0.0_x64-setup.exe`.
  - Copy release-ready artifacts under `release/littleTank-demo-<timestamp>/`, `release/littleTank-demo-<timestamp>.zip`, and `release/littleTank-demo-<timestamp>-x64-setup.exe`.
- WestFall balance scoring:
  - `npm run analyze:balance -- --area=WestFall --sample=quick` is the preferred development refresh if full sampling is too slow.
  - Expected report files are `reports/balance/westfall-auto-scoring.md` and `reports/balance/westfall-auto-scoring.json`.
  - The scoring command is read-only for `public/designer-data/*.xlsx`, but it writes refreshed reports under `reports/balance/`.
- Release produced on 2026-05-27:
  - Installer: `release/littleTank-demo-20260527-175927-x64-setup.exe`.
  - Web/standalone zip: `release/littleTank-demo-20260527-175927.zip`.
  - WestFall `quick` scoring report: `reports/balance/westfall-auto-scoring.md`.
  - Quick diagnostic summary: WestFall-1/3/4/5/6 were `impossible` for fixed and learning AI; WestFall-2 was `expert` for fixed AI and `hard` for learning AI.

## 2026-05-21 designer icon asset rule

- When `enemy_data.xlsx` or `player_build.xlsx` changes `图标资源映射`, every enabled `assetKey` must have a matching temporary SVG before shipping a build.
- Runtime resolves mapped files by sanitizing `assetKey` with `assetKey.replace(/[^A-Za-z0-9_-]/g, '-')`, then loading:
  - `iconType=skill` from `public/skill-icons/{sanitizedAssetKey}.svg`
  - other icon types currently used by status/legend/passive display from `public/status-icons/{sanitizedAssetKey}.svg`
- Temporary icons should keep the existing placeholder style: 64x64 SVG, rounded square background, gradient fill, high-contrast center motif, and readable dark outline.
- If a new planner row only changes data and needs no runtime logic, still add the SVG and verify with `npm test -- src/ui/iconAssetCoverage.test.ts`.
- Do not solve missing icons by changing planner-owned workbook rows unless the user explicitly asks for table edits.

## 2026-05-08 demo0 active sample skills removed

- The previous auto-generated `demo0_*` active skill samples have been removed from the built-in active skill catalog, workbook generator source rows, and UI icon map.
- Current active player skill content should use planner-authored `warrior_t_*` rows from `player_build.xlsx` and the stage-prefix unlock flow.
- `demo0_sample` and some `demo0_*` passive prototype remnants may still exist for legacy compatibility; do not treat them as a signal to add new `demo0_*` active skills.
- The current `public/designer-data/player_build.xlsx` already had no `demo0_*` active skill rows when checked.
- No `public/` generator was run for this work.

## 2026-05-08 stage map area/order table-driven placement

- `stage_content.xlsx -> 关卡` now has explicit `areaId` and `order` columns.
- Current demo map still supports only the first page: `harbor / midland / highland`, each with exactly six stage slots.
- Runtime workbook loading maps `关卡.areaId` to `StageInfo.areaId` and `关卡.order` to `StageInfo.stageNumber`.
- Stage-select node coordinates are now resolved from `areaId + order`, so map placement no longer depends on the `stageId` prefix.
- Designer-data validation now requires:
  - `关卡.areaId` references `区域.areaId`.
  - `关卡.order` is an integer from 1 to 6.
  - each current demo area contains exactly `order=1..6` with no duplicates.
- `public/designer-data/stage_content.xlsx` was directly and narrowly updated to 18 stage rows. Existing planner-authored rows were preserved; missing rows were only filled with placement/unlock interface fields so built-in display copy can continue to supply blank override fields.
- No `public/` generator was run for this work.

## 2026-05-08 warrior_t planner-defined passive logic ids and party pressure decay

- Implemented the current 16 `warrior_t` passive `talentLogicId` handlers from `public/designer-data/player_build.xlsx`:
  - `reinforced_plates`
  - `defensive_stance`
  - `raise_banner`
  - `snap_interrupt`
  - `defenders_aegis`
  - `barbaric_training`
  - `bloodsurge`
  - `focused_vigor`
  - `honed_reflexes`
  - `frothing_berserker`
  - `punish`
  - `enduring_defenses`
  - `immortal_stance`
  - `booming_voice`
  - `rumbling_earth`
  - `crackling_thunder`
- Passive runtime now reads these values from `被动天赋效果` / `玩家被动状态定义` rows instead of hardcoding the planner-facing numbers in tests.
- New combat effects covered:
  - permanent defensive/immortal player buffs, including damage reduction and immortal outgoing damage reduction
  - shield wall two-charge support
  - party damage/threat multipliers and blocked passive pressure-down drift for barbaric training
  - auto-attack rage/damage bonuses
  - interrupt vulnerability, revenge refund, shield-slam punish stacks, shield-block duration extension
  - demoralizing shout rage, shockwave 3x3 upgrade, thunderstruck damage/threat override
- Party pressure now has a baseline decay rule:
  - after 10,000ms with no pressure increase, pressure decreases by 5 per 1,000ms
  - decay stops at 0
  - any pressure increase resets the timer
  - `barbaric_training` disables this passive pressure decay
- Verification during implementation:
  - `npm test -- src/game/data/playerBuildCatalog.test.ts src/game/encounter/encounterFactory.test.ts` -> 88 passed.
  - `npm test` -> 107 passed.
  - `npm run build` -> passed.
  - `npm run lint` -> passed.
  - `npm run validate:designer-data` remains read-only and currently reports the known `encounter_balance.xlsx / 开场状态 row 2 targetId=harbor-1-e02` reference error.
- No `public/` generation command was run for this work, and no workbook under `public/designer-data/` was edited.

## 2026-05-06 read-only designer data validator

- Added a read-only designer-data validation command: `npm run validate:designer-data`.
- The command reads these current planner workbooks and does not generate or overwrite anything under `public/`:
  - `public/designer-data/stage_content.xlsx`
  - `public/designer-data/encounter_balance.xlsx`
  - `public/designer-data/enemy_data.xlsx`
  - `public/designer-data/player_build.xlsx`
- Validator entry points:
  - `scripts/validateDesignerData.mjs`
  - `src/game/data/designerDataValidator.ts`
- Current checks intentionally stay concise: required sheets/headers, required key fields, duplicate IDs, enum values, numeric ranges, 5x5 enemy placement bounds, and cross-table references across stage, encounter, enemy, player build, status, icon, affix, and special-rule data.
- The validator is self-contained and avoids importing runtime combat/catalog modules, so the CLI can run directly through Node's type stripping without initializing game runtime registries.
- Current real workbook validation result:
  - `npm run validate:designer-data` runs successfully but reports 1 data error.
  - `encounter_balance.xlsx -> 开场状态` row 2 references `targetId=harbor-1-e02`, but the current `敌人布置` rows for `harbor-1` do not define that `spawnId`.
- Verification during implementation:
  - `npm test -- src/game/data/designerDataValidator.test.ts` -> 3 passed.
- No `public/` generation command was run for this work.

## 2026-05-07 passive talent effect rows and party category

- Passive talent runtime now uses `被动天赋效果` rows as planner-facing parameters.
- `被动天赋定义.talentLogicId` remains the runtime dispatch key.
- `被动天赋效果.talentLogicId` now follows the same rule as `主动技能效果.skillLogicId`: it is a note/grouping field and does not select the runtime handler.
- `playerTalentLogicRegistry` handlers receive `getTalentEffectsForTalent(talentId)` via helpers and read `valueA / valueB / statusId / skillId / targetScope` from enabled effect rows.
- Current handlers keep legacy fallback constants when a talent has no effect rows, so built-in/default data remains compatible.
- Planner-facing passive talent category enum changed from `player / skill / team` to `player / skill / party`.
- Runtime workbook loading normalizes old `category=team` to `party` for compatibility, but validator/docs now treat `party` as the correct value; current real workbooks should be manually updated by planners.
- No `public/` generation command was run for this work, and no workbook under `public/designer-data/` was edited.

## 2026-05-05 stage-prefix active skill unlock and deprecated build-rule columns removed

- Active skill unlocks now come from `stage_content.xlsx -> 关卡.unlockedActiveSkillIdsCsv`.
- `unlockedActiveSkillIdsCsv` means “new active skill IDs unlocked by this stage”; the runtime accumulates those IDs from the first stage through the current stage using `stageOrder`.
- Active skill availability is scoped to the current stage prefix, not global highest progress. Example: `midland-4` / `2-4` allows all active skills unlocked through `1-1..1-6` plus `2-1..2-4`; replaying `harbor-6` / `1-6` still strips later-area skills even after later stages were cleared.
- Removed these deprecated `player_build.xlsx -> 构筑规则定义` columns from the workbook and runtime parser:
  - `allowedActiveSkillIdsCsv`
  - `allowedTalentIdsCsv`
  - `forcedSkillIdsCsv`
  - `forcedTalentIdsCsv`
  - `lockedSkillIdsCsv`
  - `lockedTalentIdsCsv`
- Build rules now only own point budget, active-slot count, enabled hotkeys, inheritance policy, class binding, and display text.
- Future explicit workbook generation has been updated so it will not reintroduce the removed build-rule columns and will include `unlockedActiveSkillIdsCsv` in the stage sample sheet.
- No broad `public/` generation command was run for this work; workbook edits were targeted to the requested files.

## 2026-05-05 passive talent tier unlock implemented

- `PassiveTalentDefinition.tier` is now required in code and in `player_build.xlsx -> 被动天赋定义`.
- Workbook parsing now rejects passive talent definition rows whose `tier` is missing or cannot be parsed as a number, so new passive talents must declare a tier explicitly.
- Passive talent unlock order is based on the current stage, not global highest progress:
  - Non-boss stages in area X allow passive tiers up to X-1.
  - Boss stage X-6 allows passive tiers up to X before the fight starts.
  - Example: `midland-6` / `2-6` allows passive `tier0 / tier1 / tier2`; replaying `harbor-6` / `1-6` still only allows `tier0 / tier1`, even after `2-6` is completed.
- Active skill unlocks are also scoped to the current stage prefix and are now driven by `stage_content.xlsx -> 关卡.unlockedActiveSkillIdsCsv`, not by `uiOrder` groups.
- `getPassiveTalentUnlockTierForStage(stage)` and `getUnlockedActiveSkillIdsForStage(stage)` centralize the current-stage unlock rules.
- `canUseTalentInRule(buildRuleId, talentId, maxUnlockedTier)` checks both build-rule eligibility and passive tier.
- `canUseSkillInRule(buildRuleId, skillId, unlockedActiveSkillIds)` checks both build-rule eligibility and current-stage active skill unlock IDs.
- `normalizePersistedBuildForRule(..., maxUnlockedPassiveTalentTier, unlockedActiveSkillIds)` removes saved passive talents and active skills above the current stage prefix when previewing or entering a stage.
- `App`, `StageSelectScreen`, and `EncounterScreen` now pass current-stage passive tier and active skill unlock IDs into build preview, active skill selection, and passive talent selection.
- Verification:
  - `npm test -- src/game/data/playerBuildCatalog.test.ts` -> 10 passed
  - `npx tsc -b --pretty false` -> passed
- No `public/` generation command was run for this work.

## 2026-05-04 warrior_t uiOrder 9-16 implemented

- Completed runtime support for the next warrior_t active skills from `player_build.xlsx`:
  - `warrior_t_shield_slam`
  - `warrior_t_shield_reflection`
  - `warrior_t_avatar`
  - `warrior_t_shockwave`
  - `warrior_t_thunderstruck`
  - `warrior_t_rallying_cry`
  - `warrior_t_intervene`
  - `warrior_t_demoralizing_shout`
- Data baseline now includes these skills, effects, status definitions, uiOrder mapping, and icon mappings so the game still loads without workbook overrides.
- Runtime notes:
  - Shield Slam deals 15 current-target damage, uses `threatMultiplier=5`, and grants 10 rage.
  - Shield Reflection applies `shieldReflection` for 1000ms. It only consumes the next enemy skill's player-facing damage/effects; party damage/pressure from the same enemy skill still applies.
  - Shield Reflection reflected damage ignores player mitigation/buff reductions and does not generate threat. The reflected player portion also skips player debuffs and enemy post-hit tank-threat gain.
  - Avatar grants 50 rage and a 16000ms `avatar` buff with `damageMultiplierBonus=0.5`.
  - Shockwave stuns `cross` targets for 2000ms and can control eligible casts.
  - Thunderstruck damages `matrix3x3` living targets for 15 damage, uses `threatMultiplier=5`, and grants 10 rage.
  - Rallying Cry heals player and party by their own max HP * 20%.
  - Intervene applies `intervened` to `party.statuses`; the next party damage is redirected to the player and then the status is consumed.
  - Demoralizing Shout applies `demoralized` to all living enemies for 5000ms, reduces outgoing damage by 25%, and adds 20 tank threat per target.
- New runtime status fields:
  - `StatusEffect.damageMultiplierBonus`
  - `StatusEffect.outgoingDamageReductionRatio`
- Verification completed:
  - `npm test -- src/game/encounter/encounterFactory.test.ts` -> 65 passed
  - `npm test -- src/game/data/playerBuildCatalog.test.ts` -> 6 passed
  - `npm test` -> 86 passed
  - `npm run build` -> passed
  - `npm run lint` -> passed
- No `public/` generation command was run for this work.

## 2026-05-01 ignore_pain 鏈€灏忚繍琛屾椂

- `ignore_pain` 宸叉帴鍏?`playerSkillRuntimeRegistry`锛屼細璇诲彇 `涓诲姩鎶€鑳芥晥鏋?statusId / durationMs` 骞剁粰 `player.buffs` 娣诲姞鐜╁澧炵泭銆?- 鐜╁闄愭椂 buff 鐜板湪浼氬湪 `tickEncounter` 涓€掕鏃跺苟杩囨湡銆?- `ignorePain` 宸叉帴鍏ョ帺瀹舵壙浼ゆ祦绋嬶細`valueA` 鍐欏叆 `absorbRemaining`锛宍valueB` 鍐欏叆 `absorbRatio`锛涚帺瀹跺彈浼ゆ椂鎸夋瘮渚嬪惛鏀跺苟鎵ｉ櫎绛夐噺鍓╀綑鍚告敹鍊硷紝褰掗浂鍚庣Щ闄?buff銆?
## 2026-04-28 鐜╁璧勬簮绯荤粺绗竴鐗?
- 褰撳墠鍞竴姝ｅ紡鑱屼笟浠嶆槸 `warrior_t`锛岀帺瀹惰祫婧愭寜鈥滄€掓皵鈥濆鐞嗐€?- 鏂板璧勬簮绯荤粺鍏ュ彛锛?  - `src/game/encounter/playerResourceSystem.ts`
- 褰撳墠鎴樺＋T鎬掓皵瑙勫垯锛?  - 鍩虹涓婇檺 `100`
  - 鑷劧鍥炴€?`8/绉抈
  - 鍙楀嚮鍥炴€?`max(4, round(鎵垮彈鐜╁浼ゅ / 11))`
- `tickEncounter(...)` 涓嶅啀鎶?`stage.tuning.playerResourceRegenMultiplier` 涔樿繘鐜╁璧勬簮鎭㈠鍏紡銆?- 璧勬簮鍏紡鐜伴樁娈靛彧鎺ュ彈鐜╁鏋勭瓚/鐜╁鐘舵€佹柟鍚戠殑淇锛涘叧鍗°€佹晫浜恒€佽瘝缂€鑻ヤ互鍚庤褰卞搷鎬掓皵锛屽簲鍏堢粰鐜╁鏂藉姞鐘舵€侊紝鍐嶇敱鐘舵€侀€昏緫鐢熸晥銆?- `EncounterEvent` 鏂板锛?  - `player/resource-changed`
- 鎶€鑳介€昏緫鑻ヨ浜х敓鎬掓皵锛岃蛋 `playerSkillRuntimeRegistry` 鐨勮祫婧?helper 鎴栧叆闃?`player/resource-changed` 浜嬩欢銆?- `resourceCost` 鏄綋鍓嶇瓥鍒掕〃閲屽敮涓€閫氱敤鎶€鑳借祫婧愬瓧娈点€?- `resourceDelta` 涓嶅啀浣滀负 `涓诲姩鎶€鑳芥晥鏋渀 瀛楁浣跨敤锛沗player_build.xlsx` 宸查噸鏂扮敓鎴愬苟绉婚櫎璇ュ垪銆?- `涓诲姩鎶€鑳藉畾涔?skillLogicId` 鏄妧鑳介噴鏀炬椂鍞竴浣跨敤鐨勪富澶勭悊鍣ㄥ叆鍙ｃ€?- `涓诲姩鎶€鑳芥晥鏋?skillLogicId` 宸叉敹绱т负鍙€夊娉ㄥ瓧娈碉紱杩愯鏃朵富澶勭悊鍣ㄤ細鏍规嵁 `skillId` 璇诲彇鏁堟灉琛ㄥ弬鏁帮紝涓嶉€氳繃鏁堟灉琛岀殑 `skillLogicId` 鍒嗘淳澶勭悊鍣ㄣ€?- 2026-04-30锛歚playerSkillRuntimeRegistry` 鏂板鍏变韩鑼冨洿澶勭悊鍣?`taunt` / `stun`銆傝繖涓や釜鍏ュ彛浠?`涓诲姩鎶€鑳藉畾涔?targetingType` 瑙ｆ瀽鐩爣闆嗗悎锛屽啀鎶婂悓涓€鏁堟灉搴旂敤鍒版瘡涓洰鏍囷紱鏃?`taunt_single / stun_single` 缁х画淇濈暀鍏煎銆?- 2026-04-30锛歚鐜╁涓诲姩鐘舵€佸畾涔塦 鏀寔浠?xlsx 鏂板鐘舵€?ID锛沗revenge` 杩愯鏃跺鐞嗗櫒宸叉帴鍏ワ紝浼氭寜 `targetingType/targetSelector` 瑙ｆ瀽鑼冨洿锛屾寜 `valueA` 閫犳垚浼ゅ锛屽苟鎸?`damage * threatMultiplier + threatDelta` 缁撶畻浠囨仺銆?
## 2026-04-24 闃熶紞鍘嬪姏鐘舵€佸寲琛ュ厖

- `EncounterRuntime` 宸叉柊澧烇細
  - `partyStatusRuntime`
- 鏂板闃熶紞鐘舵€侀€昏緫娉ㄥ唽琛細
  - `src/game/encounter/partyStatusEffectRegistry.ts`
- 褰撳墠闃熶紞鐘舵€佸凡鏀寔锛?  - 鍥哄畾闂撮殧瑙﹀彂
  - 鍩轰簬 `lastProcessedEvents` 鐨勪簨浠惰Е鍙?- 褰撳墠宸叉帴鍏ョ殑鏍蜂緥闃熶紞鐘舵€侀€昏緫锛?  - `steady_relief`
    - 姣?`1000ms` 闄嶄綆闃熶紞鍘嬪姏 `2`
  - `steady_pressure_rise`
    - 姣?`1000ms` 鎻愰珮闃熶紞鍘嬪姏 `2`
  - `steady_pressure_rise_small`
    - 姣?`1000ms` 鎻愰珮闃熶紞鍘嬪姏 `1`
  - `skill_relief_on_use`
    - 鏈?tick 鍐呰Е鍙?`player/skill-activated` 涓旀妧鑳戒负 `warrior_t_taunt` 鏃讹紝棰濆闄嶄綆闃熶紞鍘嬪姏 `10`
- 褰撳墠闃熶紞鍘嬪姏鐨勬寔缁彉鍖栦笉鍐嶈蛋榛樿鑳屾櫙鏃堕棿婕傜Щ锛涜嫢鏌愬叧闇€瑕佹寔缁定鍘嬶紝搴斾紭鍏堥€氳繃锛?  - 鍏冲崱璇嶇紑
  - 鐗规畩瑙勫垯
  - 闃熶紞鐘舵€?- 宸茶縼绉诲嚭 `partyPressureDriftPerSecond` 鐨勬牱渚嬪ぉ璧嬶細
  - `warrior_t_pressure_valve`
  - `warrior_t_overclock_doctrine`
  - `warrior_t_field_medic`
- 杩欎簺澶╄祴鐜板湪閫氳繃 `grantedStatusIds` 鍦ㄥ紑鎴樻椂缁?`party.statuses` 闄勫姞鐘舵€侊紝鑰屼笉鏄洿鎺ユ敼鍘嬪姏婕傜Щ鍊笺€?
## 2026-04-20 鍏冲崱鐗规畩瑙勫垯鏈€灏忔敞鍐岃〃琛ュ厖

- `encounter_balance.xlsx -> 鐗规畩瑙勫垯瀹氫箟.ruleLogicId` 宸叉寮忔帴鍏ヨ繍琛屾椂娉ㄥ唽琛ㄣ€?- 娉ㄥ唽琛ㄥ叆鍙ｆ枃浠讹細
  - `src/game/encounter/stageRuleLogicRegistry.ts`
- 褰撳墠宸插疄鐜扮殑鏈€灏忔牱渚嬭鍒欙細
  - `opening_pressure_shift`
    - 鎴樻枟寮€濮嬫椂闃熶紞鍘嬪姏 `+8`
  - `periodic_reinforcement`
    - 姣?`3000ms` 缁欑涓€涓瓨娲绘晫浜烘柦鍔?`enrage-song`
  - `player_control_tax`
    - 鐜╁澶勪簬 `stunned` 鏃讹紝姣?`1000ms` 闃熶紞鍘嬪姏 `+6`
- `EncounterRuntime` 宸叉柊澧烇細
  - `stageRuleRuntime`
- 褰撳墠杩愯椤哄簭锛?  - 鍒涘缓閬亣鏃跺厛鍒濆鍖?`stageRuleRuntime`
  - `tickEncounter(...)` 涓寜瑙勫垯鎵ц `onEncounterStart / onTick / onEncounterEnd`
- 绛栧垝鍏ュ彛鏂囨。宸叉柊澧烇細
  - `鍏冲崱璁捐鍏ュ彛.md`
- 閲嶈绾﹀畾锛?  - 褰撳墠 Excel 浠嶅彧濉啓 `ruleLogicId`
  - 涓嶅紩鍏ュ崟鐙?boss 妗嗘灦
  - 鏇村鏉傜殑瑙勫垯鍙傛暟鍖栫暀寰呭悗缁户缁墿

## 2026-04-20 鍛戒护/浜嬩欢闃熷垪鎵ц妯″瀷锛圱ask 4锛?
- UI 涓嶅啀鐩存帴淇敼 `EncounterState`锛堝挨鍏舵槸 runtime 瀛楁锛夛紱鎵€鏈変氦浜掔粺涓€閫氳繃 `dispatchEncounterCommand(...)` 娲惧彂鍛戒护銆?- 鍛戒护杩涘叆 `encounter.runtime.commandQueue`锛屽苟鍦ㄥ悓涓€甯ч€氳繃 `flushEncounterCommands(...)` 鎸夐『搴忔墽琛岋紙涓嶆帹杩涙椂闂达級銆?- 鍛戒护鎵ц杩囩▼鍙礋璐ｅ仛鍐冲畾骞跺叆闃?`encounter.runtime.eventQueue`锛涢殢鍚庣敤 `drainEncounterEvents(...)` 灏嗕簨浠惰矾鐢卞埌鐘舵€佸彉鏇达紙鏂芥硶/鐘舵€?浠囨仺/姝讳骸绛夛級銆?- 澶辫触鍙嶉缁熶竴鐢辫繍琛屾椂鍐欏叆 `encounter.runtime.lastRejectedCommandMessage`锛孶I 鍙礋璐ｅ睍绀猴紱閬垮厤鍐嶅姞鈥淯I 渚ч鏍￠獙鈥濆鑷磋鍒欐紓绉汇€?- 鎵╁睍鏂瑰紡锛氭柊澧炲懡浠?浜嬩欢绫诲瀷涓庡搴?handler/system锛岃€屼笉鏄湪 `EncounterScreen.tsx` 閲岀洿鎺ユ敼杩愯鏃剁粨鏋勩€?
## 2026-04-17 閫夊叧椤靛竷灞€涓庢瀯绛戞彁绀鸿ˉ鍏?
- 鍏冲崱鍦板浘椤靛凡鏀逛负鍥哄畾鍦板浘鍖?+ 鍥哄畾鍙充晶淇℃伅鍗″竷灞€锛岄伩鍏嶆枃瀛楀灏戝鑷磋妭鐐瑰拰鎸夐挳琚尋鍑哄睆骞曘€?- 鍙充晶榛樿涓嶅啀鐩存帴灞曞紑鏋勭瓚瑙勫垯缁嗚妭锛屾敼涓猴細
  - `鏋勭瓚瑙勫垯` 鎸夐挳
  - `褰撳墠鏋勭瓚鍐茬獊` 璀﹀憡鎸夐挳锛堜粎鍦ㄦ湁鍐茬獊鏃舵樉绀猴級
- 涓や釜鎸夐挳閮藉湪鍙充晶鍗＄墖鍐呴儴鎵撳紑鍥哄畾灏哄寮圭獥锛岃€屼笉鏄烦杞埌鏂伴〉闈€?- 鏈疆鏂板绾嚱鏁版暣鐞嗗眰锛?  - `src/ui/stageSelectViewModel.ts`
  - 鍚庣画鑻ョ户缁姞鈥滄帹鑽愭瀯绛戞憳瑕?/ 鍏冲崱鍗遍櫓鏍囩 / 鍖哄煙鎽樿鏂囨鈥濈瓑灞曠ず閫昏緫锛屼紭鍏堢户缁斁杩欓噷銆?- 鏇存柊鏃ュ織鏂囦欢宸叉寮忔敼鍚嶄负锛?  - `寮€鍙戞洿鏂版棩蹇?md`

## 2026-04-17 浼ゅ鏉ユ簮妯″瀷琛ュ厖

- `EncounterRuntime.damageSources` 宸叉寮忔帴鍏ヨ繍琛屾椂銆?- 褰撳墠 source 渚у凡钀藉湴锛?  - `player_auto_attack`
  - `party_ambient_random`
- 鍏抽敭琛屼负锛?  - 鐜╁骞矨閿佸畾褰撳墠鐩爣
  - 褰撳墠鐩爣姝讳骸鍚?`currentTargetId` 褰掗浂锛屼笉鑷姩鍒囨柊鐩爣
  - 閲嶆柊閫変腑鐩爣鍚庯紝骞矨浠?ready 鎬佹仮澶?  - 闃熶紞闅忔満浼ゅ鎸?`damage 脳 1 + 0` 澧炲姞 `allyThreat`
- 鐜╁鎶€鑳戒激瀹充粐鎭ㄥ叕寮忓凡鏀逛负璇昏〃锛?  - `damage 脳 threatMultiplier + threatDelta`
- 褰撳墠宸叉帴鍏ヨ鍏紡鐨勬牱渚嬫妧鑳斤細
  - `warrior_t_burst`
  - `warrior_t_cleave`
- 鐩稿叧鍏抽敭鏂囦欢锛?  - `src/game/encounter/encounterFactory.ts`
  - `src/game/encounter/playerSkillRuntimeRegistry.ts`
  - `src/game/data/playerBuildCatalog.ts`
  - `src/game/data/workbookLoader.ts`
  - `scripts/generateDesignerWorkbooks.mjs`

## 2026-04-17 鏈€鏂颁氦鎺ヨˉ鍏?
- 鐜╁鏋勭瓚鏁版嵁鎺ュ彛宸蹭粠鍗曞眰鎶€鑳借〃锛岄噸鏋勪负鑱屼笟灞傘€佹瀯绛戣鍒欏眰銆佹妧鑳藉畾涔夊眰銆佹晥鏋滃眰銆佺姸鎬佸眰銆?- 姝ｅ紡鍙帺鑱屼笟鐜伴樁娈垫敹鏁涗负 `warrior_t`锛屼腑鏂囧悕 `鎴樺＋T`銆?- 鏃ф牱渚嬪唴瀹瑰凡缁熶竴鏀瑰悕涓?`demo0_*`锛屾墍灞炶亴涓氫负 `demo0_sample`锛屽彧淇濈暀浣滄紨绀哄弬鑰冦€?- `standard_5slot` 涓庢暀绋嬫瀯绛戣鍒欏綋鍓嶉兘缁戝畾鍒?`warrior_t`銆?- 鍚庣画鎵╁睍鐜╁鏋勭瓚鏃讹紝浼樺厛璧版敞鍐岃〃鑰屼笉鏄户缁線涓荤姸鎬佹満閲屽爢鍒嗘敮锛?  - `src/game/data/playerSkillLogicRegistry.ts`
  - `src/game/data/playerTalentLogicRegistry.ts`
  - `src/game/encounter/playerSkillRuntimeRegistry.ts`
- 鐜╁鏋勭瓚 Excel 褰撳墠鐪熷疄宸ヤ綔琛ㄤ负锛?  - `鑱屼笟瀹氫箟`
  - `鏋勭瓚瑙勫垯瀹氫箟`
  - `涓诲姩鎶€鑳藉畾涔塦
  - `涓诲姩鎶€鑳芥晥鏋渀
  - `鐜╁涓诲姩鐘舵€佸畾涔塦
  - `琚姩澶╄祴瀹氫箟`
  - `琚姩澶╄祴鏁堟灉`
  - `鐜╁琚姩鐘舵€佸畾涔塦
  - `榛樿涓诲姩鏋勭瓚`
  - `榛樿琚姩鏋勭瓚`
  - `鍥炬爣璧勬簮鏄犲皠`
- 宸查獙璇佸彲渚?UI 涓庡悗缁€昏緫澶嶇敤鐨勬煡璇㈡帴鍙ｏ細
  - `getPlayerClassDefinition`
  - `getSkillEffectsForSkill`
  - `getTalentEffectsForTalent`
- 鐜╁鎶€鑳界洰鏍囪寖鍥村凡鍦ㄤ笉鏀硅〃缁撴瀯鐨勫墠鎻愪笅鎵╁厖锛?  - `targetingType` 鏀寔 `currentEnemy / crossEnemy / matrix3x3Enemy / topLeft2x2Enemy / allEnemy / party / self`
  - `targetSelector` 鏀寔 `current / adjacent / cross / matrix3x3 / topLeft2x2 / allEnemy / party / self`
- 杩愯鏃跺凡缁忔帴鍏ョ殑鏁屾柟鍖哄煙瑙ｆ瀽鍏ュ彛浣嶄簬锛?  - `src/game/encounter/encounterFactory.ts`
  - `resolveEnemyTargetIdsBySelector(...)`
- `stun_single` 褰撳墠宸查獙璇佷細浼樺厛璇诲彇鏁堟灉灞?`targetSelector`锛屽洜姝ゅ悗缁柊澧炶寖鍥存帶鍒舵妧鑳芥椂锛屽彲鍏堝鐢ㄨ繖濂楁ā寮?- 鏈疆缁х画鎺ㄨ繘鍚庯紝浠ヤ笅涓诲姩鎶€鑳藉凡寮€濮嬬湡瀹炶鍙?`涓诲姩鎶€鑳芥晥鏋渀 琛ㄤ腑鐨勯儴鍒嗗瓧娈碉細
  - `mass_taunt`
  - `burst_single`
  - `shield_wall`
  - `shield_block`
  - `cleave_adjacent`
- `shield_block` 褰撳墠鎸夌瓥鍒掓枃鏈€滆€楁€掔墿鐞嗗噺浼?/ 鐗╃悊鍑忎激50%鈥濆疄鐜帮細
  - 閲婃斁鍚庣粰鐜╁娣诲姞 `shieldBlock` buff銆?  - 璇诲彇 `涓诲姩鎶€鑳芥晥鏋?valueB` 浣滀负鍑忎激姣斾緥锛屽綋鍓嶆牱渚?`0.5` 琛ㄧず 50%銆?  - 璇诲彇 `涓诲姩鎶€鑳芥晥鏋?durationMs` 浣滀负鎸佺画鏃堕棿锛涘綋鍓嶇瓥鍒掔洰鏍囨槸 7000ms銆?  - 鍙奖鍝?`enemy_data.xlsx -> 鏁屼汉鎶€鑳?damageType=physical` 鐨勭帺瀹舵壙浼わ紝涓嶅奖鍝?`magic`銆?- `enemy_data.xlsx -> 鏁屼汉鎶€鑳絗 鏂板 `damageType` 瀛楁锛?  - `physical`
  - `magic`
  - 鐣欑┖鏃剁▼搴忓熀绾挎寜鐗╃悊澶勭悊銆?- 杩欐剰鍛崇潃鍚庣画 agent 鑻ヨ缁х画鎶婄帺瀹舵妧鑳戒粠鎵嬪啓鍒嗘敮鎺ㄨ繘鍒拌〃椹卞姩锛屼紭鍏堝簲鎵?`playerSkillRuntimeRegistry.ts`锛岃€屼笉鏄洿鎺ユ敼 UI 鎴栧啓姝绘暟鍊笺€?- 鑻ユ枃妗ｅ拰浠ｇ爜涓嶄竴鑷达紝浠?`src/game/data/workbookLoader.ts` 鍜?`scripts/generateDesignerWorkbooks.mjs` 涓哄噯銆?
## 褰撳墠鐪熷疄鐘舵€?
椤圭洰褰撳墠鏄彲杩愯鐨勬垬鏂楀師鍨嬶紝涓嶅啀鏄潤鎬佺嚎妗嗐€? 
宸插寘鍚細

- 涓変釜鍖哄煙銆佸崄鍏叧鐨勫湴鍥鹃€夊叧
- 鎴樻枟鐣岄潰銆佹晫鏂?5x5 鍥㈤槦妗嗕綋銆佺帺瀹剁姸鎬併€侀槦浼嶇姸鎬併€佹妧鑳芥爮
- `鎶€鑳介厤缃甡 / `琚姩澶╄祴` / `鏈満鐘舵€乣 涓変釜闈㈡澘
- 鎴樻枟涓攣瀹氭瀯绛戙€佹垬鏂楀悗瑙ｉ攣
- 閫氳繃 Excel 瑕嗙洊璇诲彇鍏冲崱銆侀伃閬囥€佹晫浜哄拰鐜╁鏋勭瓚鏁版嵁

## 鏈疆瀹炵幇鐨勫叧閿彉鍖?
- 闃熶紞澹皵姒傚康宸茬Щ闄わ紝鐩稿叧鎵垮帇缁熶竴骞跺叆闃熶紞鍘嬪姏
- 鏁屼汉鏁版嵁宸叉媶涓轰笁灞傦細
  - 鏁屼汉瀹氫箟
  - 鏁屼汉鎶€鑳藉畾涔?  - 鏁屼汉鐘舵€佸畾涔夛紙鏁屾柟 Buff / 鐜╁ Debuff / 闃熶紞 Debuff锛?- 鏁屼汉瀹氫箟宸蹭笉鍐嶄娇鐢?`rotationId / threatLogicId`
- 褰撳墠鐪熷疄瀛楁鏀逛负 `skillCycleCsv / threatLogic`
- 绗簩姝ュ叧鍗℃帴鍙ｅ凡鏀逛负澶氳〃缁撴瀯锛?  - `鍏冲崱寮€鍦篳
  - `鏁屼汉甯冪疆`
  - `寮€鍦虹姸鎬乣
  - `鍏冲崱璇嶇紑缁戝畾`
  - `璇嶇紑瀹氫箟`
  - `鐗规畩瑙勫垯缁戝畾`
  - `鐗规畩瑙勫垯瀹氫箟`
- 绗笁姝ョ帺瀹舵瀯绛戞帴鍙ｅ凡姝ｅ紡钀藉湴锛?  - `player_build.xlsx`
  - `鍏冲崱寮€鍦?buildRuleId`
  - 鑱屼笟瀹氫箟
  - 涓诲姩鎶€鑳藉畾涔?/ 涓诲姩鎶€鑳芥晥鏋?/ 鐜╁涓诲姩鐘舵€佸畾涔?  - 琚姩澶╄祴瀹氫箟 / 琚姩澶╄祴鏁堟灉 / 鐜╁琚姩鐘舵€佸畾涔?  - 榛樿涓诲姩鏋勭瓚 / 榛樿琚姩鏋勭瓚
  - 鍥炬爣璧勬簮鏄犲皠
- 鐜╁鍒囨崲鍏冲崱鏃朵細榛樿缁ф壙涓婁竴鍏虫瀯绛戯紝骞舵寜鏂板叧 `buildRuleId` 鑷姩瑙勮寖鍖?- 瑙勮寖鍖栬鍒欎細浼樺厛淇濈暀涓诲姩鎶€鑳斤紝鍐嶇Щ闄や笉鍏煎鎴栬秴鐐规暟鐨勫ぉ璧?- 閫夊叧椤靛彸渚т細棰勮鏈叧鏋勭瓚瑙勫垯涓庤嚜鍔ㄨ皟鏁寸粨鏋?- 鈥滄湰鍦虹姸鎬佲€濋潰鏉垮凡鏀逛负鍙睍绀洪潪鐜╁鏉ユ簮鐘舵€侊細
  - 鏁屼汉鎶€鑳藉鑷寸殑鐘舵€?  - 鍏冲崱璇嶇紑瀵艰嚧鐨勭姸鎬?  - 鐗规畩瑙勫垯鍏宠仈鐨勭姸鎬?- 褰撳墠鎴樻枟宸叉柊澧炴殏鍋滃眰锛?  - 宸︿笂瑙掑叧鍗″悕鍙充晶 `鎴戣鍋滃仠`
  - 鎴樻枟涓?`Esc` 鍦ㄦ棤闈㈡澘鎵撳紑鏃朵篃浼氳繘鍏ュ悓鏍风殑鏆傚仠灞?  - 鏆傚仠鏃舵垬鏂楁椂闂淬€佹妧鑳藉喎鍗淬€佹晫浜烘柦娉曘€佺姸鎬佸€掕鏃躲€侀槦浼嶈嚜鍔ㄤ激瀹冲叏閮ㄥ喕缁?- 绗簩姝ュ叧鍗℃帴鍙?`鍏冲崱寮€鍦篳 鏂板浜?4 涓瓧娈电敤浜庨厤缃瘡鍏充笉鍚岀殑闃熶紞鑷姩浼ゅ锛?  - `partyAutoDamageIntervalMs`
  - `partyAutoDamageTargetCount`
  - `partyAutoDamageMin`
  - `partyAutoDamageMax`
- 鏁屼汉姝讳骸鍚庣幇鍦ㄤ細淇濈暀鍦ㄥ師 5x5 鏍煎瓙閲岋紝涓嶅啀浠庢暟缁勪腑鍒犳帀
- 姝讳骸鏁屼汉锛?  - 涓嶅啀鏂芥硶
  - 涓嶅啀鍙備笌 Tab 閫夌洰鏍?  - 涓嶅啀鎴愪负鏅€氭晫鏂圭洰鏍囨妧鑳界洰鏍?  - 涓嶅啀鎴愪负闃熶紞鑷姩浼ゅ鐩爣
- 鏁屾柟琛€鏉＄涓€琛岀幇鍦ㄦ敼涓猴細`鍚嶇О 褰撳墠HP/鏈€澶P >褰撳墠鐩爣`
- 姝讳骸鏁屼汉琛€鏉′細鏆楀寲锛屽苟棰濆鏄剧ず楝奸瓊鍥炬爣

## 鏁版嵁鍏ュ彛

### 杩愯鏃跺叆鍙?
- `src/main.tsx`
- `src/game/data/workbookLoader.ts`

### 绛栧垝鏃ュ父鍏ュ彛

- `public/designer-data/stage_content.xlsx`
- `public/designer-data/encounter_balance.xlsx`
- `public/designer-data/enemy_data.xlsx`
- `public/designer-data/player_build.xlsx`

### 浠ｇ爜鍩虹嚎

- `src/game/data/stageTemplates.ts`
- `src/game/data/encounterTemplates.ts`
- `src/game/data/enemyCatalog.ts`
- `src/game/data/playerBuildCatalog.ts`

瑙勫垯锛?
- Excel 鏈夊€硷細瑕嗙洊鍩虹嚎
- Excel 鐣欑┖锛氱户缁娇鐢ㄥ熀绾?
## 鍏抽敭鏂囦欢

- `寮€鍙戞洿鏂版棩蹇?md`
- `src/game/data/enemyCatalog.ts`
- `src/game/data/encounterTemplates.ts`
- `src/game/data/playerBuildCatalog.ts`
- `src/game/data/workbookLoader.ts`
- `src/game/encounter/encounterFactory.ts`
- `src/ui/EncounterScreen.tsx`
- `src/ui/StageSelectScreen.tsx`
- `scripts/generateDesignerWorkbooks.mjs`

## 寤鸿闃呰椤哄簭

1. `README.md`
2. `DEVELOPMENT_HANDOFF.md`
3. `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
4. `怪物设计入口.md`
5. `ENEMY_DATA_INTERFACE_SPEC.md`
6. `STAGE_DATA_INTERFACE_SPEC.md`
7. `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
8. `src/game/data/workbookLoader.ts`
9. `src/game/encounter/encounterFactory.ts`

## 褰撳墠楠岃瘉

鎺ユ墜鍓嶅彲鍏堢‘璁わ細

```powershell
npm test
npm run build
npm run lint
```

Do not include `npm run generate:designer-data` in routine verification. Run it only when the user explicitly asks to regenerate planner workbooks, because it overwrites `public/designer-data/*.xlsx`.

## 2026-05-27 接手补充

- 最新 WestFall 数据中，“鱼人在治疗”当前策划描述为回复 75 生命值。运行时 `murlocHealing_status` 已同步为 75，并由 `encounterFactory.test.ts` 覆盖。
- 当前敌方状态表还没有结构化数值字段，`EnemyStatusDefinition` 也没有 `valueA`。如果后续策划继续调整敌方状态数值，推荐先扩展敌方状态 schema，再让 `enemyStatusEffectRegistry.ts` 从结构化字段读取数值。
- 静态评分已升级为 V2 组件口径：
  - `rawThreatScore`
  - `enemySupportRisk`
  - `toolCoverageScore`
  - `adjustedThreatScore`
- `mostInjured` 治疗支援风险会折扣计算，因为 WestFall-3 已确认读条开始时锁定目标，多个治疗可能过量到同一个目标上。
- 根目录 `第二章自动评分.md` 不是脚本直接写出的文件；WestFall 自动评分先生成到 `reports/balance/westfall-auto-scoring.md`，再同步为根目录中文报告。
- 本轮最新可安装包：`release/littleTank-demo-20260527-192816-x64-setup.exe`。
- 本轮 standalone 包：`release/littleTank-demo-20260527-192816.zip`。

## 涓嬩竴姝ユ渶鍚堢悊鐨勫紑鍙戦『搴?
1. 缁х画绗笁姝ワ紝鎶婃洿澶氫富鍔ㄦ妧鑳?/ 琚姩澶╄祴鐪熸鏀规垚绾?`logicId` 椹卞姩
2. 缁?`player_build.xlsx` 澧炲姞鏇翠赴瀵岀殑鏍蜂緥鍜屽瓧娈电骇鏍￠獙
3. 绛夌瓥鍒掑～瀹?`鍏冲崱璁捐鍏ュ彛.md` 閲屽垪鍑虹殑鍏冲崱琛ㄥ悗锛屽啀鎵╃壒娈婅鍒欏弬鏁板寲
4. 鎸夊叧鍗′笌鏁屼汉绛栧垝闇€姹傜户缁噸鏋勬洿缁嗙殑鏁板€煎叆鍙?

## 2026-06-04 接手补充：状态/词缀/特殊规则参数数据驱动

- 敌方状态、玩家 Debuff、队伍 Debuff、关卡词缀、特殊规则已新增通用结构字段：`valueA`、`valueB`、`tickIntervalMs`。
- `enemy_data.xlsx` 与 `encounter_balance.xlsx` 已按当前策划描述和现有代码效果定向回填这些字段；没有运行 `npm run generate:designer-data`。
- 当前为兼容现有实装效果，保留两处描述/代码差异：
  - `disliked`/`affix_dislike` 描述写“5倍仇恨”，当前实装和本次结构字段按 3 次、3 倍填写。
  - `andThen` 描述写敌人死亡后重置 20 秒，当前实装和本次结构字段按初始 15 秒、死亡后重置 15 秒填写。
- 后续排队 2/3：
  - 2：WF4~6 机制闭环与自动评分闭环，等第一批结构字段稳定后继续校准。
  - 3：战斗统计/诊断覆盖模板，补齐状态、词缀、特殊规则触发的事件归类，供后续自动评测和学习型 AI 内部使用。
