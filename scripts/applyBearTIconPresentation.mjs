import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  XLSX,
  readDesignerWorkbook,
} from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')
const skillIconDir = path.join(projectRoot, 'public', 'skill-icons')
const statusIconDir = path.join(projectRoot, 'public', 'status-icons')
const workbook = readDesignerWorkbook(workbookPath)
const iconSheetName = '图标资源映射'
const iconSheet = workbook.Sheets[iconSheetName]

if (!iconSheet?.['!ref']) throw new Error(`Missing sheet: ${iconSheetName}`)

const range = XLSX.utils.decode_range(iconSheet['!ref'])
const columns = new Map()
for (let col = range.s.c; col <= range.e.c; col += 1) {
  const address = XLSX.utils.encode_cell({ r: range.s.r, c: col })
  columns.set(String(iconSheet[address]?.v ?? ''), col)
}

for (const header of ['iconId', 'assetKey', 'iconType', 'enabled']) {
  if (!columns.has(header)) throw new Error(`Missing ${iconSheetName}.${header}`)
}

function readCell(row, header) {
  const col = columns.get(header)
  return iconSheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function isEnabled(value) {
  return value === true || String(value).toUpperCase() === 'TRUE'
}

function getAssetKey(iconId, iconType) {
  let slug = iconId
    .replace(/^druid_bear_t_/, '')
    .replace(/_pic$/, '')
  if (iconType === 'status') slug = slug.replace(/_status$/, '')
  return `bear-${iconType}-${slug.replaceAll('_', '-')}`
}

const targetRows = []
for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
  const iconId = String(readCell(row, 'iconId'))
  const iconType = String(readCell(row, 'iconType'))
  if (
    iconId.startsWith('druid_bear_t_') &&
    ['skill', 'talent', 'status'].includes(iconType) &&
    isEnabled(readCell(row, 'enabled'))
  ) {
    targetRows.push({ row, iconId, iconType, assetKey: getAssetKey(iconId, iconType) })
  }
}

if (targetRows.length !== 53) {
  throw new Error(`Expected 53 enabled Bear T skill/talent/status icons, found ${targetRows.length}`)
}
if (new Set(targetRows.map(({ iconId }) => iconId)).size !== targetRows.length) {
  throw new Error('Bear T iconId values must be unique')
}
if (new Set(targetRows.map(({ assetKey }) => assetKey)).size !== targetRows.length) {
  throw new Error('Generated Bear T assetKey values must be unique')
}

for (const target of targetRows) {
  const currentAssetKey = String(readCell(target.row, 'assetKey'))
  if (currentAssetKey !== target.assetKey) {
    throw new Error(`Unexpected assetKey for ${target.iconId}: ${currentAssetKey}`)
  }
}

const palettes = {
  moon: ['#101d38', '#285a82', '#b7ecff', '#69bff4'],
  rage: ['#351713', '#873725', '#ffd083', '#f06a45'],
  nature: ['#102b24', '#23664d', '#c8f5a5', '#57d49a'],
  guard: ['#17262a', '#35616a', '#d8f2df', '#76c9b2'],
  neutral: ['#172329', '#31505a', '#e3f2d1', '#7bd5a5'],
}

function paletteFor(slug) {
  if (/moon|lunar/.test(slug)) return palettes.moon
  if (/rage|berserk|feral|thrash|mangle|roar|pain/.test(slug)) return palettes.rage
  if (/bark|grove|natural|spring|regrowth|regen|wild/.test(slug)) return palettes.nature
  if (/iron|survival|thick|shelter|immunity|hide/.test(slug)) return palettes.guard
  return palettes.neutral
}

