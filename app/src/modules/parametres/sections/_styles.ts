/**
 * Classes utilitaires partagées par les sections Paramètres.
 * (Séparé de _shared.tsx pour permettre Fast Refresh sur les composants.)
 */

export const inputClass =
  'h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15 disabled:bg-[#f8f8f5] disabled:text-(--color-muted)';

export const textareaClass =
  'w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15 disabled:bg-[#f8f8f5] disabled:text-(--color-muted)';

export const selectClass = inputClass;
