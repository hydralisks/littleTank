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

  const enemyIcons = parseEnemyWorkbook(enemyWorkbook).iconDefinitions ?? []
  const playerBuildIcons = parsePlayerBuildWorkbook(playerBuildWorkbook).iconDefinitions

  return [...enemyIcons, ...playerBuildIcons].filter((icon) => icon.enabled)
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