const glyphs = {
  growl: '<path d="M20 38c2-11 7-17 12-17s10 6 12 17"/><path d="M24 24l-5-8 10 4m11 4 5-8-10 4"/><path d="M28 36c3 3 5 3 8 0m-2-5h-4"/><path d="M47 25c4 2 6 5 7 9m-8 2c4 1 7 4 8 7"/>',
  mangle: '<path d="M18 48L42 16m-14 34 22-29M16 37l18-23"/><path d="M18 51l-5-9 8 1m9 9-6-9 8 1m10-12 8 1-5-8"/>',
  thrash: '<path d="M46 23c-8-9-25-4-24 8 1 10 15 13 20 5 4-7-6-13-12-8-5 4 1 11 6 7"/><path d="M17 18l6 2-1-6m25 32-6-2 1 6"/>',
  'skull-bash': '<path d="M21 29c0-9 5-15 11-15s11 6 11 15c0 6-3 9-7 11v7h-8v-7c-4-2-7-5-7-11Z"/><path d="M26 30h2m8 0h2m-9 8h6M19 18l-6-6m32 6 6-6"/>',
  ironfur: '<path d="M18 21l14-8 14 8-3 24-11 7-11-7Z"/><path d="M22 24h20m-21 8h22m-19 8h16M32 16v32"/>',
  'frenzied-regeneration': '<path d="M32 48S16 39 16 27c0-9 12-12 16-4 4-8 16-5 16 4 0 12-16 21-16 21Z"/><path d="M23 34h6l3-8 4 13 3-5h5"/>',
  swipe: '<path d="M17 44c9-1 19-8 26-20m-25 10c9-1 17-6 22-15m-20 6c6-1 11-4 15-10"/><path d="M42 22l3-7 4 7m-10 9 4-7 5 5m-13 11 2-8 6 4"/>',
  moonfire: '<path d="M39 14c-12 3-16 19-6 27 5 4 11 4 16 1-4 7-11 11-19 9-11-3-16-15-11-25 4-8 12-13 20-12Z"/><path d="M43 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
  barkskin: '<path d="M26 13h12l5 11-4 27H25l-4-27Z"/><path d="M32 15v34m-9-22 8 5-7 8m17-14-8 6 7 9"/>',
  'survival-instincts': '<path d="M32 12l17 7v11c0 11-6 18-17 23-11-5-17-12-17-23V19Z"/><path d="M24 34l6 6 11-15"/>',
  'lunar-beam': '<path d="M39 13c-9 2-12 13-6 19 4 3 8 4 12 1-3 6-10 9-16 6-8-4-9-15-3-21 4-4 8-6 13-5Z"/><path d="M21 43v9m11-11v13m11-14v11"/>',
  'incarnation-ursoc': '<path d="M20 45V27l7-10 5 6 5-6 7 10v18l-12 8Z"/><path d="M20 29l-7-8 11 2m20 6 7-8-11 2M27 35h2m6 0h2m-8 8h6"/>',
  'rage-of-the-sleeper': '<path d="M13 32s7-12 19-12 19 12 19 12-7 12-19 12S13 32 13 32Z"/><circle cx="32" cy="32" r="6"/><path d="M32 10v5m0 34v5M10 32h5m34 0h5"/>',
  regrowth: '<path d="M32 52V29"/><path d="M31 35c-12 0-15-8-14-15 9 0 16 4 14 15Zm2-7c1-10 8-14 16-13 0 8-4 14-16 13Z"/><path d="M23 45h18"/>',
  berserk: '<path d="M33 52c-11 0-18-7-16-17 1-7 8-10 8-19 7 4 9 10 8 16 4-3 7-7 7-12 8 7 10 15 6 23-3 6-7 9-13 9Z"/><path d="M31 47c-5-2-6-7-3-11 2 3 5 4 6 8 2-2 3-4 3-7 4 5 2 10-6 10Z"/>',
  roar: '<path d="M18 42V24l8-8 6 6 6-6 8 8v18l-14 10Z"/><path d="M26 32h2m8 0h2m-10 8h8M49 24c4 2 6 5 7 9m-7 4c3 1 5 3 6 6"/>',
  'great-bear-vigor': '<path d="M32 49S17 41 17 29c0-9 11-11 15-4 4-7 15-5 15 4 0 12-15 20-15 20Z"/><circle cx="24" cy="17" r="3"/><circle cx="32" cy="14" r="3"/><circle cx="40" cy="17" r="3"/>',
  'thick-hide': '<path d="M17 22l15-9 15 9-3 22-12 8-12-8Z"/><path d="M22 25l10-6 10 6-2 15-8 6-8-6Z"/><path d="M27 28l5-3 5 3-1 9-4 3-4-3Z"/>',
  'ursine-threat': '<path d="M21 40c0-8 5-14 11-14s11 6 11 14c0 7-5 11-11 11s-11-4-11-11Z"/><circle cx="20" cy="23" r="4"/><circle cx="28" cy="17" r="4"/><circle cx="37" cy="17" r="4"/><circle cx="45" cy="23" r="4"/><path d="M32 9V5m-18 9-3-3m39 3 3-3"/>',
  'savage-focus': '<circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="8"/><path d="M32 8v10m0 28v10M8 32h10m28 0h10M27 37l10-10"/>',
  'pain-immunity': '<path d="M32 12l16 7v12c0 11-6 17-16 22-10-5-16-11-16-22V19Z"/><path d="M36 18l-7 13 7 4-8 13"/>',
  'iron-thorns': '<circle cx="32" cy="32" r="14"/><path d="M32 8l4 10h-8Zm0 48-4-10h8ZM8 32l10-4v8Zm48 0-10 4v-8ZM15 15l10 4-6 6Zm34 34-10-4 6-6Zm0-34-4 10-6-6ZM15 49l4-10 6 6Z"/>',
  'natural-inspiration': '<path d="M19 44c14 0 24-10 27-28-18 2-29 12-27 28Z"/><path d="M19 44c8-8 15-14 25-23M45 38l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
  'skull-bash-instinct': '<path d="M22 29c0-8 4-14 10-14s10 6 10 14c0 5-3 8-6 10v7h-8v-7c-3-2-6-5-6-10Z"/><path d="M27 29h2m6 0h2m-9 8h8M48 15l-8 12h7l-9 15"/>',
  'broken-bark': '<path d="M25 12h14l5 13-5 27H25l-5-27Z"/><path d="M34 14l-6 15 7 4-8 18m-6-25 8 3m14-3-8 7"/>',
  'mark-of-the-wild': '<circle cx="32" cy="32" r="20"/><path d="M22 40c0-7 4-12 10-12s10 5 10 12c0 6-4 9-10 9s-10-3-10-9Z"/><circle cx="21" cy="25" r="3"/><circle cx="28" cy="19" r="3"/><circle cx="36" cy="19" r="3"/><circle cx="43" cy="25" r="3"/>',
  'moonlit-resolve': '<path d="M32 14l15 7v11c0 10-6 16-15 21-9-5-15-11-15-21V21Z"/><path d="M36 21c-8 2-10 11-5 16 3 3 7 3 10 1-3 6-10 7-15 3-5-5-3-15 4-19 2-1 4-1 6-1Z"/>',
  'bark-dispelling': '<path d="M19 44c14 0 24-10 27-28-18 2-29 12-27 28Z"/><path d="M19 44c8-8 15-14 25-23M49 35v14m-7-7h14M17 13l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/>',
  'regenerative-bond': '<circle cx="25" cy="34" r="11"/><circle cx="39" cy="30" r="11"/><path d="M32 50V39m0 2c-7 0-9-5-8-9 5 0 9 2 8 9Zm1-5c1-6 5-8 10-7 0 4-3 8-10 7Z"/>',
  'ursoc-shelter': '<path d="M13 33l19-18 19 18M19 29v21h26V29"/><path d="M25 43c0-6 3-10 7-10s7 4 7 10c0 4-3 7-7 7s-7-3-7-7Z"/>',
  'water-fire-immunity': '<path d="M22 15c0 8-8 12-8 21a10 10 0 0 0 20 0c0-9-8-13-12-21Z"/><path d="M44 51c-8 0-12-5-10-12 1-5 6-7 6-14 5 3 7 7 6 11 3-2 4-5 4-8 6 6 7 12 3 18-2 3-5 5-9 5Z"/>',
  'regrowth-of-the-pack': '<path d="M32 50S19 42 19 32c0-8 10-10 13-3 3-7 13-5 13 3 0 10-13 18-13 18Z"/><circle cx="18" cy="20" r="3"/><circle cx="27" cy="15" r="3"/><circle cx="37" cy="15" r="3"/><circle cx="46" cy="20" r="3"/>',
  'guardian-of-the-grove': '<path d="M32 13l-12 14h8l-11 13h11v12h8V40h11L36 27h8Z"/><path d="M15 19l17-7 17 7v12c0 10-6 17-17 22-11-5-17-12-17-22Z"/>',
  'feral-aftershock': '<circle cx="32" cy="32" r="19"/><circle cx="32" cy="32" r="11"/><path d="M18 43l20-25m-11 29 18-23m-29 9 14-18"/>',
  'last-bear-stand': '<path d="M32 11l17 8v12c0 11-6 18-17 23-11-5-17-12-17-23V19Z"/><path d="M24 42c0-7 3-12 8-12s8 5 8 12m-15-16-4-7m18 7 4-7M32 30V18"/>',
  'spring-returns': '<path d="M32 54V34m0 5c-10 0-13-7-12-13 7 0 13 3 12 13Zm1-7c1-8 7-11 13-10 0 6-3 10-13 10Z"/><circle cx="18" cy="17" r="7"/><path d="M18 6V3m0 28v-3M7 17H4m28 0h-3M10 9 8 7m20 20-2-2"/>',
  'pain-rage': '<path d="M35 8 20 34h11l-4 22 17-29H33Z"/><path d="M16 48c-6-6-4-13 1-18 0 5 4 7 5 11 2-2 4-5 4-8 6 7 4 15-4 18"/>',
  'rage-exhaustion': '<path d="M28 49c-8-3-12-10-9-17 2-5 7-8 7-15 6 4 8 9 7 14 3-3 5-6 5-10 5 5 8 10 7 16"/><rect x="31" y="36" width="20" height="15" rx="3"/><path d="M36 36v-4a5 5 0 0 1 10 0v4"/>',
  'wild-recovery': '<path d="M32 50S18 42 18 31c0-8 10-11 14-3 4-8 14-5 14 3 0 11-14 19-14 19Z"/><path d="M32 28V15m0 7c-7 0-10-5-9-10 6 0 10 3 9 10Zm1-4c0-6 5-9 10-8 0 5-3 8-10 8Z"/>',
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character])
}

