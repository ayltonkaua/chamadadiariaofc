import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Edit, Trash2, History, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// MODIFICADO: Campos de responsável adicionados e campos calculados como opcionais
interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  faltas?: number;
  frequencia?: number;
  turma_id: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
}

interface AlunosTableProps {
  alunos: Aluno[];
  onEdit: (id: string) => void;
  onRemove: (aluno: Aluno) => void;
}

const AlunosTable = ({ alunos, onEdit, onRemove }: AlunosTableProps) => {
  const [search, setSearch] = useState("");
  const filteredAlunos = alunos.filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.matricula.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Buscar por nome ou matrícula..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {/* NOVO: Layout de Cards para Mobile (visível apenas em telas pequenas) */}
      <div className="sm:hidden space-y-3">
        {filteredAlunos.map((aluno) => (
          <Card key={aluno.id} className="w-full">
            <CardHeader className="flex flex-row items-start justify-between p-4">
              <div>
                <CardTitle className="text-base">{aluno.nome}</CardTitle>
                <CardDescription>Matrícula: {aluno.matricula}</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(aluno.id)}>
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/turmas/${aluno.turma_id}/alunos/${aluno.id}`} className="w-full">
                      <History className="mr-2 h-4 w-4" /> Histórico
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRemove(aluno)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" /> Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground px-4 pb-4 space-y-2">
              <div><strong>Responsável:</strong> {aluno.nome_responsavel || "-"}</div>
              <div><strong>Telefone:</strong> {aluno.telefone_responsavel || "-"}</div>
              <div className="flex justify-between items-center pt-2">
                <span><strong>Faltas:</strong> {aluno.faltas ?? 'N/A'}</span>
                <span><strong>Frequência:</strong> {aluno.frequencia ?? 'N/A'}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Layout de Tabela para Desktop (oculto em telas pequenas) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table className="min-w-[800px] w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Faltas</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlunos.map((aluno) => (
              <TableRow key={aluno.id} className={aluno.faltas && aluno.faltas > 10 ? "bg-yellow-50" : ""}>
                <TableCell className="font-medium">{aluno.nome}</TableCell>
                <TableCell>{aluno.matricula}</TableCell>
                <TableCell>{aluno.nome_responsavel || "-"}</TableCell>
                <TableCell>{aluno.telefone_responsavel || "-"}</TableCell>
                <TableCell>
                  <span className={aluno.faltas && aluno.faltas > 10 ? "font-bold text-red-600" : ""}>
                    {aluno.faltas ?? 'N/A'}
                  </span>
                </TableCell>
                <TableCell>
                  {aluno.frequencia !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${aluno.frequencia > 80 ? "bg-green-500" : aluno.frequencia > 60 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${aluno.frequencia}%` }}
                        ></div>
                      </div>
                      <span>{aluno.frequencia}%</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link to={`/turmas/${aluno.turma_id}/alunos/${aluno.id}`}>
                      <Button variant="ghost" size="icon" title="Ver histórico">
                        <History className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button onClick={() => onEdit(aluno.id)} variant="outline" size="sm" className="h-8 border-purple-300 text-purple-700">
                      <Edit size={16}/> <span className="hidden md:inline ml-2">Editar</span>
                    </Button>
                    <Button onClick={() => onRemove(aluno)} variant="outline" size="sm" className="h-8 border-red-300 text-red-600">
                      <Trash2 size={16}/> <span className="hidden md:inline ml-2">Apagar</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AlunosTable;