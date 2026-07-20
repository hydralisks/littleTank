import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { buildDesktopDataPack } from './buildDesktopDataPack.mjs'

function readRustConst(source, name) {
  const match = source.match(new RegExp(`pub const ${name}: &str = "([^"]+)";`))
  assert.ok(match, `missing generated const ${name}`)
  return match[1]
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'little-tank-pack-'))
const outputDir = path.join(tempRoot, 'desktop-data')
const generatedRustPath = path.join(tempRoot, 'generated_data_pack.rs')

await buildDesktopDataPack({
  inputDir: path.resolve('public/designer-data'),
  outputDir,
  generatedRustPath,
})

const packPath = path.join(outputDir, 'game-data.ltpkg')
assert.equal(fs.existsSync(packPath), true)
assert.equal(fs.existsSync(path.join(outputDir, 'stage_content.xlsx')), false)
assert.equal(fs.existsSync(path.join(outputDir, 'enemy_data.xlsx')), false)

const pack = fs.readFileSync(packPath)
assert.equal(pack.includes(Buffer.from('stage_content.xlsx')), false)
assert.equal(pack.includes(Buffer.from('encounter_balance.xlsx')), false)

const generated = fs.readFileSync(generatedRustPath, 'utf8')
const expectedPackHash = readRustConst(generated, 'EXPECTED_DATA_PACK_SHA256')
const keyHex = readRustConst(generated, 'DATA_PACK_KEY_HEX')
const nonceHex = readRustConst(generated, 'DATA_PACK_NONCE_HEX')

assert.equal(crypto.createHash('sha256').update(pack).digest('hex'), expectedPackHash)

const authTag = pack.subarray(pack.length - 16)
const ciphertext = pack.subarray(0, pack.length - 16)
const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(nonceHex, 'hex'))
decipher.setAuthTag(authTag)
const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()])
const payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'))

assert.deepEqual(payload.files.map((entry) => entry.name), [
  'stage_content.xlsx',
  'encounter_balance.xlsx',
  'enemy_data.xlsx',
  'player_build.xlsx',
  'challenge_stage_content.xlsx',
  'challenge_encounter_balance.xlsx',
])
assert.equal(typeof payload.files[0].sha256, 'string')
