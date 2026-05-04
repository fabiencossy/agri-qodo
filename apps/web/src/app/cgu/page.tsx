/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Agri Qodo",
  description: "Conditions générales d'utilisation du service Agri Qodo (CGU).",
};

export default function CguPage() {
  return (
    <LegalPageShell title="Conditions générales d'utilisation" lastUpdated="2026-04-30">
      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions générales d'utilisation (« CGU ») régissent l'accès et l'usage du
        service Agri Qodo (« le Service »), édité par <strong>Qodo SA</strong>, société de droit
        suisse dont le siège est Chemin des Halles 3, 1510 Moudon, Suisse (« l'Éditeur »).
      </p>
      <p>
        L'utilisation du Service implique l'acceptation pleine et entière des présentes CGU.
        L'Utilisateur déclare avoir pris connaissance des CGU lors de la création de son compte.
      </p>

      <h2>2. Description du service</h2>
      <p>
        Agri Qodo est un logiciel de gestion d'exploitation agricole proposé en mode SaaS, destiné
        aux agriculteurs, entrepreneurs de travaux agricoles (ETA) et autres professionnels du
        secteur. Il permet notamment la tenue du carnet des champs, la gestion des animaux, la
        facturation des travaux pour tiers et la conformité réglementaire suisse (Suisse-Bilanz,
        SRPA, OPD).
      </p>
      <p>
        Le Service est distribué sous licence libre <strong>AGPL v3</strong>. Le code source est
        publié sur GitHub à l'adresse <code>github.com/fabiencossy/agri-qodo</code>.
      </p>

      <h2>3. Création de compte</h2>
      <p>
        L'inscription est gratuite et ouverte à toute personne disposant d'une adresse e-mail
        valide. L'Utilisateur garantit l'exactitude des informations fournies. Un compte par
        exploitation est attendu ; un même Utilisateur peut être rattaché à plusieurs exploitations
        via un mécanisme de partenariat.
      </p>

      <h2>4. Engagements de l'Utilisateur</h2>
      <ul>
        <li>
          Ne pas utiliser le Service à des fins illicites, frauduleuses ou contraires aux droits de
          tiers.
        </li>
        <li>
          Préserver la confidentialité de ses identifiants et signaler sans délai toute
          compromission présumée à l'Éditeur.
        </li>
        <li>
          Saisir des données conformes à la réalité (parcelles, animaux, interventions) et veiller
          au respect des obligations légales suisses (LPD, OPD, OAgr).
        </li>
        <li>Respecter les droits de propriété intellectuelle de l'Éditeur et des tiers.</li>
      </ul>

      <h2>5. Données et propriété</h2>
      <p>
        Les données saisies par l'Utilisateur restent <strong>sa propriété exclusive</strong>.
        L'Éditeur agit comme sous-traitant au sens de la nLPD et du RGPD. Voir notre{" "}
        <a href="/politique-confidentialite">Politique de confidentialité</a> pour le détail des
        traitements.
      </p>
      <p>
        L'Utilisateur peut à tout moment exporter ses données au format CSV ou demander leur
        suppression définitive en contactant l'Éditeur.
      </p>

      <h2>6. Disponibilité et maintenance</h2>
      <p>
        L'Éditeur s'efforce d'assurer la disponibilité du Service 24h/24 et 7j/7, sans toutefois
        garantir aucun niveau de service contractuel à ce stade du projet. Des opérations de
        maintenance peuvent entraîner des interruptions ponctuelles.
      </p>

      <h2>7. Limitation de responsabilité</h2>
      <p>
        Le Service est fourni « en l'état », sans garantie expresse ou implicite. L'Éditeur ne
        saurait être tenu responsable de pertes de données, de dommages indirects, ou de manquements
        à des obligations légales (déclarations PER, BDTA, fiscales) qui demeurent de la seule
        responsabilité de l'Utilisateur.
      </p>

      <h2>8. Résiliation</h2>
      <p>
        L'Utilisateur peut résilier son compte à tout moment depuis son profil. L'Éditeur peut
        suspendre ou résilier un compte en cas de manquement grave aux présentes CGU, après mise en
        demeure restée sans effet.
      </p>

      <h2>9. Modification des CGU</h2>
      <p>
        L'Éditeur se réserve le droit de modifier les CGU. L'Utilisateur sera informé par e-mail des
        modifications matérielles, et pourra être invité à ré-accepter les nouvelles CGU.
      </p>

      <h2>10. Droit applicable et juridiction</h2>
      <p>
        Les présentes CGU sont régies par le <strong>droit suisse</strong>. Tout litige relève de la
        compétence exclusive des tribunaux du canton de Vaud, Suisse, sous réserve des règles
        impératives de protection des consommateurs.
      </p>

      <h2>11. Contact</h2>
      <p>
        Toute question relative aux présentes CGU peut être adressée à : <br />
        <strong>Qodo SA</strong>
        <br />
        Chemin des Halles 3
        <br />
        1510 Moudon, Suisse
        <br />
        <a href="mailto:contact@qodo.ch">contact@qodo.ch</a>
      </p>
    </LegalPageShell>
  );
}