function fallbackGlyph(slug) {
  const hash = [...slug].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  const inset = 12 + (hash % 7)
  const tilt = (hash % 19) - 9
  return `<path d="M${inset} 43 32 13 ${64 - inset} 43 32 52Z"/><path d="M20 32h24M32 18v27" transform="rotate(${tilt} 32 32)"/>`
}

function corePlateFor(slug) {
  if (/iron|survival|thick|shelter|immunity|hide|guard/.test(slug)) {
    return '<path d="M32 7 53 16v16c0 13-8 21-21 27C19 53 11 45 11 32V16Z"/>'
  }
  if (/moon|lunar/.test(slug)) {
    return '<circle cx="32" cy="32" r="24"/>'
  }
  if (/rage|berserk|feral|thrash|mangle|roar|pain/.test(slug)) {
    return '<path d="M32 6 57 31 32 58 7 31Z"/>'
  }
  if (/bark|grove|natural|spring|regrowth|regen|wild/.test(slug)) {
    return '<path d="M10 37C10 18 23 7 44 8c8 10 11 24 5 35-7 13-22 17-36 11-3-5-4-11-3-17Z"/>'
  }
  return '<path d="m32 7 21 12v26L32 57 11 45V19Z"/>'
}

function treatmentFor(iconType, light, accent) {
  if (iconType === 'talent') {
    return {
      coreFill: light,
      coreOpacity: '.88',
      coreTransform: 'translate(1.5 1.5) scale(.953)',
      symbolFill: accent,
      symbolTransform: 'translate(5.5 8.5) scale(.78)',
    }
  }

  if (iconType === 'status') {
    return {
      coreFill: accent,
      coreOpacity: '1',
      coreTransform: 'translate(2.5 2.5) scale(.922)',
      symbolFill: light,
      symbolTransform: 'translate(9 9) scale(.72)',
    }
  }

  return {
    coreFill: accent,
    coreOpacity: '1',
    coreTransform: '',
    symbolFill: light,
    symbolTransform: 'translate(7 7) scale(.78)',
  }
}

