import { stageAreaOrder, type StageAreaId, type StageInfo, type StageNumber } from '../game/data/stageTemplates'

export interface StageNodeLayout {
  x: string
  y: string
}

const STAGE_NODE_LAYOUT_BY_AREA_ORDER: Record<StageAreaId, Record<StageNumber, StageNodeLayout>> = {
  harbor: {
    1: { x: '10%', y: '78%' },
    2: { x: '16%', y: '68%' },
    3: { x: '24%', y: '73%' },
    4: { x: '30%', y: '60%' },
    5: { x: '24%', y: '49%' },
    6: { x: '36%', y: '45%' },
  },
  midland: {
    1: { x: '44%', y: '55%' },
    2: { x: '52%', y: '63%' },
    3: { x: '60%', y: '55%' },
    4: { x: '52%', y: '41%' },
    5: { x: '64%', y: '36%' },
    6: { x: '72%', y: '46%' },
  },
  highland: {
    1: { x: '76%', y: '32%' },
    2: { x: '84%', y: '24%' },
    3: { x: '91%', y: '33%' },
    4: { x: '84%', y: '46%' },
    5: { x: '92%', y: '56%' },
    6: { x: '86%', y: '67%' },
  },
}

const DEFAULT_LAYOUT_AREAS = Object.keys(STAGE_NODE_LAYOUT_BY_AREA_ORDER) as StageAreaId[]

export function getStageNodeLayout(stage: StageInfo): StageNodeLayout {
  const layoutByArea = STAGE_NODE_LAYOUT_BY_AREA_ORDER[stage.areaId as StageAreaId]
  if (layoutByArea?.[stage.stageNumber]) {
    return layoutByArea[stage.stageNumber]
  }

  const areaIndex = stageAreaOrder.indexOf(stage.areaId as StageAreaId)
  const fallbackArea = DEFAULT_LAYOUT_AREAS[Math.max(0, areaIndex) % DEFAULT_LAYOUT_AREAS.length] ?? DEFAULT_LAYOUT_AREAS[0]
  return STAGE_NODE_LAYOUT_BY_AREA_ORDER[fallbackArea][stage.stageNumber] ?? STAGE_NODE_LAYOUT_BY_AREA_ORDER[fallbackArea][1]
}
