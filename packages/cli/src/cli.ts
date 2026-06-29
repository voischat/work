import { cac } from 'cac'
import pkg from '../package.json' with { type: 'json' }
import { registerAddressCommands } from './commands/address.js'
import { registerAuthCommands } from './commands/auth.js'
import { registerGlobalOptions } from './commands/_shared.js'
import { registerGroupCommands } from './commands/group.js'
import { registerOrgCommands } from './commands/org.js'

const cli = cac('weila-work-cli')

cli.help()
cli.version(pkg.version)

registerGlobalOptions(cli)

registerAuthCommands(cli)
registerOrgCommands(cli)
registerAddressCommands(cli)
registerGroupCommands(cli)

cli.parse()
