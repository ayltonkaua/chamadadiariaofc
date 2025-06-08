import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Check, X, FileText, Save, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import JustificarFaltaForm from "@/components/justificativa/JustificarFaltaForm";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

type Presenca = "presente" | "falta" | "atestado" | null;

const ChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, Presenca>>({});
  const [date, setDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [showJustificarFalta, setShowJustificarFalta] = useState<{ alunoId: string } | null>(null);

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
    if (!turmaId) {
      toast({
        title: "Erro",
        description: "Turma não encontrada",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Preparar os registros de presença para inserção
      const presencasParaInserir = Object.entries(presencas).map(([alunoId, status]) => {
        // Converter o tipo de presença para boolean
        let presente = false;
        if (status === "presente") presente = true;
        // Atestado também é considerado como presente no banco de dados
        else if (status === "atestado") presente = true;
        
        return {
          aluno_id: alunoId,
          turma_id: turmaId,
          presente,
          data_chamada: format(date, "yyyy-MM-dd"),
        };
      });

      // Só salva se houver presença registrada
      if (presencasParaInserir.length > 0) {
        const { error } = await supabase
          .from("presencas")
          .insert(presencasParaInserir);

        if (error) throw error;

        toast({
          title: "Chamada salva",
          description: "A chamada foi registrada com sucesso.",
        });

        // Limpar o estado das presenças após salvar com sucesso
        setPresencas({});
      } else {
        toast({
          title: "Atenção",
          description: "Nenhuma presença registrada para salvar.",
        });
      }
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
          {alunos.map((aluno) => (
            <div key={aluno.id} className="flex items-center justify-between border rounded-md p-2 gap-2 bg-gray-50">
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
                <Button
                  variant="outline"
                  className="border-yellow-400 text-yellow-700"
                  onClick={() => setShowJustificarFalta({ alunoId: aluno.id })}
                  title="Justificar Falta"
                >Justificar Falta</Button>
              </div>
            </div>
          ))}
        </div>
        <Button 
          className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white flex gap-2" 
          onClick={handleSalvar}
          disabled={isSaving}
        >
          <Save size={20}/> {isSaving ? "Salvando..." : "Salvar Chamada"}
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
