import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Check, X, FileText, Save, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import JustificarFaltaForm from "@/components/justificativa/JustificarFaltaForm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { salvarChamadaOffline } from '@/lib/offlineChamada';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

type Presenca = "presente" | "falta" | "atestado" | null;

const ChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, Presenca | null>>({});
  const [date, setDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [showJustificarFalta, setShowJustificarFalta] = useState<{ alunoId: string } | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  useEffect(() => {
    const buscarAlunos = async () => {
      if (!turmaId) return;
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, matricula")
        .eq("turma_id", turmaId);
      if (data) setAlunos(data);
    };
    buscarAlunos();
  }, [turmaId]);

  const handlePresenca = (alunoId: string, tipo: Presenca) => {
    setPresencas((prev) => ({ ...prev, [alunoId]: tipo }));
  };

  const handleSalvar = async () => {
    setTentouSalvar(true);
    // Validação: todos os alunos devem ter status definido
    const alunosSemRegistro = alunos.filter(aluno => !presencas[aluno.id]);
    if (alunosSemRegistro.length > 0) {
      toast({
        title: "Erro",
        description: "Todos os alunos devem ter presença, falta ou atestado registrados.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const dataChamada = format(date, "yyyy-MM-dd");
      const presencasParaInserir = Object.entries(presencas)
        .map(([alunoId, status]) => {
          let presente = false;
          let falta_justificada = false;
          if (status === "presente") presente = true;
          else if (status === "falta") presente = false;
          else if (status === "atestado") {
            presente = false;
            falta_justificada = true;
          }
          return {
            aluno_id: alunoId,
            turma_id: turmaId,
            presente,
            falta_justificada,
            data_chamada: dataChamada,
          };
        });
      if (!navigator.onLine) {
        await salvarChamadaOffline(presencasParaInserir);
        toast({
          title: "Sem internet",
          description: "Chamada salva localmente. Será enviada quando a conexão voltar.",
        });
        setPresencas({});
        setTentouSalvar(false);
        setIsSaving(false);
        return;
      }
      if (presencasParaInserir.length > 0) {
        const { error } = await supabase.from("presencas").insert(presencasParaInserir);
        if (error) throw error;
      }
      toast({
        title: "Chamada salva",
        description: "A chamada foi registrada com sucesso.",
      });
      setPresencas({});
      setTentouSalvar(false);
    } catch (error) {
      console.error("Erro ao salvar chamada:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar a chamada.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-purple-700">Chamada</h2>
          <Link to="/dashboard">
            <Button variant="outline" className="flex gap-2">
              <ArrowLeft size={18} /> Voltar ao Dashboard
            </Button>
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <span className="font-medium">Data selecionada:</span>{" "}
            <span className="text-gray-800">
              {format(date, "dd/MM/yyyy")}
            </span>
          </div>
          <div>
            <Calendar 
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              className="p-3 pointer-events-auto"
            />
          </div>
        </div>
        <div className="mb-2 mt-4">
          <h3 className="font-semibold text-gray-700">Alunos</h3>
        </div>
        <div className="flex flex-col gap-2">
          {[...alunos].sort((a, b) => a.nome.localeCompare(b.nome)).map((aluno) => {
            const semRegistro = tentouSalvar && !presencas[aluno.id];
            return (
              <div
                key={aluno.id}
                className={`flex items-center justify-between border rounded-md p-2 gap-2 bg-gray-50 ${semRegistro ? "border-2 border-red-500 bg-red-50" : ""}`}
              >
                <div>
                  <span className="font-medium">{aluno.nome}</span>{" "}
                  <span className="text-sm text-gray-500">(Matrícula: {aluno.matricula})</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={presencas[aluno.id] === "presente" ? "default" : "outline"}
                    className={presencas[aluno.id] === "presente" ? "bg-green-600 text-white" : ""}
                    onClick={() => handlePresenca(aluno.id, "presente")}
                    title="Presente"
                  ><Check size={18}/></Button>
                  <Button
                    variant={presencas[aluno.id] === "falta" ? "default" : "outline"}
                    className={presencas[aluno.id] === "falta" ? "bg-red-600 text-white" : ""}
                    onClick={() => handlePresenca(aluno.id, "falta")}
                    title="Falta"
                  ><X size={18}/></Button>
                  <Button
                    variant={presencas[aluno.id] === "atestado" ? "default" : "outline"}
                    className={presencas[aluno.id] === "atestado" ? "bg-blue-400 text-white" : ""}
                    onClick={() => handlePresenca(aluno.id, "atestado")}
                    title="Atestado"
                  ><FileText size={18}/></Button>
                </div>
                {semRegistro && (
                  <span className="text-xs text-red-600 font-semibold ml-2">Obrigatório registrar presença</span>
                )}
              </div>
            );
          })}
        </div>
        <Button 
          className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white flex gap-2 items-center justify-center" 
          onClick={handleSalvar}
          disabled={isSaving || alunos.some(aluno => !presencas[aluno.id])}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save size={20}/> Salvar Chamada
            </>
          )}
        </Button>
      </div>
      <Dialog open={!!showJustificarFalta} onOpenChange={() => setShowJustificarFalta(null)}>
        <DialogContent>
          {showJustificarFalta && (
            <JustificarFaltaForm onClose={() => setShowJustificarFalta(null)} alunoId={showJustificarFalta.alunoId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChamadaPage;
