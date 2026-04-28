import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Drawer } from "@/components/drawer";
import { Fab } from "@/components/fab";
import { Header } from "@/components/header";
import { useIsAuthenticated } from "@/lib/auth";

export default function AuthenticatedLayout() {
  const router = useRouter();
  const auth = useIsAuthenticated();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (auth.data === false) router.replace("/login");
  }, [auth.data, router]);

  if (auth.data !== true) return null;

  return (
    <View className="flex-1 bg-white">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#2E7D32",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: { backgroundColor: "#fff" },
          header: () => <Header onMenuClick={() => setDrawerOpen(true)} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="parcelles/index"
          options={{
            title: "Parcelles",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="map-marker-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="interventions/index"
          options={{
            title: "Carnet",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="sprout-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
            ),
          }}
        />
        {/* Routes accessibles mais cachées des onglets */}
        <Tabs.Screen name="parcelles/new" options={{ href: null }} />
        <Tabs.Screen name="interventions/new" options={{ href: null }} />
        <Tabs.Screen name="srpa" options={{ href: null }} />
        <Tabs.Screen name="veille" options={{ href: null }} />
      </Tabs>
      <Fab />
    </View>
  );
}
