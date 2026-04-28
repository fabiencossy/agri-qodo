import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import type { Href } from "expo-router";
import { useEffect } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCurrentTenant, useLogout } from "@/lib/auth";

interface NavLink {
  href: Href;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const NAVIGATION: NavLink[] = [
  { href: "/", label: "Accueil", icon: "home-outline" },
  { href: "/parcelles", label: "Parcelles", icon: "map-marker-outline" },
  {
    href: "/interventions",
    label: "Carnet des champs",
    icon: "sprout-outline",
  },
  { href: "/animaux", label: "Cheptel", icon: "cow" },
  { href: "/srpa", label: "SRPA", icon: "clipboard-text-outline" },
];

const PILOTAGE: NavLink[] = [
  { href: "/stats", label: "Statistiques", icon: "chart-bar" },
  { href: "/veille", label: "Veille réglementaire", icon: "book-open-outline" },
];

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const tenant = useCurrentTenant();
  const logout = useLogout();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 flex-row bg-black/30"
        onPress={onClose}
        accessibilityLabel="Fermer le menu"
      >
        <Pressable className="h-full w-72 bg-white" onPress={() => undefined}>
          <SafeAreaView edges={["top"]} className="flex-1 bg-white">
            <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
              <Text className="text-lg font-bold text-green">🌱 Agri Qodo</Text>
              <Pressable onPress={onClose} accessibilityLabel="Fermer" hitSlop={8}>
                <MaterialCommunityIcons name="close" size={24} color="#374151" />
              </Pressable>
            </View>

            {tenant.data && (
              <View className="border-b border-gray-200 px-4 py-3">
                <Text className="text-sm font-medium">{tenant.data.nom}</Text>
                <Text className="font-mono text-xs text-gray-500">{tenant.data.code}</Text>
              </View>
            )}

            <ScrollView className="flex-1">
              <NavSection title="Navigation">
                {NAVIGATION.map((link) => (
                  <NavItem key={link.label} link={link} pathname={pathname} />
                ))}
              </NavSection>
              <NavSection title="Pilotage">
                {PILOTAGE.map((link) => (
                  <NavItem key={link.label} link={link} pathname={pathname} />
                ))}
              </NavSection>
            </ScrollView>

            <SafeAreaView edges={["bottom"]} className="border-t border-gray-200 p-3">
              <Pressable
                onPress={() => logout.mutate()}
                disabled={logout.isPending}
                className="flex-row items-center gap-3 rounded-md p-2"
              >
                <MaterialCommunityIcons name="logout" size={18} color="#6B7280" />
                <Text className="text-sm text-gray-700">
                  {logout.isPending ? "Déconnexion…" : "Déconnexion"}
                </Text>
              </Pressable>
            </SafeAreaView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4 px-3 pt-3">
      <Text className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const hrefStr = typeof link.href === "string" ? link.href : "";
  const isActive = hrefStr === "/" ? pathname === "/" : pathname.startsWith(hrefStr);
  return (
    <Link href={link.href} asChild>
      <Pressable
        className={`flex-row items-center gap-3 rounded-md px-2 py-2 ${
          isActive ? "bg-green/10" : ""
        }`}
      >
        <MaterialCommunityIcons
          name={link.icon}
          size={18}
          color={isActive ? "#2E7D32" : "#374151"}
        />
        <Text className={`text-sm ${isActive ? "font-medium text-green" : "text-gray-700"}`}>
          {link.label}
        </Text>
      </Pressable>
    </Link>
  );
}
