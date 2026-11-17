export const invitationToken = /^[0-9a-f]{32}$/;
export const invitationLifetime = 7 * 24 * 60 * 60 * 1000;
export type Invitation = { token: string; room: string; expires: number };

export function activeInvitation(invite: Invitation | undefined, now: number): boolean {
  return Boolean(invite && invite.expires > now);
}
