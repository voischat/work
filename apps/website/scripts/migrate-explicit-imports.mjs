#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
const DTS = join(SRC, 'auto-imports.d.ts')
const MAP_CACHE = join(ROOT, 'scripts', '.auto-imports-map.json')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry')
const onlyFile = args.includes('--file') ? resolve(ROOT, args[args.indexOf('--file') + 1]) : null
const MACROS = new Set(['definePage', 'defineProps', 'defineEmits', 'defineExpose', 'defineOptions', 'defineSlots', 'defineModel', 'withDefaults', 'defineRender'])

function toSpec(mod) {
  if (!mod.startsWith('.'))
    return mod
  return `~/${relative(SRC, resolve(SRC, mod)).replaceAll('\\', '/').replace(/\.tsx?$/, '')}`
}

function loadMap() {
  if (!existsSync(DTS)) {
    if (!existsSync(MAP_CACHE))
      throw new Error(`missing ${DTS} and no cached map at ${MAP_CACHE}`)
    return new Map(JSON.parse(readFileSync(MAP_CACHE, 'utf8')))
  }
  const map = new Map()
  const dts = readFileSync(DTS, 'utf8')
  for (const m of dts.matchAll(/^\s*const ([$\w]+): typeof import\('([^']+)'\)\.([$\w]+)$/gm))
    map.set(m[1], { from: toSpec(m[2]), name: m[3], type: false })
  for (const m of dts.matchAll(/^\s*export type \{([^}]+)\} from '([^']+)'$/gm)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim()
      if (name)
        map.set(name, { from: toSpec(m[2]), name, type: true })
    }
  }
  writeFileSync(MAP_CACHE, JSON.stringify([...map]))
  return map
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules')
      continue
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      walk(path, out)
    else if (/\.(vue|ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts'))
      out.push(path)
  }
  return out
}

function typecheckMissingNames() {
  let output = ''
  try {
    output = execFileSync('./node_modules/.bin/vue-tsc', ['--noEmit', '--skipLibCheck'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  }
  catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
  const errors = []
  for (const line of output.split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error TS(2304|2552|2503|18004): (.*)$/)
    if (!m)
      continue
    const name = m[5].match(/Cannot find name '([^']+)'/)?.[1]
      ?? m[5].match(/Cannot find namespace '([^']+)'/)?.[1]
      ?? m[5].match(/shorthand property '([^']+)'/)?.[1]
    if (name)
      errors.push({ file: resolve(ROOT, m[1]), line: Number(m[2]), name, raw: m[5] })
  }
  return errors
}

function templateMissingNames(file, code, map) {
  const { descriptor } = parse(code, { filename: file })
  if (!descriptor.template)
    return []
  let bindings = {}
  try {
    if (descriptor.scriptSetup || descriptor.script) {
      const compiled = compileScript(descriptor, { id: createHash('sha1').update(file).digest('hex').slice(0, 8), inlineTemplate: false })
      bindings = compiled.bindings ?? {}
    }
  }
  catch (error) {
    console.warn(`compileScript failed for ${relative(ROOT, file)}: ${error.message}`)
    return []
  }
  const template = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: createHash('sha1').update(file).digest('hex').slice(0, 8),
    compilerOptions: { bindingMetadata: bindings, prefixIdentifiers: true },
  })
  if (template.errors.length)
    console.warn(`compileTemplate warnings for ${relative(ROOT, file)}: ${template.errors.map(String).join('; ')}`)
  const names = new Set()
  for (const m of template.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)) {
    if (map.has(m[1]))
      names.add(m[1])
  }
  return [...names]
}

function planBlock(blockContent, wanted) {
  wanted = [...new Map(wanted.map(item => [item.name, item])).values()]
  const nl = blockContent.includes('\r\n') ? '\r\n' : '\n'
  const sf = ts.createSourceFile('block.ts', blockContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const imported = new Set()
  const valueNamed = new Map()
  const typeNamed = new Map()
  let lastImportEnd = -1
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt))
      continue
    lastImportEnd = stmt.end
    const clause = stmt.importClause
    if (!clause)
      continue
    if (clause.name)
      imported.add(clause.name.text)
    const named = clause.namedBindings
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements)
        imported.add(element.name.text)
      const target = clause.isTypeOnly ? typeNamed : valueNamed
      if (!target.has(stmt.moduleSpecifier.text))
        target.set(stmt.moduleSpecifier.text, named)
    }
    else if (named && ts.isNamespaceImport(named)) {
      imported.add(named.name.text)
    }
  }

  const additions = wanted.filter(item => !imported.has(item.name))
  if (!additions.length)
    return null

  const edits = []
  const freshValues = new Map()
  const freshTypes = new Map()
  for (const item of additions) {
    const mergeTarget = item.type ? typeNamed.get(item.from) : valueNamed.get(item.from)
    if (mergeTarget) {
      const last = mergeTarget.elements.at(-1)
      const pos = last ? last.end : mergeTarget.getStart() + 1
      const prefix = last ? ', ' : ' '
      edits.push({ pos, text: `${prefix}${item.name}` })
    }
    else {
      const target = item.type ? freshTypes : freshValues
      if (!target.has(item.from))
        target.set(item.from, [])
      target.get(item.from).push(item.name)
    }
  }

  const lines = []
  for (const [from, names] of freshValues)
    lines.push(`import { ${[...new Set(names)].sort().join(', ')} } from '${from}'`)
  for (const [from, names] of freshTypes)
    lines.push(`import type { ${[...new Set(names)].sort().join(', ')} } from '${from}'`)
  if (lines.length) {
    const localNl = lastImportEnd > 0 && blockContent.slice(lastImportEnd, lastImportEnd + 2) === '\r\n' ? '\r\n' : nl
    let text
    if (lastImportEnd > 0)
      text = `${localNl}${lines.join(localNl)}`
    else if (blockContent.startsWith('\r\n') || blockContent.startsWith('\n'))
      text = `${nl}${lines.join(nl)}${nl}`
    else
      text = `${lines.join(nl)}${nl}`
    edits.push({ pos: lastImportEnd > 0 ? lastImportEnd : 0, text })
  }

  edits.sort((a, b) => b.pos - a.pos)
  let result = blockContent
  for (const edit of edits)
    result = result.slice(0, edit.pos) + edit.text + result.slice(edit.pos)
  return result
}

