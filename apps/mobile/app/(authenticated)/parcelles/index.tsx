import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { ParcellesMap } from "@/components/parcelles-map";
import {
  formatSurface,
  libelleZone,
  useDeleteParcelle,
  useParcelles,
  useParcellesMap,
} from "@/lib/parcelles";

type Vue = "liste" | "carte";

export default function ParcellesScreen() {
  const [vue, setVue] = useState<Vue>("liste");
  const parcelles = useParcelles();
  const parcellesMap = useParcellesMap();
  const deleteMutation = useDeleteParcelle();

  const onDelete = (id: string, nom: string) => {
    Alert.alert("Supprimer la parcelle", `« ${nom} » sera définitivement supprimée.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  if (parcelles.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#2E7D32" />
      </View>
    );
  }

  if (parcelles.isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-sm text-red-600">
          Impossible de charger les parcelles. Vérifie ta connexion.
        </Text>
      </View>
    );
  }

  if (!parcelles.data || parcelles.data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <MaterialCommunityIcons name="map-marker-outline" size={56} color="#9CA3AF" />
        <Text className="mt-3 text-lg font-semibold">Aucune parcelle pour l'instant</Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          Crée ta première parcelle avec le bouton + en bas à droite.
        </Text>
        <Link href="/parcelles/new" asChild>
          <Pressable className="mt-6 rounded-lg bg-green px-5 py-3">
            <Text className="text-base font-semibold text-white">+ Nouvelle parcelle</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row gap-2 border-b border-gray-200 bg-white p-3">
        <Pressable
          onPress={() => setVue("liste")}
          className={`flex-row items-center gap-2 rounded-md px-4 py-2 ${
            vue === "liste" ? "bg-green" : "bg-gray-100"
          }`}
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={18}
            color={vue === "liste" ? "#fff" : "#374151"}
          />
          <Text
            className={`text-sm font-medium ${vue === "liste" ? "text-white" : "text-gray-700"}`}
          >
            Liste
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setVue("carte")}
          className={`flex-row items-center gap-2 rounded-md px-4 py-2 ${
            vue === "carte" ? "bg-green" : "bg-gray-100"
          }`}
        >
          <MaterialCommunityIcons
            name="map-outline"
            size={18}
            color={vue === "carte" ? "#fff" : "#374151"}
          />
          <Text
            className={`text-sm font-medium ${vue === "carte" ? "text-white" : "text-gray-700"}`}
          >
            Carte
          </Text>
        </Pressable>
      </View>

      {vue === "carte" &&
        (parcellesMap.data ? (
          <ParcellesMap parcelles={parcellesMap.data} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2E7D32" />
          </View>
        ))}

      {vue === "liste" && (
        <FlatList
          data={parcelles.data}
          keyExtractor={(p) => p.id}
          contentContainerClassName="p-4 gap-3 pb-32"
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-gray-200 bg-white p-4">
              <View className="flex-row items-start justify-between">
                <Text className="flex-1 text-lg font-semibold" numberOfLines={1}>
                  {item.nom}
                </Text>
                <Pressable
                  onPress={() => onDelete(item.id, item.nom)}
                  hitSlop={8}
                  accessibilityLabel="Supprimer"
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#9CA3AF" />
                </Pressable>
              </View>
              <View className="mt-2 flex-row justify-between">
                <Text className="text-sm text-gray-500">Surface</Text>
                <Text className="text-sm font-medium">{formatSurface(item.surfaceM2)}</Text>
              </View>
              <View className="mt-1 flex-row justify-between">
                <Text className="text-sm text-gray-500">Zone</Text>
                <Text className="text-sm">{libelleZone(item.zone)}</Text>
              </View>
              {item.identifiantCadastral && (
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-sm text-gray-500">N° cadastral</Text>
                  <Text className="font-mono text-xs">{item.identifiantCadastral}</Text>
                </View>
              )}
              {item.notes && <Text className="mt-2 text-xs text-gray-500">{item.notes}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}
