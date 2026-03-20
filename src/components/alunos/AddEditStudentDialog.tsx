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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Mail, UserX, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { geocodeAddress } from "@/lib/geocoding.service";

interface Student {
  id?: string;
  nome: string;
  matricula: string;
  turma_id: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
  telefone_responsavel_2?: string;
  user_id?: string;
  data_nascimento?: string;
  endereco?: string;
  trabalha?: boolean;
  recebe_pe_de_meia?: boolean;
  recebe_bolsa_familia?: boolean;
  mora_com_familia?: boolean;
  usa_transporte?: boolean;
  tem_passe_livre?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  telefone_aluno?: string;
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
  const [telefoneResponsavel2, setTelefoneResponsavel2] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [endereco, setEndereco] = useState("");

  // Socioeconomic fields
  const [trabalha, setTrabalha] = useState(false);
  const [recebePeDeMeia, setRecebePeDeMeia] = useState(false);
  const [recebeBolsaFamilia, setRecebeBolsaFamilia] = useState(false);
  const [moraComFamilia, setMoraComFamilia] = useState(true);
  const [usaTransporte, setUsaTransporte] = useState(false);
  const [temPasseLivre, setTemPasseLivre] = useState(false);

  // Student contact
  const [telefoneAluno, setTelefoneAluno] = useState("");

  // Geocoding
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');

