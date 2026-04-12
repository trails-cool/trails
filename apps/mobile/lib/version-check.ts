import { Alert, AppState } from "react-native";
import { getServerUrl, fetchDiscovery, isApiVersionCompatible } from "./server-config";

let listening = false;

/**
 * Start listening for app foreground events to re-check API version.
 * Shows a non-blocking alert if the server version has drifted.
 */
export function startVersionCheck() {
  if (listening) return;
  listening = true;

  AppState.addEventListener("change", async (state) => {
    if (state !== "active") return;

    try {
      const serverUrl = await getServerUrl();
      const discovery = await fetchDiscovery(serverUrl);
      if (!isApiVersionCompatible(discovery.apiVersion)) {
        Alert.alert(
          "Update Available",
          "The server has been updated. Please update the app for the best experience.",
          [{ text: "OK" }],
        );
      }
    } catch {
      // Silently ignore — network may be unavailable
    }
  });
}
