/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SESSION_TKEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
