export interface PresenceState {
  cursor: { x: number; y: number } | null;
  thinking: boolean;
}

export interface UserMeta {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  cursorColor: string;
}
