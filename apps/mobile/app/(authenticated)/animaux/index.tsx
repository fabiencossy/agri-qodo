import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAnimauxSummary, useSetEffectif } from "@/lib/animaux";
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
          {total} animau{total > 1 ? "x" : "l"} actif{total > 1 ? "s" : ""}
        </Text>
        <Text className="mt-1 text-xs text-gray-400">
          Saisis le total désiré puis valide. Les bovins seront tirés de la BDTA à terme.
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
  const [target, setTarget] = useState(String(current));
  const setEffectif = useSetEffectif();

  useEffect(() => {
    setTarget(String(current));
  }, [current]);

  const n = Math.max(0, Math.floor(Number(target) || 0));
  const dirty = n !== current;

  const onSave = () => {
    if (!dirty) return;
    if (n < current) {
      Alert.alert(
        "Confirmer",
        `Retirer ${current - n} ${libelleCategorie(categorie).toLowerCase()} ? Les non-identifiés sont retirés en priorité.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Valider",
            style: "destructive",
            onPress: () => setEffectif.mutate({ categorie, total: n }),
          },
        ],
      );
    } else {
      setEffectif.mutate({ categorie, total: n });
    }
  };

  return (
    <View
      className={`flex-row items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 ${
        current === 0 && !dirty ? "opacity-60" : ""
      }`}
    >
      <Text className="text-2xl">{emojiCategorie(categorie)}</Text>
      <View className="flex-1">
        <Text className="font-medium">{libelleCategorie(categorie)}</Text>
        <Text className="text-sm text-gray-500">
          {current} actif{current > 1 ? "s" : ""}
        </Text>
      </View>
      <Pressable
        onPress={() => setTarget(String(Math.max(0, n - 1)))}
        disabled={setEffectif.isPending || n === 0}
        accessibilityLabel="Diminuer"
        className="h-10 w-10 items-center justify-center rounded-md border border-gray-200 disabled:opacity-30"
      >
        <MaterialCommunityIcons name="minus" size={18} color="#374151" />
      </Pressable>
      <TextInput
        keyboardType="number-pad"
        value={target}
        onChangeText={setTarget}
        className="h-10 w-14 rounded-md border border-gray-300 px-2 text-center text-base"
      />
      <Pressable
        onPress={() => setTarget(String(n + 1))}
        disabled={setEffectif.isPending}
        accessibilityLabel="Augmenter"
        className="h-10 w-10 items-center justify-center rounded-md border border-gray-200 disabled:opacity-30"
      >
        <MaterialCommunityIcons name="plus" size={18} color="#374151" />
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={!dirty || setEffectif.isPending}
        accessibilityLabel="Valider"
        className="h-10 w-10 items-center justify-center rounded-md bg-green disabled:opacity-30"
      >
        <MaterialCommunityIcons name="check" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}
