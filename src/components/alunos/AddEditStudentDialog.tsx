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
// CORREÇÃO: Padronizando importações com '@' para garantir resolução correta
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
  
  // Estados dos dados do aluno
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");

  // Estados para geração de acesso (Portal do Aluno)
  const [gerarAcesso, setGerarAcesso] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (student && open) {
      // Modo Edição: Preenche os dados existentes
      setNome(student.nome || "");
      setMatricula(student.matricula || "");
      setNomeResponsavel(student.nome_responsavel || "");
      setTelefoneResponsavel(student.telefone_responsavel || "");
      
      // Reseta campos de acesso na edição para evitar confusão
      setGerarAcesso(false);
      setEmail("");
      setPassword("");
    } else if (!isEditing) {
      // Modo Adição: Limpa tudo
      setNome("");
      setMatricula("");
      setNomeResponsavel("");
      setTelefoneResponsavel("");
      setGerarAcesso(false);
      setEmail("");
      setPassword("");
    }
  }, [student, open, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!nome.trim() || !matricula.trim()) {
      toast({
        title: "Erro",
        description: "Nome e matrícula são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Validação dos campos de acesso se a opção estiver marcada
    if (gerarAcesso) {
      if (!email.trim() || !password.trim()) {
        toast({
          title: "Erro de Acesso",
          description: "Para gerar acesso, E-mail e Senha são obrigatórios.",
          variant: "destructive",
        });
        return;
      }
      if (password.length < 6) {
        toast({
          title: "Senha Fraca",
          description: "A senha deve ter pelo menos 6 caracteres.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      let currentStudentId = student?.id;

      // Verificação de segurança: Precisamos do ID da escola
      // Se for admin, o escola_id deve estar presente no objeto user
      if (!isEditing && !user?.escola_id) {
        throw new Error("Erro de configuração: ID da Escola não encontrado no usuário logado. Tente sair e entrar novamente.");
      }

      // 1. Operação no Banco de Dados (Alunos)
      if (isEditing && student?.id) {
        // Atualização
        const { error } = await supabase
          .from("alunos")
          .update({ 
            nome, 
            matricula,
            nome_responsavel: nomeResponsavel,
            telefone_responsavel: telefoneResponsavel
          })
          .eq("id", student.id);

        if (error) throw error;

        toast({
          title: "Aluno atualizado",
          description: "Os dados do aluno foram atualizados com sucesso.",
        });

      } else {
        // Inserção - Agora incluindo o escola_id
        const { data: newStudent, error } = await supabase
          .from("alunos")
          .insert({
            nome,
            matricula,
            turma_id: turmaId,
            escola_id: user?.escola_id, // Inclui o ID da escola na criação
            nome_responsavel: nomeResponsavel,
            telefone_responsavel: telefoneResponsavel
          })
          .select()
          .single();

        if (error) throw error;
        
        currentStudentId = newStudent.id;

        // Se não for gerar acesso, avisa logo que deu certo
        if (!gerarAcesso) {
            toast({
                title: "Aluno adicionado",
                description: "O aluno foi adicionado à turma com sucesso.",
            });
        }
      }

      // 2. Operação na Edge Function (Criar Usuário Auth)
      if (gerarAcesso && currentStudentId) {
        console.log("Chamando Edge Function para criar usuário:", email);
        
        const { data: funcData, error: funcError } = await supabase.functions.invoke('create-student-user', {
          body: {
            email: email.trim(),
            password: password.trim(),
            alunoId: currentStudentId,
            nome: nome
          }
        });

        if (funcError) {
          console.error("Erro na Edge Function:", funcError);
          
          let errorMsg = "Erro ao comunicar com o servidor.";
          // Tenta extrair erro do corpo da resposta se disponível
          if (funcError && typeof funcError === 'object' && 'message' in funcError) {
             try {
                const body = JSON.parse(funcError.message);
                if (body.error) errorMsg = body.error;
             } catch {
                errorMsg = funcError.message;
             }
          }
          
          throw new Error("Aluno salvo, mas falha ao criar acesso: " + errorMsg);
        }

        if (funcData && funcData.error) {
           throw new Error("Aluno salvo, mas falha ao criar acesso: " + funcData.error);
        }

        toast({
          title: "Acesso Criado!",
          description: `Login criado com sucesso para ${email}`,
          variant: "default",
          className: "bg-green-50 border-green-200 text-green-900"
        });
      }

      onStudentAdded();
      onClose();

    } catch (error: any) {
      console.error("Erro ao processar:", error);
      
      let displayError = error.message || "Ocorreu um erro ao salvar os dados.";
      
      // Tratamento para erros genéricos
      if (displayError.includes("non-2xx")) {
          displayError = "Erro no servidor: O email pode já estar em uso ou a função não foi implantada.";
      }

      toast({
        title: "Atenção",
        description: displayError,
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
            {isEditing ? "Editar aluno" : "Adicionar novo aluno"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados do aluno abaixo."
              : "Preencha os dados para adicionar à turma."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Seção: Dados Pessoais */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Dados Pessoais</h4>
              
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

            {/* Seção: Responsável */}
            <div className="space-y-4 mt-2">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Dados do Responsável</h4>
              
              <div className="grid gap-2">
                <Label htmlFor="nome_responsavel">Nome do Responsável</Label>
                <Input
                  id="nome_responsavel"
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
                  placeholder="Nome do pai/mãe/responsável"
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

            {/* Seção: Acesso ao Portal (NOVO) */}
            <div className="space-y-4 mt-2 bg-slate-50 p-4 rounded-md border">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="gerarAcesso"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={gerarAcesso}
                  onChange={(e) => setGerarAcesso(e.target.checked)}
                />
                <Label 
                  htmlFor="gerarAcesso" 
                  className="font-semibold text-primary cursor-pointer select-none"
                >
                  Gerar Acesso ao Portal do Aluno?
                </Label>
              </div>

              {gerarAcesso && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-xs text-muted-foreground mb-1">
                    Crie um login para o aluno acessar o app e ver suas faltas.
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail de Acesso</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aluno@email.com"
                      required={gerarAcesso}
                      className="bg-white"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Senha Provisória</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      required={gerarAcesso}
                      className="bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : isEditing ? "Atualizar Dados" : "Salvar Aluno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}