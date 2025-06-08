
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { useAuth } from "@/contexts/AuthContext";

interface ImportTurmasDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportTurmasDialog({ onClose, onSuccess }: ImportTurmasDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const processExcelFile = async (file: File) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({
            title: "Erro",
            description: "O arquivo não contém dados.",
            variant: "destructive",
          });
          return;
        }

        setLoading(true);

        for (const row of jsonData as any[]) {
          if (!row.nome || !row.numero_sala || !row.alunos) {
            continue;
          }

          // Create turma
          const { data: turma, error: turmaError } = await supabase
            .from('turmas')
            .insert({
              nome: row.nome,
              numero_sala: row.numero_sala,
              user_id: user?.id
            })
            .select()
            .single();

          if (turmaError) {
            console.error('Error creating turma:', turmaError);
            continue;
          }

          // Process alunos if they exist
          const alunos = row.alunos.split(',').map((nome: string) => ({
            nome: nome.trim(),
            matricula: Math.random().toString(36).substring(2, 8).toUpperCase(),
            turma_id: turma.id
          }));

          if (alunos.length > 0) {
            const { error: alunosError } = await supabase
              .from('alunos')
              .insert(alunos);

            if (alunosError) {
              console.error('Error creating alunos:', alunosError);
            }
          }
        }

        toast({
          title: "Importação concluída",
          description: "As turmas foram importadas com sucesso.",
        });
        
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: "Erro",
          description: "Erro ao processar o arquivo.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Turmas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Input 
              type="file" 
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  processExcelFile(file);
                }
              }}
            />
            <p className="text-sm text-gray-500">
              O arquivo Excel deve conter as colunas: nome, numero_sala, alunos (nomes separados por vírgula)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
