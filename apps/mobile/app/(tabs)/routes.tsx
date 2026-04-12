import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { listRoutes, type RouteSummary } from "../../lib/api-client";

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async (cursor?: string) => {
    try {
      const data = await listRoutes(cursor);
      if (cursor) {
        setRoutes((prev) => [...prev, ...data.routes]);
      } else {
        setRoutes(data.routes);
      }
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load routes");
    }
  }, []);

  useEffect(() => {
    fetchRoutes().finally(() => setLoading(false));
  }, [fetchRoutes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRoutes();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchRoutes(nextCursor);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4A6B40" />
      </View>
    );
  }

  if (error && routes.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchRoutes().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={routes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        routes.length === 0 ? styles.emptyContainer : styles.list,
        { paddingTop: (routes.length === 0 ? 0 : 16) + insets.top, paddingBottom: insets.bottom },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4A6B40" />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No routes yet</Text>
          <Text style={styles.emptySubtext}>Create your first route in the Planner</Text>
        </View>
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color="#4A6B40" /> : null}
      renderItem={({ item }) => <RouteCard route={item} />}
    />
  );
}

function RouteCard({ route }: { route: RouteSummary }) {
  const distance = route.distance ? `${(route.distance / 1000).toFixed(1)} km` : null;
  const elevation = route.elevationGain ? `↑ ${Math.round(route.elevationGain)} m` : null;
  const days = route.dayBreaks.length > 0 ? `${route.dayBreaks.length + 1} days` : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/routes/${route.id}` as never)}
      activeOpacity={0.7}
    >
      <Text style={styles.cardName} numberOfLines={1}>{route.name}</Text>
      <View style={styles.cardStats}>
        {distance && <Text style={styles.cardStat}>{distance}</Text>}
        {elevation && <Text style={styles.cardStat}>{elevation}</Text>}
        {days && <Text style={styles.cardStat}>{days}</Text>}
      </View>
      {route.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>{route.description}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 18, color: "#666", fontWeight: "600" },
  emptySubtext: { fontSize: 14, color: "#999", marginTop: 4 },
  errorText: { fontSize: 16, color: "#c00", textAlign: "center" },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#4A6B40",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  footer: { paddingVertical: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardName: { fontSize: 16, fontWeight: "600", color: "#111" },
  cardStats: { flexDirection: "row", gap: 12, marginTop: 6 },
  cardStat: { fontSize: 13, color: "#666" },
  cardDescription: { fontSize: 13, color: "#999", marginTop: 6 },
});
