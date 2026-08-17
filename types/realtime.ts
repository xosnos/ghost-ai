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

export type PresencePayload = UserMeta & PresenceState;

export interface CursorMovePayload {
  userId: string;
  cursor: { x: number; y: number } | null;
}

export interface SelectionChangePayload {
  userId: string;
  nodeIds: string[];
}