function blockForLine(descriptor, line) {
  const blocks = [descriptor.scriptSetup, descriptor.script].filter(Boolean)
  return blocks.find(block => line >= block.loc.start.line && line <= block.loc.end.line) ?? null
}

function applyToVue(file, code, items) {
  const { descriptor } = parse(code, { filename: file })
  const byBlock = new Map()
  const templateItems = []
  for (const item of items) {
    if (item.source === 'template') {
      templateItems.push(item)
      continue
    }
    const block = blockForLine(descriptor, item.line)
    if (!block) {
      templateItems.push(item)
      continue
    }
    if (!byBlock.has(block))
      byBlock.set(block, [])
    byBlock.get(block).push(item)
  }

  const replacements = []
  for (const [block, blockItems] of byBlock) {
    const next = planBlock(block.content, blockItems.map(item => item.import))
    if (next !== null)
      replacements.push({ start: block.loc.start.offset, end: block.loc.end.offset, text: next })
  }

  if (templateItems.length) {
    const setup = descriptor.scriptSetup
    if (setup) {
      const existing = replacements.find(r => r.start === setup.loc.start.offset)
      const base = existing ? existing.text : setup.content
      const next = planBlock(base, templateItems.map(item => item.import))
      if (next !== null) {
        if (existing)
          existing.text = next
        else
          replacements.push({ start: setup.loc.start.offset, end: setup.loc.end.offset, text: next })
      }
    }
    else {
      const planned = planBlock('', templateItems.map(item => item.import))
      if (planned) {
        const nl = code.includes('\r\n') ? '\r\n' : '\n'
        const text = `<script setup lang="ts">${nl}${planned.trim().replaceAll('\n', nl)}${nl}</script>${nl}${nl}`
        replacements.push({ start: 0, end: 0, text })
      }
    }
  }

  if (!replacements.length)
    return null
  replacements.sort((a, b) => b.start - a.start)
  let result = code
  for (const replacement of replacements)
    result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end)
  return result
}

function applyToTs(code, items) {
  const next = planBlock(code, items.map(item => item.import))
  return next
}

function main() {
  const map = loadMap()
  if (existsSync(DTS) && !dryRun) {
    rmSync(DTS)
    console.log(`removed ${relative(ROOT, DTS)}`)
  }
  const files = walk(SRC).filter(file => !onlyFile || file === onlyFile)
  const vueFiles = files.filter(file => file.endsWith('.vue'))

  for (let round = 0; round < 6; round++) {
    const byFile = new Map()
    const push = (file, entry) => {
      if (!byFile.has(file))
        byFile.set(file, [])
      byFile.get(file).push(entry)
    }

    for (const error of typecheckMissingNames()) {
      if (!files.includes(error.file))
        continue
      if (MACROS.has(error.name)) {
        console.log(`macro (skipped): ${relative(ROOT, error.file)}:${error.line} ${error.name}`)
        continue
      }
      const item = map.get(error.name)
      if (!item) {
        console.log(`UNMAPPED: ${relative(ROOT, error.file)}:${error.line} ${error.raw}`)
        continue
      }
      push(error.file, { import: item, line: error.line, source: 'ts' })
    }

    for (const file of vueFiles) {
      const code = readFileSync(file, 'utf8')
      for (const name of templateMissingNames(file, code, map))
        push(file, { import: map.get(name), source: 'template' })
    }

    if (!byFile.size) {
      console.log(`round ${round}: no missing names`)
      break
    }

    console.log(`round ${round}: ${byFile.size} files need imports`)
    for (const [file, items] of byFile) {
      const code = readFileSync(file, 'utf8')
      const next = file.endsWith('.vue') ? applyToVue(file, code, items) : applyToTs(code, items)
      if (next === null || next === code) {
        console.log(`no change: ${relative(ROOT, file)} (${items.map(i => i.import.name).join(', ')})`)
        continue
      }
      console.log(`${dryRun ? 'would update' : 'updated'} ${relative(ROOT, file)}: ${[...new Set(items.map(i => i.import.name))].join(', ')}`)
      if (!dryRun)
        writeFileSync(file, next)
    }

    if (dryRun)
      break
  }
}

main()
