import { useEffect, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import ParcellairePage from './modules/parcellaire/ParcellairePage';
import ParcelleDetailPage from './modules/parcellaire/ParcelleDetailPage';
import AssolementPage from './modules/assolement/AssolementPage';
import CarnetPage from './modules/carnet/CarnetPage';
import TravauxPage from './modules/travaux/TravauxPage';
import PlanningPage from './modules/planning/PlanningPage';
import TroupeauPage from './modules/troupeau/TroupeauPage';
import RHLayout from './modules/rh/RHLayout';
import MesHeuresPage from './modules/rh/MesHeuresPage';
import SaisirPresencePage from './modules/rh/SaisirPresencePage';
import MesCongesPage from './modules/rh/MesCongesPage';
import ParametresLayout from './modules/parametres/ParametresLayout';
import FumureExploitationPage from './modules/fumure/FumureExploitationPage';
import { ExploitationSection } from './modules/parametres/sections/ExploitationSection';
import { UtilisateursSection } from './modules/parametres/sections/UtilisateursSection';
import { UtilisateurDetailPage } from './modules/parametres/sections/UtilisateurDetailPage';
import { PreferencesSection } from './modules/parametres/sections/PreferencesSection';
import { CulturesSection } from './modules/parametres/sections/CulturesSection';
import { ProduitsSection } from './modules/parametres/sections/ProduitsSection';
import { ClientsSection } from './modules/parametres/sections/ClientsSection';
import { CheptelSection } from './modules/parametres/sections/CheptelSection';
import { OdooSection } from './modules/parametres/sections/OdooSection';
import { MeteoSection } from './modules/parametres/sections/MeteoSection';
import LoginPage from './modules/auth/LoginPage';
import ResetPasswordPage from './modules/auth/ResetPasswordPage';
import AcceptInvitePage from './modules/auth/AcceptInvitePage';
import { initAuthListener, useAuth } from './modules/auth/auth.store';
import { initFarmsBootstrap } from './modules/farms/farms.store';
import { initProductsBootstrap } from './modules/products/products.store';
import { initUsersBootstrap } from './modules/users/users.store';
import { initParcelsBootstrap } from './modules/parcellaire/parcellaire.store';
import { initParcelGroupsBootstrap } from './modules/parcel-groups/parcel-groups.store';
import { initAssolementBootstrap } from './modules/assolement/assolement.store';
import { initCarnetBootstrap } from './modules/carnet/carnet.store';

// Pages marketing en lazy-load — pas dans le bundle main, chargées au besoin
// (les prospects sur la landing ne paient pas le coût de l'app complète).
const MarketingLayout = lazy(() => import('./modules/marketing/MarketingLayout'));
const LandingPage = lazy(() => import('./modules/marketing/LandingPage'));
const FonctionnalitesPage = lazy(() => import('./modules/marketing/FonctionnalitesPage'));
const TarifsPage = lazy(() => import('./modules/marketing/TarifsPage'));
const ContactPage = lazy(() => import('./modules/marketing/ContactPage'));
const MentionsLegalesPage = lazy(() => import('./modules/marketing/MentionsLegalesPage'));
const ConfidentialitePage = lazy(() => import('./modules/marketing/ConfidentialitePage'));
const OpenSourcePage = lazy(() => import('./modules/marketing/OpenSourcePage'));
const ComposantsPage = lazy(() => import('./modules/composants/ComposantsPage'));
const FabLabPage = lazy(() => import('./modules/fab-lab/FabLabPage'));
const ParametresLabPage = lazy(() => import('./modules/parametres-lab/ParametresLabPage'));

function MarketingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-bg)">
      <div className="text-sm text-(--color-muted)">Chargement…</div>
    </div>
  );
}

export default function App() {
  const { mode } = useAuth();

  useEffect(() => {
    initFarmsBootstrap();
    initProductsBootstrap();
    initUsersBootstrap();
    initParcelsBootstrap();
    initParcelGroupsBootstrap();
    initAssolementBootstrap();
    initCarnetBootstrap();
    return initAuthListener();
  }, []);

  // Routes 100% publiques (marketing + auth), accessibles quel que soit le mode
  const publicRoutes = (
    <>
      <Route
        element={
          <Suspense fallback={<MarketingFallback />}>
            <MarketingLayout />
          </Suspense>
        }
      >
        <Route index element={<LandingPage />} />
        <Route path="/fonctionnalites" element={<FonctionnalitesPage />} />
        <Route path="/tarifs" element={<TarifsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
        <Route path="/confidentialite" element={<ConfidentialitePage />} />
        <Route path="/open-source" element={<OpenSourcePage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/composants" element={<ComposantsPage />} />
      <Route path="/fab-lab" element={<FabLabPage />} />
      <Route path="/parametres-lab" element={<ParametresLabPage />} />
    </>
  );

  // Pas connecté : uniquement marketing + auth (impossible d'accéder aux routes app)
  if (mode === 'logged-out') {
    return (
      <Suspense fallback={<MarketingFallback />}>
        <Routes>
          {publicRoutes}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Connecté (démo ou authentifié) : marketing public + app protégée
  return (
    <Suspense fallback={<MarketingFallback />}>
      <Routes>
        {publicRoutes}

        <Route element={<AppLayout />}>
          <Route path="/parcellaire" element={<ParcellairePage />} />
          <Route path="/parcellaire/:id" element={<ParcelleDetailPage />} />
          <Route path="/assolement" element={<AssolementPage />} />
          <Route path="/carnet" element={<CarnetPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/travaux" element={<TravauxPage />} />
          <Route path="/troupeau" element={<TroupeauPage />} />
          <Route path="/fumure" element={<FumureExploitationPage />} />

          <Route path="/rh" element={<RHLayout />}>
            <Route index element={<Navigate to="/rh/heures" replace />} />
            <Route path="heures" element={<MesHeuresPage />} />
            <Route path="saisir" element={<SaisirPresencePage />} />
            <Route path="conges" element={<MesCongesPage />} />
          </Route>

          <Route path="/parametres" element={<ParametresLayout />}>
            <Route index element={<Navigate to="/parametres/exploitation" replace />} />
            <Route path="exploitation" element={<ExploitationSection />} />
            <Route path="utilisateurs" element={<UtilisateursSection />} />
            <Route path="utilisateurs/:id" element={<UtilisateurDetailPage />} />
            <Route path="preferences" element={<PreferencesSection />} />
            <Route path="cultures" element={<CulturesSection />} />
            <Route path="produits" element={<ProduitsSection />} />
            <Route path="clients" element={<ClientsSection />} />
            <Route path="cheptel" element={<CheptelSection />} />
            <Route path="travaux" element={<Navigate to="/parametres/produits" replace />} />
            <Route path="odoo" element={<OdooSection />} />
            <Route path="meteo" element={<MeteoSection />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
