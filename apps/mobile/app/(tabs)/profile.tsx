import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { API_VERSION } from "@trails-cool/api";
import { logout } from "../../lib/auth";
import { getServerUrl, clearServerUrl } from "../../lib/server-config";

export default function ProfileScreen() {
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    getServerUrl().then(setServerUrl);
  }, []);

  const handleSwitchServer = () => {
    Alert.alert(
      "Switch Server",
      "This will log you out and clear local data. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          style: "destructive",
          onPress: async () => {
            await logout();
            await clearServerUrl();
            router.replace("/login");
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile</Text>
      <Text style={styles.server}>{serverUrl}</Text>
      <Text style={styles.version}>API v{API_VERSION}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSwitchServer}>
        <Text style={styles.link}>Switch Server</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  text: { fontSize: 18, color: "#666" },
  server: { fontSize: 14, color: "#999", marginTop: 4 },
  version: { fontSize: 12, color: "#999", marginTop: 4 },
  logoutButton: {
    marginTop: 32,
    backgroundColor: "#e5e5e5",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutText: { fontSize: 16, color: "#333" },
  link: { color: "#4A6B40", fontSize: 14, marginTop: 16 },
});
