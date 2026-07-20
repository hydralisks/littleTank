import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const DESKTOP_DATA_FILES = [
  'stage_content.xlsx',
  'encounter_balance.xlsx',
  'enemy_data.xlsx',
  'player_build.xlsx',
  'challenge_stage_content.xlsx',
  'challenge_encounter_balance.xlsx',
]

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function toHex(buffer) {
  return Buffer.from(buffer).toString('hex')
}

function readFileBuffer(filePath) {
  return fs.readFileSync(filePath)
}

export async function buildDesktopDataPack({
  inputDir,
  outputDir,
  generatedRustPath,
}) {
  ensureDirectory(outputDir)
  if (generatedRustPath) {
    ensureDirectory(path.dirname(generatedRustPath))
  }

  const files = []
  for (const fileName of DESKTOP_DATA_FILES) {
    const source = readFileBuffer(path.join(inputDir, fileName))
    files.push({
      name: fileName,
      sha256: crypto.createHash('sha256').update(source).digest('hex'),
      bytes: source.toString('base64'),
    })
  }

  const payload = Buffer.from(JSON.stringify({ files }), 'utf8')
  const compressed = zlib.gzipSync(payload)
  const key = crypto.randomBytes(32)
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()])
  const authTag = cipher.getAuthTag()
  const pack = Buffer.concat([encrypted, authTag])
  const packPath = path.join(outputDir, 'game-data.ltpkg')
  fs.writeFileSync(packPath, pack)

  const manifest = {
    format: 'littleTank.desktopPack.v1',
    files: files.map(({ name, sha256 }) => ({ name, sha256 })),
    encryptedPack: 'game-data.ltpkg',
  }
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  if (generatedRustPath) {
    const rustSource = `pub const DATA_PACK_KEY_HEX: &str = "${toHex(key)}";\n` +
      `pub const DATA_PACK_NONCE_HEX: &str = "${toHex(nonce)}";\n` +
      `pub const EXPECTED_DATA_PACK_SHA256: &str = "${crypto.createHash('sha256').update(pack).digest('hex')}";\n`
    fs.writeFileSync(generatedRustPath, rustSource)
  }
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const inputDir = process.argv[2]
  const outputDir = process.argv[3]
  const generatedRustPath = process.argv[4]

  if (!inputDir || !outputDir) {
    throw new Error('Usage: node scripts/buildDesktopDataPack.mjs <input-dir> <output-dir> [generated-rust-path]')
  }

  await buildDesktopDataPack({ inputDir, outputDir, generatedRustPath })
}