  // Estados para exibição do vínculo de conta
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchedCep, setLastFetchedCep] = useState<string>("");

  // -------------------------------------------------------
  // Carregar dados ao abrir
  // -------------------------------------------------------
  useEffect(() => {
    if (student && open) {
      setNome(student.nome || "");
      setMatricula(student.matricula || "");
      setNomeResponsavel(student.nome_responsavel || "");
      setTelefoneResponsavel(student.telefone_responsavel || "");
      setTelefoneResponsavel2(student.telefone_responsavel_2 || "");
      setDataNascimento(student.data_nascimento || "");
      setEndereco(student.endereco || "");
      setTrabalha(student.trabalha || false);
      setRecebePeDeMeia(student.recebe_pe_de_meia || false);
      setRecebeBolsaFamilia(student.recebe_bolsa_familia || false);
      setMoraComFamilia(student.mora_com_familia !== false); // default true
      setUsaTransporte(student.usa_transporte || false);
      setTemPasseLivre(student.tem_passe_livre || false);
      setLatitude(student.latitude || null);
      setLongitude(student.longitude || null);
      setGeocodingStatus(student.latitude ? 'found' : 'idle');
      setTelefoneAluno(student.telefone_aluno || "");

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
      setTelefoneResponsavel2("");
      setDataNascimento("");
      setEndereco("");
      setTrabalha(false);
      setRecebePeDeMeia(false);
      setMoraComFamilia(true);
      setUsaTransporte(false);
      setTemPasseLivre(false);
      setLatitude(null);
      setLongitude(null);
      setGeocodingStatus('idle');
      setTelefoneAluno("");
      setRegisteredEmail(null);
      setLastFetchedCep("");
    }
  }, [student, open, isEditing]);

  const fetchStudentEmail = async (userId: string) => {
    setLoadingEmail(true);
    try {
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

  useEffect(() => {
    const checkCepEAutoPreencher = async () => {
      const match = endereco.match(/\b(\d{5}-?\d{3})\b/);
      if (match) {
        const cep = match[1].replace('-', '');
        if (cep !== lastFetchedCep) {
          setLastFetchedCep(cep);
          try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
              const novoEndereco = `${data.logradouro}, Número, ${data.bairro}, ${data.localidade} - ${data.uf}, CEP ${match[1]}`;
              setEndereco(novoEndereco);
              toast({ title: "CEP Encontrado", description: "Endereço preenchido automaticamente com dados do ViaCEP." });
            }
          } catch (err) {
            console.error("Erro ao buscar ViaCEP:", err);
          }
        }
      }
    };
    checkCepEAutoPreencher();
  }, [endereco, lastFetchedCep, toast]);

  // -------------------------------------------------------
  // GEOCODING ao sair do campo endereço
  // -------------------------------------------------------
  const handleEnderecoBlur = async () => {
    if (!endereco || endereco.trim().length < 5) {
      setGeocodingStatus('idle');
      return;
    }

    setGeocodingStatus('loading');
    const result = await geocodeAddress(endereco);
    if (result) {
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setGeocodingStatus('found');
    } else {
      setLatitude(null);
      setLongitude(null);
      setGeocodingStatus('not_found');
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

      const payload: Record<string, any> = {
        nome,
        matricula,
        nome_responsavel: nomeResponsavel,
        telefone_responsavel: telefoneResponsavel,
        telefone_responsavel_2: telefoneResponsavel2 || null,
        data_nascimento: dataNascimento || null,
        endereco: endereco || null,
        trabalha,
        recebe_pe_de_meia: recebePeDeMeia,
        recebe_bolsa_familia: recebeBolsaFamilia,
        mora_com_familia: moraComFamilia,
        usa_transporte: usaTransporte,
        tem_passe_livre: temPasseLivre,
        latitude: latitude,
        longitude: longitude,
        telefone_aluno: telefoneAluno || null,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

              <div className="grid gap-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  placeholder="DD/MM/AAAA"
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

              <div className="grid gap-2">
                <Label htmlFor="telefone_responsavel_2">Telefone Responsável 2 (opcional)</Label>
                <Input
                  id="telefone_responsavel_2"
                  value={telefoneResponsavel2}
                  onChange={(e) => setTelefoneResponsavel2(e.target.value)}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>
            </div>

            {/* Endereço + Geocoding */}
            <div className="space-y-4 mt-2">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                Localização
              </h4>

              <div className="grid gap-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  onBlur={handleEnderecoBlur}
                  placeholder="Ex: Rua das Flores, 10, Água Fria, CEP 00000-000"
                />
                {geocodingStatus === 'loading' && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando localização...
                  </p>
                )}
                {geocodingStatus === 'found' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Localização encontrada
                  </p>
                )}
                {geocodingStatus === 'not_found' && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    ⚠️ Endereço não localizado no mapa. Tente ser mais específico.
                  </p>
                )}
              </div>
            </div>

            {/* Contato do Aluno */}
            <div className="space-y-4 mt-2">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                Contato do Aluno
              </h4>

              <div className="grid gap-2">
                <Label htmlFor="telefone_aluno">Telefone / WhatsApp</Label>
                <Input
                  id="telefone_aluno"
                  value={telefoneAluno}
                  onChange={(e) => setTelefoneAluno(e.target.value)}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>
            </div>

            {/* Dados socioeconômicos */}
            <div className="space-y-4 mt-2">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                Dados Socioeconômicos
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="trabalha" className="text-sm font-medium">Trabalha</Label>
                    <p className="text-xs text-muted-foreground">O aluno exerce atividade remunerada?</p>
                  </div>
                  <Switch id="trabalha" checked={trabalha} onCheckedChange={setTrabalha} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="pe_de_meia" className="text-sm font-medium">Pé-de-Meia</Label>
                    <p className="text-xs text-muted-foreground">Recebe benefício Pé-de-Meia?</p>
                  </div>
                  <Switch id="pe_de_meia" checked={recebePeDeMeia} onCheckedChange={setRecebePeDeMeia} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="bolsa_familia" className="text-sm font-medium">Bolsa Família</Label>
                    <p className="text-xs text-muted-foreground">Recebe benefício Bolsa Família?</p>
                  </div>
                  <Switch id="bolsa_familia" checked={recebeBolsaFamilia} onCheckedChange={setRecebeBolsaFamilia} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="familia" className="text-sm font-medium">Mora com a família</Label>
                    <p className="text-xs text-muted-foreground">O aluno reside com familiares?</p>
                  </div>
                  <Switch id="familia" checked={moraComFamilia} onCheckedChange={setMoraComFamilia} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="transporte" className="text-sm font-medium">Transporte Escolar</Label>
                    <p className="text-xs text-muted-foreground">Utiliza transporte escolar?</p>
                  </div>
                  <Switch id="transporte" checked={usaTransporte} onCheckedChange={setUsaTransporte} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="passe_livre" className="text-sm font-medium">Passe Livre</Label>
                    <p className="text-xs text-muted-foreground">Possui passe livre estudantil?</p>
                  </div>
                  <Switch id="passe_livre" checked={temPasseLivre} onCheckedChange={setTemPasseLivre} />
                </div>
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