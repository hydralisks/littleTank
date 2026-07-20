/// <reference types="node" />

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { BuildIconDefinition } from '../game/encounter/encounterTypes'
import { parseEnemyWorkbook, parsePlayerBuildWorkbook } from '../game/data/workbookLoader'
import { sanitizeIconAssetKey } from './statusIconResolver'

const designerDataDir = path.resolve('public/designer-data')
const publicDir = path.resolve('public')

function expectedIconAssetPath(icon: BuildIconDefinition) {
  const folder = icon.iconType === 'skill' ? 'skill-icons' : 'status-icons'
  return path.join(publicDir, folder, `${sanitizeIconAssetKey(icon.assetKey)}.svg`)
}

function loadWorkbookIconDefinitions() {
  const enemyWorkbook = XLSX.readFile(path.join(designerDataDir, 'enemy_data.xlsx'))
  const playerBuildWorkbook = XLSX.readFile(path.join(designerDataDir, 'player_build.xlsx'))
  const challengeEncounterWorkbook = XLSX.readFile(path.join(designerDataDir, 'challenge_encounter_balance.xlsx'))

  const enemyIcons = parseEnemyWorkbook(enemyWorkbook).iconDefinitions ?? []
  const playerBuildIcons = parsePlayerBuildWorkbook(playerBuildWorkbook).iconDefinitions
  const challengeIcons = loadChallengeEncounterIconDefinitions(challengeEncounterWorkbook)

  return [...enemyIcons, ...playerBuildIcons, ...challengeIcons].filter((icon) => icon.enabled)
}

function loadChallengeEncounterIconDefinitions(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['图标资源映射']
  expect(sheet, 'challenge_encounter_balance.xlsx should include 图标资源映射').toBeTruthy()

  return XLSX.utils.sheet_to_json<BuildIconDefinition>(sheet, {
    defval: '',
    raw: false,
  })
}

describe('designer workbook icon assets', () => {
  it('has a generated temporary SVG for every enabled mapped icon asset', () => {
    const missingAssets = loadWorkbookIconDefinitions()
      .map((icon) => ({
        iconId: icon.iconId,
        assetKey: icon.assetKey,
        iconType: icon.iconType,
        filePath: expectedIconAssetPath(icon),
      }))
      .filter((entry) => !fs.existsSync(entry.filePath))

    expect(missingAssets).toEqual([])
  })
})
