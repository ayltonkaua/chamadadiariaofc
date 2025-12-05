import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, MapPin, Phone, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DadosCadastraisProps {
    alunoId: string;
    onUpdate?: () => void; // Callback para avisar a página pai que atualizou
}

export function DadosCadastraisTab({ alunoId, onUpdate }: DadosCadastraisProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        nome_responsavel: "",
        telefone_responsavel: "",
        endereco: ""
    });

    useEffect(() => {
        if (alunoId) carregarDados();
    }, [alunoId]);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("alunos")
                .select("nome_responsavel, telefone_responsavel, endereco")
                .eq("id", alunoId)
                .single();

            if (error) throw error;

            if (data) {
                setFormData({
                    nome_responsavel: data.nome_responsavel || "",
                    telefone_responsavel: data.telefone_responsavel || "",
                    endereco: data.endereco || ""
                });
            }
        } catch (error) {
            console.error("Erro ao carregar:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nome_responsavel || !formData.telefone_responsavel || !formData.endereco) {
            toast({ title: "Campos obrigatórios", description: "Preencha todos os campos para confirmar.", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from("alunos")
                .update({
                    ...formData,
                    dados_atualizados_em: new Date().toISOString() // Marca a data de hoje
                })
                .eq("id", alunoId);

            if (error) throw error;

            toast({ title: "Dados atualizados!", className: "bg-green-600 text-white" });
            if (onUpdate) onUpdate(); // Avisa para fechar o alerta se estiver aberto

        } catch (error: any) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Dados Cadastrais</CardTitle>
                <CardDescription>Mantenha seus dados e contatos de emergência atualizados.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-4">

                    <div className="space-y-2">
                        <Label htmlFor="responsavel">Nome do Responsável</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                id="responsavel"
                                value={formData.nome_responsavel}
                                onChange={e => setFormData({ ...formData, nome_responsavel: e.target.value })}
                                className="pl-10"
                                placeholder="Nome completo do pai, mãe ou responsável"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="telefone">Telefone de Contato (WhatsApp)</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                id="telefone"
                                value={formData.telefone_responsavel}
                                onChange={e => setFormData({ ...formData, telefone_responsavel: e.target.value })}
                                className="pl-10"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="endereco">Endereço Completo</Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                id="endereco"
                                value={formData.endereco}
                                onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                                className="pl-10"
                                placeholder="Rua, Número, Bairro..."
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full md:w-auto" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" /> Confirmar Atualização
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
