const LEGAL = /(?:copyright|license|spdx|all rights reserved)/i
const DIRECTIVE = /^(?:eslint|oxlint)-(?:disable|enable)(?:-(?:next-)?line)?\b/
const TYPESCRIPT_DIRECTIVE = /^@ts-(?:expect-error|ignore|nocheck|check)\b/
const REFERENCE = /^\/\s*<reference\b/
const FRAMEWORK_DIRECTIVE =
  /^@(?:vite-ignore|vue-expect-error|vue-ignore|vitest-environment|jest-environment)\b/
const BUNDLER_DIRECTIVE = /^webpack[A-Za-z]*\b/
const FORMATTER_DIRECTIVE = /^(?:prettier-ignore|oxfmt-ignore|biome-ignore)\b/
const PURE = /^(?:@__PURE__|#__PURE__)$/
const SOURCE_MAP = /^[#@]\s*sourceMappingURL=/
const SAFETY = /^SAFETY:/
const LINK = /^https?:\/\/\S+$/

function isAllowedComment(comment, index) {
  const body = comment.value.trim()
  if (index === 0 && LEGAL.test(body)) return true
  return (
    DIRECTIVE.test(body) ||
    TYPESCRIPT_DIRECTIVE.test(body) ||
    REFERENCE.test(body) ||
    FRAMEWORK_DIRECTIVE.test(body) ||
    BUNDLER_DIRECTIVE.test(body) ||
    FORMATTER_DIRECTIVE.test(body) ||
    PURE.test(body) ||
    SOURCE_MAP.test(body) ||
    SAFETY.test(body) ||
    LINK.test(body)
  )
}

function removalRange(sourceCode, comment) {
  if (!comment.range) return null
  const text = sourceCode.text
  const [start, end] = comment.range
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEnd = text.indexOf('\n', end)
  const before = text.slice(lineStart, start)
  const after = text.slice(end, lineEnd === -1 ? text.length : lineEnd)
  if (before.trim() !== '' || after.trim() !== '') return [start, end]
  return [lineStart, lineEnd === -1 ? text.length : lineEnd + 1]
}

const noCommentsRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow comments outside the machine-read directive allowlist.',
    },
    schema: [],
    messages: {
      comment:
        'Delete this comment. Encode the reason in code, a type, a test, or an allowed directive.',
    },
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode()
        const comments = [
          ...sourceCode.getAllComments(),
          ...(sourceCode.ast?.templateBody?.comments ?? []),
        ].toSorted((a, b) => a.range[0] - b.range[0])
        comments.forEach((comment, index) => {
          if (isAllowedComment(comment, index)) return
          const range = removalRange(sourceCode, comment)
          context.report({
            loc: comment.loc,
            messageId: 'comment',
            fix: range ? (fixer) => fixer.removeRange(range) : undefined,
          })
        })
      },
    }
  },
}

export { isAllowedComment }

export default {
  meta: { name: 'no-comments' },
  rules: {
    'no-comments': noCommentsRule,
  },
}
