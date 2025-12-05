// app/_layout.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Stack } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

const TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID as string | undefined;
const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID as string | undefined;

// type AuthState = {
//   accessToken: string;
// };

type AuthState = {
  accessToken: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
};


type AuthContextType = {
  authState: AuthState | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token on startup
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("accessToken");
        if (storedToken) {
          setAuthState({ accessToken: storedToken });
        }
      } catch (e) {
        console.warn("[Auth] Error loading token:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const discovery = AuthSession.useAutoDiscovery(
    TENANT_ID
      ? `https://login.microsoftonline.com/${TENANT_ID}/v2.0`
      : `undefined`
  );

  // 👇 Let Expo decide the exp://... redirect URI it uses in Expo Go
  const redirectUri = AuthSession.makeRedirectUri();
  console.log("Redirect URI used by app:", redirectUri);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID ?? "",
      scopes: ["openid", "profile", "email", "offline_access", "User.Read"],
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
    },
    discovery
  );

  // Handle Microsoft response
  useEffect(() => {
    (async () => {
      if (!response || response.type !== "success") return;
      if (!discovery) return;

      try {
        const { code } = response.params;

        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: CLIENT_ID ?? "",
            code,
            redirectUri, // same URI as in useAuthRequest
            extraParams: {
              code_verifier: request?.codeVerifier || "",
            },
          },
          discovery
        );

        // const accessToken = tokenResult.accessToken;
        // if (accessToken) {
        //   await SecureStore.setItemAsync("accessToken", accessToken);
        //   setAuthState({ accessToken });
        // }

        const accessToken = tokenResult.accessToken;
if (accessToken) {
  // 1) Call Microsoft Graph /me to get profile
  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = await profileRes.json();

  // 2) Print name + surname in console
  console.log(
    "Signed in as:",
    profile.givenName,
    profile.surname
  );

  // 3) Save token + basic profile in state / secure store
  await SecureStore.setItemAsync("accessToken", accessToken);

  setAuthState({
    accessToken,
    displayName: profile.displayName,
    givenName: profile.givenName,
    surname: profile.surname,
  });
}

      } catch (e) {
        console.warn("[Auth] Token exchange error:", e);
      }
    })();
  }, [response, discovery, redirectUri, request]);

  const signIn = useCallback(async () => {
    if (!request) {
      console.warn("[Auth] Auth request not ready yet");
      return;
    }
    // 👇 No proxy here, plain Expo Go redirect (exp://...)
    await promptAsync();
  }, [promptAsync, request]);

  const signOut = useCallback(async () => {
    setAuthState(null);
    await SecureStore.deleteItemAsync("accessToken");
  }, []);

  return (
    <AuthContext.Provider value={{ authState, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, loading, signIn } = useAuth();
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    if (!loading && !authState && !autoStarted) {
      setAutoStarted(true);
      signIn().catch((e) => console.warn("[Auth] Auto sign-in error:", e));
    }
  }, [loading, authState, autoStarted, signIn]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.text}>Checking session…</Text>
      </SafeAreaView>
    );
  }

  if (!authState) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>Sign in required</Text>
        <Text style={styles.text}>
          Tap the button to sign in with your Microsoft 365 account.
        </Text>
        <TouchableOpacity style={styles.button} onPress={signIn}>
          <Text style={styles.buttonText}>Sign in with Microsoft</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  text: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
