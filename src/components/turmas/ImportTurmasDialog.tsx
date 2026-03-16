import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { turmaService } from '@/domains';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { Loader2, FileUp, ArrowRight, ArrowLeft, Sun, Moon, Sunset, Clock, CheckCircle } from 'lucide-react';

interface AlunoImportado {
  nome: string;
  matricula: string;
  data_nascimento?: string;
}

interface DadosBrutos {
  nomeTurmaSugerido: string;
  salaSugerida: string;
  linhas: string[][];
}

type EtapaImportacao = 'upload' | 'mapeamento' | 'preview';
type Turno = 'Manhã' | 'Tarde' | 'Noite' | 'Integral';

interface ImportTurmasDialogProps {
  onSuccess: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ImportTurmasDialog({ onSuccess, open: externalOpen, onOpenChange }: ImportTurmasDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // SECURITY CHECK: Only managers can import
  const userRole = user?.role?.toLowerCase() || '';
  const isManager = ['admin', 'diretor', 'coordenador', 'secretario', 'super_admin', 'gestor'].includes(userRole);

  // Debug logs for troubleshooting
  console.log('[ImportTurmasDialog] user:', user);
  console.log('[ImportTurmasDialog] user.role:', user?.role);
  console.log('[ImportTurmasDialog] normalized role:', userRole);
  console.log('[ImportTurmasDialog] isManager:', isManager);

  // Estado interno para controle quando não for controlado externamente
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const [etapa, setEtapa] = useState<EtapaImportacao>('upload');
  const [loading, setLoading] = useState(false);
  const [dadosBrutos, setDadosBrutos] = useState<DadosBrutos | null>(null);
  const [nomeTurma, setNomeTurma] = useState("");
  const [numeroSala, setNumeroSala] = useState("");
  const [turno, setTurno] = useState<Turno>("Manhã");
  const [colunaMatricula, setColunaMatricula] = useState<string>("0");
  const [colunaNome, setColunaNome] = useState<string>("1");
  const [colunaDataNascimento, setColunaDataNascimento] = useState<string>("-1"); // -1 = não usar
  const [linhaInicio, setLinhaInicio] = useState<number>(2);
  const [alunosProcessados, setAlunosProcessados] = useState<AlunoImportado[]>([]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (!newOpen) {
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
      } catch (_err) {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const gerarPreview = () => {
    if (!dadosBrutos) return;
    const idxMatricula = parseInt(colunaMatricula);
    const idxNome = parseInt(colunaNome);
    const idxDataNascimento = parseInt(colunaDataNascimento);
    const alunos: AlunoImportado[] = [];

    for (let i = linhaInicio; i < dadosBrutos.linhas.length; i++) {
      const row = dadosBrutos.linhas[i];
      const matricula = String(row[idxMatricula] || "").trim();
      const nome = String(row[idxNome] || "").trim();
      let dataNascimento: string | undefined = undefined;

      if (idxDataNascimento >= 0 && row[idxDataNascimento]) {
        const rawDate = row[idxDataNascimento];
        // Tentar converter número Excel para data (serial date)
        if (typeof rawDate === 'number') {
          // Excel serial date: days since 1900-01-01 (with Excel's leap year bug)
          // Add 1 to the serial date to fix the leap year bug correctly when generating month/day
          const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
          // Use UTC string split to reliably get YYYY-MM-DD from the UTC date
          const [yyyy, mm, dd] = d.toISOString().split('T')[0].split('-');
          dataNascimento = `${yyyy}-${mm}-${dd}`;
        } else {
          const dateStr = String(rawDate).trim();
          // Converter DD/MM/YYYY para YYYY-MM-DD
          const brMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
          if (brMatch) {
            const [, dia, mes, ano] = brMatch;
            dataNascimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Já está em formato ISO
            dataNascimento = dateStr;
          } else {
            dataNascimento = dateStr; // Deixar como está e tentar sorte no SQL
          }
        }
      }

      if (matricula && nome) {
        alunos.push({ matricula, nome, data_nascimento: dataNascimento });
      }
    }

    if (alunos.length === 0) {
      toast({ title: "Nenhum aluno encontrado", description: "Verifique as colunas selecionadas.", variant: "destructive" });
      return;
    }
    setAlunosProcessados(alunos);
    setEtapa('preview');
  };

  const handleImportar = async () => {
    if (!user?.escola_id) {
      toast({ title: "Erro", description: "Escola não identificada.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const result = await turmaService.importWithStudents(
        nomeTurma,
        numeroSala,
        turno,
        user.escola_id,
        alunosProcessados
      );

      toast({
        title: "Sucesso!",
        description: `Turma importada. Novos: ${result.inseridos}, Atualizados: ${result.atualizados}`,
        className: "bg-green-600 text-white"
      });

      onSuccess();
      handleOpenChange(false);

    } catch (err: unknown) {
      console.error('Import error:', err);
      const message = err instanceof Error ? err.message : "Erro inesperado na importação";
      toast({ title: "Erro na importação", description: message, variant: "destructive" });
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
        <Input id="file" type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
        <p className="text-sm text-gray-500 mt-2">.xlsx ou .xls</p>
      </div>
    </div>
  );

  const renderMapeamento = () => {
    if (!dadosBrutos) return null;

    const colunas = dadosBrutos.linhas[0] || [];
    const previewLinhas = dadosBrutos.linhas.slice(0, 5);

    return (
      <div className="space-y-6 py-4">
        {/* Dados da Turma */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="nomeTurma">Nome da Turma *</Label>
            <Input
              id="nomeTurma"
              value={nomeTurma}
              onChange={(e) => setNomeTurma(e.target.value)}
              placeholder="Ex: 3º Ano A"
            />
          </div>
          <div>
            <Label htmlFor="numeroSala">Número da Sala</Label>
            <Input
              id="numeroSala"
              value={numeroSala}
              onChange={(e) => setNumeroSala(e.target.value)}
              placeholder="Ex: 101"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Turno *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {[
                { value: 'Manhã', icon: Sun, label: 'Manhã' },
                { value: 'Tarde', icon: Sunset, label: 'Tarde' },
                { value: 'Noite', icon: Moon, label: 'Noite' },
                { value: 'Integral', icon: Clock, label: 'Int.' },
              ].map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={turno === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTurno(value as Turno)}
                  className="w-full"
                >
                  <Icon className="h-4 w-4 mr-1" />
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Mapeamento de Colunas */}
        <div className="border rounded-lg p-4 bg-slate-50">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            📊 Mapeamento de Colunas
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Coluna Matrícula *</Label>
              <Select value={colunaMatricula} onValueChange={setColunaMatricula}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {colunas.map((col, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Coluna {idx + 1}: {String(col).slice(0, 20) || `(vazia)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Coluna Nome *</Label>
              <Select value={colunaNome} onValueChange={setColunaNome}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {colunas.map((col, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Coluna {idx + 1}: {String(col).slice(0, 20) || `(vazia)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Coluna Data Nasc. (opcional)</Label>
              <Select value={colunaDataNascimento} onValueChange={setColunaDataNascimento}>
                <SelectTrigger>
                  <SelectValue placeholder="Não usar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">— Não importar —</SelectItem>
                  {colunas.map((col, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Coluna {idx + 1}: {String(col).slice(0, 20) || `(vazia)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Iniciar da Linha</Label>
              <Select value={String(linhaInicio)} onValueChange={(v) => setLinhaInicio(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Linha {n} (pula {n - 1} cabeçalho{n > 2 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Preview da Tabela */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 font-medium text-sm">
            📋 Prévia das primeiras linhas do Excel
          </div>
          <ScrollArea className="max-h-48">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {colunas.map((_, idx) => (
                    <TableHead key={idx} className={`
                      ${idx === parseInt(colunaMatricula) ? 'bg-blue-100 text-blue-800' : ''}
                      ${idx === parseInt(colunaNome) ? 'bg-green-100 text-green-800' : ''}
                    `}>
                      Col {idx + 1}
                      {idx === parseInt(colunaMatricula) && ' (Matrícula)'}
                      {idx === parseInt(colunaNome) && ' (Nome)'}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewLinhas.map((row, rowIdx) => (
                  <TableRow key={rowIdx} className={rowIdx < linhaInicio ? 'bg-gray-100 opacity-50' : ''}>
                    <TableCell className="font-mono text-xs">{rowIdx + 1}</TableCell>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx} className={`text-sm
                        ${cellIdx === parseInt(colunaMatricula) ? 'bg-blue-50' : ''}
                        ${cellIdx === parseInt(colunaNome) ? 'bg-green-50' : ''}
                      `}>
                        {String(cell).slice(0, 30)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          {linhaInicio > 1 && (
            <div className="bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
              ⚠️ Linhas 1-{linhaInicio - 1} serão ignoradas (cabeçalho)
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPreview = () => (
    <div className="space-y-4 py-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
          <CheckCircle className="h-5 w-5" />
          Pronto para importar!
        </div>
        <p className="text-sm text-green-700">
          <strong>{alunosProcessados.length}</strong> alunos serão importados para a turma <strong>{nomeTurma}</strong>
          {parseInt(colunaDataNascimento) >= 0 && ' (com data de nascimento)'}
        </p>
      </div>

      <ScrollArea className="max-h-64 border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nome</TableHead>
              {parseInt(colunaDataNascimento) >= 0 && <TableHead>Data Nasc.</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {alunosProcessados.map((aluno, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                <TableCell className="font-mono">{aluno.matricula}</TableCell>
                <TableCell>{aluno.nome}</TableCell>
                {parseInt(colunaDataNascimento) >= 0 && (
                  <TableCell className="text-sm text-gray-600">{aluno.data_nascimento || '—'}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );

  if (!isManager) {
    console.warn('[ImportTurmasDialog] Access denied for role:', user?.role);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Botão trigger quando não controlado externamente */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FileUp className="h-4 w-4" />
            Importar Turma
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 border-b shrink-0">
          <DialogTitle className="text-lg sm:text-xl">
            {etapa === 'upload' && '📁 Importar Turma via Excel'}
            {etapa === 'mapeamento' && '⚙️ Configurar Mapeamento'}
            {etapa === 'preview' && '✅ Confirmar Importação'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {etapa === 'upload' && 'Selecione um arquivo Excel com a lista de alunos.'}
            {etapa === 'mapeamento' && 'Configure os dados da turma e as colunas do Excel.'}
            {etapa === 'preview' && 'Revise os dados antes de importar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          {etapa === 'upload' && renderUpload()}
          {etapa === 'mapeamento' && renderMapeamento()}
          {etapa === 'preview' && renderPreview()}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 px-4 py-4 sm:px-6 border-t shrink-0">
          {etapa === 'upload' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
          )}

          {etapa === 'mapeamento' && (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading} className="sm:mr-auto">
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEtapa('upload')} className="flex-1 sm:flex-none">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={gerarPreview} disabled={!nomeTurma} className="flex-1 sm:flex-none">
                  Continuar <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {etapa === 'preview' && (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading} className="sm:mr-auto">
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEtapa('mapeamento')} disabled={loading} className="flex-1 sm:flex-none">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Ajustar
                </Button>
                <Button onClick={handleImportar} disabled={loading} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700">
                  {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
                  {loading ? 'Importando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
