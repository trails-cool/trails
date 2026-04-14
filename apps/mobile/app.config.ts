import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "trails.cool",
  slug: "mobile",
  version: "0.0.1",
  scheme: "trailscool",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "cool.trails.app",
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "cool.trails.app",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "@maplibre/maplibre-react-native",
    ["@sentry/react-native", {
      organization: "trails-qq",
      project: "mobile",
    }],
    "expo-sqlite",
    "react-native-reanimated",
  ],
  extra: {
    eas: {
      projectId: "93c75cae-fecf-4ce5-8cd8-c823760b12e2",
    },
  },
});
