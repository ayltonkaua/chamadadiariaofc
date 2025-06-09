import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Save, Check, X, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAlunosTurma } from "@/hooks/useAlunosTurma";
import { useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChamadaHistorico {
  data: string;
  presentes: number;
  faltosos: number;
  total: number;
  presencas: Array<{
    aluno_id: string;
    presente: boolean;
    falta_justificada?: boolean;
  }>;
}

interface TabelaChamadasProps {
  historico: ChamadaHistorico[];
  onEditarChamada: (data: string, novasPresencas: Array<{ aluno_id: string; presente: boolean }>) => Promise<void>;
  onExcluirChamada: (data: string) => Promise<void>;
}

export const TabelaChamadas: React.FC<TabelaChamadasProps> = ({ 
  historico, 
  onEditarChamada,
  onExcluirChamada 
}) => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [chamadaParaEditar, setChamadaParaEditar] = useState<ChamadaHistorico | null>(null);
  const [chamadaParaExcluir, setChamadaParaExcluir] = useState<ChamadaHistorico | null>(null);
  const [presencasEditadas, setPresencasEditadas] = useState<Array<{ aluno_id: string; presente: boolean | null; falta_justificada?: boolean }>>([]);
  const [salvando, setSalvando] = useState(false);
  const { alunos, loading: loadingAlunos } = useAlunosTurma(turmaId);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (chamadaParaEditar) {
      const presencasIniciais = alunos.map(aluno => {
        const presencaExistente = chamadaParaEditar.presencas.find(p => p.aluno_id === aluno.id);
        return {
          aluno_id: aluno.id,
          presente: presencaExistente ? presencaExistente.presente : null,
          falta_justificada: presencaExistente ? presencaExistente.falta_justificada || false : false
        };
      });
      setPresencasEditadas(presencasIniciais);
    }
  }, [chamadaParaEditar, alunos]);

  const handleAbrirEdicao = (chamada: ChamadaHistorico) => {
    setChamadaParaEditar(chamada);
  };

  const handleEditarPresenca = (alunoId: string, presente: boolean | null) => {
    setPresencasEditadas(prev => 
      prev.map(p => p.aluno_id === alunoId ? { ...p, presente, falta_justificada: false } : p)
    );
  };

  const handleJustificarFalta = (alunoId: string) => {
    setPresencasEditadas(prev =>
      prev.map(p =>
        p.aluno_id === alunoId ? { ...p, presente: false, falta_justificada: !p.falta_justificada } : p
      )
    );
  };

  const handleSalvarEdicao = async () => {
    if (!chamadaParaEditar) return;
    setSalvando(true);
    try {
      // Remove alunos com presente === null (sem registro)
      const presencasParaSalvar = presencasEditadas.filter(p => p.presente !== null);
      await onEditarChamada(chamadaParaEditar.data, presencasParaSalvar);
      setChamadaParaEditar(null);
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirChamada = async () => {
    if (chamadaParaExcluir) {
      await onExcluirChamada(chamadaParaExcluir.data);
      setChamadaParaExcluir(null);
    }
  };

  if (historico.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Nenhuma chamada encontrada para o período selecionado.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
              {!isMobile && (
                <>
            <TableHead>Presentes</TableHead>
            <TableHead>Faltosos</TableHead>
                  <TableHead>Total</TableHead>
                </>
              )}
              <TableHead>Frequência</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historico.map((chamada) => {
            const dataFormatada = format(parseISO(chamada.data), "dd/MM/yyyy");
            const frequencia = chamada.total > 0
              ? Math.round((chamada.presentes / chamada.total) * 100)
              : 0;
              
            return (
              <TableRow key={chamada.data}>
                <TableCell className="font-medium">{dataFormatada}</TableCell>
                  {!isMobile && (
                    <>
                <TableCell className="text-green-600">{chamada.presentes}</TableCell>
                <TableCell className="text-red-600">{chamada.faltosos}</TableCell>
                <TableCell>{chamada.total}</TableCell>
                    </>
                  )}
                <TableCell>
                    <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        frequencia > 80 ? 'bg-green-500' : 
                        frequencia > 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${frequencia}%` }}
                    ></div>
                  </div>
                      <span className="text-sm whitespace-nowrap">{frequencia}%</span>
                    </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAbrirEdicao(chamada)}
                        title="Editar chamada"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setChamadaParaExcluir(chamada)}
                        title="Excluir chamada"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>

      {/* Modal de Edição */}
      <Dialog open={!!chamadaParaEditar} onOpenChange={() => setChamadaParaEditar(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Chamada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAlunos ? (
              <div className="text-center py-4">Carregando alunos...</div>
            ) : (
              alunos.map((aluno) => {
                const presenca = presencasEditadas.find(p => p.aluno_id === aluno.id);
                return (
                  <div key={aluno.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-gray-50">
                    <div className="flex-1">
                      <span className="font-medium">{aluno.nome}</span>
                      <span className="text-sm text-gray-500 block sm:inline sm:ml-2">
                        (Matrícula: {aluno.matricula})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={presenca?.presente === true ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEditarPresenca(aluno.id, true)}
                        className={presenca?.presente === true ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Presente
                      </Button>
                      <Button
                        variant={presenca?.presente === false && !presenca?.falta_justificada ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEditarPresenca(aluno.id, false)}
                        className={presenca?.presente === false && !presenca?.falta_justificada ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Falta
                      </Button>
                      <Button
                        variant={presenca?.falta_justificada ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleJustificarFalta(aluno.id)}
                        className={presenca?.falta_justificada ? "bg-blue-600 hover:bg-blue-700" : ""}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Justificar
                      </Button>
                      <Button
                        variant={presenca?.presente === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEditarPresenca(aluno.id, null)}
                        className={presenca?.presente === null ? "bg-gray-400 hover:bg-gray-500 text-white" : ""}
                      >
                        Sem Registro
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setChamadaParaEditar(null)}
              disabled={salvando}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSalvarEdicao}
              disabled={salvando || loadingAlunos}
              className="w-full sm:w-auto"
            >
              <Save className="mr-2 h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar Edição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!chamadaParaExcluir} onOpenChange={() => setChamadaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Chamada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta chamada? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirChamada} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
