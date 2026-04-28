import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useCurrentTenant } from "@/lib/auth";

export default function HomeScreen() {
  const tenant = useCurrentTenant();
  const prenom = tenant.data?.nom?.split(" ")[0] ?? "agriculteur";

  return (
    <ScrollView contentContainerClassName="px-4 py-6">
      <Text className="text-2xl font-bold">Bonjour {prenom} 👋</Text>
      <Text className="mt-1 text-base text-gray-600">Que souhaitez-vous faire ?</Text>

      <PrimaryCard
        href="/interventions/new"
        title="Saisir une intervention"
        subtitle="Semis, fumure, phyto, récolte"
        iconName="sprout"
      />

      <View className="mt-4 flex-row gap-3">
        <SecondaryCard href="/parcelles" title="Mes parcelles" iconName="map-marker-outline" />
        <SecondaryCard href="/srpa" title="SRPA aujourd'hui" iconName="clipboard-text-outline" />
      </View>

      <Text className="mt-8 text-xs text-gray-400">
        Astuce : utilise le bouton « + » en bas à droite pour créer rapidement depuis n'importe
        quelle page.
      </Text>
    </ScrollView>
  );
}

function PrimaryCard({
  href,
  title,
  subtitle,
  iconName,
}: {
  href: Href;
  title: string;
  subtitle: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <Link href={href} asChild>
      <Pressable className="mt-8 items-center justify-center rounded-2xl bg-green p-6 active:bg-green-dark">
        <MaterialCommunityIcons name={iconName} size={32} color="#fff" />
        <Text className="mt-2 text-xl font-semibold text-white">{title}</Text>
        <Text className="mt-1 text-sm text-white/80">{subtitle}</Text>
      </Pressable>
    </Link>
  );
}

function SecondaryCard({
  href,
  title,
  iconName,
}: {
  href: Href;
  title: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white p-5">
        <MaterialCommunityIcons name={iconName} size={24} color="#2E7D32" />
        <Text className="mt-2 text-center text-base font-semibold">{title}</Text>
      </Pressable>
    </Link>
  );
}
