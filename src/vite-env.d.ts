/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZG_ROUTER_API_KEY: string;
  readonly VITE_ZG_ROUTER_URL: string;
  readonly VITE_ZG_RPC_URL: string;
  readonly VITE_ZG_CHAIN_ID: string;
  readonly VITE_ZG_ERC8004_IDENTITY: string;
  readonly VITE_ZG_ERC8004_REPUTATION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
