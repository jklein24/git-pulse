"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: number;
  githubId: number;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

interface Workspace {
  id: number;
  name: string;
  slug: string;
  role: string;
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  isAdmin: boolean;
  loading: boolean;
  switchWorkspace: (workspaceId: number) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  workspace: null,
  workspaces: [],
  isAdmin: false,
  loading: true,
  switchWorkspace: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login" || pathname === "/onboarding") {
      setLoading(false);
      return;
    }

    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setWorkspace(data.workspace);
        setWorkspaces(data.workspaces);
      })
      .catch(() => {
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  const switchWorkspace = useCallback((workspaceId: number) => {
    document.cookie = `workspace_id=${workspaceId};path=/;max-age=${30 * 86400}`;
    window.location.reload();
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  const isAdmin = workspace?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, workspace, workspaces, isAdmin, loading, switchWorkspace, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
