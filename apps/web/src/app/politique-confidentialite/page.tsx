/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Agri Qodo",
  description: "Comment Agri Qodo collecte, traite et protège vos données personnelles.",
};

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalPageShell title="Politique de confidentialité" lastUpdated="2026-04-30">
      <h2>1. Responsable du traitement</h2>
      <p>
        <strong>Qodo SA</strong>, Chemin des Halles 3, 1510 Moudon, Suisse, est responsable du
        traitement des données personnelles collectées dans le cadre du Service Agri Qodo.
      </p>
      <p>
        Cette politique est conforme à la{" "}
        <strong>nouvelle Loi fédérale sur la protection des données (nLPD)</strong> en vigueur en
        Suisse depuis le 1<sup>er</sup> septembre 2023, ainsi qu'au{" "}
        <strong>Règlement général sur la protection des données (RGPD)</strong> applicable aux
        utilisateurs de l'Union européenne.
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li>
          <strong>Compte</strong> : prénom, nom, e-mail, mot de passe (haché, jamais en clair),
          téléphone optionnel, préférences d'interface.
        </li>
        <li>
          <strong>Exploitation</strong> : nom, canton, adresse, NPA, code exploitation.
        </li>
        <li>
          <strong>Données métier</strong> : parcelles, cultures, interventions, animaux, travaux,
          présences, partenaires. Saisies volontairement par l'Utilisateur.
        </li>
        <li>
          <strong>Connexion</strong> : adresse IP, user-agent navigateur, horodatages de connexion
          (dernière connexion, demandes de réinitialisation).
        </li>
      </ul>

      <h2>3. Finalités</h2>
      <ul>
        <li>Fournir le Service et permettre la gestion de l'exploitation.</li>
        <li>Authentifier l'Utilisateur et sécuriser son compte.</li>
        <li>Envoyer des e-mails transactionnels (vérification, bienvenue, réinitialisation).</li>
        <li>Détecter les abus (rate limiting, audit de sécurité).</li>
        <li>
          Synchroniser optionnellement avec Odoo Enterprise du client si configuré (les credentials
          Odoo sont chiffrés AES-256-GCM dans notre base, jamais accessibles en clair).
        </li>
      </ul>

      <h2>4. Base légale</h2>
      <p>
        Les traitements reposent sur l'<strong>exécution du contrat</strong> conclu via les CGU
        (création de compte, fonctionnement du Service) ou sur le{" "}
        <strong>consentement explicite</strong> de l'Utilisateur (mails marketing — non actifs à ce
        stade).
      </p>

      <h2>5. Sous-traitants et hébergement</h2>
      <ul>
        <li>
          <strong>Hébergement principal</strong> : Infomaniak (Cloud Server, Genève, Suisse). Les
          données sont stockées exclusivement en Suisse.
        </li>
        <li>
          <strong>Frontend</strong> : Vercel Inc. (États-Unis) pour l'hébergement statique et les
          rewrites — aucune donnée personnelle n'y transite, le frontend appelle directement l'API
          Suisse.
        </li>
        <li>
          <strong>E-mails transactionnels</strong> : Resend Inc. (États-Unis). Les e-mails (adresse
          du destinataire, contenu transactionnel) sont transmis à ce sous-traitant. Resend est
          conforme aux clauses contractuelles types et au DPA RGPD.
        </li>
        <li>
          <strong>Odoo</strong> : si l'Utilisateur configure une intégration Odoo, les données
          synchronisées (produits, partenaires, sale.order) sont transmises à l'instance Odoo qu'il
          a lui-même choisie (Odoo SA ou hébergeur tiers). Cette transmission est sous sa
          responsabilité.
        </li>
      </ul>

      <h2>6. Durée de conservation</h2>
      <ul>
        <li>
          <strong>Données métier</strong> : conservées tant que le compte est actif. Suppression sur
          demande, sous 30 jours.
        </li>
        <li>
          <strong>Logs techniques</strong> : 12 mois maximum.
        </li>
        <li>
          <strong>Tokens d'authentification</strong> : durée de vie courte (refresh 30 jours,
          rotation à chaque connexion).
        </li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>Conformément à la nLPD et au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li>
          <strong>Accès</strong> : obtenir une copie de vos données personnelles.
        </li>
        <li>
          <strong>Rectification</strong> : corriger des données inexactes (directement depuis votre
          profil ou par e-mail).
        </li>
        <li>
          <strong>Effacement</strong> : demander la suppression définitive de vos données.
        </li>
        <li>
          <strong>Portabilité</strong> : exporter vos données au format CSV depuis chaque liste de
          l'application.
        </li>
        <li>
          <strong>Opposition</strong> : retirer votre consentement à tout moment.
        </li>
      </ul>
      <p>
        Pour exercer ces droits, écrivez à <a href="mailto:privacy@qodo.ch">privacy@qodo.ch</a>. En
        cas de litige, vous pouvez saisir le{" "}
        <strong>Préposé fédéral à la protection des données et à la transparence (PFPDT)</strong> en
        Suisse, ou l'autorité compétente de votre État membre dans l'UE.
      </p>

      <h2>8. Sécurité</h2>
      <ul>
        <li>HTTPS strict (TLS 1.3, Let's Encrypt) sur tous les flux.</li>
        <li>Mots de passe stockés avec bcrypt (rounds ≥ 10).</li>
        <li>Credentials Odoo chiffrés AES-256-GCM par tenant.</li>
        <li>Sauvegardes quotidiennes chiffrées sur infrastructure tierce.</li>
        <li>Audit logs pour les modifications matérielles (en cours de déploiement).</li>
      </ul>

      <h2>9. Cookies</h2>
      <p>
        Voir notre <a href="/cookies">page Cookies</a> dédiée pour le détail des cookies et
        stockages locaux utilisés.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Cette politique peut être mise à jour. Nous vous informerons par e-mail des modifications
        matérielles affectant vos droits ou les traitements.
      </p>

      <h2>11. Contact</h2>
      <p>
        <strong>Qodo SA</strong> — Chemin des Halles 3, 1510 Moudon, Suisse
        <br />
        <a href="mailto:privacy@qodo.ch">privacy@qodo.ch</a>
      </p>
    </LegalPageShell>
  );
}
