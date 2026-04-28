/**
 * @agri-qodo/shared — types et schémas partagés.
 *
 * Contient les types DTO, schémas zod, et modèles partagés entre
 * backend, web et mobile.
 */

export const PACKAGE_NAME = "@agri-qodo/shared" as const;

export type Tenant = {
  id: string;
  name: string;
};
