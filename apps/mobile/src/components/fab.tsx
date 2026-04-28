import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

interface Action {
  href: Href;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const ACTIONS: Action[] = [
  {
    href: "/interventions/new",
    label: "Saisir une intervention",
    icon: "sprout",
  },
  { href: "/parcelles/new", label: "Nouvelle parcelle", icon: "map-marker" },
];

export function Fab() {
  const [open, setOpen] = useState(false);

  return (
    <View pointerEvents="box-none" className="absolute bottom-20 right-5 items-end gap-3">
      {open &&
        ACTIONS.map((action) => (
          <Link key={action.label} href={action.href} asChild>
            <Pressable
              onPress={() => setOpen(false)}
              className="flex-row items-center gap-3 rounded-full border border-gray-200 bg-white py-2 pl-3 pr-5"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-green/10">
                <MaterialCommunityIcons name={action.icon} size={18} color="#2E7D32" />
              </View>
              <Text className="text-sm font-medium">{action.label}</Text>
            </Pressable>
          </Link>
        ))}

      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityLabel={open ? "Fermer le menu d'actions" : "Ouvrir le menu d'actions"}
        className="h-14 w-14 items-center justify-center rounded-full bg-green active:bg-green-dark"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        }}
      >
        <MaterialCommunityIcons name={open ? "close" : "plus"} size={28} color="#fff" />
      </Pressable>
    </View>
  );
}
