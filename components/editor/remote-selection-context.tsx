"use client";

import { createContext, useContext } from "react";

export interface RemoteNodeHighlight {
  userId: string;
  color: string;
  name: string;
}

export type RemoteSelectionMap = Record<string, RemoteNodeHighlight[]>;
const EMPTY_HIGHLIGHTS: RemoteNodeHighlight[] = [];

const RemoteSelectionContext = createContext<RemoteSelectionMap>({});

export function RemoteSelectionProvider({
  value,
  children,
}: {
  value: RemoteSelectionMap;
  children: React.ReactNode;
}) {
  return (
    <RemoteSelectionContext.Provider value={value}>
      {children}
    </RemoteSelectionContext.Provider>
  );
}

export function useRemoteHighlights(nodeId: string): RemoteNodeHighlight[] {
  return useContext(RemoteSelectionContext)[nodeId] ?? EMPTY_HIGHLIGHTS;
}
