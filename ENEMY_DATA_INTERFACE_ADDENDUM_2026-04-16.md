# Enemy Data Interface Addendum 2026-04-16

## 新增字段

### 敌人定义

- `counteredDurationMs`
  - 中文：被反制持续时间
  - 类型：number
  - 说明：敌人被打断成功后进入 `countered` 状态的持续时间

### 敌人技能

- `castBreakRule`
  - 中文：施法阻止规则
  - 类型：enum
  - 可选值：
    - `interruptOrControl`
    - `controlOnly`
    - `unstoppable`

## 运行规则

- `interruptOrControl`：可被打断类或控制类技能阻止
- `controlOnly`：只能被控制类技能阻止
- `unstoppable`：当前施法不可被这两类方式阻止
