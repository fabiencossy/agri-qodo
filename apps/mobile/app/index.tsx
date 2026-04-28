import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { SyncIndicator } from "@/components/sync-indicator";
import { useCurrentTenant, useIsAuthenticated, useLogout } from "@/lib/auth";

export default function HomeScreen() {
  const auth = useIsAuthenticated();
  const tenant = useCurrentTenant();
  const logout = useLogout();

  useEffect(() => {
    if (auth.data === false) router.replace("/login");
  }, [auth.data]);

  if (auth.data !== true) return null;

  const prenom = tenant.data?.nom?.split(" ")[0] ?? "agriculteur";

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
        <View>
          <Text className="text-lg font-bold text-green">🌱 Agri Qodo</Text>
          {tenant.data && <Text className="text-xs text-gray-500">{tenant.data.nom}</Text>}
        </View>
        <View className="flex-row items-center gap-3">
          <SyncIndicator />
          <Pressable onPress={() => logout.mutate()}>
            <Text className="text-sm text-gray-700">Déconnexion</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-4 py-8">
        <Text className="text-2xl font-bold">Bonjour {prenom} 👋</Text>
        <Text className="mt-1 text-base text-gray-600">Que souhaitez-vous faire ?</Text>

        <Pressable
          onPress={() => router.push("/")}
          className="mt-8 h-32 items-center justify-center rounded-2xl bg-green active:bg-green-dark"
        >
          <Text className="text-2xl font-bold text-white">🌱</Text>
          <Text className="mt-1 text-xl font-semibold text-white">Saisir une intervention</Text>
          <Text className="mt-1 text-sm text-white/80">Semis, fumure, phyto, récolte</Text>
        </Pressable>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => router.push("/")}
            className="flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white p-5"
          >
            <Text className="text-lg">📍</Text>
            <Text className="mt-2 text-base font-semibold">Mes parcelles</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/")}
            className="flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white p-5"
          >
            <Text className="text-lg">📋</Text>
            <Text className="mt-2 text-base font-semibold">SRPA aujourd'hui</Text>
          </Pressable>
        </View>

        <Text className="mt-12 text-xs text-gray-400">Pages métier à venir aux étapes 5-6.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
