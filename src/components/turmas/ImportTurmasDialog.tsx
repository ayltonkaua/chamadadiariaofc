import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Loader2, FileUp, List, User, School, ArrowRight, ArrowLeft, Settings2, Table as TableIcon, Sun, Moon, Sunset, Clock } from 'lucide-react';

// Tipos
interface AlunoImportado {
  nome: string;
  matricula: string;
}

interface DadosBrutos {
  nomeTurmaSugerido: string;
  salaSugerida: string;
  linhas: string[][]; // Matriz bruta dos dados do Excel
}

type EtapaImportacao = 'upload' | 'mapeamento' | 'preview';
type EstrategiaDuplicidade = 'ignorar' | 'atualizar';
type Turno = 'Manhã' | 'Tarde' | 'Noite' | 'Integral';

interface ImportTurmasDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportTurmasDialog({ onClose, onSuccess }: ImportTurmasDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // --- ESTADOS ---
  const [etapa, setEtapa] = useState<EtapaImportacao>('upload');
  const [loading, setLoading] = useState(false);

  // Dados do Arquivo
  const [dadosBrutos, setDadosBrutos] = useState<DadosBrutos | null>(null);

  // Configuração do Mapeamento
  const [nomeTurma, setNomeTurma] = useState("");
  const [numeroSala, setNumeroSala] = useState("");
  const [turno, setTurno] = useState<Turno>("Manhã"); // NOVO ESTADO

  const [colunaMatricula, setColunaMatricula] = useState<string>("0"); // Índice A
  const [colunaNome, setColunaNome] = useState<string>("1");      // Índice B
  const [linhaInicio, setLinhaInicio] = useState<number>(2);      // Começa na linha 3 (índice 2)

  // Dados Processados
  const [alunosProcessados, setAlunosProcessados] = useState<AlunoImportado[]>([]);
  const [estrategia, setEstrategia] = useState<EstrategiaDuplicidade>('ignorar');

  // --- 1. PROCESSAMENTO INICIAL DO ARQUIVO ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        // Ler tudo como matriz de strings
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

        if (data.length < 3) throw new Error("O arquivo parece vazio ou muito curto.");

        // Sugestões iniciais baseadas no padrão antigo
        const sugeridoNome = data[0]?.[0] || "";
        const sugeridoSala = String(data[1]?.[0] || "");

        setDadosBrutos({
          nomeTurmaSugerido: sugeridoNome,
          salaSugerida: sugeridoSala,
          linhas: data
        });

        // Preenche inputs iniciais
        setNomeTurma(sugeridoNome);
        setNumeroSala(sugeridoSala);

        // Tenta adivinhar o turno pelo nome da turma (opcional, mas útil)
        const nomeLower = sugeridoNome.toLowerCase();
        if (nomeLower.includes('manhã') || nomeLower.includes('matutino')) setTurno("Manhã");
        else if (nomeLower.includes('tarde') || nomeLower.includes('vespertino')) setTurno("Tarde");
        else if (nomeLower.includes('noite') || nomeLower.includes('noturno')) setTurno("Noite");
        else if (nomeLower.includes('integral')) setTurno("Integral");

        // Avança etapa
        setEtapa('mapeamento');
      } catch (err) {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- 2. GERAÇÃO DO PREVIEW ---
  const gerarPreview = () => {
    if (!dadosBrutos) return;

    const idxMatricula = parseInt(colunaMatricula);
    const idxNome = parseInt(colunaNome);

    const alunos: AlunoImportado[] = [];

    // Itera a partir da linha de início configurada
    for (let i = linhaInicio; i < dadosBrutos.linhas.length; i++) {
      const row = dadosBrutos.linhas[i];
      const matricula = String(row[idxMatricula] || "").trim();
      const nome = String(row[idxNome] || "").trim();

      if (matricula && nome) {
        alunos.push({ matricula, nome });
      }
    }

    if (alunos.length === 0) {
      toast({ title: "Nenhum aluno encontrado", description: "Verifique o mapeamento das colunas.", variant: "destructive" });
      return;
    }

    setAlunosProcessados(alunos);
    setEtapa('preview');
  };

  // --- 3. IMPORTAÇÃO FINAL AO BANCO ---
  const handleImportar = async () => {
    if (!user?.escola_id) return;
    setLoading(true);

    try {
      // 1. Criar Turma com o Turno selecionado
      const { data: turma, error: errTurma } = await supabase
        .from('turmas')
        .insert({
          nome: nomeTurma,
          numero_sala: numeroSala,
          turno: turno, // INSERINDO O TURNO AQUI
          escola_id: user.escola_id,
          user_id: user.id
        })
        .select()
        .single();

      if (errTurma) throw new Error("Erro ao criar turma: " + errTurma.message);

      // 2. Processar Alunos (Lógica de Duplicidade)
      let atualizados = 0;
      let inseridos = 0;
      let ignorados = 0;

      for (const aluno of alunosProcessados) {
        const { data: existente } = await supabase
          .from('alunos')
          .select('id, nome')
          .eq('escola_id', user.escola_id)
          .eq('matricula', aluno.matricula)
          .maybeSingle();

        if (existente) {
          if (estrategia === 'ignorar') {
            ignorados++;
            continue;
          } else {
            // Atualizar e Mover
            await supabase
              .from('alunos')
              .update({
                nome: aluno.nome,
                turma_id: turma.id
              })
              .eq('id', existente.id);
            atualizados++;
          }
        } else {
          // Criar novo
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
        title: "Importação Concluída!",
        description: `Turma criada no turno ${turno}. Novos: ${inseridos} | Movidos: ${atualizados}`,
        className: "bg-green-600 text-white"
      });

      onSuccess();
      onClose();

    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha na importação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZADORES DE ETAPAS ---

  const renderUpload = () => (
    <div className="space-y-6 py-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
        <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <Label htmlFor="file" className="text-base font-medium cursor-pointer text-blue-600 hover:underline">
          Clique para selecionar o arquivo Excel
        </Label>
        <Input
          id="file"
          type="file"
          accept=".xlsx, .xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-sm text-gray-500 mt-2">Formatos .xlsx ou .xls</p>
      </div>
      <div className="text-xs text-gray-400">
        O sistema identificará Nome e Sala nas primeiras linhas.
      </div>
    </div>
  );

  const renderMapeamento = () => {
    const colunasExcel = Array.from({ length: 10 }, (_, i) => ({
      valor: String(i),
      label: `Coluna ${String.fromCharCode(65 + i)}` // A, B, C...
    }));

    return (
      <div className="space-y-4 py-2">
        {/* Dados da Turma */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 col-span-1">
            <Label>Nome da Turma</Label>
            <Input value={nomeTurma} onChange={e => setNomeTurma(e.target.value)} placeholder="Ex: 3º Ano" />
          </div>
          <div className="space-y-2 col-span-1">
            <Label>Sala</Label>
            <Input value={numeroSala} onChange={e => setNumeroSala(e.target.value)} placeholder="Ex: 10" />
          </div>
          <div className="space-y-2 col-span-1">
            <Label>Turno</Label>
            <Select value={turno} onValueChange={(v) => setTurno(v as Turno)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Manhã"><Sun className="w-4 h-4 inline mr-2 text-orange-500" />Manhã</SelectItem>
                <SelectItem value="Tarde"><Sunset className="w-4 h-4 inline mr-2 text-orange-400" />Tarde</SelectItem>
                <SelectItem value="Noite"><Moon className="w-4 h-4 inline mr-2 text-indigo-500" />Noite</SelectItem>
                <SelectItem value="Integral"><Clock className="w-4 h-4 inline mr-2 text-blue-500" />Integral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-md border space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Settings2 className="h-4 w-4" /> Mapeamento de Colunas
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Coluna da Matrícula</Label>
              <Select value={colunaMatricula} onValueChange={setColunaMatricula}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colunasExcel.map(col => <SelectItem key={col.valor} value={col.valor}>{col.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coluna do Nome</Label>
              <Select value={colunaNome} onValueChange={setColunaNome}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colunasExcel.map(col => <SelectItem key={col.valor} value={col.valor}>{col.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Começar a ler alunos a partir da linha:</Label>
            <Input
              type="number"
              min={1}
              value={linhaInicio + 1}
              onChange={(e) => setLinhaInicio(parseInt(e.target.value) - 1)}
              className="bg-white w-32"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderPreview = () => (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded border">
        <span><School className="inline h-4 w-4 mr-1" /> <strong>{nomeTurma}</strong></span>
        <span><List className="inline h-4 w-4 mr-1" /> Sala: <strong>{numeroSala}</strong></span>
        <span>
          {turno === 'Manhã' && <Sun className="inline h-4 w-4 mr-1 text-orange-500" />}
          {turno === 'Tarde' && <Sunset className="inline h-4 w-4 mr-1 text-orange-400" />}
          {turno === 'Noite' && <Moon className="inline h-4 w-4 mr-1 text-indigo-500" />}
          {turno === 'Integral' && <Clock className="inline h-4 w-4 mr-1 text-blue-500" />}
          <strong>{turno}</strong>
        </span>
        <span><User className="inline h-4 w-4 mr-1" /> Alunos: <strong>{alunosProcessados.length}</strong></span>
      </div>

      <div className="border rounded-md">
        <div className="bg-gray-100 p-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b flex items-center gap-2">
          <TableIcon className="h-3 w-3" /> Pré-visualização
        </div>
        <ScrollArea className="h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Matrícula</TableHead>
                <TableHead>Nome do Aluno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunosProcessados.map((aluno, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{aluno.matricula}</TableCell>
                  <TableCell>{aluno.nome}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <div className="space-y-3 pt-2">
        <Label className="text-base">Se a matrícula já existir na escola:</Label>
        <RadioGroup value={estrategia} onValueChange={(v) => setEstrategia(v as EstrategiaDuplicidade)} className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer">
            <RadioGroupItem value="ignorar" id="r1" />
            <Label htmlFor="r1" className="cursor-pointer font-normal">
              <strong>Ignorar:</strong> Manter aluno na turma antiga.
            </Label>
          </div>
          <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer border-orange-200 bg-orange-50/30">
            <RadioGroupItem value="atualizar" id="r2" />
            <Label htmlFor="r2" className="cursor-pointer font-normal">
              <strong>Atualizar e Mover:</strong> Mover aluno para esta turma ({turno}).
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Turma</DialogTitle>
        </DialogHeader>

        {etapa === 'upload' && renderUpload()}
        {etapa === 'mapeamento' && renderMapeamento()}
        {etapa === 'preview' && renderPreview()}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
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
                {loading ? 'Importando...' : 'Confirmar Importação'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}