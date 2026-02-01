/**
 * Arquivos List Page - Listar Anos Arquivados
 * 
 * Exibe lista de anos letivos que foram arquivados para o Firebase.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { anoLetivoService, type AnoLetivoComStats } from "@/domains";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, Calendar, ArrowRight, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";

const ArquivosListPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [arquivos, setArquivos] = useState<AnoLetivoComStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.escola_id) {
            loadArquivos();
        }
    }, [user?.escola_id]);

    const loadArquivos = async () => {
        if (!user?.escola_id) return;
        setLoading(true);
        try {
            // Reutiliza o serviço existente que busca todos os anos
            const todosAnos = await anoLetivoService.getAll(user.escola_id);
            // Filtra apenas os arquivados
            const arquivados = todosAnos.filter(a => a.status === 'arquivado');
            setArquivos(arquivados);
        } catch (error) {
            console.error("Erro ao carregar arquivos", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 px-4 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                    <Archive className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Arquivos Mortos</h1>
                    <p className="text-gray-500">Histórico de anos letivos arquivados</p>
                </div>
            </div>

            {arquivos.length === 0 ? (
                <Card className="py-12 bg-gray-50 border-dashed">
                    <CardContent className="text-center">
                        <Archive className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700">Nenhum arquivo encontrado</h3>
                        <p className="text-gray-500">
                            Os anos letivos arquivados aparecerão aqui.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {arquivos.map(arquivo => (
                        <Card key={arquivo.id} className="hover:shadow-md transition-shadow cursor-pointer border-orange-100" onClick={() => navigate(`/arquivos/${arquivo.id}`)}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-orange-500" />
                                        {arquivo.nome}
                                    </CardTitle>
                                    <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                                        Arquivado
                                    </Badge>
                                </div>
                                <CardDescription>
                                    {arquivo.ano}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        <span>
                                            {format(new Date(arquivo.data_inicio + 'T00:00:00'), "dd/MM/yyyy")} - {format(new Date(arquivo.data_fim + 'T00:00:00'), "dd/MM/yyyy")}
                                        </span>
                                    </div>
                                    <div className="pt-2 flex justify-end">
                                        <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-2 p-0 h-auto font-medium">
                                            Acessar Arquivo <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ArquivosListPage;
