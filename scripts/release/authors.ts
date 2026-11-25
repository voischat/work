const AUTHOR_ALIASES: Record<string, string> = {
  kvoon3: 'kvoon9',
  'Kevin Kwong': 'kvoon9',
}

function rewriteAuthors(markdown: string): string {
  let result = markdown

  for (const [from, to] of Object.entries(AUTHOR_ALIASES)) {
    result = result.replaceAll(`@${from}`, `@${to}`).replaceAll(from, to)
  }

  return result
}

export { rewriteAuthors }
