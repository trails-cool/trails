import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
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

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default Sentry.wrap(RootLayout);
