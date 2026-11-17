import type { CafeDirectory } from './directory';
import type { CafeRoom } from './room';

export interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<CafeRoom>;
  DIRECTORY: DurableObjectNamespace<CafeDirectory>;
  DB: D1Database;
  BETA_ACCESS_CODE?: string;
  BETA_REQUIRED?: string;
  PUBLIC_ORIGIN?: string;
  GUEST_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  CAFE_ADMIN_TOKEN?: string;
}
