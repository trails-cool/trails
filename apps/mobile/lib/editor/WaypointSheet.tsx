import { useRef, useCallback, useMemo } from "react";
import { Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
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
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["35%"], []);

  const handleDelete = useCallback(() => {
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
  }, [index, waypoint.name, onDelete, onClose]);

  const handleSheetChange = useCallback((sheetIndex: number) => {
    if (sheetIndex === -1) onClose();
  }, [onClose]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
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
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  handle: { backgroundColor: "#d1d5db", width: 36 },
  content: { padding: 16 },
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
});
