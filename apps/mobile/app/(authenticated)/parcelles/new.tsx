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
import { useCreateParcelle, type ZoneAgricole } from "@/lib/parcelles";

const ZONES: Array<{ value: ZoneAgricole; label: string }> = [
  { value: "ZA", label: "ZA — Zone agricole" },
  { value: "ZP", label: "ZP — Zone des prairies" },
  { value: "ZM1", label: "ZM1 — Montagne I" },
  { value: "ZM2", label: "ZM2 — Montagne II" },
  { value: "ZM3", label: "ZM3 — Montagne III" },
  { value: "ZM4", label: "ZM4 — Montagne IV" },
  { value: "ZE", label: "ZE — Estivage" },
];

const formSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire").max(120),
  surfaceM2: z.coerce
    .number({ invalid_type_error: "Surface invalide" })
    .positive("La surface doit être positive"),
  zone: z.enum(["ZA", "ZP", "ZM1", "ZM2", "ZM3", "ZM4", "ZE"]),
  identifiantCadastral: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewParcelleScreen() {
  const createMutation = useCreateParcelle();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: "",
      surfaceM2: 0,
      zone: "ZA",
      identifiantCadastral: "",
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        nom: values.nom,
        surfaceM2: values.surfaceM2,
        zone: values.zone,
        ...(values.identifiantCadastral
          ? { identifiantCadastral: values.identifiantCadastral }
          : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      {
        onSuccess: () => router.replace("/parcelles"),
        onError: () => Alert.alert("Création impossible", "Vérifie les valeurs et réessaie."),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="p-4 gap-4 pb-32">
        <Text className="text-2xl font-bold">Nouvelle parcelle</Text>

        <Field label="Nom" error={errors.nom?.message}>
          <Controller
            control={control}
            name="nom"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                placeholder="Champ du Loup"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </Field>

        <Field label="Surface (m²)" hint="1 hectare = 10 000 m²" error={errors.surfaceM2?.message}>
          <Controller
            control={control}
            name="surfaceM2"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                placeholder="12500"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={value === 0 ? "" : String(value)}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </Field>

        <Field label="Zone agricole" error={errors.zone?.message}>
          <Controller
            control={control}
            name="zone"
            render={({ field: { value, onChange } }) => (
              <View className="flex-row flex-wrap gap-2">
                {ZONES.map((z) => (
                  <Pressable
                    key={z.value}
                    onPress={() => onChange(z.value)}
                    className={`rounded-full border px-3 py-2 ${
                      value === z.value ? "border-green bg-green/10" : "border-gray-300"
                    }`}
                  >
                    <Text
                      className={`text-sm ${value === z.value ? "font-medium text-green" : ""}`}
                    >
                      {z.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </Field>

        <Field
          label="Identifiant cadastral (optionnel)"
          error={errors.identifiantCadastral?.message}
        >
          <Controller
            control={control}
            name="identifiantCadastral"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                placeholder="VD-1234-5678"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </Field>

        <Field label="Notes (optionnel)" error={errors.notes?.message}>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="min-h-24 rounded-lg border border-gray-300 px-3 py-2 text-base"
                placeholder="Observations particulières (drainage, exposition…)"
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
            className="h-14 flex-1 items-center justify-center rounded-lg bg-green active:bg-green-dark"
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">Créer la parcelle</Text>
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
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-gray-700">{label}</Text>
      {children}
      {hint && !error && <Text className="mt-1 text-xs text-gray-400">{hint}</Text>}
      {error && <Text className="mt-1 text-sm text-red-600">{error}</Text>}
    </View>
  );
}
