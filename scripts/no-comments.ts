import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { isAllowedComment } from '../tools/lint/no-comments.mjs'

const ROOTS = ['apps', 'packages', 'scripts', 'infra', 'tools']
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'storybook-static',
  'public',
  '__snapshots__',
  '.git',
])
const TARGET_EXT = new Set(['.vue', '.css', '.less', '.pcss', '.html'])
const HTML_COMMENT = /<!--[\s\S]*?-->/g
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g
const LESS_COMMENT = /\/\/[^\n]*/g

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) yield* walk(path)
    else if (TARGET_EXT.has(name.slice(name.lastIndexOf('.')))) yield path
  }
}

function commentRanges(text: string, regex: RegExp, offset = 0): [number, number, string][] {
  const ranges: [number, number, string][] = []
  for (const match of text.matchAll(regex))
    ranges.push([offset + match.index, offset + match.index + match[0].length, match[0]])
  return ranges
}

function templateRanges(text: string): [number, number][] {
  const ranges: [number, number][] = []
  let index = 0
  while ((index = text.indexOf('<template', index)) !== -1) {
    const next = text[index + 9]
    if (next !== '>' && next !== undefined && !/\s/.test(next)) {
      index += 9
      continue
    }
    const openEnd = text.indexOf('>', index)
    if (openEnd === -1) break
    let depth = 1
    let cursor = openEnd + 1
    while (depth > 0) {
      const open = text.indexOf('<template', cursor)
      const close = text.indexOf('</template>', cursor)
      if (close === -1) return ranges
      if (open !== -1 && open < close) {
        depth++
        cursor = open + 9
      } else {
        depth--
        cursor = close + 11
      }
    }
    ranges.push([openEnd + 1, cursor - 11])
    index = cursor
  }
  return ranges
}

function styleRanges(text: string): [number, number, boolean][] {
  const ranges: [number, number, boolean][] = []
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    const start = match.index + match[0].indexOf('>') + 1
    ranges.push([start, start + match[1].length, /lang\s*=\s*["']?less/.test(match[0])])
  }
  return ranges
}

function scan(text: string, ext: string): [number, number, string][] {
  const ranges: [number, number, string][] = []
  if (ext === '.vue') {
    for (const [start, end] of templateRanges(text))
      ranges.push(...commentRanges(text.slice(start, end), HTML_COMMENT, start))
    for (const [start, end, less] of styleRanges(text)) {
      ranges.push(...commentRanges(text.slice(start, end), CSS_COMMENT, start))
      if (less) ranges.push(...commentRanges(text.slice(start, end), LESS_COMMENT, start))
    }
    return ranges
  }
  if (ext === '.html') return commentRanges(text, HTML_COMMENT)
  if (ext === '.less')
    return [...commentRanges(text, CSS_COMMENT), ...commentRanges(text, LESS_COMMENT)]
  return commentRanges(text, CSS_COMMENT)
}

function removalRange(text: string, start: number, end: number): [number, number] {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEnd = text.indexOf('\n', end)
  const before = text.slice(lineStart, start)
  const after = text.slice(end, lineEnd === -1 ? text.length : lineEnd)
  if (before.trim() !== '' || after.trim() !== '') return [start, end]
  return [lineStart, lineEnd === -1 ? text.length : lineEnd + 1]
}

const fix = process.argv.includes('--fix')
const problems: string[] = []

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const ext = path.slice(path.lastIndexOf('.'))
    const text = readFileSync(path, 'utf8')
    const ranges = scan(text, ext)
    const kept: [number, number][] = []
    ranges.forEach(([start, end, raw], index) => {
      const value = raw.replace(/^<!--|-->$/g, '').replace(/^\/\*|\*\/$/g, '')
      if (isAllowedComment({ value }, index)) return
      kept.push([start, end])
    })
    if (kept.length === 0) continue
    if (!fix) {
      for (const [start] of kept) {
        const before = text.slice(0, start)
        const line = before.split('\n').length
        problems.push(`${relative(process.cwd(), path)}:${line}`)
      }
      continue
    }
    let next = text
    for (const [start, end] of kept.toSorted((a, b) => b[0] - a[0])) {
      const [from, to] = removalRange(next, start, end)
      next = next.slice(0, from) + next.slice(to)
    }
    writeFileSync(path, next)
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`${problem}: unexpected comment`)
  process.exitCode = 1
}
