# Cast Break Rules Handoff

## 本轮新增数据字段

### 敌人定义表

- `counteredDurationMs`
  - 中文：被反制持续时间
  - 作用：被打断成功后进入“被反制”状态的时长

### 敌人技能表

- `castBreakRule`
  - `interruptOrControl`
  - `controlOnly`
  - `unstoppable`

### 玩家技能表

- `castStopMode`
  - `none`
  - `interrupt`
  - `control`
- `canAffectSkull`
  - `true / false`

## 已实现运行规则

- 打断成功：
  - 当前施法取消
  - 进入 `countered`
  - 技能循环前进到下一个技能
- 控制成功：
  - 当前施法取消
  - 进入控制状态
  - 控制结束后立即重读同一个技能
- 首领免控：
  - 当玩家技能 `canAffectSkull=false` 时，对 `isSkull=true` 的敌人不生效

## UI 颜色

- `interruptOrControl`：浅黄色
- `controlOnly`：浅蓝色
- `unstoppable`：浅灰色

## 当前优先检查文件

- [encounterFactory.ts](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.ts)
- [encounterFactory.test.ts](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.test.ts)
- [enemyCatalog.ts](/C:/codexCode/littleTank/src/game/data/enemyCatalog.ts)
- [playerBuildCatalog.ts](/C:/codexCode/littleTank/src/game/data/playerBuildCatalog.ts)
- [workbookLoader.ts](/C:/codexCode/littleTank/src/game/data/workbookLoader.ts)
- [EnemyRaidFrameItem.tsx](/C:/codexCode/littleTank/src/ui/EnemyRaidFrameItem.tsx)
