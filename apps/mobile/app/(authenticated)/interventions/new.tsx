import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router } from "expo-router";
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
  emojiType,
  type InterventionType,
  libelleType,
  TYPES_ORDER,
  useCreateIntervention,
} from "@/lib/interventions";
import { useParcelles } from "@/lib/parcelles";

const formSchema = z.object({
  parcelleId: z.string().uuid("Parcelle obligatoire"),
  type: z.enum([
    "SEMIS",
    "FUMURE_ORGANIQUE",
    "FUMURE_MINERALE",
    "PHYTO",
    "RECOLTE",
    "TRAVAIL_DU_SOL",
    "IRRIGATION",
    "AUTRE",
  ]),
  dateOperation: z.string().min(1, "Date obligatoire"),
  produit: z.string().max(200).optional().or(z.literal("")),
  quantite: z.coerce.number().min(0).optional().or(z.literal(NaN)),
  unite: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const today = (): string => new Date().toISOString().slice(0, 10);

export default function NewInterventionScreen() {
  const createMutation = useCreateIntervention();
  const parcelles = useParcelles();

  const defaultParcelle = parcelles.data?.length === 1 ? (parcelles.data[0]?.id ?? "") : "";

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parcelleId: defaultParcelle,
      type: "PHYTO",
      dateOperation: today(),
      produit: "",
      quantite: undefined,
      unite: "",
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        parcelleId: values.parcelleId,
        type: values.type,
        dateOperation: values.dateOperation,
        ...(values.produit ? { produit: values.produit } : {}),
        ...(values.quantite && !Number.isNaN(values.quantite) ? { quantite: values.quantite } : {}),
        ...(values.unite ? { unite: values.unite } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      {
        onSuccess: () => router.replace("/interventions"),
        onError: () => Alert.alert("Saisie impossible", "Vérifie les valeurs et réessaie."),
      },
    );
  };

  const noParcelles = parcelles.data !== undefined && parcelles.data.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="p-4 gap-4 pb-32">
        <Text className="text-2xl font-bold">Saisir une intervention</Text>

        {noParcelles && (
          <View className="rounded-lg bg-amber-50 p-4">
            <Text className="text-sm text-amber-900">
              Vous devez d'abord créer au moins une parcelle.
            </Text>
            <Link href="/parcelles/new" asChild>
              <Pressable className="mt-2">
                <Text className="text-sm font-semibold text-amber-900 underline">
                  Créer une parcelle →
                </Text>
              </Pressable>
            </Link>
          </View>
        )}

        <Field label="Parcelle" error={errors.parcelleId?.message}>
          <Controller
            control={control}
            name="parcelleId"
            render={({ field: { value, onChange } }) => (
              <View className="flex-row flex-wrap gap-2">
                {parcelles.data?.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => onChange(p.id)}
                    className={`rounded-full border px-3 py-2 ${
                      value === p.id ? "border-green bg-green/10" : "border-gray-300"
                    }`}
                  >
                    <Text className={`text-sm ${value === p.id ? "font-medium text-green" : ""}`}>
                      {p.nom}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </Field>

        <Field label="Type d'opération" error={errors.type?.message}>
          <Controller
            control={control}
            name="type"
            render={({ field: { value, onChange } }) => (
              <View className="flex-row flex-wrap gap-2">
                {TYPES_ORDER.map((t: InterventionType) => (
                  <Pressable
                    key={t}
                    onPress={() => onChange(t)}
                    className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${
                      value === t ? "border-green bg-green/10" : "border-gray-300"
                    }`}
                  >
                    <Text className="text-base">{emojiType(t)}</Text>
                    <Text className={`text-sm ${value === t ? "font-medium text-green" : ""}`}>
                      {libelleType(t)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </Field>

        <Field label="Date" error={errors.dateOperation?.message}>
          <Controller
            control={control}
            name="dateOperation"
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

        <Field
          label="Produit (optionnel)"
          hint="Nom commercial ou code OPPh"
          error={errors.produit?.message}
        >
          <Controller
            control={control}
            name="produit"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                placeholder="Roundup MAX 360"
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
            <Field label="Quantité" error={errors.quantite?.message}>
              <Controller
                control={control}
                name="quantite"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                    placeholder="25.5"
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
          <View className="flex-1">
            <Field label="Unité" error={errors.unite?.message}>
              <Controller
                control={control}
                name="unite"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                    placeholder="L, kg, t…"
                    placeholderTextColor="#9CA3AF"
                    value={value}
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
                className="min-h-24 rounded-lg border border-gray-300 px-3 py-2 text-base"
                placeholder="Conditions météo, observations…"
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
            disabled={createMutation.isPending || noParcelles}
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
