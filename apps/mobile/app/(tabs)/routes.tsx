import { View, Text, StyleSheet } from "react-native";

export default function RoutesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Routes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, color: "#666" },
});
