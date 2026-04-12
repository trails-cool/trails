import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import {
  setServerUrl,
  fetchDiscovery,
  isApiVersionCompatible,
  ServerConfigError,
} from "../lib/server-config";
import { login } from "../lib/auth";

export default function LoginScreen() {
  const [serverUrl, setServerUrlState] = useState(
    __DEV__ ? "http://localhost:3000" : "https://trails.cool",
  );
  const [showCustomServer, setShowCustomServer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const url = serverUrl.replace(/\/+$/, "");

      // Validate server via discovery endpoint
      const discovery = await fetchDiscovery(url);

      if (!isApiVersionCompatible(discovery.apiVersion)) {
        setError(
          `This app requires API v${discovery.apiVersion.split(".")[0]}.x but the server runs v${discovery.apiVersion}. Please update the app.`,
        );
        setLoading(false);
        return;
      }

      // Store the validated server URL
      await setServerUrl(url);

      // Start OAuth2 PKCE login
      const success = await login();
      if (success) {
        router.replace("/(tabs)");
      } else {
        setError("Login was cancelled or failed. Please try again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Login] Error:", message, err);
      if (err instanceof ServerConfigError) {
        setError(`Could not connect to server: ${err.message}`);
      } else {
        setError(`Connection failed: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>trails.cool</Text>
      <Text style={styles.subtitle}>Sign in to your Journal</Text>

      {showCustomServer && (
        <View style={styles.serverInput}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrlState}
            placeholder="https://trails.cool"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      {!showCustomServer && (
        <TouchableOpacity onPress={() => setShowCustomServer(true)}>
          <Text style={styles.link}>Connect to a different server</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#4A6B40",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  serverInput: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#4A6B40",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#4A6B40",
    fontSize: 14,
  },
  error: {
    color: "#c00",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
});
