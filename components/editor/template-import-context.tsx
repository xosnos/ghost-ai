"use client";

import { createContext, useContext } from "react";
import type { CanvasTemplate } from "@/components/editor/starter-templates";

export type TemplateImportRef = {
  current: ((template: CanvasTemplate) => void) | null;
};

const TemplateImportContext = createContext<TemplateImportRef | null>(null);

export function TemplateImportProvider({
  value,
  children,
}: {
  value: TemplateImportRef;
  children: React.ReactNode;
}) {
  return (
    <TemplateImportContext.Provider value={value}>
      {children}
    </TemplateImportContext.Provider>
  );
}

export function useTemplateImportRef(): TemplateImportRef | null {
  return useContext(TemplateImportContext);
}
