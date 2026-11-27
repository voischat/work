// Ambient declarations for modules that only exist after the Rspack loaders
// run: worklet bundles are inlined by worklet-inline-loader.ts (default
// export is the module URL), and wav/wasm files are emitted by
// type: 'asset/resource' (default export is the asset URL).
declare module '*.worklet.js' {
  const url: string
  export default url
}

declare module '*.wav' {
  const url: string
  export default url
}

declare module '*.wasm' {
  const url: string
  export default url
}

// worker-rspack-loader turns a .worker.ts module into a Worker factory whose
// default export is a `new () => Worker` constructor. The alias below matches
// the import in main/weila_core.ts.
declare module 'main/weila_network.worker' {
  const NetworkWorker: new () => Worker
  export default NetworkWorker
}
