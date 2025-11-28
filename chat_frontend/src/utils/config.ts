export type AppConfig = {
  apiBase: string | undefined;
  wsUrl: string | undefined;
  env: string | undefined;
  frontendUrl: string | undefined;
  backendUrl: string | undefined;
};

function cleanEnvVar(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

// PUBLIC_INTERFACE
export const getAppConfig = (): AppConfig => {
  /** Returns environment configuration read from Vite env vars (client-safe). */
  const apiBase = cleanEnvVar(import.meta.env.VITE_API_BASE);
  const wsUrl = cleanEnvVar(import.meta.env.VITE_WS_URL);
  const env = cleanEnvVar(import.meta.env.VITE_NODE_ENV);
  const frontendUrl = cleanEnvVar(import.meta.env.VITE_FRONTEND_URL);
  const backendUrl = cleanEnvVar(import.meta.env.VITE_BACKEND_URL);

  return {
    apiBase,
    wsUrl,
    env,
    frontendUrl,
    backendUrl,
  };
};
