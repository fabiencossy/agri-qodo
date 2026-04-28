import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAnimauxSummary, useCreateBatch, useRemoveBatch } from "@/lib/animaux";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
} from "@/lib/srpa";

export default function AnimauxScreen() {
  const summary = useAnimauxSummary();
  const total = (summary.data ?? []).reduce((acc, s) => acc + s.nombreActifs, 0);

  if (summary.isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#2E7D32" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-4 pb-32 gap-3">
      <View className="mb-2">
        <Text className="text-2xl font-bold">Cheptel</Text>
        <Text className="text-sm text-gray-600">
          {total} animal{total > 1 ? "x" : ""} actif{total > 1 ? "s" : ""}
        </Text>
      </View>

      {CATEGORIES_ORDER.map((cat) => {
        const row = summary.data?.find((s) => s.categorie === cat);
        return <CategorieRow key={cat} categorie={cat} current={row?.nombreActifs ?? 0} />;
      })}
    </ScrollView>
  );
}

function CategorieRow({ categorie, current }: { categorie: AnimalCategorie; current: number }) {
  const [delta, setDelta] = useState("1");
  const createBatch = useCreateBatch();
  const removeBatch = useRemoveBatch();
  const isPending = createBatch.isPending || removeBatch.isPending;
  const n = Math.max(1, Math.floor(Number(delta) || 1));

  const onAdd = () => {
    createBatch.mutate(
      { categorie, nombre: n },
      {
        onError: (err) =>
          Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible d'ajouter."),
      },
    );
  };
  const onRemove = () => {
    if (n > current) return;
    Alert.alert("Confirmer", `Retirer ${n} ${libelleCategorie(categorie).toLowerCase()} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: () => removeBatch.mutate({ categorie, nombre: n }),
      },
    ]);
  };

  return (
    <View
      className={`flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 ${
        current === 0 ? "opacity-60" : ""
      }`}
    >
      <Text className="text-2xl">{emojiCategorie(categorie)}</Text>
      <View className="flex-1">
        <Text className="font-medium">{libelleCategorie(categorie)}</Text>
        <Text className="text-sm text-gray-500">
          {current} actif{current > 1 ? "s" : ""}
        </Text>
      </View>
      <TextInput
        keyboardType="number-pad"
        value={delta}
        onChangeText={setDelta}
        className="h-10 w-14 rounded-md border border-gray-300 px-2 text-center text-base"
      />
      <Pressable
        onPress={onRemove}
        disabled={isPending || current === 0 || n > current}
        accessibilityLabel="Retirer"
        className="h-10 w-10 items-center justify-center rounded-md border border-gray-200 disabled:opacity-30"
      >
        <MaterialCommunityIcons name="minus" size={18} color="#374151" />
      </Pressable>
      <Pressable
        onPress={onAdd}
        disabled={isPending}
        accessibilityLabel="Ajouter"
        className="h-10 w-10 items-center justify-center rounded-md bg-green disabled:opacity-50"
      >
        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}
