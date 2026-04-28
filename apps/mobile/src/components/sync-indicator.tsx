import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { watermelondbHealthcheck } from "@/lib/watermelondb";

type Status = "idle" | "ok" | "error";

export function SyncIndicator() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    watermelondbHealthcheck()
      .then((ok) => {
        if (!cancelled) setStatus(ok ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const colorClass =
    status === "ok" ? "bg-green" : status === "error" ? "bg-red-500" : "bg-yellow-400";

  const label =
    status === "ok"
      ? "stockage local prêt"
      : status === "error"
        ? "stockage local indisponible"
        : "vérification…";

  return (
    <View className="flex-row items-center gap-2">
      <View className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  );
}
