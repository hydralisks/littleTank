# Stage Select Fixed Layout And Build Warning Design

## Goal

收紧选关地图页的布局稳定性，避免因为关卡标题、副标题、构筑规则说明或构筑冲突文案过长，导致地图比例、右侧信息框高度、按钮位置或节点点击区域被撑出屏幕。  
同时把构筑规则与当前构筑冲突从默认信息流中拆出，改为两个独立的大按钮，各自通过固定尺寸弹窗查看详细内容。

## Context

当前 [`StageSelectScreen.tsx`](/C:/codexCode/littleTank/src/ui/StageSelectScreen.tsx) 把下列内容直接堆在右侧 [`stage-brief`](/C:/codexCode/littleTank/src/ui/StageSelectScreen.tsx) 信息卡中：

- 关卡标题
- 副标题
- 区域摘要
- 重点标签
- 一句话预览
- 构筑规则说明
- 构筑预览技能/天赋
- 当前构筑冲突提示
- 进入关卡按钮

这样虽然信息完整，但存在两个问题：

1. 文案多时，右侧卡片会明显变高，整体布局比例不稳定。
2. 构筑规则与冲突提示属于“决策性细节”，不应长期占据默认视图主层级。

因此本轮不调整地图结构本身，而是收紧地图页信息密度与尺寸约束。

## User-Approved Direction

采用方案 A：

- 地图和右侧关卡信息卡片都固定尺寸
- 默认态不直接展开构筑规则与冲突明细
- 右侧卡片始终显示一个显眼的 `构筑规则` 按钮
- 若存在冲突，则在其下方额外显示一个显眼的 `当前构筑冲突` 警告按钮
- 两者都通过固定尺寸弹窗展示详情

## Scope

### In Scope

- 固定地图页主布局尺寸
- 固定右侧关卡信息卡片尺寸
- 限制默认信息区的文案增长
- 新增 `构筑规则` 大按钮
- 新增条件出现的 `当前构筑冲突` 警告按钮
- 新增两个固定尺寸弹窗
- 调整地图页信息层级与交互状态

### Out Of Scope

- 不重做地图地形与节点分布
- 不改动关卡数据结构
- 不改变构筑归一化逻辑
- 不改动战斗页中的构筑规则面板
- 不在本轮引入新的全局弹窗系统

## Recommended Approach

### Layout Strategy

地图页继续保留左右双栏：

- 左侧为地图主视觉
- 右侧为关卡简报卡片

但从“内容撑开容器”改为“容器固定，内容局部滚动/折叠/截断”。

### Why This Works

- 地图的节点位置和旗标继续依附固定容器，不会因右栏变高而产生体感抖动。
- 右栏维持稳定高度，玩家每次进入选关页都能形成固定视觉记忆。
- 构筑规则与构筑冲突转成操作入口，更符合“默认看摘要，需要时看细节”的层级设计。

## UI Design

## 1. Stage Select Shell

### 1.1 Fixed Outer Layout

[`stage-select`](/C:/codexCode/littleTank/src/styles/encounter.css) 与 [`stage-select__layout`](/C:/codexCode/littleTank/src/styles/encounter.css) 需要满足：

- 页面主容器不再随着内容无限增高
- 地图区与右侧信息区共享固定高度
- 在常见桌面分辨率下，`进入这一关` 按钮必须始终可见

推荐行为：

- 外层布局使用固定可用高度，例如继承现有 `encounter-stage` 的内部高度约束
- 地图区 `min-height: 0`
- 右栏 `min-height: 0`
- 右栏内部显式分成：
  - 固定信息区
  - 伸缩空白/滚动区
  - 固定底部行动按钮区

## 2. Stage Map

### 2.1 Fixed Ratio Map

[`stage-map`](/C:/codexCode/littleTank/src/styles/encounter.css) 需要从“纯填满剩余高度”改为“固定视觉比例”：

- 采用稳定的长宽比，例如 16:10 或接近当前观感的固定比例
- 最大高度受外层限制
- 超出时不让节点离开容器，而是缩放地图整体

目标：

- 无论右侧文案多少，所有 stage node、旗标、caption 都必须留在可点击视窗内
- 地图不允许因为右侧文本长度变化而被挤压到难以点击

### 2.2 Caption And Node Safety

地图内元素需要额外约束：

- 区域 caption 最大宽度固定
- 节点 label 最大宽度固定
- 长标题仅在选中详情区完整展示，地图节点标签保持短格式

## 3. Right Stage Brief

### 3.1 Default Visible Content

默认态只保留：

- 关卡序号与状态
- 关卡标题
- 副标题
- 区域摘要
- 基础统计标签：词缀/环境/规则/图例数量
- 本关重点标签
- 一句话预览
- `构筑规则` 按钮
- 条件出现的 `当前构筑冲突` 按钮
- `进入这一关` 按钮

以下内容从默认态移除：

- 构筑规则全文说明
- 开放键位/总点数/主动槽位明细
- 当前构筑技能/天赋预览串
- 冲突提示全文列表

