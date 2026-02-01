import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { FrequenciaDisciplinaData } from "@/domains/gestor/types/gestor.types";

interface FrequenciaPorDisciplinaChartProps {
    data: FrequenciaDisciplinaData[];
}

export const FrequenciaPorDisciplinaChart: React.FC<FrequenciaPorDisciplinaChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <Card className="col-span-1 lg:col-span-2 shadow-sm">
                <CardHeader>
                    <CardTitle>Frequência por Disciplina</CardTitle>
                    <CardDescription>Comparativo de presença por matéria</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados disponíveis para o período.
                </CardContent>
            </Card>
        );
    }

    // Ordenar por taxa de frequência (decrescente) para melhor visualização
    const sortedData = [...data].sort((a, b) => b.taxa_frequencia - a.taxa_frequencia);

    return (
        <Card className="col-span-1 lg:col-span-2 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle>Frequência por Disciplina</CardTitle>
                <CardDescription>Taxa de presença acumulada por matéria</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis
                                type="category"
                                dataKey="disciplina_nome"
                                width={120}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                formatter={(value: number) => [`${value}%`, 'Presença']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar
                                dataKey="taxa_frequencia"
                                fill="#8884d8"
                                radius={[0, 4, 4, 0]}
                                barSize={20}
                                name="Taxa de Presença"
                            >
                                {
                                    sortedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.taxa_frequencia < 75 ? '#ef4444' : entry.taxa_frequencia < 85 ? '#f59e0b' : '#10b981'} />
                                    ))
                                }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
