Object.assign(globalThis, {
  AudioWorkletProcessor: class {
    port: MessagePort | null = null
  },
  registerProcessor: () => {},
})
