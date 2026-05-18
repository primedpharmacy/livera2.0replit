"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CURRENT_USER, USERS_REGISTRY } from "@/lib/api/mock";
import type { User } from "@/lib/api/mock";

const STORAGE_KEY = "livera:demo-current-user-id";
const IS_DEV = process.env.NODE_ENV !== "production";

type CurrentUserContextValue = {
  user: User;
  setUserId: (id: string) => void;
  availableUsers: User[];
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string>(CURRENT_USER.id);

  useEffect(() => {
    if (!IS_DEV) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && USERS_REGISTRY[stored]) {
        setUserIdState(stored);
      }
    } catch {
      // ignore — localStorage may be unavailable
    }
  }, []);

  const setUserId = useCallback((id: string) => {
    if (!IS_DEV) return;
    if (!USERS_REGISTRY[id]) return;
    setUserIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => {
    const user = USERS_REGISTRY[userId] ?? CURRENT_USER;
    return {
      user,
      setUserId,
      availableUsers: Object.values(USERS_REGISTRY),
    };
  }, [userId, setUserId]);

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUserContext(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (ctx) return ctx;
  // Fallback for components rendered outside the provider (e.g. tests).
  return {
    user: CURRENT_USER,
    setUserId: () => {},
    availableUsers: Object.values(USERS_REGISTRY),
  };
}
