import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Trophy } from "lucide-react";

interface BoletimItem {
  disciplina: string;
  notas: {
    1: number | null;
    2: number | null;
    3: number | null;
  };
  mediaFinal?: number;
  situacao?: string;
}

export function BoletimAluno({ alunoId }: { alunoId?: string }) {
  const [boletim, setBoletim] = useState<BoletimItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotas = async () => {
      if (!alunoId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("notas")
        .select(`
          valor,
          semestre,
          disciplina:disciplinas(nome)
        `)
        .eq("aluno_id", alunoId);

      if (!error && data) {
        const notasMap = new Map<string, BoletimItem>();

        data.forEach((nota: any) => {
          const discNome = nota.disciplina?.nome || "Desconhecida";
          if (!notasMap.has(discNome)) {
            notasMap.set(discNome, { 
              disciplina: discNome, 
              notas: { 1: null, 2: null, 3: null } 
            });
          }
          const item = notasMap.get(discNome)!;
          // @ts-ignore
          item.notas[nota.semestre] = nota.valor;
        });

        const boletimArray = Array.from(notasMap.values()).map(item => {
            const notasValidas = Object.values(item.notas).filter(n => n !== null) as number[];
            const soma = notasValidas.reduce((a, b) => a + b, 0);
            const media = notasValidas.length > 0 ? parseFloat((soma / notasValidas.length).toFixed(1)) : undefined;
            
            // Lógica simples de situação (Pode ajustar conforme regras de PE)
            let situacao = "-";
            if (media !== undefined) {
                if (media >= 6) situacao = "Aprovado";
                else if (media >= 4) situacao = "Recuperação";
                else situacao = "Reprovado";
            }

            return { ...item, mediaFinal: media, situacao };
        });

        setBoletim(boletimArray);
      }
      setLoading(false);
    };

    fetchNotas();
  }, [alunoId]);

  if (loading) return <div className="p-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;

  if (boletim.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed mx-4 mb-4">
        <AlertTriangle className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-sm font-medium">Boletim indisponível.</p>
        <p className="text-xs">Nenhuma nota registrada neste período.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-gray-50/80">
          <TableRow>
            <TableHead className="w-[35%] font-bold text-gray-700">Disciplina</TableHead>
            <TableHead className="text-center font-semibold text-gray-600">1º Tri</TableHead>
            <TableHead className="text-center font-semibold text-gray-600">2º Tri</TableHead>
            <TableHead className="text-center font-semibold text-gray-600">3º Tri</TableHead>
            <TableHead className="text-right font-bold text-gray-800">Média</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boletim.map((item) => (
            <TableRow key={item.disciplina} className="hover:bg-slate-50/50 transition-colors">
              <TableCell className="font-medium text-xs sm:text-sm text-gray-800">{item.disciplina}</TableCell>
              {[1, 2, 3].map(sem => (
                <TableCell key={sem} className="text-center">
                  {/* @ts-ignore */}
                  {item.notas[sem] !== null ? (
                    // @ts-ignore
                    <span className={`font-medium ${item.notas[sem] < 6 ? "text-red-500" : "text-slate-700"}`}>
                      {/* @ts-ignore */}
                      {item.notas[sem].toFixed(1)}
                    </span>
                  ) : <span className="text-gray-300 text-xs">-</span>}
                </TableCell>
              ))}
              <TableCell className="text-right">
                {item.mediaFinal !== undefined && (
                  <div className="flex items-center justify-end gap-2">
                    <span className={`font-bold ${item.mediaFinal >= 6 ? "text-green-600" : "text-red-600"}`}>
                        {item.mediaFinal}
                    </span>
                    {item.mediaFinal >= 9 && <Trophy className="h-3 w-3 text-yellow-500" />}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}