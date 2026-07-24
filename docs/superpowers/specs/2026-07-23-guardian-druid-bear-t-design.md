# 熊T职业设计规格

日期：2026-07-23

## 目标与范围

在现有多职业基础设施中加入完整的 `druid_bear_t` 职业本体：职业定义、怒气模型、16项主动技能、20项被动天赋、状态、图标、默认构筑和运行时支持。本规格不修改关卡难度；除 `public/designer-data/player_build.xlsx` 外，不修改其他策划工作簿。

## 职业定位

熊T是均衡混合型坦克，以持续物理减伤、多目标仇恨和最大生命值联动自疗为核心。熊T没有战士T的时间产怒和受击产怒；怒气只由技能成功释放和天赋事件触发获得。最大怒气为100。

“护甲”在本项目中统一简化为“只对物理伤害生效的减伤”，不引入护甲值或换算公式。临时最大生命值改变时，当前生命值按原百分比同步变化；效果结束时按比例回落。

## 解锁规则

非战士职业不参与 RD-1~6 教程拆分。熊T的前5项技能在 `RingingDeeps-6` 同时可用，对应挑战1~3的 `standard_5slot` 快照；到 `WestFall-6` 累计10项；到 `Zul'Aman-6` 累计16项。具体关卡表同步在熊T本体数据与运行时验证后执行。

## 主动技能

| 序号 | ID | 名称 | 设计数值与作用 |
| --- | --- | --- | --- |
| 1 | `druid_bear_t_growl` | 低吼 | 单体嘲讽，0怒，8秒CD，无GCD，施加公共 `taunted` 3秒。 |
| 2 | `druid_bear_t_mangle` | 裂伤 | 单体伤害与高仇恨，0怒，6秒CD，1.5秒GCD；成功释放获得20怒。 |
| 3 | `druid_bear_t_thrash` | 痛击 | 3×3范围伤害与高仇恨，0怒，8秒CD，1.5秒GCD；成功释放获得15怒。 |
| 4 | `druid_bear_t_skull_bash` | 迎头痛击 | 单体打断，10怒，12秒CD，1.5秒GCD，成功时施加公共 `countered`。 |
| 5 | `druid_bear_t_ironfur` | 铁鬃 | 35怒，无CD，无GCD；8秒内每层提供15%物理减伤，最多3层，重复施放刷新持续时间。 |
| 6 | `druid_bear_t_frenzied_regeneration` | 狂暴回复 | 35怒，24秒CD，无GCD；8秒4跳，每跳按当时最大生命值的6%治疗。控制不暂停HoT，每跳即时读取禁疗/减疗。 |
| 7 | `druid_bear_t_swipe` | 横扫 | cross范围填充伤害与仇恨，0怒，无CD，1.5秒GCD。 |
| 8 | `druid_bear_t_moonfire` | 月火术 | 单体法术，0怒，10秒CD，1.5秒GCD；施加12秒DoT，每3秒造成伤害。 |
| 9 | `druid_bear_t_barkskin` | 树皮术 | 0怒，28秒CD，无GCD；6秒内20%全伤害减伤。 |
| 10 | `druid_bear_t_survival_instincts` | 生存本能 | 0怒，90秒CD，无GCD；8秒内最大生命值提高30%，并获得20%全伤害减伤。 |
| 11 | `druid_bear_t_lunar_beam` | 明月普照 | 20怒，60秒CD，1.5秒GCD；10秒内最大生命值提高20%，每2秒治疗自身最大生命值的3%。 |
| 12 | `druid_bear_t_incarnation_ursoc` | 乌索克的化身 | 0怒，90秒CD，无GCD；12秒内最大生命值提高35%、获得20%物理减伤、仇恨提高30%。不改变其他技能公式。 |
| 13 | `druid_bear_t_rage_of_the_sleeper` | 沉睡者之怒 | 20怒，45秒CD，无GCD；8秒内自身25%全伤害减伤，并将受伤量的一部分转为对攻击者的反击伤害与仇恨。 |
| 14 | `druid_bear_t_regrowth` | 愈合 | 20怒，20秒CD，1.5秒GCD；仅对自身施放，立即治疗最大生命值的12%，再于6秒内3跳各治疗3%。 |
| 15 | `druid_bear_t_berserk` | 狂暴 | 0怒，90秒CD，无GCD；立即获得40怒，并解除自身一个可驱散控制或减速效果。 |
| 16 | `druid_bear_t_roar` | 咆哮 | 20怒，30秒CD，1.5秒GCD；对当前格及上下左右共5格施加公共 `taunted` 3秒。 |

## 被动天赋

四个Tier各5项。Tier在数据中使用0~3，与当前战士T格式一致。

