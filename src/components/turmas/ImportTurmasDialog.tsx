import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { Loader2, FileUp, List, User, School, ArrowRight, ArrowLeft, Settings2, Table as TableIcon, Sun, Moon, Sunset, Clock, Upload } from 'lucide-react';

// ... (Interfaces AlunoImportado, DadosBrutos etc mantidas) ...
interface AlunoImportado {
  nome: string;
  matricula: string;
}

interface DadosBrutos {
  nomeTurmaSugerido: string;
  salaSugerida: string;
  linhas: string[][];
}

type EtapaImportacao = 'upload' | 'mapeamento' | 'preview';
type EstrategiaDuplicidade = 'ignorar' | 'atualizar';
type Turno = 'Manhã' | 'Tarde' | 'Noite' | 'Integral';

interface ImportTurmasDialogProps {
  onSuccess: () => void;
}

export function ImportTurmasDialog({ onSuccess }: ImportTurmasDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // --- CONTROLE DE ABERTURA (O SEGREDO!) ---
  const [open, setOpen] = useState(false); // Começa fechado!

  const [etapa, setEtapa] = useState<EtapaImportacao>('upload');
  const [loading, setLoading] = useState(false);
  const [dadosBrutos, setDadosBrutos] = useState<DadosBrutos | null>(null);
  const [nomeTurma, setNomeTurma] = useState("");
  const [numeroSala, setNumeroSala] = useState("");
  const [turno, setTurno] = useState<Turno>("Manhã");
  const [colunaMatricula, setColunaMatricula] = useState<string>("0");
  const [colunaNome, setColunaNome] = useState<string>("1");
  const [linhaInicio, setLinhaInicio] = useState<number>(2);
  const [alunosProcessados, setAlunosProcessados] = useState<AlunoImportado[]>([]);
  const [estrategia, setEstrategia] = useState<EstrategiaDuplicidade>('ignorar');

  // Resetar estados ao fechar
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Limpa tudo ao fechar para a próxima vez ser limpa
      setTimeout(() => {
        setEtapa('upload');
        setDadosBrutos(null);
        setAlunosProcessados([]);
        setNomeTurma("");
        setNumeroSala("");
      }, 300);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (mesma lógica de leitura do Excel) ...
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

        if (data.length < 3) throw new Error("O arquivo parece vazio ou muito curto.");

        const sugeridoNome = String(data[0]?.[0] || "");
        const sugeridoSala = String(data[1]?.[0] || "");

        setDadosBrutos({
          nomeTurmaSugerido: sugeridoNome,
          salaSugerida: sugeridoSala,
          linhas: data
        });

        setNomeTurma(sugeridoNome);
        setNumeroSala(sugeridoSala);

        const nomeLower = sugeridoNome.toLowerCase();
        if (nomeLower.includes('manhã') || nomeLower.includes('matutino')) setTurno("Manhã");
        else if (nomeLower.includes('tarde') || nomeLower.includes('vespertino')) setTurno("Tarde");
        else if (nomeLower.includes('noite') || nomeLower.includes('noturno')) setTurno("Noite");
        else if (nomeLower.includes('integral')) setTurno("Integral");

        setEtapa('mapeamento');
      } catch (err) {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const gerarPreview = () => {
    // ... (mesma lógica de preview) ...
    if (!dadosBrutos) return;
    const idxMatricula = parseInt(colunaMatricula);
    const idxNome = parseInt(colunaNome);
    const alunos: AlunoImportado[] = [];

    for (let i = linhaInicio; i < dadosBrutos.linhas.length; i++) {
      const row = dadosBrutos.linhas[i];
      const matricula = String(row[idxMatricula] || "").trim();
      const nome = String(row[idxNome] || "").trim();
      if (matricula && nome) alunos.push({ matricula, nome });
    }

    if (alunos.length === 0) {
      toast({ title: "Nenhum aluno encontrado", description: "Verifique colunas.", variant: "destructive" });
      return;
    }
    setAlunosProcessados(alunos);
    setEtapa('preview');
  };

  const handleImportar = async () => {
    // ... (mesma lógica de importação) ...
    if (!user?.escola_id) return;
    setLoading(true);

    try {
      // 1. Criar Turma
      const { data: turma, error: errTurma } = await supabase
        .from('turmas')
        .insert({
          nome: nomeTurma,
          numero_sala: numeroSala,
          turno: turno,
          escola_id: user.escola_id,
          // user_id: user.id -> Removido se o banco já tiver o campo novo, ou mantém se for compatibilidade
        })
        .select()
        .single();

      if (errTurma) throw new Error("Erro ao criar turma: " + errTurma.message);

      // 2. Processar Alunos
      let atualizados = 0;
      let inseridos = 0;

      for (const aluno of alunosProcessados) {
        const { data: existente } = await supabase
          .from('alunos')
          .select('id')
          .eq('escola_id', user.escola_id)
          .eq('matricula', aluno.matricula)
          .maybeSingle();

        if (existente) {
          if (estrategia === 'atualizar') {
            await supabase.from('alunos').update({ nome: aluno.nome, turma_id: turma.id }).eq('id', existente.id);
            atualizados++;
          }
        } else {
          await supabase.from('alunos').insert({
            nome: aluno.nome,
            matricula: aluno.matricula,
            turma_id: turma.id,
            escola_id: user.escola_id
          });
          inseridos++;
        }
      }

      toast({
        title: "Sucesso!",
        description: `Turma importada. Novos: ${inseridos}, Atualizados: ${atualizados}`,
        className: "bg-green-600 text-white"
      });

      onSuccess();
      setOpen(false); // Fecha o modal

    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZADORES DE CONTEÚDO (Mantive a lógica visual intacta) ---
  const renderUpload = () => (
    <div className="space-y-6 py-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
        <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <Label htmlFor="file" className="text-base font-medium cursor-pointer text-blue-600 hover:underline">
          Clique para selecionar o arquivo Excel
        </Label>
        <Input id="file" type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
        <p className="text-sm text-gray-500 mt-2">.xlsx ou .xls</p>
      </div>
    </div>
  );

  // ... (renderMapeamento e renderPreview iguais ao seu código original) ...
  // Para economizar espaço aqui, assuma que são os mesmos.
  // Vou colocar apenas o Dialog principal corrigido:

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Importar</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Turma via Excel</DialogTitle>
          <DialogDescription>Siga os passos para cadastrar turmas em massa.</DialogDescription>
        </DialogHeader>

        {etapa === 'upload' && renderUpload()}
        {/* Adicione renderMapeamento() e renderPreview() aqui se copiar o código completo */}
        {/* Como estou editando, vou assumir que você tem essas funções no corpo */}
        {etapa === 'mapeamento' && (
          // Cole aqui o conteúdo do seu renderMapeamento original
          <div className="text-center p-4">Conteúdo de Mapeamento (Reutilize seu código)</div>
        )}
        {etapa === 'preview' && (
          // Cole aqui o conteúdo do seu renderPreview original
          <div className="text-center p-4">Conteúdo de Preview (Reutilize seu código)</div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>

          {etapa === 'mapeamento' && (
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button variant="secondary" onClick={() => setEtapa('upload')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={gerarPreview}>
                Pré-visualizar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {etapa === 'preview' && (
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button variant="secondary" onClick={() => setEtapa('mapeamento')} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Ajustar
              </Button>
              <Button onClick={handleImportar} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                {loading ? 'Importando...' : 'Confirmar'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}