"use client";

import { SettingsContent } from "@/components/settings/settings-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SettingsModalProps {
  open: boolean;
  currentEmail: string;
  displayName?: string | null;
  onClose: () => void;
}

export function SettingsModal({ open, currentEmail, displayName, onClose }: SettingsModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex h-[min(720px,85vh)] max-h-[85vh] w-[min(960px,95vw)] max-w-[960px] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 border-b border-[var(--border-default)] px-6 py-4 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your Architype account, email, and account deletion.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
          {open ? (
            <SettingsContent
              key="settings-modal-content"
              currentEmail={currentEmail}
              displayName={displayName}
              embedded
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
