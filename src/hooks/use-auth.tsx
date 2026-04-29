import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "student";

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
        setRolesLoading(true);
        void fetchRoles(newSession.user.id);
      } else {
        setRoles([]);
        setRolesLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
      setLoading(false);
    });

    supabase.auth.getSession()
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
  }, []);

  async function fetchRoles(userId: string) {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      setRoles((data ?? []).map((r) => r.role as Role).filter((role): role is Role => role === "admin" || role === "student"));
    } catch {
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ user, session, roles, loading, rolesLoading, signOut, isAdmin: roles.includes("admin") }}
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