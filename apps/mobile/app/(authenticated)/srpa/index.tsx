import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import {
  emojiCategorie,
  formatDateFr,
  libelleCategorie,
  useDeleteSortie,
  useSrpa,
} from "@/lib/srpa";

export default function SrpaScreen() {
  const sorties = useSrpa();
  const deleteMutation = useDeleteSortie();

  const onDelete = (id: string, label: string) => {
    Alert.alert("Supprimer", `${label} sera supprimée.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  if (sorties.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#2E7D32" />
      </View>
    );
  }

  if (!sorties.data || sorties.data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <MaterialCommunityIcons name="clipboard-text-outline" size={56} color="#9CA3AF" />
        <Text className="mt-3 text-lg font-semibold">Aucune sortie enregistrée</Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          Saisis tes sorties au pâturage en quelques secondes pour le SRPA (paiements directs PER).
        </Text>
        <Link href="/srpa/new" asChild>
          <Pressable className="mt-6 rounded-lg bg-green px-5 py-3">
            <Text className="text-base font-semibold text-white">+ Première sortie</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <FlatList
      data={sorties.data}
      keyExtractor={(s) => s.id}
      contentContainerClassName="p-4 gap-2 pb-32"
      renderItem={({ item }) => (
        <View className="flex-row items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-green/10">
            <Text className="text-2xl">{emojiCategorie(item.categorie)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold">
              {libelleCategorie(item.categorie)}
              {item.nombreAnimaux !== null && (
                <Text className="font-normal text-gray-500"> · {item.nombreAnimaux}</Text>
              )}
            </Text>
            <Text className="text-sm capitalize text-gray-500">
              {formatDateFr(item.date)}
              {item.dureeMinutes !== null && ` · ${Math.round(item.dureeMinutes / 60)} h`}
            </Text>
            {item.notes && <Text className="mt-1 text-xs text-gray-600">{item.notes}</Text>}
          </View>
          <Pressable
            onPress={() =>
              onDelete(item.id, `${libelleCategorie(item.categorie)} — ${formatDateFr(item.date)}`)
            }
            hitSlop={8}
            accessibilityLabel="Supprimer"
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#9CA3AF" />
          </Pressable>
        </View>
      )}
    />
  );
}
