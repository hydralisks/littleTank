import fs from 'node:fs'
import path from 'node:path'

const packageDir = process.argv[2]

if (!packageDir) {
  throw new Error('Usage: node scripts/createStandaloneDemoHtml.mjs <package-dir>')
}

const resolvedPackageDir = path.resolve(packageDir)
const saveNamespace = path.basename(resolvedPackageDir)
const indexPath = path.join(resolvedPackageDir, 'index.html')
const outputPath = path.join(resolvedPackageDir, 'LittleTank Demo.html')
const assetDir = path.join(resolvedPackageDir, 'assets')
const workbookDir = path.join(resolvedPackageDir, 'designer-data')
const workbookNames = [
  'stage_content.xlsx',
  'encounter_balance.xlsx',
  'enemy_data.xlsx',
  'player_build.xlsx',
]

const workbooks = Object.fromEntries(
  workbookNames.map((name) => {
    const filePath = path.join(workbookDir, name)
    return [name, fs.readFileSync(filePath).toString('base64')]
  }),
)

const embeddedFetchScript = `<script>
(() => {
  window.__LITTLETANK_SAVE_NAMESPACE__ = ${JSON.stringify(saveNamespace)}
  const workbookBase64 = ${JSON.stringify(workbooks)}
  const workbookMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  function decodeBase64(value) {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input && input.url ? input.url : String(input)
    const fileName = rawUrl.split('?')[0].split('#')[0].split('/').pop()
    const content = workbookBase64[fileName]
    if (content) {
      return Promise.resolve(new Response(decodeBase64(content), {
        status: 200,
        headers: { 'Content-Type': workbookMime },
      }))
    }
    return originalFetch(input, init)
  }
})()
</script>`

const sourceHtml = fs.readFileSync(indexPath, 'utf8')
const moduleByName = Object.fromEntries(
  fs
    .readdirSync(assetDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => [name, fs.readFileSync(path.join(assetDir, name), 'utf8')]),
)
const cssByName = Object.fromEntries(
  fs
    .readdirSync(assetDir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => [name, fs.readFileSync(path.join(assetDir, name), 'utf8')]),
)

const mainModuleName = sourceHtml.match(/src="\/assets\/([^"]+\.js)"/)?.[1]
if (!mainModuleName) {
  throw new Error('Unable to find main module in index.html')
}

const moduleUrls = {}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toModuleDataUrl(source) {
  return `data:text/javascript;charset=utf-8;base64,${Buffer.from(source, 'utf8').toString('base64')}`
}

function rewriteStandaloneSource(source) {
  return source
    .replaceAll('sourceMappingURL=', 'sourceMappingURL-disabled=')
    .replaceAll('`/`+e', '`./`+e')
    .replaceAll('return`/`+e', 'return`./`+e')
    .replaceAll('"/status-icons/', '"./status-icons/')
    .replaceAll('"/skill-icons/', '"./skill-icons/')
    .replaceAll("'/status-icons/", "'./status-icons/")
    .replaceAll("'/skill-icons/", "'./skill-icons/")
    .replaceAll('`/status-icons/', '`./status-icons/')
    .replaceAll('`/skill-icons/', '`./skill-icons/')
    .replaceAll('return n?`/${t===`skill`?`skill-icons`:`status-icons`}/', 'return n?`./${t===`skill`?`skill-icons`:`status-icons`}/')
    .replace(
      /return ([A-Za-z_$][\w$]*)\?`\/\$\{([^}]+)\}\/\$\{([^}]+)\}\.svg`:null/g,
      'return $1?`./${$2}/${$3}.svg`:null',
    )
}

function rewriteLocalModuleSpecifiers(source, currentName, stack = []) {
  let rewritten = source

  for (const name of Object.keys(moduleByName)) {
    if (name === currentName) {
      continue
    }

    const escapedName = escapeRegExp(name)
    const staticImportPattern = new RegExp(`from\\s*["'\`]\\.\\/${escapedName}["'\`]`, 'g')
    const dynamicImportPattern = new RegExp(`import\\(\\s*["'\`]\\.\\/${escapedName}["'\`]\\s*\\)`, 'g')

    if (!staticImportPattern.test(rewritten) && !dynamicImportPattern.test(rewritten)) {
      continue
    }

    staticImportPattern.lastIndex = 0
    dynamicImportPattern.lastIndex = 0
    const url = getModuleDataUrl(name, stack)
    rewritten = rewritten.replace(
      staticImportPattern,
      `from ${JSON.stringify(url)}`,
    )
    rewritten = rewritten.replace(
      dynamicImportPattern,
      `import(${JSON.stringify(url)})`,
    )
  }

  return rewritten
}

function getModuleDataUrl(name, stack = []) {
  if (moduleUrls[name]) {
    return moduleUrls[name]
  }

  if (stack.includes(name)) {
    throw new Error(`Circular module dependency while creating standalone demo: ${[...stack, name].join(' -> ')}`)
  }

  const source = moduleByName[name]
  if (!source) {
    throw new Error(`Unknown module asset: ${name}`)
  }

  const rewritten = rewriteLocalModuleSpecifiers(
    rewriteStandaloneSource(source),
    name,
    [...stack, name],
  )
  moduleUrls[name] = toModuleDataUrl(rewritten)
  return moduleUrls[name]
}

const standaloneMainModule = rewriteLocalModuleSpecifiers(
  rewriteStandaloneSource(moduleByName[mainModuleName])
    .replace(/^const __vite__mapDeps=.*?;\n/, 'const __vite__mapDeps=()=>[];\n'),
  mainModuleName,
)

const embeddedCss = Object.values(cssByName)
  .map((source) => `<style>\n${source}\n</style>`)
  .join('\n')
const embeddedMainModule = `<script type="module">\n${standaloneMainModule}\n</script>`

const standaloneHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Little Tank Demo</title>
    ${embeddedCss}
    ${embeddedFetchScript}
  </head>
  <body>
    <div id="root"></div>
    ${embeddedMainModule}
  </body>
</html>`

fs.writeFileSync(outputPath, standaloneHtml)
console.log(outputPath)
