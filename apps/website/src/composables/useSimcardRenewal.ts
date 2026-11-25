import type { CreatedRenewOrderDto } from '~/api/simcard'
import type { CreatedRenewOrder, SimCard } from '~/utils/simcard'
import { shallowRef } from 'vue'
import { SIMCARD_CREATE_RENEW_ORDER_ENDPOINT, SIMCARD_PKG_NAME } from '~/api/simcard'
import { readErrorMessage, toCreatedOrder } from '~/utils/simcard'
import { useWeilaApi } from './useWeilaApi'

export type RenewalState
  = | { kind: 'idle' }
    | { kind: 'creating', card: SimCard }
    | { kind: 'created', card: SimCard, order: CreatedRenewOrder }
    | { kind: 'failed', card: SimCard, message: string }

export function useSimcardRenewal() {
  const api = useWeilaApi()
  const state = shallowRef<RenewalState>({ kind: 'idle' })

  async function start(card: SimCard) {
    state.value = { kind: 'creating', card }

    try {
      const dto = await api.value.v2.fetch<CreatedRenewOrderDto>(SIMCARD_CREATE_RENEW_ORDER_ENDPOINT, {
        body: {
          iccid: card.iccid,
          pay_method: 'wechat',
          pkg_name: SIMCARD_PKG_NAME,
        },
      })
      state.value = {
        kind: 'created',
        card,
        order: toCreatedOrder(dto),
      }
    }
    catch (error) {
      state.value = {
        kind: 'failed',
        card,
        message: readErrorMessage(error),
      }
    }
  }

  function reset() {
    state.value = { kind: 'idle' }
  }

  return { state, start, reset }
}
