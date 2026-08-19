"use client";

import { useEffect } from "react";

import { JournalCards } from "@/components/journal/journal-cards";
import { JournalEmpty } from "@/components/journal/journal-empty";
import { JournalSummary } from "@/components/journal/journal-summary";
import { JournalTable } from "@/components/journal/journal-table";
import { useJournalStore } from "@/lib/stores/journal-store";

export function JournalContent() {
  const entries = useJournalStore((s) => s.entries);
  const resolveEntries = useJournalStore((s) => s.resolveEntries);

  useEffect(() => {
    if (entries.length === 0) return;
    void resolveEntries();
  }, [entries.length, resolveEntries]);

  if (entries.length === 0) {
    return <JournalEmpty />;
  }

  return (
    <>
      <JournalSummary entries={entries} />
      <JournalTable entries={entries} />
      <JournalCards entries={entries} />
    </>
  );
}
