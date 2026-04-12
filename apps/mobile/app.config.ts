import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "trails.cool",
  slug: "trails-cool",
  version: "0.0.1",
  scheme: "trailscool",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "cool.trails.app",
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
  experiments: {
    monorepo: true,
  },
  plugins: ["expo-router"],
});
