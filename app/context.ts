declare global {
  interface Env {
    TURNSTILE_SECRET: string;
    IP_HASH_SALT: string;
    ADMIN_SETUP_TOKEN: string;
    API_SECRET: string;
  }
  namespace Cloudflare {
    interface Env {
      TURNSTILE_SECRET: string;
      IP_HASH_SALT: string;
      ADMIN_SETUP_TOKEN: string;
      API_SECRET: string;
    }
  }
}

export {};
