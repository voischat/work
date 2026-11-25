import { calculateAudioDuration } from '@vois/weila-sdk-core'

export function framesToDuration(frameCount: number): number {
  return calculateAudioDuration(frameCount)
}
