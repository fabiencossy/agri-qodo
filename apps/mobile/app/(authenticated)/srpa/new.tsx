import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
  useCreateSortie,
} from "@/lib/srpa";

const formSchema = z.object({
  date: z.string().min(1, "Date obligatoire"),
  categorie: z.enum([
    "VACHE_LAITIERE",
    "GENISSE",
    "VEAU",
    "TAUREAU",
    "BOEUF",
    "AUTRE_BOVIN",
    "PORC",
    "POULET",
    "AUTRE",
  ]),
  nombreAnimaux: z.coerce.number().int().min(0).optional().or(z.literal(NaN)),
  dureeHeures: z.coerce.number().min(0).max(24).optional().or(z.literal(NaN)),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;
const today = (): string => new Date().toISOString().slice(0, 10);

export default function NewSortieScreen() {
  const createMutation = useCreateSortie();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: today(),
      categorie: "VACHE_LAITIERE",
      nombreAnimaux: undefined,
      dureeHeures: undefined,
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        date: values.date,
        categorie: values.categorie,
        ...(values.nombreAnimaux && !Number.isNaN(values.nombreAnimaux)
          ? { nombreAnimaux: values.nombreAnimaux }
          : {}),
        ...(values.dureeHeures && !Number.isNaN(values.dureeHeures)
          ? { dureeMinutes: Math.round(values.dureeHeures * 60) }
          : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      {
        onSuccess: () => router.replace("/srpa"),
        onError: (err) =>
          Alert.alert("Saisie impossible", err instanceof Error ? err.message : "Réessaie."),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="p-4 gap-4 pb-32">
        <Text className="text-2xl font-bold">Saisir une sortie</Text>

        <Field label="Catégorie d'animaux" error={errors.categorie?.message}>
          <Controller
            control={control}
            name="categorie"
            render={({ field: { value, onChange } }) => (
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES_ORDER.map((c: AnimalCategorie) => (
                  <Pressable
                    key={c}
                    onPress={() => onChange(c)}
                    className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${
                      value === c ? "border-green bg-green/10" : "border-gray-300"
                    }`}
                  >
                    <Text className="text-base">{emojiCategorie(c)}</Text>
                    <Text className={`text-sm ${value === c ? "font-medium text-green" : ""}`}>
                      {libelleCategorie(c)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </Field>

        <Field label="Date" error={errors.date?.message}>
          <Controller
            control={control}
            name="date"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                placeholder="2026-04-28"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </Field>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Animaux" error={errors.nombreAnimaux?.message}>
              <Controller
                control={control}
                name="nombreAnimaux"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                    placeholder="25"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    value={value === undefined || Number.isNaN(value) ? "" : String(value)}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Durée (h)" error={errors.dureeHeures?.message}>
              <Controller
                control={control}
                name="dureeHeures"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                    placeholder="8"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={value === undefined || Number.isNaN(value) ? "" : String(value)}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </Field>
          </View>
        </View>

        <Field label="Notes (optionnel)" error={errors.notes?.message}>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-base"
                placeholder="Conditions météo, parcelle…"
                placeholderTextColor="#9CA3AF"
                multiline
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </Field>

        <View className="mt-2 flex-row gap-3">
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            className="h-14 flex-1 items-center justify-center rounded-lg bg-green active:bg-green-dark disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">Enregistrer</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="h-14 items-center justify-center rounded-lg px-5"
          >
            <Text className="text-base text-gray-700">Annuler</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-gray-700">{label}</Text>
      {children}
      {error && <Text className="mt-1 text-sm text-red-600">{error}</Text>}
    </View>
  );
}