function makeSvg({ iconId, iconType, assetKey }) {
  const slug = assetKey.replace(`bear-${iconType}-`, '')
  const [deep, mid, light, accent] = paletteFor(slug)
  const glyph = glyphs[slug] ?? fallbackGlyph(slug)
  const corePlate = corePlateFor(slug)
  const treatment = treatmentFor(iconType, light, accent)
  const coreTransform = treatment.coreTransform ? ` transform="${treatment.coreTransform}"` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-icon-canvas="full" data-icon-style="warrior-block" data-icon-kind="${iconType}" data-icon-key="${escapeXml(assetKey)}">
  <title>${escapeXml(iconId)}</title>
  <defs>
    <linearGradient id="bg" x1="8" y1="4" x2="57" y2="62" gradientUnits="userSpaceOnUse">
      <stop stop-color="${mid}"/>
      <stop offset="1" stop-color="${deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="translate(23 18) rotate(48) scale(38)">
      <stop stop-color="${light}" stop-opacity=".3"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="3" y="3" width="58" height="58" rx="12" fill="url(#bg)"/>
  <rect x="3" y="3" width="58" height="58" rx="12" fill="url(#glow)"/>
  <g data-icon-layer="core"${coreTransform} fill="${treatment.coreFill}" fill-opacity="${treatment.coreOpacity}" stroke="#091116" stroke-width="4" stroke-linejoin="round">${corePlate}</g>
  <g data-icon-layer="symbol-outline" transform="${treatment.symbolTransform}" fill="${treatment.symbolFill}" stroke="#091116" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>
`
}

fs.mkdirSync(skillIconDir, { recursive: true })
fs.mkdirSync(statusIconDir, { recursive: true })
for (const target of targetRows) {
  const outputDir = target.iconType === 'skill' ? skillIconDir : statusIconDir
  fs.writeFileSync(path.join(outputDir, `${target.assetKey}.svg`), makeSvg(target), 'utf8')
}

console.log(`Generated ${targetRows.length} Bear T warrior-block SVG assets without modifying workbook mappings.`)
