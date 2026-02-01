/**
 * Info Cards - Dashboard Component
 * 
 * Cards informativos usando cores da escola.
 * Chamadas Hoje = quantidade de turmas com chamada realizada hoje(não total de presenças).
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Users, GraduationCap, CheckCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { getSchoolCache } from "@/lib/offlineStorage";

interface Stats {
  totalAlunos: number;
  totalTurmas: number;
  chamadasHoje: number;
  frequenciaGeral: number;
}

export function InfoCards() {
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const isProfessor = user?.role === 'professor';
  const [stats, setStats] = useState<Stats>({
    totalAlunos: 0,
    totalTurmas: 0,
    chamadasHoje: 0,
    frequenciaGeral: 0,
  });
  const [loading, setLoading] = useState(true);

  // Cor primária da escola
  const corPrimaria = config?.cor_primaria || "#6D28D9";

  // Gerar cores derivadas
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const hsl = hexToHsl(corPrimaria);
  const bgLight = `hsl(${hsl.h}, ${hsl.s}%, 95%)`;
  const iconBg = `hsl(${hsl.h}, ${hsl.s}%, 90%)`;
  const textColor = corPrimaria;

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      if (navigator.onLine && user?.escola_id) {
        try {
          // 1. Buscar ID do ano letivo ativo
          const { data: anoAtivo } = await supabase
            .from("anos_letivos")
            .select("id")
            .eq("escola_id", user.escola_id)
            .eq("status", "aberto")
            .maybeSingle();

          const anoAtivoId = anoAtivo?.id || null;

          // 2. Buscar turmas do ano ativo OU sem ano (legado)
          let turmasQuery = supabase
            .from("turmas")
            .select("id")
            .eq("escola_id", user.escola_id);

          if (anoAtivoId) {
            // Ano ativo existe: pegar turmas desse ano OU sem ano
            turmasQuery = turmasQuery.or(`ano_letivo_id.eq.${anoAtivoId},ano_letivo_id.is.null`);
          } else {
            // Sem ano ativo: pegar apenas turmas sem ano (legado)
            turmasQuery = turmasQuery.is("ano_letivo_id", null);
          }

          const { data: turmasAtivas } = await turmasQuery;
          const turmaIds = turmasAtivas?.map(t => t.id) || [];
          const turmasCount = turmaIds.length;

          // 2. Contar alunos apenas das turmas ativas
          let alunosCount = 0;
          if (turmaIds.length > 0) {
            const { count } = await supabase
              .from("alunos")
              .select("id", { count: "exact", head: true })
              .eq("escola_id", user.escola_id)
              .in("turma_id", turmaIds);
            alunosCount = count || 0;
          }

          // 3. Busca turmas DISTINTAS com chamada hoje (apenas turmas ativas)
          let turmasComChamadaCount = 0;
          if (turmaIds.length > 0) {
            const { data: chamadasData } = await supabase
              .from("presencas")
              .select("turma_id")
              .eq("data_chamada", today)
              .in("turma_id", turmaIds);

            const turmasComChamada = new Set(chamadasData?.map(p => p.turma_id) || []);
            turmasComChamadaCount = turmasComChamada.size;
          }

          // 4. Get frequency últimos 30 dias (apenas turmas ativas)
          let frequencia = 100;
          if (turmaIds.length > 0) {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data: presencas } = await supabase
              .from("presencas")
              .select("presente")
              .gte("data_chamada", thirtyDaysAgo)
              .in("turma_id", turmaIds);

            const total = presencas?.length || 0;
            const presentes = presencas?.filter((p: any) => p.presente).length || 0;
            frequencia = total > 0 ? Math.round((presentes / total) * 100) : 100;
          }

          setStats({
            totalAlunos: alunosCount,
            totalTurmas: turmasCount,
            chamadasHoje: turmasComChamadaCount,
            frequenciaGeral: frequencia,
          });
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
      } else {
        try {
          const dadosOffline = await getSchoolCache(user?.escola_id || '');
          if (dadosOffline) {
            setStats({
              totalAlunos: dadosOffline.alunos.length,
              totalTurmas: dadosOffline.turmas.length,
              chamadasHoje: 0,
              frequenciaGeral: 85,
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    };

    fetchStats();
  }, [user?.escola_id]);

  const cards = [
    {
      title: isProfessor ? "Meus Alunos" : "Total de Alunos",
      value: stats.totalAlunos,
      icon: Users,
    },
    {
      title: isProfessor ? "Minhas Turmas" : "Turmas Ativas",
      value: stats.totalTurmas,
      icon: GraduationCap,
    },
    {
      title: "Chamadas Hoje",
      value: stats.chamadasHoje,
      icon: CheckCircle,
      subtitle: "turmas"
    },
    {
      title: "Frequência (30d)",
      value: `${stats.frequenciaGeral}%`,
      icon: TrendingUp,
      isFrequency: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card
          key={index}
          className="overflow-hidden border shadow-sm hover:shadow-md transition-all duration-300 group"
          style={{ backgroundColor: bgLight, borderColor: `${corPrimaria}20` }}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                  {card.title}
                </p>
                <div className="flex items-baseline gap-1">
                  <p
                    className="text-2xl sm:text-3xl font-bold"
                    style={{
                      color: card.isFrequency && stats.frequenciaGeral < 75
                        ? '#dc2626'
                        : textColor
                    }}
                  >
                    {loading ? (
                      <span className="animate-pulse">--</span>
                    ) : (
                      card.value
                    )}
                  </p>
                  {card.subtitle && (
                    <span className="text-xs text-gray-500">{card.subtitle}</span>
                  )}
                </div>
              </div>
              <div
                className="p-2 sm:p-3 rounded-xl group-hover:scale-110 transition-transform"
                style={{ backgroundColor: iconBg }}
              >
                <card.icon
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  style={{ color: textColor }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}