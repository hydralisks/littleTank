declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string })
    window: Window & typeof globalThis
  }
}

declare let IS_REACT_ACT_ENVIRONMENT: boolean | undefined