| Tier | ID | 名称 | 效果 |
| --- | --- | --- | --- |
| 0 | `druid_bear_t_great_bear_vigor` | 巨熊活力 | 最大生命值提高20%。 |
| 0 | `druid_bear_t_thick_hide` | 厚皮 | 常驻8%物理减伤。 |
| 0 | `druid_bear_t_ursine_threat` | 熊威 | 熊T技能产生的仇恨提高20%。 |
| 0 | `druid_bear_t_savage_focus` | 野性专注 | 裂伤和痛击各额外获得5怒。 |
| 0 | `druid_bear_t_natural_tenacity` | 自然坚韧 | 玩家可驱散控制类减益持续时间缩短25%。 |
| 1 | `druid_bear_t_ironfur_reserve` | 铁鬃余韵 | 铁鬃状态结束后获得3秒、8%物理减伤。 |
| 1 | `druid_bear_t_blood_scent` | 血性气息 | 狂暴回复生效期间首次受到有效伤害时获得8怒，每次狂暴回复限一次。 |
| 1 | `druid_bear_t_skull_bash_instinct` | 断法本能 | 迎头痛击成功打断时获得10怒。 |
| 1 | `druid_bear_t_broken_bark` | 破盾回响 | 自身吸收盾在到期前被完全打破时获得12怒，每个盾限一次。 |
| 1 | `druid_bear_t_pack_presence` | 兽群威势 | 铁鬃达到2层时，队伍获得8%全伤害减伤。 |
| 2 | `druid_bear_t_moonlit_resolve` | 月下坚守 | 目标身上存在熊T月火术时，熊T获得5%全伤害减伤。 |
| 2 | `druid_bear_t_bark_dispelling` | 树皮净化 | 树皮术结束时解除玩家身上全部 `dispellable=true` 的减益。 |
| 2 | `druid_bear_t_regenerative_bond` | 回春羁绊 | 狂暴回复最后一跳同时治疗队伍5点生命值。 |
| 2 | `druid_bear_t_ursoc_shelter` | 乌索克庇护 | 沉睡者之怒生效时，队伍同时获得12%全伤害减伤。 |
| 2 | `druid_bear_t_wild_recovery` | 野性复原 | 自身获得有效治疗后，5秒内最大生命值提高10%；10秒内置冷却，不叠加。 |
| 3 | `druid_bear_t_regrowth_of_the_pack` | 兽群愈合 | 愈合的每次治疗同时治疗队伍相当于该次原始治疗量25%的生命值。 |
| 3 | `druid_bear_t_guardian_of_the_grove` | 林地守护者 | 熊T生命值高于80%时，队伍获得6%全伤害减伤。 |
| 3 | `druid_bear_t_feral_aftershock` | 野性余震 | 咆哮影响至少2个目标时，获得6秒12%物理减伤。 |
| 3 | `druid_bear_t_last_bear_stand` | 巨熊绝境 | 每场战斗一次，致命伤害将生命值保留为1，并获得1层铁鬃。 |
| 3 | `druid_bear_t_spring_returns` | 春风吹又生 | 累计获得每30点怒气时治疗队伍5点生命值；单次获得可跨越多个阈值。 |

## 状态与事件边界

公共状态继续复用 `taunted`、`countered`。铁鬃、狂暴回复、月火术、树皮术、生存本能、明月普照、乌索克的化身、沉睡者之怒及天赋派生状态使用 `druid_bear_t_*` 前缀。

周期治疗每跳独立应用当前禁疗与减疗；周期伤害按当前目标状态结算。最大生命值增益叠加时按加法汇总，生命百分比同步保持。物理减伤与全伤害减伤分别记录，最终乘算并限制在合理范围内。

## 默认构筑

`standard_5slot` 默认主动构筑使用低吼、裂伤、痛击、迎头痛击、铁鬃；默认被动优先巨熊活力、厚皮、野性专注。后续8槽构筑根据章节解锁从狂暴回复、横扫、树皮术和高级功能技能中补足。

## 验收

- `player_build.xlsx` 中熊T具有16项启用主动技能、20项启用被动天赋、完整效果/状态/图标/默认构筑行；职业定义在挑战快照同步前保持发布关闭，避免提前出现在UI。
- 熊T注册怒气资源为100上限、时间产怒0、受击产怒0。
- 所有启用的技能与天赋逻辑均有运行时注册，职业专属引用不跨职业。
- 铁鬃只减物理伤害；狂暴回复逐跳读取最大生命值和治疗抑制；怒气只由技能与天赋事件产生。
- 不修改 `stage_content.xlsx`、`challenge_stage_content.xlsx` 等其他策划表，直到职业本体验证完成。
