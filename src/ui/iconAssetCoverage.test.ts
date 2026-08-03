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

function loadPlayerBuildIconDefinitions() {
  const workbook = XLSX.readFile(path.join(designerDataDir, 'player_build.xlsx'))
  return parsePlayerBuildWorkbook(workbook).iconDefinitions.filter((icon) => icon.enabled)
}

function loadChallengeEncounterIconDefinitions(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets['图标资源映射']
  expect(sheet, 'challenge_encounter_balance.xlsx should include 图标资源映射').toBeTruthy()

  return XLSX.utils.sheet_to_json<BuildIconDefinition>(sheet, {
    defval: '',
    raw: false,
  })
}

function normalizeBearSvgPresentation(svg: string) {
  return svg
    .replace(/<title>.*?<\/title>/g, '')
    .replace(/ data-icon-kind="[^"]+"/g, '')
    .replace(/ data-icon-key="[^"]+"/g, '')
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

  it('gives every enabled bear skill, talent, and status its own full-canvas asset', () => {
    const bearIcons = loadPlayerBuildIconDefinitions().filter((icon) =>
      icon.iconId.startsWith('druid_bear_t_') && ['skill', 'talent', 'status'].includes(icon.iconType),
    )

    expect(bearIcons.length).toBeGreaterThan(40)
    expect(new Set(bearIcons.map((icon) => icon.assetKey)).size).toBe(bearIcons.length)

    for (const icon of bearIcons) {
      const filePath = expectedIconAssetPath(icon)
      expect(fs.existsSync(filePath), `missing ${icon.iconId}: ${filePath}`).toBe(true)
      const svg = fs.readFileSync(filePath, 'utf8')

      expect(svg).toContain('data-icon-canvas="full"')
      expect(svg).toContain('data-icon-style="warrior-block"')
      expect(svg).toContain('data-icon-layer="core"')
      expect(svg).not.toContain('data-icon-layer="frame"')
      expect(svg).not.toContain('data-icon-layer="platform"')
      expect(svg).not.toContain('data-icon-layer="highlight"')
      expect(svg).not.toContain('M5 15V5h10')
      expect(svg).not.toContain('M8 57h48')
    }
  })

  it('keeps related bear skill, talent, and status artwork visually distinct', () => {
    const bearIcons = loadPlayerBuildIconDefinitions().filter((icon) =>
      icon.iconId.startsWith('druid_bear_t_') && ['skill', 'talent', 'status'].includes(icon.iconType),
    )
    const collisions: string[] = []
    const presentations = new Map<string, BuildIconDefinition>()

    for (const icon of bearIcons) {
      const svg = fs.readFileSync(expectedIconAssetPath(icon), 'utf8')
      const presentation = normalizeBearSvgPresentation(svg)
      const existing = presentations.get(presentation)

      if (existing && existing.iconType !== icon.iconType) {
        collisions.push(`${existing.assetKey} = ${icon.assetKey}`)
      } else {
        presentations.set(presentation, icon)
      }
    }

    expect(collisions).toEqual([])
  })
})
