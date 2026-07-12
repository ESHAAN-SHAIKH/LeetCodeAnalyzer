declare module 'cloudflare:workers' {
  interface Env {
    LEETCODE_CACHE: KVNamespace;
    SESSION: KVNamespace;
  }
  const env: Env;
  export { env };
}