### 3.2 Overflow Rules

默认态文字显示规则：

- 标题最多 2 行
- 副标题最多 2 行
- 区域摘要最多 3 行
- 一句话预览最多 3 行
- 超出部分使用截断或行裁切

目的：

- 默认态稳定，不因数据字数变化而改变主布局

## 4. Build Rule Button

### 4.1 Default State

右栏固定显示一个显眼按钮：

- 文案：`构筑规则`
- 风格：比普通标签更大、更像操作入口
- 不在按钮表面直接铺开具体规则条目

按钮默认可附带简洁状态提示，但不显示完整规则：

- 例如小字副标：`查看本关构筑限制与开放内容`

### 4.2 Build Rule Modal Content

点击后打开固定尺寸弹窗，展示：

- 规则名称
- 规则完整描述
- 总技能点
- 最大主动槽位
- 开放键位
- 强制技能
- 强制天赋
- 锁定技能
- 锁定天赋
- 允许范围摘要

如果某项为空，则显示：

- `无额外限制`

而不是直接隐藏整块，避免结构忽隐忽现。

## 5. Build Conflict Warning Button

### 5.1 Visibility Rule

只有当：

- `buildPreview.warnings.length > 0`

时才显示第二个按钮。

无冲突时：

- 不显示
- 不占位

### 5.2 Visual Style

按钮应明显区别于 `构筑规则`：

- 主体做成偏警告色
- 包含黄三角框元素
- 感叹号颜色依严重程度或统一警示色显示

当前阶段无需做多级冲突类型配色，只需显眼、可一眼识别为“有问题需要看”。

### 5.3 Conflict Modal Content

点击后打开另一个固定尺寸弹窗，仅展示：

- 冲突标题
- 当前构筑与本关规则冲突的逐条列表

每条冲突按当前已有 `warning.message` 原样展示即可。

不在该弹窗中重复展示构筑规则全文，避免信息混杂。

## 6. Modal Behavior

### 6.1 Modal Type

采用地图页内的局部弹窗，不跳转二级页面。

原因：

- 保持选关上下文
- 不打断地图浏览
- 不影响当前已选关卡
- 最容易控制固定尺寸

### 6.2 Modal Requirements

两个弹窗都必须：

- 固定宽高范围
- 内容区单独滚动
- 标题区固定
- 关闭按钮固定可见

推荐结构：

- 头部：标题 + 关闭
- 内容区：滚动
- 底部：可选关闭按钮或不单独设置底栏

### 6.3 Interaction Rules

- 点击按钮打开对应弹窗
- 关闭后回到原地图页，不改变当前选中关卡
- 同一时刻只允许一个地图详情弹窗打开
- 打开规则弹窗时，不自动联动打开冲突弹窗
- 打开冲突弹窗时，也不重复嵌入规则说明

## 7. State Model

[`StageSelectScreen.tsx`](/C:/codexCode/littleTank/src/ui/StageSelectScreen.tsx) 建议新增本地 UI 状态，例如：

- `buildInfoModal: 'none' | 'rule' | 'conflict'`

这样足够满足本轮需求，不需要上升为全局状态。

## 8. Accessibility And Input

- 键盘应可聚焦两个按钮
- `Esc` 可关闭地图详情弹窗
- 弹窗标题和内容区应具有基础语义结构
- 关闭按钮需要明确中文文案或 `aria-label`

## 9. Testing Strategy

至少补以下测试：

- 选关页在有构筑规则时始终渲染 `构筑规则` 按钮
- 当 `buildPreview.warnings.length > 0` 时渲染 `当前构筑冲突` 按钮
- 当 `buildPreview.warnings.length === 0` 时不渲染该按钮
- 点击 `构筑规则` 后显示规则弹窗内容
- 点击 `当前构筑冲突` 后显示冲突弹窗内容
- 关闭弹窗后返回默认地图页状态

如果当前项目没有选关页组件测试基础设施，也可以至少先做渲染/交互层面的最小测试，剩余通过人工验证补齐。

## 10. Risks

### Risk 1: Fixed Height Causes Internal Content Clipping

解决：

- 只固定外层尺寸
- 让弹窗内容区和右栏内部详情区单独滚动

### Risk 2: Too Many Button Styles Fragment Visual Hierarchy

解决：

- `构筑规则` 和 `当前构筑冲突` 共用同一按钮骨架
- 仅通过颜色、图标和提示语区分

### Risk 3: Current CSS Is All In One File

解决：

- 本轮优先沿用 [`encounter.css`](/C:/codexCode/littleTank/src/styles/encounter.css)
- 只在地图页相关类附近增量修改，不做无关拆分

## Result

完成后，选关页将具备：

- 固定比例地图，不因文字多少导致点位超出屏幕
- 固定尺寸右侧关卡信息卡，不再被构筑说明撑高
- 构筑规则独立入口
- 当前构筑冲突独立警告入口
- 两个固定尺寸弹窗分别承载规则详情与冲突详情
- 更稳定的地图页浏览与选关体验
