import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRolesWithRetry, type AppRole } from "@/lib/auth-roles";

type Role = AppRole;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  rolesLoading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const rolesRef = useRef<Role[]>([]);
  const userIdRef = useRef<string | null>(null);

  const applyRoles = useCallback((nextRoles: Role[]) => {
    rolesRef.current = nextRoles;
    setRoles(nextRoles);
  }, []);

  const fetchRoles = useCallback(
    async (userId: string) => {
      try {
        applyRoles(await fetchUserRolesWithRetry(userId));
      } catch {
        applyRoles([]);
      } finally {
        setRolesLoading(false);
      }
    },
    [applyRoles],
  );

  useEffect(() => {
    let active = true;
    const fallbackTimer = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setRolesLoading(false);
    }, 3500);

    const applySession = (newSession: Session | null) => {
      if (!active) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const sameUser = userIdRef.current === newSession.user.id;
        userIdRef.current = newSession.user.id;

        if (!sameUser || rolesRef.current.length === 0) {
          setRolesLoading(true);
          window.setTimeout(() => {
            if (!active) return;
            setRolesLoading(false);
          }, 3500);
          void fetchRoles(newSession.user.id);
        }
      } else {
        userIdRef.current = null;
        applyRoles([]);
        setRolesLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => applySession(s))
      .catch(() => applySession(null))
      .finally(() => {
        if (!active) return;
        window.clearTimeout(fallbackTimer);
        setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [applyRoles, fetchRoles]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        rolesLoading,
        signOut,
        isAdmin: roles.includes("admin"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
