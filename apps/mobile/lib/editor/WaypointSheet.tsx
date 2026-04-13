import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import type { Waypoint } from "@trails-cool/types";

interface WaypointSheetProps {
  waypoint: Waypoint;
  index: number;
  onClose: () => void;
  onDelete: (index: number) => void;
  onToggleOvernight: (index: number) => void;
}

export function WaypointSheet({
  waypoint,
  index,
  onClose,
  onDelete,
  onToggleOvernight,
}: WaypointSheetProps) {
  const handleDelete = () => {
    Alert.alert(
      "Delete Waypoint",
      `Remove waypoint ${index + 1}${waypoint.name ? ` (${waypoint.name})` : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(index);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>
        Waypoint {index + 1}{waypoint.name ? `: ${waypoint.name}` : ""}
      </Text>
      <Text style={styles.coords}>
        {waypoint.lat.toFixed(5)}, {waypoint.lon.toFixed(5)}
      </Text>

      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          onToggleOvernight(index);
          onClose();
        }}
      >
        <Text style={styles.optionIcon}>{waypoint.isDayBreak ? "☀️" : "🌙"}</Text>
        <Text style={styles.optionText}>
          {waypoint.isDayBreak ? "Remove overnight stop" : "Mark as overnight stop"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={handleDelete}>
        <Text style={styles.optionIcon}>🗑️</Text>
        <Text style={[styles.optionText, styles.deleteText]}>Delete waypoint</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#111" },
  coords: { fontSize: 12, color: "#999", marginTop: 2, marginBottom: 16 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  optionIcon: { fontSize: 18, marginRight: 12 },
  optionText: { fontSize: 15, color: "#333" },
  deleteText: { color: "#dc2626" },
  closeButton: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  closeText: { fontSize: 15, color: "#666" },
});
