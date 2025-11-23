import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Mail, UserX, CheckCircle2, Loader2 } from "lucide-react";

interface Student {
  id?: string;
  nome: string;
  matricula: string;
  turma_id: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
  user_id?: string; // ID do usuário vinculado (auth.users)
}

interface AddEditStudentDialogProps {
  open: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
  turmaId: string;
  student?: Student;
  isEditing?: boolean;
}

export default function AddEditStudentDialog({
  open,
  onClose,
  onStudentAdded,
  turmaId,
  student,
  isEditing = false,
}: AddEditStudentDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");
  
  // Estados para exibição do vínculo de conta
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // -------------------------------------------------------
  // Carregar dados ao abrir
  // -------------------------------------------------------
  useEffect(() => {
    if (student && open) {
      setNome(student.nome || "");
      setMatricula(student.matricula || "");
      setNomeResponsavel(student.nome_responsavel || "");
      setTelefoneResponsavel(student.telefone_responsavel || "");
      
      // Busca o e-mail se o aluno tiver um usuário vinculado
      if (student.user_id) {
        fetchStudentEmail(student.user_id);
      } else {
        setRegisteredEmail(null);
      }

    } else if (!isEditing) {
      // Limpar campos para novo aluno
      setNome("");
      setMatricula("");
      setNomeResponsavel("");
      setTelefoneResponsavel("");
      setRegisteredEmail(null);
    }
  }, [student, open, isEditing]);

  const fetchStudentEmail = async (userId: string) => {
    setLoadingEmail(true);
    try {
      // Chama a função RPC criada no banco de dados
      const { data, error } = await supabase.rpc('get_user_email', { p_user_id: userId });
      if (!error && data) {
        setRegisteredEmail(data);
      } else {
        setRegisteredEmail(null);
      }
    } catch (err) {
      console.error("Erro ao buscar email:", err);
    } finally {
      setLoadingEmail(false);
    }
  };

  // -------------------------------------------------------
  // ENVIO DO FORMULÁRIO
  // -------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !matricula.trim()) {
      toast({
        title: "Erro",
        description: "Nome e matrícula são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (!isEditing && !user?.escola_id) {
        throw new Error(
          "ID da escola não encontrado. Faça login novamente."
        );
      }

      const payload = {
        nome,
        matricula,
        nome_responsavel: nomeResponsavel,
        telefone_responsavel: telefoneResponsavel,
      };

      if (isEditing && student?.id) {
        const { error } = await supabase
          .from("alunos")
          .update(payload)
          .eq("id", student.id);

        if (error) throw error;

        toast({
          title: "Aluno atualizado",
          description: "Os dados foram atualizados com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("alunos")
          .insert({
            ...payload,
            turma_id: turmaId,
            escola_id: user?.escola_id,
          });

        if (error) throw error;

        toast({
          title: "Aluno cadastrado",
          description: "Aluno inserido com sucesso!",
        });
      }

      onStudentAdded();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar aluno.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar aluno" : "Adicionar aluno"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do aluno."
              : "Preencha os dados abaixo para adicionar um novo aluno."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Status do Cadastro (Visível apenas na edição) */}
            {isEditing && (
              <div className={`p-3 rounded-md border ${registeredEmail ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {loadingEmail ? (
                     <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  ) : registeredEmail ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <UserX className="h-5 w-5 text-orange-500" />
                  )}
                  <span className={`font-semibold text-sm ${registeredEmail ? "text-green-800" : "text-orange-800"}`}>
                    {loadingEmail ? "Verificando vínculo..." : (registeredEmail ? "Aluno Registrado no App" : "Aluno Não Registrado")}
                  </span>
                </div>
                
                {registeredEmail && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-green-700 ml-7">
                    <Mail className="h-3 w-3" />
                    <span>{registeredEmail}</span>
                  </div>
                )}
                
                {!registeredEmail && !loadingEmail && (
                  <p className="text-xs text-orange-700 ml-7">
                    Este aluno ainda não criou uma conta no aplicativo usando esta matrícula.
                  </p>
                )}
              </div>
            )}

            {/* Dados pessoais */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                Dados Pessoais
              </h4>

              <div className="grid gap-2">
                <Label htmlFor="nome">Nome do aluno</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="matricula">Matrícula</Label>
                <Input
                  id="matricula"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Número de matrícula"
                  required
                />
              </div>
            </div>

            {/* Dados do responsável */}
            <div className="space-y-4 mt-2">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                Responsável
              </h4>

              <div className="grid gap-2">
                <Label htmlFor="nome_responsavel">Nome</Label>
                <Input
                  id="nome_responsavel"
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="telefone_responsavel">Telefone / WhatsApp</Label>
                <Input
                  id="telefone_responsavel"
                  value={telefoneResponsavel}
                  onChange={(e) => setTelefoneResponsavel(e.target.value)}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}