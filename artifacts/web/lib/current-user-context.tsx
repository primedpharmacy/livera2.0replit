"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  CURRENT_USER,
  DEMO_OVERRIDE_COOKIE_NAME,
  USERS_REGISTRY,
} from "@/lib/api/mock";
import type { User } from "@/lib/api/mock";

const IS_DEV = process.env.NODE_ENV !== "production";

type CurrentUserContextValue = {
  user: User;
  setUserId: (id: string) => void;
  availableUsers: User[];
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  initialUserId,
  children,
}: {
  initialUserId: string;
  children: React.ReactNode;
}) {
  // The provider is seeded from the server (which reads the
  // `livera_demo_uid` cookie via `next/headers`), so the very first
  // client render hydrates with the same persona the server rendered —
  // no SSR/client mismatch and no flash of the wrong persona's gated UI.
  const seedId = USERS_REGISTRY[initialUserId] ? initialUserId : CURRENT_USER.id;
  const [userId, setUserIdState] = useState<string>(seedId);

  const setUserId = useCallback((id: string) => {
    if (!IS_DEV) return;
    if (!USERS_REGISTRY[id]) return;
    setUserIdState(id);
    // Mirror the choice into the demo cookie so that the next server render
    // (e.g. a route navigation) resolves the same persona and stays
    // hydration-consistent. This is the same non-httpOnly mirror cookie that
    // `middleware.ts` writes on `?as=<uid>`.
    try {
      document.cookie = `${DEMO_OVERRIDE_COOKIE_NAME}=${encodeURIComponent(
        id,
      )}; path=/; SameSite=Lax`;
    } catch {
      // ignore — document may be unavailable in tests
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
