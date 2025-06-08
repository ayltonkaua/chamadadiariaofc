
import React, { useState, useEffect } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Turma { id: string; nome: string }
interface Faltoso { aluno_nome: string; matricula: string; turma_nome: string; total_faltas: number }

export default function FaltososAlert() {
  const [open, setOpen] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>("");
  const [qtdeFaltas, setQtdeFaltas] = useState("1");
  const [faltosos, setFaltosos] = useState<Faltoso[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase.from("turmas").select("id, nome").then(({ data }) => setTurmas(data || []));
  }, []);

  const consultarFaltosos = async () => {
    setCarregando(true);
    let query = supabase.from("alunos_faltosos").select("*");
    if (turmaSelecionada) {
      query = query.eq("turma_id", turmaSelecionada);
    }
    if (qtdeFaltas) {
      query = query.gte("total_faltas", Number(qtdeFaltas));
    }
    const { data } = await query.order("total_faltas", { ascending: false });
    setFaltosos(data || []);
    setCarregando(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="flex gap-2 items-center border-blue-500 text-blue-700 hover:bg-blue-50">
          <Filter className="w-4 h-4" />
          Ver Alunos Faltosos
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Filtrar Alunos Mais Faltosos</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Turma</Label>
            <select className="w-full border rounded px-2 py-1 mt-1" value={turmaSelecionada} onChange={e => setTurmaSelecionada(e.target.value)}>
              <option value="">Todas</option>
              {turmas.map(t => <option value={t.id} key={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantidade mínima de faltas</Label>
            <Input type="number" min="1" value={qtdeFaltas} onChange={e => setQtdeFaltas(e.target.value)} className="w-36" />
          </div>
          <Button onClick={consultarFaltosos} disabled={carregando}>
            {carregando ? "Consultando..." : "Consultar"}
          </Button>
          {faltosos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Faltas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faltosos.map(f => (
                  <TableRow key={f.aluno_nome + f.matricula}>
                    <TableCell>{f.aluno_nome}</TableCell>
                    <TableCell>{f.matricula}</TableCell>
                    <TableCell>{f.turma_nome}</TableCell>
                    <TableCell>{f.total_faltas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500 mt-3">Nenhum aluno encontrado com esse filtro.</p>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
