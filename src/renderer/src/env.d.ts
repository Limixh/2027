declare const __APP_VERSION__: string

/** Vite: dosyanın derlenmiş adresi (pdf.js worker için) */
declare module '*?url' {
  const url: string
  export default url
}
