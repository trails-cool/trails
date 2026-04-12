import { View, Text, StyleSheet } from "react-native";

export default function ActivitiesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Activities</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, color: "#666" },
});
