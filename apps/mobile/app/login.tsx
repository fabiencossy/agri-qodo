import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";
import { useIsAuthenticated, useLogin } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const auth = useIsAuthenticated();
  const login = useLogin();

  useEffect(() => {
    if (auth.data === true) router.replace("/");
  }, [auth.data]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginForm) => login.mutate(data);

  const errorMessage =
    login.error instanceof ApiError && login.error.status === 401
      ? "E-mail ou mot de passe incorrect."
      : login.error
        ? "Connexion impossible. Réessayer plus tard."
        : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center">
          <Text className="text-3xl font-bold text-green">🌱 Agri Qodo</Text>
          <Text className="mt-2 text-sm text-gray-500">Connectez-vous à votre exploitation</Text>
        </View>

        <View className="rounded-2xl border border-gray-200 bg-white p-5">
          <Text className="mb-1 text-sm font-medium text-gray-700">E-mail</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="marie@ferme-rolet.ch"
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          {errors.email && (
            <Text className="mt-1 text-sm text-red-600">{errors.email.message}</Text>
          )}

          <Text className="mb-1 mt-4 text-sm font-medium text-gray-700">Mot de passe</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="h-12 rounded-lg border border-gray-300 px-3 text-base"
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          {errors.password && (
            <Text className="mt-1 text-sm text-red-600">{errors.password.message}</Text>
          )}

          {errorMessage && (
            <View className="mt-4 rounded-md bg-red-50 px-3 py-2">
              <Text className="text-sm text-red-700">{errorMessage}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={login.isPending}
            className="mt-5 h-14 items-center justify-center rounded-lg bg-green active:bg-green-dark disabled:opacity-50"
          >
            {login.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-lg font-semibold text-white">Se connecter</Text>
            )}
          </Pressable>
        </View>

        <Text className="mt-6 text-center text-xs text-gray-400">
          Stockage local — vous pouvez travailler hors ligne.
        </Text>
      </View>
    </SafeAreaView>
  );
}
