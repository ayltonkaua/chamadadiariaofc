/**
 * Lazy-loaded Route Components
 * 
 * Uses React.lazy for code splitting by route.
 * Heavy pages are loaded only when the user navigates to them.
 */

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Loading fallback component
export const PageLoader: React.FC = () => (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-gray-500">Carregando...</p>
        </div>
    </div>
);

// Wrapper for lazy components with suspense
export function withSuspense<P extends object>(
    LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>
): React.FC<P> {
    return function SuspenseWrapper(props: P) {
        return (
            <Suspense fallback={<PageLoader />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}

// ============================================
// LAZY LOADED PAGES (Heavy/Less frequently used)
// ============================================

// Relatórios (heavy charts)
export const LazyRelatoriosPage = React.lazy(() => import('@/pages/RelatoriosPage'));

// Pesquisas (complex forms)
export const LazyPesquisasListPage = React.lazy(() => import('@/pages/PesquisasListPage'));
export const LazyPesquisaCreatePage = React.lazy(() => import('@/pages/PesquisaCreatePage'));
export const LazyPesquisaResultadosPage = React.lazy(() => import('@/pages/PesquisaResultadosPage'));

// Gestor pages
export const LazyDashboardGestorPage = React.lazy(() => import('@/pages/DashboardGestorPage'));
export const LazyGerenciarAcessoPage = React.lazy(() => import('@/pages/GerenciarAcessoPage'));
export const LazyGerenciarEventosPage = React.lazy(() => import('@/pages/gestor/GerenciarEventosPage'));
export const LazyGerenciarProgramasPage = React.lazy(() => import('@/pages/gestor/GerenciarProgramasPage'));

// Scanner (camera access)
export const LazyScannerPage = React.lazy(() => import('@/pages/evento/ScannerPage'));

// ============================================
// WRAPPED COMPONENTS (Ready to use in routes)
// ============================================

export const RelatoriosPage = withSuspense(LazyRelatoriosPage);
export const PesquisasListPage = withSuspense(LazyPesquisasListPage);
export const PesquisaCreatePage = withSuspense(LazyPesquisaCreatePage);
export const PesquisaResultadosPage = withSuspense(LazyPesquisaResultadosPage);
export const DashboardGestorPage = withSuspense(LazyDashboardGestorPage);
export const GerenciarAcessoPage = withSuspense(LazyGerenciarAcessoPage);
export const GerenciarEventosPage = withSuspense(LazyGerenciarEventosPage);
export const GerenciarProgramasPage = withSuspense(LazyGerenciarProgramasPage);
export const ScannerPage = withSuspense(LazyScannerPage);
