import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMe, setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "lifeops_auth_token";
const LEGACY_USER_KEY = "lifeops_user";

interface UserProfile {
  id: number;
  fullName: string;
  mobile: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (authToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

function toUserProfile(data: { id: number; fullName: string; mobile: string }): UserProfile {
  return { id: data.id, fullName: data.fullName, mobile: data.mobile };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authToken: string): Promise<void> => {
    setToken(authToken);
    try {
      const me = await getMe();
      setUser(toUserProfile(me));
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      return stored;
    });

    async function loadStoredAuth() {
      try {
        await AsyncStorage.removeItem(LEGACY_USER_KEY);
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          await fetchProfile(stored);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    loadStoredAuth();
  }, [fetchProfile]);

  const login = useCallback(
    async (authToken: string) => {
      await AsyncStorage.setItem(TOKEN_KEY, authToken);
      await AsyncStorage.removeItem(LEGACY_USER_KEY);
      await fetchProfile(authToken);
    },
    [fetchProfile],
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(LEGACY_USER_KEY);
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
