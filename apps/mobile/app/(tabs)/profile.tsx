import { View, Text, StyleSheet } from "react-native";
import { API_VERSION } from "@trails-cool/api";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile</Text>
      <Text style={styles.version}>API v{API_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, color: "#666" },
  version: { fontSize: 12, color: "#999", marginTop: 8 },
});
