/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Mentions légales — Agri Qodo",
  description: "Informations légales relatives à l'éditeur du service Agri Qodo.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPageShell title="Mentions légales" lastUpdated="2026-04-30">
      <h2>Éditeur</h2>
      <p>
        <strong>Qodo SA</strong>
        <br />
        Chemin des Halles 3
        <br />
        1510 Moudon
        <br />
        Suisse
      </p>
      <p>
        E-mail : <a href="mailto:contact@qodo.ch">contact@qodo.ch</a>
        <br />
        Site web : <a href="https://qodo.ch">qodo.ch</a>
      </p>
      <p>
        <em>
          Numéro IDE / inscription au Registre du commerce / numéro de TVA : à compléter par
          l'Éditeur.
        </em>
      </p>

      <h2>Directeur de la publication</h2>
      <p>Fabien Cossy, Administrateur, Qodo SA.</p>

      <h2>Hébergement</h2>
      <ul>
        <li>
          <strong>Backend &amp; base de données</strong> :{" "}
          <a href="https://www.infomaniak.com" target="_blank" rel="noopener noreferrer">
            Infomaniak Network SA
          </a>
          , Rue Eugène-Marziano 25, 1227 Les Acacias, Genève, Suisse.
        </li>
        <li>
          <strong>Frontend</strong> :{" "}
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            Vercel Inc.
          </a>
          , 340 S Lemon Ave #4133, Walnut, CA 91789, USA.
        </li>
      </ul>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le code source du Service Agri Qodo est publié sous licence libre{" "}
        <strong>GNU AGPL v3</strong> sur GitHub :{" "}
        <a
          href="https://github.com/Qodo-Digital/agri-qodo"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/Qodo-Digital/agri-qodo
        </a>
        . Les marques, logos et identité visuelle « Agri Qodo » et « Qodo » sont la propriété
        exclusive de Qodo SA.
      </p>
      <p>
        Les données saisies par les Utilisateurs leur appartiennent intégralement (voir CGU et
        Politique de confidentialité).
      </p>

      <h2>Limitation de responsabilité</h2>
      <p>
        Le Service est fourni « tel quel », conformément à la licence AGPL v3 et aux CGU. L'Éditeur
        ne saurait être tenu responsable des dommages directs ou indirects découlant de l'usage du
        Service, ni des manquements aux obligations légales (PER, déclarations BDTA, Suisse-Bilanz)
        qui demeurent de la responsabilité exclusive de l'Utilisateur.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Les présentes mentions sont régies par le droit suisse. Tout litige relève des tribunaux
        compétents du canton de Vaud, Suisse.
      </p>
    </LegalPageShell>
  );
}
