import process from 'node:process'
import gentlyCopy from 'gently-copy'

const userPath = `${process.env.INIT_CWD ?? process.cwd()}/public`

gentlyCopy(['dist/assets'], userPath, { overwrite: true })
