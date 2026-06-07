# Tauri Desktop PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package littleTank as a Windows desktop app with no plain xlsx files in the installed directory, while keeping the web build flow unchanged.

**Architecture:** Keep the current Vite/React app as the frontend. Add a small Tauri Rust shell that loads a protected game-data pack, verifies integrity before startup, and exposes a single read command for the frontend. Build-time scripts generate the desktop data pack and hash manifest from the existing planner-owned xlsx files; the web build continues to load `/public/designer-data/*.xlsx` directly.

**Tech Stack:** Vite, React, TypeScript, Rust, Tauri v2, NSIS, SHA-256 hashing, JSON manifest, existing `xlsx` parser.

---

### Task 1: Add a desktop data pack generator

**Files:**
- Create: `scripts/buildDesktopDataPack.mjs`
- Modify: `package.json`
- Test: `scripts/buildDesktopDataPack.mjs` output in a temporary folder

- [ ] **Step 1: Write the failing test**

```javascript
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { buildDesktopDataPack } from './buildDesktopDataPack.mjs'

const tempDir = path.resolve('tmp/desktop-pack-test')
await buildDesktopDataPack({
  inputDir: path.resolve('public/designer-data'),
  outputDir: tempDir,
})

const manifest = JSON.parse(fs.readFileSync(path.join(tempDir, 'manifest.json'), 'utf8'))
assert.equal(manifest.files.length, 4)
assert.equal(typeof manifest.files[0].sha256, 'string')
assert.equal(fs.existsSync(path.join(tempDir, 'stage_content.xlsx')), false)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/buildDesktopDataPack.mjs`
Expected: fails because the script and exported function do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```javascript
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export async function buildDesktopDataPack({ inputDir, outputDir }) {
  fs.mkdirSync(outputDir, { recursive: true })
  const files = ['stage_content.xlsx', 'encounter_balance.xlsx', 'enemy_data.xlsx', 'player_build.xlsx']
  const entries = []

  for (const name of files) {
    const source = fs.readFileSync(path.join(inputDir, name))
    const sha256 = crypto.createHash('sha256').update(source).digest('hex')
    const packed = Buffer.from(source).toString('base64')
    fs.writeFileSync(path.join(outputDir, `${name}.pack`), packed)
    entries.push({ name, sha256, packedName: `${name}.pack` })
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify({ files: entries }, null, 2))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/buildDesktopDataPack.mjs`
Expected: PASS and a manifest plus packed files are written.

- [ ] **Step 5: Commit**

```bash
git add scripts/buildDesktopDataPack.mjs package.json
git commit -m "feat: add desktop data pack generator"
```

### Task 2: Add runtime data loading and verification in Rust

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/data_pack.rs`
- Create: `src-tauri/tauri.conf.json`
- Modify: `src/game/data/workbookLoader.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest'
import { resolveDesignerDataSource } from './workbookLoader'

describe('resolveDesignerDataSource', () => {
  it('uses desktop data pack when running inside Tauri', () => {
    expect(resolveDesignerDataSource(true)).toBe('tauri')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/data/workbookLoader.test.ts`
Expected: fails because `resolveDesignerDataSource` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
export function resolveDesignerDataSource(isDesktop: boolean) {
  return isDesktop ? 'tauri' : 'web'
}
```

```rust
#[tauri::command]
fn load_designer_pack() -> Result<DesignerPack, String> {
  // read manifest.json, verify sha256, decode pack files, return bytes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/data/workbookLoader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri src/game/data/workbookLoader.ts src/game/data/workbookLoader.test.ts
git commit -m "feat: load protected designer data in tauri"
```

### Task 3: Wire Tauri into the app entry and build scripts

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/main.tsx`
- Create: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest'
import { shouldUseTauriBridge } from './appBootstrap'

describe('app bootstrap', () => {
  it('prefers the Tauri bridge when the desktop runtime is present', () => {
    expect(shouldUseTauriBridge({ isDesktop: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/appBootstrap.test.ts`
Expected: fails because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
export function shouldUseTauriBridge(context: { isDesktop: boolean }) {
  return context.isDesktop
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/appBootstrap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts src/main.tsx src-tauri/src/lib.rs
git commit -m "feat: wire tauri desktop bootstrap"
```

### Task 4: Build Windows installer and verify anti-tamper behavior

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Test: generated Windows installer and runtime launch

- [ ] **Step 1: Write the failing test**

```powershell
$env:Path="$env:USERPROFILE\.cargo\bin;$env:Path"
npm run tauri build
```

Expected: fails until Rust toolchain, Tauri CLI, and Windows build prerequisites are installed.

- [ ] **Step 2: Run test to verify it fails**

Run the command above and confirm the build stops before producing an installer.

- [ ] **Step 3: Write minimal implementation**

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installMode": "perMachine"
      }
    },
    "resources": [
      "desktop-data"
    ]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run tauri build`
Expected: produces a Windows installer and the installed app launches with validated data.

- [ ] **Step 5: Commit**

```bash
git add package.json src-tauri/tauri.conf.json
git commit -m "feat: bundle tauri desktop installer"
```
