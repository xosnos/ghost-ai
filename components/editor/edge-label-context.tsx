"use client";

import { createContext, useContext } from "react";

export type UpdateEdgeLabelFn = (edgeId: string, label: string) => void;

export const EdgeLabelContext = createContext<UpdateEdgeLabelFn | null>(null);

export function useEdgeLabelUpdater(): UpdateEdgeLabelFn | null {
  return useContext(EdgeLabelContext);
}
