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

interface Student {
  id?: string;
  nome: string;
  matricula: string;
  turma_id: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
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

  const [gerarAcesso, setGerarAcesso] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // -------------------------------------------------------
  // Preenchimento automático quando editar
  // -------------------------------------------------------
  useEffect(() => {
    if (student && open) {
      setNome(student.nome || "");
      setMatricula(student.matricula || "");
      setNomeResponsavel(student.nome_responsavel || "");
      setTelefoneResponsavel(student.telefone_responsavel || "");

      setGerarAcesso(false);
      setEmail("");
      setPassword("");
    } else if (!isEditing) {
      setNome("");
      setMatricula("");
      setNomeResponsavel("");
      setTelefoneResponsavel("");
      setGerarAcesso(false);
      setEmail("");
      setPassword("");
    }
  }, [student, open, isEditing]);

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

    if (gerarAcesso) {
      if (!email.trim() || !password.trim()) {
        toast({
          title: "Erro",
          description: "Email e senha são obrigatórios para gerar acesso.",
          variant: "destructive",
        });
        return;
      }
      if (password.length < 6) {
        toast({
          title: "Senha fraca",
          description: "A senha deve ter pelo menos 6 caracteres.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      let currentStudentId = student?.id;

      if (!isEditing && !user?.escola_id) {
        throw new Error(
          "ID da escola não encontrado no usuário logado. Faça login novamente."
        );
      }

      // -------------------------------------------------------
      // 1. SALVAR OU EDITAR ALUNO
      // -------------------------------------------------------
      if (isEditing && student?.id) {
        const { error } = await supabase
          .from("alunos")
          .update({
            nome,
            matricula,
            nome_responsavel: nomeResponsavel,
            telefone_responsavel: telefoneResponsavel,
          })
          .eq("id", student.id);

        if (error) throw error;

        toast({
          title: "Aluno atualizado",
          description: "Os dados foram atualizados com sucesso",
        });
      } else {
        const { data: newStudent, error } = await supabase
          .from("alunos")
          .insert({
            nome,
            matricula,
            turma_id: turmaId,
            escola_id: user?.escola_id,
            nome_responsavel: nomeResponsavel,
            telefone_responsavel: telefoneResponsavel,
          })
          .select()
          .single();

        if (error) throw error;

        currentStudentId = newStudent.id;

        if (!gerarAcesso) {
          toast({
            title: "Aluno cadastrado",
            description: "Aluno inserido com sucesso!",
          });
        }
      }

      // -------------------------------------------------------
      // 2. GERAR ACESSO — CHAMAR EDGE FUNCTION
      // -------------------------------------------------------
      if (gerarAcesso && currentStudentId) {
        console.log("Criando acesso para:", email);

        // pegar token do usuário
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          throw new Error("Sessão expirada. Faça login novamente.");
        }

        const { data: funcData, error: funcError } = await supabase.functions.invoke(
          "create-student-user",
          {
            body: {
              email: email.trim(),
              password: password.trim(),
              alunoId: currentStudentId,
              nome: nome,
              escolaId: user?.escola_id,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (funcError) {
          console.error("Erro Edge Function:", funcError);
          throw new Error(
            funcError.message || "Erro ao criar acesso do aluno."
          );
        }

        if (funcData?.error) {
          throw new Error(funcData.error);
        }

        toast({
          title: "Acesso Criado",
          description: `O login ${email} foi criado com sucesso.`,
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

  // -------------------------------------------------------
  // JSX
  // -------------------------------------------------------
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

            {/* Gerar acesso */}
            <div className="space-y-4 mt-2 bg-slate-50 p-4 rounded-md border">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="gerarAcesso"
                  className="h-4 w-4"
                  checked={gerarAcesso}
                  onChange={(e) => setGerarAcesso(e.target.checked)}
                />
                <Label htmlFor="gerarAcesso" className="font-semibold">
                  Gerar acesso ao Portal do Aluno?
                </Label>
              </div>

              {gerarAcesso && (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      className="bg-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required={gerarAcesso}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      className="bg-white"
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={gerarAcesso}
                    />
                  </div>
                </div>
              )}
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
