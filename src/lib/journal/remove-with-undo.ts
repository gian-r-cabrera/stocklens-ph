"use client";

import { toast } from "sonner";

import type { JournalEntry } from "@/lib/journal/types";
import { useJournalStore } from "@/lib/stores/journal-store";

/** Shared by JournalTable and JournalCards so the remove+undo toast stays
 * identical on desktop and mobile instead of drifting across two copies. */
export function removeJournalEntryWithUndo(entry: JournalEntry): void {
  useJournalStore.getState().removeEntry(entry.id);
  toast.message(`Removed ${entry.ticker} call from your journal.`, {
    action: {
      label: "Undo",
      onClick: () => useJournalStore.getState().restoreEntry(entry),
    },
  });
}
