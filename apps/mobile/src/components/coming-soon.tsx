import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";

export function ComingSoon({
  iconName,
  title,
  module,
  description,
}: {
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  module: string;
  description: string;
}) {
  return (
    <ScrollView contentContainerClassName="items-center px-6 py-16">
      <MaterialCommunityIcons name={iconName} size={64} color="#2E7D3266" />
      <Text className="mt-4 text-2xl font-bold">{title}</Text>
      <Text className="mt-1 text-xs uppercase tracking-wider text-gray-400">{module}</Text>
      <Text className="mt-4 max-w-md text-center text-sm text-gray-600">{description}</Text>
      <View className="mt-8 rounded-lg border border-dashed border-gray-300 px-4 py-3">
        <Text className="text-xs text-gray-500">🌱 Module en cours de développement</Text>
      </View>
    </ScrollView>
  );
}
