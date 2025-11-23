import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch"; 

export function ImportarNotasDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [semestreSelecionado, setSemestreSelecionado] = useState<string>("1");
  const [modoExcel, setModoExcel] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setLog([]);
    }
  };

  const normalizarTexto = (texto: string) => {
    if (!texto) return "";
    return texto
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "");
  };

  const processarCSV = async () => {
    if (!file || !user?.escola_id) return;
    setLoading(true);
    setLog(["Iniciando leitura da pauta..."]);

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      // Detecta separador
      const separator = text.indexOf(';') > -1 ? ';' : ',';
      
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 3) {
        setLog(prev => [...prev, "❌ Arquivo inválido: Menos de 3 linhas encontradas."]);
        setLoading(false);
        return;
      }

      // --- 1. MAPEAR DISCIPLINAS (Linha 1) ---
      const headerDisciplinas = lines[0].split(separator).map(c => c.trim().replace(/"/g, ''));
      const mapaDisciplinas: { index: number; nome: string; id?: string }[] = [];
      
      // Pula as primeiras colunas fixas (Chamada, Nome, etc)
      for (let i = 0; i < headerDisciplinas.length; i++) {
        const nomeDisc = headerDisciplinas[i];
        // Filtra colunas que parecem ser disciplinas
        if (nomeDisc && 
            !["chamada", "nome", "média", "media", "faltas", "resultado", "total"].some(p => nomeDisc.toLowerCase().includes(p)) &&
            nomeDisc.length > 2) {
          mapaDisciplinas.push({ index: i, nome: nomeDisc });
        }
      }

      if (mapaDisciplinas.length === 0) {
        setLog(prev => [...prev, "❌ Nenhuma disciplina identificada no cabeçalho. Verifique o 'Modo Excel'."]);
        setLoading(false);
        return;
      }

      setLog(prev => [...prev, `📚 Disciplinas detectadas: ${mapaDisciplinas.length}`]);

      // --- 2. DADOS DO BANCO ---
      const { data: disciplinasDB } = await supabase.from('disciplinas').select('id, nome').eq('escola_id', user.escola_id);
      const { data: alunosDB } = await supabase.from('alunos').select('id, nome').eq('escola_id', user.escola_id);

      if (!disciplinasDB || !alunosDB) {
        setLog(prev => [...prev, "❌ Falha ao conectar com o banco de dados."]);
        setLoading(false);
        return;
      }

      // Vincular IDs das disciplinas
      mapaDisciplinas.forEach(item => {
        const discEncontrada = disciplinasDB.find(d => normalizarTexto(d.nome) === normalizarTexto(item.nome));
        if (discEncontrada) {
          item.id = discEncontrada.id;
        } else {
          setLog(prev => [...prev, `⚠️ Disciplina '${item.nome}' não existe no sistema. Crie-a primeiro.`]);
        }
      });

      // --- 3. PROCESSAR ALUNOS ---
      let sucessos = 0;
      let erros = 0;
      
      // Começa da linha 2 (onde estão os alunos)
      for (let i = 2; i < lines.length; i++) {
        const row = lines[i].split(separator).map(c => c.trim().replace(/"/g, ''));
        
        // Coluna 1 costuma ser o Nome (conforme seu CSV: Chamada, Nome...)
        const nomeAlunoCSV = row[1]; 
        if (!nomeAlunoCSV) continue;

        const aluno = alunosDB.find(a => normalizarTexto(a.nome) === normalizarTexto(nomeAlunoCSV));

        if (!aluno) {
          // Log opcional para não poluir muito se tiver muitos erros
          // setLog(prev => [...prev, `⚠️ Aluno '${nomeAlunoCSV}' não encontrado.`]);
          continue;
        }

        // Salva notas para cada disciplina mapeada
        for (const disc of mapaDisciplinas) {
          if (!disc.id) continue; 

          const notaStr = row[disc.index];
          if (notaStr && notaStr !== '-' && notaStr !== '') {
            const nota = parseFloat(notaStr.replace(',', '.'));
            
            if (!isNaN(nota)) {
              // O PULO DO GATO: O 'onConflict' deve ser EXATAMENTE 'aluno_id, disciplina_id, semestre'
              // E não enviamos 'tipo_avaliacao' para ele usar o default 'media'
              const { error } = await supabase.from('notas').upsert({
                escola_id: user.escola_id,
                aluno_id: aluno.id,
                disciplina_id: disc.id,
                semestre: parseInt(semestreSelecionado),
                valor: nota
              }, { 
                onConflict: 'aluno_id, disciplina_id, semestre' 
              });

              if (error) {
                // Mostra o erro detalhado
                setLog(prev => [...prev, `❌ Erro no aluno ${nomeAlunoCSV}: ${error.message}`]);
                console.error("Erro Supabase:", error);
                erros++;
              } else {
                sucessos++;
              }
            }
          }
        }
      }

      setLog(prev => [
        ...prev, 
        "------------------------------------------------",
        `✅ IMPORTAÇÃO CONCLUÍDA`, 
        `Notas salvas com sucesso: ${sucessos}`, 
        `Erros de inserção: ${erros}`
      ]);
      setLoading(false);
      
      if (sucessos > 0) {
        toast({ 
          title: "Sucesso!", 
          description: `${sucessos} notas foram importadas para o ${semestreSelecionado}º Semestre.` 
        });
      }
    };

    // Leitura com encoding correto
    reader.readAsText(file, modoExcel ? 'ISO-8859-1' : 'UTF-8');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
          <FileSpreadsheet className="h-4 w-4" />
          Importar Notas (CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Notas</DialogTitle>
          <DialogDescription>
            Carregue o arquivo CSV. O sistema identificará os alunos pelo nome e as notas pelas colunas das matérias.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-md border">
             <div className="flex flex-col gap-1">
                <Label>Trimestre de Lançamento</Label>
                <Select value={semestreSelecionado} onValueChange={setSemestreSelecionado}>
                <SelectTrigger className="w-[180px] h-9 bg-white">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="1">1º Trimestre</SelectItem>
                    <SelectItem value="2">2º Trimestre</SelectItem>
                    <SelectItem value="3">3º Trimestre</SelectItem>
                </SelectContent>
                </Select>
             </div>

             <div className="flex items-center space-x-2">
                <Switch 
                    id="modo-excel" 
                    checked={modoExcel}
                    onCheckedChange={setModoExcel}
                />
                <Label htmlFor="modo-excel" className="text-xs cursor-pointer">
                    Modo Excel (BR)
                </Label>
             </div>
          </div>

          <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-slate-50 transition-colors bg-slate-50/50">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                className="hidden" 
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="block text-sm font-medium text-purple-600 cursor-pointer hover:underline mb-1">
                Clique para selecionar o arquivo
              </label>
              <p className="text-xs text-gray-500">{file ? file.name : "Nenhum arquivo selecionado"}</p>
            </div>
          </div>

          {log.length > 0 && (
            <ScrollArea className="h-[150px] w-full rounded-md border bg-slate-950 p-4">
              <div className="text-xs font-mono space-y-1">
                {log.map((l, i) => (
                  <div key={i} className={l.includes('❌') || l.includes('⚠️') ? 'text-yellow-400' : 'text-green-400'}>
                    {l}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button onClick={processarCSV} disabled={!file || loading} className="w-full sm:w-auto">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Processando...</> : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}