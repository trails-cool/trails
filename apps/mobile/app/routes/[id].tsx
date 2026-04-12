import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRoute, type RouteDetail } from "../../lib/api-client";
import { getServerUrl } from "../../lib/server-config";

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

  const distance = route.distance ? `${(route.distance / 1000).toFixed(1)} km` : null;
  const elevationGain = route.elevationGain ? `↑ ${Math.round(route.elevationGain)} m` : null;
  const elevationLoss = route.elevationLoss ? `↓ ${Math.round(route.elevationLoss)} m` : null;
  const dayCount = route.dayBreaks.length > 0 ? route.dayBreaks.length + 1 : null;

  const handleEditInPlanner = async () => {
    const serverUrl = await getServerUrl();
    const url = `${serverUrl}/routes/${route.id}/edit`;
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{route.name}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {/* Map placeholder */}
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Map</Text>
          <Text style={styles.mapPlaceholderHint}>Requires dev build with MapLibre</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {distance && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{distance}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          )}
          {elevationGain && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{elevationGain}</Text>
              <Text style={styles.statLabel}>Gain</Text>
            </View>
          )}
          {elevationLoss && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{elevationLoss}</Text>
              <Text style={styles.statLabel}>Loss</Text>
            </View>
          )}
          {dayCount && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{dayCount}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {route.description ? (
          <Text style={styles.description}>{route.description}</Text>
        ) : null}

        {/* Version history */}
        {route.versions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {route.versions.length} version{route.versions.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditInPlanner}>
            <Text style={styles.actionButtonText}>Edit in Planner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionSecondary]}>
            <Text style={styles.actionSecondaryText}>Download Offline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 16, color: "#c00", textAlign: "center" },
  backButton: { marginTop: 16, backgroundColor: "#e5e5e5", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  backButtonText: { fontSize: 14, color: "#333" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerBack: { paddingRight: 12 },
  headerBackText: { fontSize: 24, color: "#4A6B40" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111", flex: 1 },
  content: { padding: 16 },
  mapPlaceholder: {
    height: 200,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  mapPlaceholderText: { fontSize: 16, color: "#9ca3af", fontWeight: "600" },
  mapPlaceholderHint: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "700", color: "#111" },
  statLabel: { fontSize: 12, color: "#666", marginTop: 2 },
  description: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#666" },
  actions: { gap: 10, marginTop: 8 },
  actionButton: {
    backgroundColor: "#4A6B40",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  actionSecondary: { backgroundColor: "#e5e7eb" },
  actionSecondaryText: { color: "#333", fontSize: 16, fontWeight: "600" },
});
