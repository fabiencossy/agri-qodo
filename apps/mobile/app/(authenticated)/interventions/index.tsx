import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import {
  emojiType,
  formatDateFr,
  formatQuantite,
  libelleType,
  useDeleteIntervention,
  useInterventions,
} from "@/lib/interventions";

export default function InterventionsScreen() {
  const interventions = useInterventions();
  const deleteMutation = useDeleteIntervention();

  const onDelete = (id: string, label: string) => {
    Alert.alert("Supprimer", `${label} sera définitivement supprimée.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  if (interventions.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#2E7D32" />
      </View>
    );
  }

  if (interventions.isError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-sm text-red-600">
          Impossible de charger les interventions.
        </Text>
      </View>
    );
  }

  if (!interventions.data || interventions.data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <MaterialCommunityIcons name="sprout" size={56} color="#9CA3AF" />
        <Text className="mt-3 text-lg font-semibold">Aucune intervention</Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          Saisis ta première intervention avec le bouton + en bas à droite.
        </Text>
        <Link href="/interventions/new" asChild>
          <Pressable className="mt-6 rounded-lg bg-green px-5 py-3">
            <Text className="text-base font-semibold text-white">+ Saisir une intervention</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <FlatList
      data={interventions.data}
      keyExtractor={(iv) => iv.id}
      contentContainerClassName="p-4 gap-3 pb-32"
      renderItem={({ item }) => {
        const quantite = formatQuantite(item.quantite, item.unite);
        return (
          <View className="rounded-2xl border border-gray-200 bg-white p-4">
            <View className="flex-row items-start gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-green/10">
                <Text className="text-2xl">{emojiType(item.type)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold">
                  {libelleType(item.type)}
                  {item.produit && (
                    <Text className="font-normal text-gray-500"> · {item.produit}</Text>
                  )}
                </Text>
                <Text className="text-sm text-gray-500">
                  {item.parcelle.nom} · {formatDateFr(item.dateOperation)}
                  {quantite && ` · ${quantite}`}
                </Text>
                {item.notes && <Text className="mt-1 text-sm text-gray-600">{item.notes}</Text>}
              </View>
              <Pressable
                onPress={() => onDelete(item.id, libelleType(item.type).toLowerCase())}
                hitSlop={8}
                accessibilityLabel="Supprimer"
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}
