import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wallet, AlertTriangle, ExternalLink, Building2, User, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MeusBeneficiosPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [beneficios, setBeneficios] = useState<any[]>([]);
    const [alunoMatricula, setAlunoMatricula] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;

        try {
            // 1. Buscar matrícula do aluno
            const { data: alunoData, error: alunoError } = await (supabase as any)
                .from('alunos')
                .select('matricula')
                .eq('user_id', user.id)
                .single();

            if (alunoError || !alunoData) {
                setLoading(false);
                return;
            }

            setAlunoMatricula(alunoData.matricula);

            // 2. Buscar Benefícios (Registros + Nome do Programa)
            const { data: beneficiosData, error: benError } = await (supabase as any)
                .from('programas_registros')
                .select(`
                    *,
                    programas_sociais (nome, ativo)
                `)
                .eq('matricula_beneficiario', alunoData.matricula);

            if (!benError && beneficiosData) {
                // Filtra apenas programas ativos
                const ativos = beneficiosData.filter((b: any) => b.programas_sociais?.ativo);
                setBeneficios(ativos);
            }

        } catch (error) {
            console.error("Erro ao carregar benefícios:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Buscando informações...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/portal-aluno')}>
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Button>
                <div className="bg-green-100 p-3 rounded-full">
                    <Wallet className="h-8 w-8 text-green-700" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Meus Benefícios</h1>
                    <p className="text-gray-500 text-sm">Consulte repasses e programas sociais.</p>
                </div>
            </div>

            {beneficios.length === 0 ? (
                <Card className="bg-slate-50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="bg-white p-4 rounded-full mb-4 shadow-sm">
                            <Building2 className="h-10 w-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Nenhum benefício encontrado</h3>
                        <p className="text-gray-500 max-w-sm mt-2">
                            Não encontramos registros de pagamento para a matrícula <span className="font-mono bg-gray-200 px-1 rounded">{alunoMatricula || 'N/A'}</span> no momento.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Alerta de Prestação de Contas (Sempre visível se tiver benefício) */}
                    <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <AlertTitle className="ml-2 font-bold">Atenção: Prestação de Contas</AlertTitle>
                        <AlertDescription className="ml-2 mt-1 text-sm leading-relaxed">
                            Se você recebeu o benefício e ainda não fez a prestação de contas,
                            <strong> faça urgente!</strong> Em caso de dúvidas, contate a secretaria da Escola.
                            <div className="mt-3">
                                <a
                                    href="https://meutenis.pe.gov.br"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button size="sm" variant="outline" className="bg-white text-amber-800 hover:bg-amber-100 border-amber-300">
                                        Acessar meutenis.pe.gov.br <ExternalLink className="ml-2 h-3 w-3" />
                                    </Button>
                                </a>
                            </div>
                        </AlertDescription>
                    </Alert>

                    {/* Lista de Cards de Benefícios */}
                    {beneficios.map((item) => {
                        const dados = item.dados_pagamento || {}; // Garante que não quebre se for null
                        const dataPagamento = dados.data_pagamento || '--/--/----';
                        return (
                            <Card key={item.id} className="border-l-4 border-l-green-500 shadow-sm overflow-hidden">
                                <CardHeader className="bg-slate-50/50 pb-3 border-b">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg text-green-900">{item.programas_sociais?.nome}</CardTitle>
                                            <CardDescription className="text-xs text-gray-500 mt-1">
                                                Processado em: {new Date(item.created_at).toLocaleDateString()}
                                            </CardDescription>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 text-right">
                                            {dados.valor && (
                                                <Badge className="bg-green-600 text-lg px-3 py-1">
                                                    R$ {dados.valor}
                                                </Badge>
                                            )}
                                            <p className="text-xs text-gray-600">
                                                Pago em: <span className="font-semibold text-gray-800">{dataPagamento}</span>
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Favorecido (Responsável)</p>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-gray-400" />
                                            <p className="font-medium text-gray-800">{dados.nome_responsavel || 'Não informado'}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">CPF: {dados.cpf_responsavel || '***'}</p>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Dados Bancários</p>
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-gray-400" />
                                            <p className="font-medium text-gray-800">{dados.banco || 'Banco não inf.'}</p>
                                        </div>
                                        <div className="flex gap-4 mt-1">
                                            <div>
                                                <span className="text-xs text-gray-500">Ag: </span>
                                                <span className="font-mono text-sm font-bold">{dados.agencia || '--'}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">Conta: </span>
                                                <span className="font-mono text-sm font-bold">{dados.conta || '--'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}