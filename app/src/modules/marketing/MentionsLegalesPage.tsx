export default function MentionsLegalesPage() {
  return (
    <>
      <section className="border-b border-(--color-border) bg-gradient-to-b from-(--color-bg) to-(--color-surface)/40 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="m-0 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Mentions légales
          </h1>
          <p className="m-0 mt-3 text-sm text-(--color-muted)">
            Dernière mise à jour : 16 mai 2026
          </p>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-8 text-base leading-relaxed">
          <div>
            <h2 className="m-0 text-2xl font-bold">Éditeur</h2>
            <p className="mt-2">
              <strong>Qodo Digital Sàrl</strong>
              <br />
              Ch. des Halles 3<br />
              1510 Moudon · Vaud, Suisse
            </p>
            <p>
              Email :{' '}
              <a href="mailto:info@qodo.ch" className="text-(--color-primary) hover:underline">
                info@qodo.ch
              </a>{' '}
              · Téléphone :{' '}
              <a href="tel:+41219000479" className="text-(--color-primary) hover:underline">
                +41 21 900 04 79
              </a>
            </p>
            <p>Représentant légal : Fabien Cossy, fondateur.</p>
          </div>

          <div>
            <h2 className="m-0 text-2xl font-bold">Hébergement</h2>
            <p className="mt-2">
              L'application AgriQodo et l'instance Supabase associée sont hébergées sur les serveurs
              de :
            </p>
            <p>
              <strong>Infomaniak Network SA</strong>
              <br />
              Rue Eugène-Marziano 25 · 1227 Les Acacias / Genève · Suisse
            </p>
            <p>
              Le centre de données utilisé se trouve à <strong>Plan-les-Ouates (GE), Suisse</strong>
              . Aucune donnée n'est répliquée hors du territoire suisse.
            </p>
          </div>

          <div>
            <h2 className="m-0 text-2xl font-bold">Propriété intellectuelle</h2>
            <p className="mt-2">
              L'ensemble du contenu de ce site (textes, images, code source, design) est la
              propriété exclusive de Qodo Digital Sàrl, sauf mention contraire. Toute reproduction,
              même partielle, est interdite sans autorisation écrite préalable.
            </p>
          </div>

          <div>
            <h2 className="m-0 text-2xl font-bold">Données des exploitations</h2>
            <p className="mt-2">
              Les données saisies dans AgriQodo restent la propriété de l'exploitation cliente. Qodo
              Digital n'en fait aucun usage commercial et ne les transmet à aucun tiers, sauf sur
              demande explicite ou obligation légale.
            </p>
          </div>

          <div>
            <h2 className="m-0 text-2xl font-bold">Responsabilité</h2>
            <p className="mt-2">
              AgriQodo est un outil d'aide à la gestion. Les décisions agronomiques, sanitaires et
              réglementaires restent sous la responsabilité de l'exploitation cliente.
            </p>
          </div>

          <div>
            <h2 className="m-0 text-2xl font-bold">Droit applicable</h2>
            <p className="mt-2">
              Le présent site et l'application AgriQodo sont régis par le droit suisse. Tout litige
              relève de la juridiction des tribunaux du canton de Vaud.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
