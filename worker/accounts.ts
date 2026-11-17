import { readInterests } from '../lib/interests';
import { betterAuth } from 'better-auth';
import type { Env } from './env';
import type { VisitorDetails } from '../lib/cafe';

export function authFor(env: Env, origin: string) {
  if (!env.BETTER_AUTH_SECRET || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || env.BETTER_AUTH_URL !== origin) return;
  return betterAuth({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    advanced: {useSecureCookies: origin.startsWith('https:')},
    account: {encryptOAuthTokens: true},
    socialProviders: {
      google: {clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET},
    },
  });
}

export type SavedProfile = Omit<VisitorDetails, 'presence'>;

export async function getProfile(db: D1Database, id: string) {
  const row = await db.prepare('SELECT name, animal, work, bio, interests FROM profiles WHERE user_id = ?')
    .bind(id).first<SavedProfile & {interests: string}>();
  if (!row) return null;
  const {interests, ...profile} = row;
  return {...profile, interestIds: readInterests(interests)};
}

export function saveProfile(db: D1Database, id: string, profile: SavedProfile, overwrite: boolean) {
  const conflict = overwrite ? `DO UPDATE SET name=excluded.name, animal=excluded.animal,
    work=excluded.work, bio=excluded.bio, interests=excluded.interests` : 'DO NOTHING';
  return db.prepare(`INSERT INTO profiles (user_id, name, animal, work, bio, interests)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) ${conflict}`)
    .bind(id, profile.name, profile.animal, profile.work, profile.bio ?? '', JSON.stringify(profile.interestIds ?? readInterests(profile.interests ?? ''))).run();
}
