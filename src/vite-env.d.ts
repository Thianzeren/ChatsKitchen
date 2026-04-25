/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUBMIT_SESSION_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
