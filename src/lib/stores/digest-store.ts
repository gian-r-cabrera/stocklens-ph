"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type DigestState = {
  lastCheckedAt: string | null;
  markChecked: () => void;
};

export const useDigestStore = create<DigestState>()(
  persist(
    (set) => ({
      lastCheckedAt: null,
      markChecked: () => set({ lastCheckedAt: new Date().toISOString() }),
    }),
    {
      name: "stocklens-digest",
      version: 1,
    },
  ),
);
