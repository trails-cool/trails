import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4A6B40",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: "Routes",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Activities",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
