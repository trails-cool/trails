import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRoute, type RouteDetail } from "../../lib/api-client";
import { getServerUrl } from "../../lib/server-config";
import { RouteMap } from "../../lib/editor/RouteMap";
import { WaypointSheet } from "../../lib/editor/WaypointSheet";
import { useRouteEditor } from "../../lib/editor/use-route-editor";

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRoute(id)
      .then(setRoute)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load route"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4A6B40" />
      </View>
    );
  }

  if (error || !route) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error ?? "Route not found"}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <RouteDetailContent route={route} />;
}

function RouteDetailContent({ route }: { route: RouteDetail }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [editing, setEditing] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);

  const editor = useRouteEditor(route);

  const distance = route.distance ? `${(route.distance / 1000).toFixed(1)} km` : null;
  const elevationGain = route.elevationGain ? `↑ ${Math.round(route.elevationGain)} m` : null;
  const elevationLoss = route.elevationLoss ? `↓ ${Math.round(route.elevationLoss)} m` : null;
  const dayCount = route.dayBreaks.length > 0 ? route.dayBreaks.length + 1 : null;

  const handleEditInPlanner = async () => {
    const serverUrl = await getServerUrl();
    Linking.openURL(`${serverUrl}/routes/${route.id}/edit`);
  };

  const handleSave = async () => {
    const success = await editor.save();
    if (success) {
      setEditing(false);
    }
  };

  const handleBack = useCallback(() => {
    if (editor.dirty) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Save before leaving?",
        [
          { text: "Discard", style: "destructive", onPress: () => router.back() },
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async () => {
              await editor.save();
              router.back();
            },
          },
        ],
      );
    } else {
      router.back();
    }
  }, [editor]);

  // Unsaved changes guard
  useEffect(() => {
    if (!editing) return;
    const unsubscribe = navigation.addListener("beforeRemove", (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (!editor.dirty) return;
      e.preventDefault();
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Save before leaving?",
        [
          { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action as never) },
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async () => {
              await editor.save();
              navigation.dispatch(e.data.action as never);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [editing, editor, navigation]);

  // Compute initial route from waypoints
  useEffect(() => {
    if (editing && editor.waypoints.length >= 2 && editor.segments.length === 0) {
      editor.computeRoute(editor.waypoints);
    }
  }, [editing]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{route.name}</Text>
        {editing ? (
          <TouchableOpacity onPress={handleSave} disabled={editor.saving || !editor.dirty}>
            <Text style={[styles.headerAction, (!editor.dirty || editor.saving) && styles.headerActionDisabled]}>
              {editor.saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.headerAction}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <View style={{ flex: 1 }}>
          <RouteMap
            waypoints={editor.waypoints}
            segments={editor.segments}
            computing={editor.computing}
            onLongPress={(lat, lon) => editor.addWaypoint(lat, lon)}
            onWaypointDragEnd={(i, lat, lon) => editor.moveWaypoint(i, lat, lon)}
            onWaypointPress={(i) => setSelectedWaypoint(i)}
          />

          {editor.error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{editor.error}</Text>
            </View>
          )}

          {selectedWaypoint !== null && editor.waypoints[selectedWaypoint] && (
            <WaypointSheet
              waypoint={editor.waypoints[selectedWaypoint]!}
              index={selectedWaypoint}
              onClose={() => setSelectedWaypoint(null)}
              onDelete={editor.deleteWaypoint}
              onToggleOvernight={editor.toggleOvernight}
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.mapPreview}>
            <RouteMap
              waypoints={editor.waypoints}
              segments={editor.segments}
              computing={false}
              onLongPress={() => {}}
              onWaypointDragEnd={() => {}}
              onWaypointPress={() => {}}
            />
          </View>

          <View style={styles.statsRow}>
            {distance && <View style={styles.statBox}><Text style={styles.statValue}>{distance}</Text><Text style={styles.statLabel}>Distance</Text></View>}
            {elevationGain && <View style={styles.statBox}><Text style={styles.statValue}>{elevationGain}</Text><Text style={styles.statLabel}>Gain</Text></View>}
            {elevationLoss && <View style={styles.statBox}><Text style={styles.statValue}>{elevationLoss}</Text><Text style={styles.statLabel}>Loss</Text></View>}
            {dayCount && <View style={styles.statBox}><Text style={styles.statValue}>{dayCount}</Text><Text style={styles.statLabel}>Days</Text></View>}
          </View>

          {route.description ? <Text style={styles.description}>{route.description}</Text> : null}

          {route.versions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{route.versions.length} version{route.versions.length !== 1 ? "s" : ""}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setEditing(true)}>
              <Text style={styles.actionButtonText}>Edit Route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.actionSecondary]} onPress={handleEditInPlanner}>
              <Text style={styles.actionSecondaryText}>Edit in Planner</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 16, color: "#c00", textAlign: "center" },
  backButton: { marginTop: 16, backgroundColor: "#e5e5e5", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  backButtonText: { fontSize: 14, color: "#333" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerBack: { paddingRight: 12 },
  headerBackText: { fontSize: 24, color: "#4A6B40" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111", flex: 1 },
  headerAction: { fontSize: 16, fontWeight: "600", color: "#4A6B40" },
  headerActionDisabled: { color: "#9ca3af" },
  content: { padding: 16 },
  mapPreview: { height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 8, padding: 12, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "700", color: "#111" },
  statLabel: { fontSize: 12, color: "#666", marginTop: 2 },
  description: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#666" },
  actions: { gap: 10, marginTop: 8 },
  actionButton: { backgroundColor: "#4A6B40", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  actionSecondary: { backgroundColor: "#e5e7eb" },
  actionSecondaryText: { color: "#333", fontSize: 16, fontWeight: "600" },
  errorBanner: { position: "absolute", bottom: 16, alignSelf: "center", backgroundColor: "rgba(220,38,38,0.9)", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  errorBannerText: { color: "#fff", fontSize: 13 },
});
