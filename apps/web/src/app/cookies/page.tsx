/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Cookies — Agri Qodo",
  description: "Liste des cookies et stockages locaux utilisés par Agri Qodo.",
};

export default function CookiesPage() {
  return (
    <LegalPageShell title="Cookies et stockage local" lastUpdated="2026-04-30">
      <h2>1. Notre approche</h2>
      <p>
        Agri Qodo n'utilise <strong>aucun cookie publicitaire</strong> ni outil de mesure d'audience
        tiers (Google Analytics, Meta Pixel, etc.). Les seules données stockées dans votre
        navigateur servent au fonctionnement de l'application.
      </p>

      <h2>2. Stockage local utilisé</h2>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Type</th>
            <th>Finalité</th>
            <th>Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>agriqodo:tokens</code>
            </td>
            <td>localStorage</td>
            <td>
              Tokens d'authentification (access + refresh JWT) pour rester connecté entre les
              visites.
            </td>
            <td>Jusqu'à déconnexion ou 30 jours</td>
          </tr>
          <tr>
            <td>
              <code>agriqodo:active-tenant</code>
            </td>
            <td>localStorage</td>
            <td>Mémoriser le tenant actif (si plusieurs exploitations).</td>
            <td>Jusqu'à déconnexion</td>
          </tr>
          <tr>
            <td>
              <code>agriqodo:parcelles:view</code>
            </td>
            <td>localStorage</td>
            <td>Mémoriser le mode d'affichage préféré (Liste / Carte) sur la page Parcelles.</td>
            <td>Persistant</td>
          </tr>
          <tr>
            <td>
              <code>agriqodo:cookie-banner-dismissed</code>
            </td>
            <td>localStorage</td>
            <td>Mémoriser que le bandeau d'information a déjà été fermé.</td>
            <td>Persistant</td>
          </tr>
          <tr>
            <td>RxDB / IndexedDB</td>
            <td>IndexedDB</td>
            <td>Cache offline des données métier (parcelles, animaux, interventions).</td>
            <td>Tant que le compte est actif</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Cookies tiers</h2>
      <p>
        Aucun cookie tiers n'est déposé par Agri Qodo. Les e-mails transactionnels envoyés via
        Resend peuvent contenir un pixel de tracking permettant à Resend de mesurer la délivrabilité
        — vous pouvez le désactiver dans votre client mail (option « ne pas charger les images
        externes »).
      </p>

      <h2>4. Gérer ces stockages</h2>
      <p>
        Vous pouvez à tout moment effacer le stockage local et les cookies depuis les paramètres de
        votre navigateur :
      </p>
      <ul>
        <li>
          <strong>Chrome</strong> : Paramètres → Confidentialité et sécurité → Cookies et autres
          données de site.
        </li>
        <li>
          <strong>Firefox</strong> : Paramètres → Vie privée et sécurité → Cookies et données de
          sites.
        </li>
        <li>
          <strong>Safari</strong> : Préférences → Confidentialité → Gérer les données de sites web.
        </li>
      </ul>
      <p>
        Effacer le stockage local entraîne votre déconnexion ; vos données métier restent intactes
        sur nos serveurs et seront re-synchronisées à la prochaine connexion.
      </p>

      <h2>5. Plus d'informations</h2>
      <p>
        Voir notre <a href="/politique-confidentialite">Politique de confidentialité</a> pour une
        vue d'ensemble des traitements.
      </p>
    </LegalPageShell>
  );
}
