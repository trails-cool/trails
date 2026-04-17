import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Sentry, initSentry } from "../lib/sentry";
import { isAuthenticated } from "../lib/auth";
import { startVersionCheck } from "../lib/version-check";

initSentry();

function RootLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    isAuthenticated().then((authed) => {
      if (!authed) {
        router.replace("/login");
      } else {
        startVersionCheck();
      }
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
