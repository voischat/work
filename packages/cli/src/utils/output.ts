import process from 'node:process'

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function printError(err: unknown): void {
  let message = 'Unknown error'
  let code: number | undefined

  if (err instanceof Error) {
    message = err.message
    try {
      const parsed = JSON.parse(err.message)
      if (parsed.errcode !== undefined)
        code = parsed.errcode
      if (parsed.errmsg)
        message = parsed.errmsg
    }
    catch {
      // not a JSON error
    }
  }

  printJson({ success: false, error: message, code })
  process.exitCode = 1
}

export function printSuccess(data: unknown): void {
  printJson({ success: true, data })
}
