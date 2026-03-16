/**
 * Mapa de Alunos — Geolocalização + Frequência + Trajeto
 * 
 * Pin da escola + pins dos alunos coloridos por nível de frequência.
 * Verde >= 85% | Amarelo 70-84% | Vermelho < 70%
 * + Cálculo de trajeto via Mapbox Directions API
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { calcularDistanciaKm } from '@/lib/geocoding.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Users, AlertTriangle, CircleDot, Route, X, Footprints, Bike, Car, Clock, Ruler, Loader2 } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface AlunoMapa {
    id: string;
    nome: string;
    latitude: number;
    longitude: number;
    turma_id: string;
    turma_nome: string;
    total_chamadas: number;
    total_presencas: number;
    frequencia: number;
    faltas: number;
    distancia_km: number | null;
}

interface TurmaOption {
    id: string;
    nome: string;
}

interface RouteInfo {
    alunoNome: string;
    mode: string;
    modeLabel: string;
    distanceKm: number;
    durationMin: number;
}

function getFrequenciaColor(freq: number): string {
    if (freq >= 85) return '#22c55e';
    if (freq >= 70) return '#eab308';
    return '#ef4444';
}

function getFrequenciaLabel(freq: number): string {
    if (freq >= 85) return 'Assíduo';
    if (freq >= 70) return 'Atenção';
    return 'Crítico';
}

const ROUTE_MODES = [
    { id: 'walking', label: 'A pé', icon: 'Footprints' },
    { id: 'cycling', label: 'Bicicleta', icon: 'Bike' },
    { id: 'driving', label: 'Carro/Moto', icon: 'Car' },
];

export default function MapaAlunosPage() {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const navigate = useNavigate();
    const { user } = useAuth();
    const { config } = useEscolaConfig();

    const [alunos, setAlunos] = useState<AlunoMapa[]>([]);
    const [turmas, setTurmas] = useState<TurmaOption[]>([]);
    const [turmaFiltro, setTurmaFiltro] = useState<string>('todas');
    const [nivelFiltro, setNivelFiltro] = useState<string>('todos');
    const [loading, setLoading] = useState(true);

    // Route state
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [selectedAlunoForRoute, setSelectedAlunoForRoute] = useState<AlunoMapa | null>(null);

    const escolaLat = config?.latitude ?? null;
    const escolaLng = config?.longitude ?? null;

    // Fetch student data with coordinates + attendance
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.escola_id) return;
            setLoading(true);

            try {
                const { data: alunosData } = await supabase
                    .from('alunos')
                    .select('id, nome, latitude, longitude, turma_id, turmas:turma_id(id, nome)')
                    .eq('escola_id', user.escola_id)
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null);

                const { data: turmasData } = await supabase
                    .from('turmas')
                    .select('id, nome')
                    .eq('escola_id', user.escola_id)
                    .order('nome');

                setTurmas((turmasData || []) as TurmaOption[]);

                if (!alunosData || alunosData.length === 0) {
                    setAlunos([]);
                    setLoading(false);
                    return;
                }

                const alunoIds = alunosData.map(a => a.id);
                const { data: presencasData } = await supabase
                    .from('presencas')
                    .select('aluno_id, presente')
                    .in('aluno_id', alunoIds);

                const presencaMap = new Map<string, { total: number; presentes: number }>();
                (presencasData || []).forEach(p => {
                    const curr = presencaMap.get(p.aluno_id) || { total: 0, presentes: 0 };
                    curr.total++;
                    if (p.presente) curr.presentes++;
                    presencaMap.set(p.aluno_id, curr);
                });

                const alunosProcessados: AlunoMapa[] = alunosData.map((a: any) => {
                    const stats = presencaMap.get(a.id) || { total: 0, presentes: 0 };
                    const frequencia = stats.total > 0 ? Math.round((stats.presentes / stats.total) * 100) : 100;
                    const distancia = (escolaLat && escolaLng)
                        ? calcularDistanciaKm(a.latitude, a.longitude, escolaLat, escolaLng)
                        : null;

                    return {
                        id: a.id,
                        nome: a.nome,
                        latitude: a.latitude,
                        longitude: a.longitude,
                        turma_id: a.turma_id,
                        turma_nome: a.turmas?.nome || 'Sem turma',
                        total_chamadas: stats.total,
                        total_presencas: stats.presentes,
                        frequencia,
                        faltas: stats.total - stats.presentes,
                        distancia_km: distancia,
                    };
                });

                setAlunos(alunosProcessados);
            } catch (err) {
                console.error('[MapaAlunos] Error loading data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.escola_id, escolaLat, escolaLng]);

    // Filter students
    const alunosFiltrados = useMemo(() => {
        return alunos.filter(a => {
            if (turmaFiltro !== 'todas' && a.turma_id !== turmaFiltro) return false;
            if (nivelFiltro === 'verde' && a.frequencia < 85) return false;
            if (nivelFiltro === 'amarelo' && (a.frequencia < 70 || a.frequencia >= 85)) return false;
            if (nivelFiltro === 'vermelho' && a.frequencia >= 70) return false;
            return true;
        });
    }, [alunos, turmaFiltro, nivelFiltro]);

    const statsResumo = useMemo(() => {
        const total = alunosFiltrados.length;
        const verdes = alunosFiltrados.filter(a => a.frequencia >= 85).length;
        const amarelos = alunosFiltrados.filter(a => a.frequencia >= 70 && a.frequencia < 85).length;
        const vermelhos = alunosFiltrados.filter(a => a.frequencia < 70).length;
        return { total, verdes, amarelos, vermelhos };
    }, [alunosFiltrados]);

    // -------------------------------------------------------
    // Route calculation via Mapbox Directions API
    // -------------------------------------------------------
    const calcularTrajeto = useCallback(async (aluno: AlunoMapa, mode: string) => {
        if (!escolaLat || !escolaLng || !MAPBOX_TOKEN) return;

        setRouteLoading(true);
        setSelectedAlunoForRoute(aluno);

        const modeLabel = ROUTE_MODES.find(m => m.id === mode)?.label || mode;

        try {
            // Mapbox Directions API: origin -> destination
            const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${aluno.longitude},${aluno.latitude};${escolaLng},${escolaLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data.routes || data.routes.length === 0) {
                setRouteInfo({ alunoNome: aluno.nome, mode, modeLabel, distanceKm: 0, durationMin: 0 });
                setRouteLoading(false);
                return;
            }

            const route = data.routes[0];
            const distanceKm = Math.round((route.distance / 1000) * 100) / 100;
            const durationMin = Math.round(route.duration / 60);

            // Draw route on map
            const map = mapRef.current;
            if (map) {
                // Remove previous route if any
                if (map.getSource('route')) {
                    map.removeLayer('route-line');
                    map.removeSource('route');
                }

                map.addSource('route', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: route.geometry,
                    },
                });

                map.addLayer({
                    id: 'route-line',
                    type: 'line',
                    source: 'route',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                    },
                    paint: {
                        'line-color': '#6D28D9',
                        'line-width': 5,
                        'line-opacity': 0.8,
                    },
                });

                // Fit map to show the full route
                const coordinates = route.geometry.coordinates;
                const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
                coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
                map.fitBounds(bounds, { padding: 80, duration: 800 });
            }

            setRouteInfo({ alunoNome: aluno.nome, mode, modeLabel, distanceKm, durationMin });
        } catch (err) {
            console.error('[MapaAlunos] Route error:', err);
        } finally {
            setRouteLoading(false);
        }
    }, [escolaLat, escolaLng]);

    const limparTrajeto = useCallback(() => {
        const map = mapRef.current;
        if (map && map.getSource('route')) {
            map.removeLayer('route-line');
            map.removeSource('route');
        }
        setRouteInfo(null);
        setSelectedAlunoForRoute(null);

        // Re-center on school
        if (map && escolaLat && escolaLng) {
            map.flyTo({ center: [escolaLng, escolaLat], zoom: 14, duration: 800 });
        }
    }, [escolaLat, escolaLng]);

    // Expose functions to popup buttons via window
    useEffect(() => {
        (window as any).__navigateToAluno = (turmaId: string, alunoId: string) => {
            navigate(`/turmas/${turmaId}/alunos/${alunoId}`);
        };
        (window as any).__calcularTrajeto = (alunoId: string) => {
            const aluno = alunos.find(a => a.id === alunoId);
            if (aluno) {
                setSelectedAlunoForRoute(aluno);
            }
        };
        return () => {
            delete (window as any).__navigateToAluno;
            delete (window as any).__calcularTrajeto;
        };
    }, [navigate, alunos]);

    // Initialize map — center on school if available
    useEffect(() => {
        if (!mapContainerRef.current || !MAPBOX_TOKEN) return;
        if (mapRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        const centerLat = escolaLat || -3.72;
        const centerLng = escolaLng || -38.52;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [centerLng, centerLat],
            zoom: escolaLat ? 14 : 12,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [escolaLat, escolaLng]);

    // Re-center map when school coordinates change
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !escolaLat || !escolaLng) return;
        map.flyTo({ center: [escolaLng, escolaLat], zoom: 14, duration: 1000 });
    }, [escolaLat, escolaLng]);

    // Render markers
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // School marker
        if (escolaLat && escolaLng) {
            const escolaEl = document.createElement('div');
            escolaEl.style.cssText = `
                width: 40px; height: 40px; border-radius: 50%;
                background: linear-gradient(135deg, #6D28D9, #4F46E5);
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer;
            `;
            escolaEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div style="padding:8px;font-family:system-ui;">
                    <strong style="font-size:14px;">${config?.nome || 'Escola'}</strong>
                    <p style="margin:4px 0 0;font-size:12px;color:#666;">Localização da escola</p>
                </div>
            `);

            const marker = new mapboxgl.Marker({ element: escolaEl, anchor: 'center' })
                .setLngLat([escolaLng, escolaLat])
                .setPopup(popup)
                .addTo(map);
            markersRef.current.push(marker);
        }

        // Student markers
        alunosFiltrados.forEach(aluno => {
            const color = getFrequenciaColor(aluno.frequencia);
            const label = getFrequenciaLabel(aluno.frequencia);

            const el = document.createElement('div');
            el.style.cssText = `
                width: 24px; height: 24px; border-radius: 50%;
                background: ${color}; border: 2.5px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                cursor: pointer;
            `;

            const distanciaText = aluno.distancia_km !== null
                ? `${aluno.distancia_km} km da escola`
                : 'Distância não calculada';

            const hasEscola = escolaLat && escolaLng;
            const routeButtonHtml = hasEscola ? `
                <button onclick="window.__calcularTrajeto('${aluno.id}')"
                    style="background:#f3f0ff;color:#6D28D9;border:1.5px solid #6D28D9;padding:6px 16px;border-radius:6px;font-size:12px;cursor:pointer;width:100%;font-weight:600;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17h4V9H3v8z"/><path d="M17 17h4V5h-4v12z"/><path d="M7 13h10"/><path d="M10 9l3 4-3 4"/></svg>
                    Calcular Trajeto
                </button>
            ` : '';

            const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '280px' }).setHTML(`
                <div style="padding:10px;font-family:system-ui;">
                    <strong style="font-size:14px;">${aluno.nome}</strong>
                    <p style="margin:4px 0;font-size:12px;color:#666;">${aluno.turma_nome}</p>
                    <div style="display:flex;gap:8px;margin:8px 0;">
                        <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">
                            ${aluno.frequencia}% - ${label}
                        </span>
                    </div>
                    <div style="font-size:12px;color:#555;margin-bottom:4px;">${distanciaText}</div>
                    <div style="font-size:12px;color:#555;margin-bottom:10px;">${aluno.faltas} falta(s) em ${aluno.total_chamadas} chamadas</div>
                    ${routeButtonHtml}
                    <button onclick="window.__navigateToAluno('${aluno.turma_id}', '${aluno.id}')"
                        style="background:linear-gradient(135deg,#6D28D9,#4F46E5);color:white;border:none;padding:6px 16px;border-radius:6px;font-size:12px;cursor:pointer;width:100%;font-weight:500;">
                        Ver Perfil Completo
                    </button>
                </div>
            `);

            const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                .setLngLat([aluno.longitude, aluno.latitude])
                .setPopup(popup)
                .addTo(map);
            markersRef.current.push(marker);
        });
    }, [alunosFiltrados, escolaLat, escolaLng, config?.nome]);

    if (!MAPBOX_TOKEN) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold mb-2">Token Mapbox não configurado</h2>
                        <p className="text-sm text-gray-500">
                            Adicione <code className="bg-gray-100 px-1 rounded">VITE_MAPBOX_TOKEN</code> no arquivo <code className="bg-gray-100 px-1 rounded">.env</code> para habilitar o mapa.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {/* Header + Filters */}
            <div className="px-4 py-3 bg-white border-b shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-800">Mapa de Alunos</h1>
                        <p className="text-xs text-gray-500">Geolocalização e frequência escolar</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Select value={turmaFiltro} onValueChange={setTurmaFiltro}>
                        <SelectTrigger className="w-[180px] h-9 text-sm">
                            <SelectValue placeholder="Filtrar por turma" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas as turmas</SelectItem>
                            {turmas.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={nivelFiltro} onValueChange={setNivelFiltro}>
                        <SelectTrigger className="w-[180px] h-9 text-sm">
                            <SelectValue placeholder="Nível de frequência" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os níveis</SelectItem>
                            <SelectItem value="verde">Assíduo (85%+)</SelectItem>
                            <SelectItem value="amarelo">Atenção (70-84%)</SelectItem>
                            <SelectItem value="vermelho">Crítico (&lt;70%)</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Summary stats */}
                    <div className="flex items-center gap-2 ml-auto text-sm">
                        <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" /> {statsResumo.total} alunos
                        </Badge>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                            <CircleDot className="h-3 w-3" /> {statsResumo.verdes}
                        </Badge>
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 gap-1">
                            <CircleDot className="h-3 w-3" /> {statsResumo.amarelos}
                        </Badge>
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
                            <CircleDot className="h-3 w-3" /> {statsResumo.vermelhos}
                        </Badge>
                    </div>
                </div>

                {/* Warning if school has no coordinates */}
                {!escolaLat && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>A escola não tem localização cadastrada. Vá em <strong>Perfil da Escola</strong> e preencha o endereço para centralizar o mapa.</span>
                    </div>
                )}
            </div>

            {/* Map */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                        <div className="text-center space-y-2">
                            <Skeleton className="h-8 w-48 mx-auto" />
                            <p className="text-sm text-gray-500">Carregando mapa...</p>
                        </div>
                    </div>
                )}
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10 text-xs space-y-1.5">
                    <p className="font-semibold text-gray-700 mb-2">Legenda</p>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block border border-white shadow-sm" />
                        <span className="text-gray-600">85%+ Assíduo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block border border-white shadow-sm" />
                        <span className="text-gray-600">70-84% Atenção</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-sm" />
                        <span className="text-gray-600">&lt;70% Crítico</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t">
                        <span className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 inline-block border border-white shadow-sm" />
                        <span className="text-gray-600">Escola</span>
                    </div>
                </div>

                {/* Route Mode Selector Panel */}
                {selectedAlunoForRoute && !routeInfo && (
                    <div className="absolute top-4 right-14 bg-white rounded-xl shadow-xl border p-4 z-20 w-72 animate-in fade-in slide-in-from-right-2">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Route className="h-4 w-4 text-violet-600" />
                                <h3 className="font-semibold text-sm text-gray-800">Calcular Trajeto</h3>
                            </div>
                            <button
                                onClick={() => setSelectedAlunoForRoute(null)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                            <strong>{selectedAlunoForRoute.nome}</strong> até a escola
                        </p>
                        <div className="space-y-2">
                            <button
                                disabled={routeLoading}
                                onClick={() => calcularTrajeto(selectedAlunoForRoute, 'walking')}
                                className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:bg-violet-50 hover:border-violet-300 transition-colors text-sm disabled:opacity-50"
                            >
                                <Footprints className="h-5 w-5 text-violet-600" />
                                <span className="font-medium">A pé</span>
                            </button>
                            <button
                                disabled={routeLoading}
                                onClick={() => calcularTrajeto(selectedAlunoForRoute, 'cycling')}
                                className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:bg-violet-50 hover:border-violet-300 transition-colors text-sm disabled:opacity-50"
                            >
                                <Bike className="h-5 w-5 text-violet-600" />
                                <span className="font-medium">Bicicleta</span>
                            </button>
                            <button
                                disabled={routeLoading}
                                onClick={() => calcularTrajeto(selectedAlunoForRoute, 'driving')}
                                className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:bg-violet-50 hover:border-violet-300 transition-colors text-sm disabled:opacity-50"
                            >
                                <Car className="h-5 w-5 text-violet-600" />
                                <span className="font-medium">Carro / Moto</span>
                            </button>
                        </div>
                        {routeLoading && (
                            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-violet-600">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Calculando rota...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Route Result Panel */}
                {routeInfo && (
                    <div className="absolute top-4 right-14 bg-white rounded-xl shadow-xl border p-4 z-20 w-72 animate-in fade-in slide-in-from-right-2">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Route className="h-4 w-4 text-violet-600" />
                                <h3 className="font-semibold text-sm text-gray-800">Trajeto</h3>
                            </div>
                            <button
                                onClick={limparTrajeto}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Fechar e limpar rota"
                            >
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 mb-3">
                            <strong>{routeInfo.alunoNome}</strong> até a escola
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-violet-50 rounded-lg p-3 text-center">
                                <Ruler className="h-4 w-4 text-violet-600 mx-auto mb-1" />
                                <p className="text-lg font-bold text-violet-700">{routeInfo.distanceKm}</p>
                                <p className="text-[10px] text-violet-500 uppercase font-medium">km</p>
                            </div>
                            <div className="bg-violet-50 rounded-lg p-3 text-center">
                                <Clock className="h-4 w-4 text-violet-600 mx-auto mb-1" />
                                <p className="text-lg font-bold text-violet-700">{routeInfo.durationMin}</p>
                                <p className="text-[10px] text-violet-500 uppercase font-medium">minutos</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded">
                            {routeInfo.mode === 'walking' && <Footprints className="h-3.5 w-3.5" />}
                            {routeInfo.mode === 'cycling' && <Bike className="h-3.5 w-3.5" />}
                            {routeInfo.mode === 'driving' && <Car className="h-3.5 w-3.5" />}
                            <span>Modo: <strong>{routeInfo.modeLabel}</strong></span>
                        </div>

                        {/* Change mode buttons */}
                        <div className="flex gap-1.5 mb-3">
                            {ROUTE_MODES.map(m => (
                                <button
                                    key={m.id}
                                    disabled={routeLoading}
                                    onClick={() => {
                                        if (selectedAlunoForRoute) {
                                            limparTrajeto();
                                            setTimeout(() => calcularTrajeto(selectedAlunoForRoute, m.id), 100);
                                        }
                                    }}
                                    className={`flex-1 p-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50
                                        ${routeInfo.mode === m.id ? 'bg-violet-100 border-violet-300 text-violet-700' : 'hover:bg-gray-50'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={limparTrajeto}
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Limpar rota
                        </Button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && alunosFiltrados.length === 0 && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white/95 rounded-xl shadow-lg p-6 text-center max-w-sm">
                        <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-700">Nenhum aluno no mapa</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Os alunos aparecerão aqui quando tiverem um endereço cadastrado com localização válida.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
