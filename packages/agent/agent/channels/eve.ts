import { localDev, none } from 'eve/channels/auth'
import { eveChannel } from 'eve/channels/eve'

export default eveChannel({
  auth: [localDev(), none()],
  onMessage(ctx, message) {
    const request = ctx.eve.request
    const token = request.headers.get('x-weila-token')
      || (typeof message === 'string' ? undefined : undefined)

    const caller = ctx.eve.caller
    return {
      auth: caller
        ? {
            ...caller,
            attributes: token ? { ...caller.attributes, token } : caller.attributes,
          }
        : {
            authenticator: 'anonymous',
            principalId: 'anonymous',
            principalType: 'anonymous',
            attributes: token ? { token } : {},
          },
    }
  },
})
