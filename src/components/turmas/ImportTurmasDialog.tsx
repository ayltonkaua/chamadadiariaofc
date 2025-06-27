import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { Loader2, FileUp, List, User, School } from 'lucide-react';

// Interfaces para organizar os dados extraídos
interface AlunoParaImportar {
  nome: string;
  matricula: string;
}

interface DadosImportacao {
  nomeTurma: string;
  numeroSala: string;
  alunos: AlunoParaImportar[];
}

interface ImportTurmasDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportTurmasDialog({ onClose, onSuccess }: ImportTurmasDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<DadosImportacao | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, loadingUser } = useAuth();

  const processExcelFile = (selectedFile: File) => {
    setLoading(true);
    setParsedData(null); // Limpa dados anteriores

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converte a planilha para um array de arrays (linhas e colunas)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        if (rows.length < 3) {
          throw new Error("O arquivo precisa ter no mínimo 3 linhas: nome da turma, número da sala e pelo menos um aluno.");
        }

        // Extrai os dados das linhas específicas
        const nomeTurma = rows[0]?.[0]?.trim();
        const numeroSala = String(rows[1]?.[0] || '').trim();
        
        if (!nomeTurma || !numeroSala) {
          throw new Error("Verifique se o nome da turma (linha 1) e o número da sala (linha 2) estão preenchidos.");
        }

        // Extrai os alunos a partir da terceira linha (índice 2)
        const alunos = rows.slice(2).map(row => ({
          nome: row[0]?.trim(),
          matricula: String(row[1] || '').trim()
        })).filter(aluno => aluno.nome && aluno.matricula); // Filtra linhas de alunos vazias

        if (alunos.length === 0) {
            throw new Error("Nenhum aluno com nome e matrícula foi encontrado a partir da terceira linha.");
        }

        setParsedData({ nomeTurma, numeroSala, alunos });
        toast({ title: "Arquivo processado", description: `Encontrado: 1 turma e ${alunos.length} alunos. Verifique e confirme a importação.` });

      } catch (error: any) {
        console.error('Error processing file:', error);
        toast({ title: "Erro ao ler arquivo", description: error.message, variant: "destructive" });
        setFile(null); // Reseta o input de arquivo
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
        toast({ title: "Erro", description: "Não foi possível ler o arquivo.", variant: "destructive" });
        setLoading(false);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        processExcelFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!parsedData) {
      toast({ title: "Nenhum dado para importar", variant: "destructive" });
      return;
    }
    
    if (!user?.escola_id) {
      toast({ title: "Erro de Configuração", description: "Seu usuário não está vinculado a uma escola.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Cria a turma primeiro para obter o ID
      const { data: turma, error: turmaError } = await supabase
        .from('turmas')
        .insert({
          nome: parsedData.nomeTurma,
          numero_sala: parsedData.numeroSala,
          escola_id: user.escola_id,
          user_id: user.id
        })
        .select()
        .single();
      
      if (turmaError || !turma) throw turmaError || new Error("Falha ao criar a turma.");

      // 2. Prepara os dados dos alunos com o ID da turma recém-criada
      const alunosParaInserir = parsedData.alunos.map(aluno => ({
        ...aluno,
        turma_id: turma.id,
        escola_id: user.escola_id
      }));

      // 3. Insere todos os alunos
      const { error: alunosError } = await supabase.from('alunos').insert(alunosParaInserir);

      if (alunosError) {
        // Se a inserção de alunos falhar, remove a turma criada para não deixar dados órfãos
        await supabase.from('turmas').delete().eq('id', turma.id);
        throw alunosError;
      }

      toast({
        title: 'Importação Concluída',
        description: `Turma "${parsedData.nomeTurma}" e ${parsedData.alunos.length} alunos importados com sucesso.`,
      });

      onSuccess();
      onClose();

    } catch (error: any) {
      console.error("Erro ao importar dados:", error);
      toast({ title: 'Erro na importação', description: error.message || 'Não foi possível importar os dados para o banco.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Turma e Alunos via Excel</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor="file-upload">Selecione o arquivo Excel (.xlsx)</Label>
            <Input 
              id="file-upload" 
              type="file" 
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={loading || loadingUser}
            />
            <p className="text-xs text-gray-500">
              O arquivo deve seguir o formato especificado.
            </p>
          </div>

          {loading && <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}

          {/* Área de Pré-visualização */}
          {parsedData && (
            <div className="border rounded-md p-4 space-y-4 bg-slate-50">
              <h3 className="font-semibold text-base">Dados para Importação</h3>
              <div className='flex items-center gap-2 text-sm'><School size={16} className="text-gray-600"/> Turma: <span className="font-medium">{parsedData.nomeTurma}</span></div>
              <div className='flex items-center gap-2 text-sm'><List size={16} className="text-gray-600"/> Sala: <span className="font-medium">{parsedData.numeroSala}</span></div>
              <div className='flex items-center gap-2 text-sm'><User size={16} className="text-gray-600"/> Alunos Encontrados: <span className="font-medium">{parsedData.alunos.length}</span></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={loading || loadingUser || !parsedData}>
            {loading || loadingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            {loadingUser ? "Aguarde..." : (loading ? 'Importando...' : 'Confirmar Importação')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}