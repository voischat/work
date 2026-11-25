const AUTHOR_ALIASES = {
  kvoon3: 'kvoon9',
  'Kevin Kwong': 'kvoon9',
}

function rewriteAuthors(markdown) {
  let result = markdown

  for (const [from, to] of Object.entries(AUTHOR_ALIASES)) {
    result = result.replaceAll(`@${from}`, `@${to}`).replaceAll(from, to)
  }

  return result
}

export { rewriteAuthors }
