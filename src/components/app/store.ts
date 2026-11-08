'use client';

import { create } from 'zustand';
import type { SessionUser } from '@/lib/client/types';

type AppStore = {
  user: SessionUser | null;
  bootstrapped: boolean;
  setUser: (user: SessionUser | null) => void;
  setBootstrapped: (v: boolean) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  bootstrapped: false,
  setUser: (user) => set({ user }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
}));

export function usePerm(key: string): boolean {
  return useAppStore((s) => s.user?.perms.includes(key) ?? false);
}
