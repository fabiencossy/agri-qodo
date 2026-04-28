import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCurrentTenant } from "@/lib/auth";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const tenant = useCurrentTenant();
  return (
    <SafeAreaView edges={["top"]} className="bg-white">
      <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
        <Pressable
          onPress={onMenuClick}
          accessibilityLabel="Ouvrir le menu"
          hitSlop={8}
          className="rounded-md p-1"
        >
          <MaterialCommunityIcons name="menu" size={24} color="#1F2937" />
        </Pressable>
        <Text className="text-lg font-bold text-green">🌱 Agri Qodo</Text>
        {tenant.data && (
          <Text className="flex-1 text-xs text-gray-500" numberOfLines={1}>
            {tenant.data.nom}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
