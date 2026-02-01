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
import { Trash2, MoreVertical, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
  data_nascimento?: string;
  user_id?: string;
}

interface AlunosTableProps {
  alunos: Aluno[];
  onRemove: (aluno: Aluno) => void;
  canEdit?: boolean;
}

const AlunosTable = ({ alunos, onRemove, canEdit = false }: AlunosTableProps) => {
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

      {/* --- MODO MOBILE (CARD) --- */}
      <div className="sm:hidden space-y-3">
        {filteredAlunos.map((aluno) => (
          <Card key={aluno.id} className="w-full">
            <CardHeader className="flex flex-row items-start justify-between p-4">
              <div>
                <CardTitle className="text-base">{aluno.nome}</CardTitle>
                <CardDescription>Matrícula: {aluno.matricula}</CardDescription>
                <CardDescription className="mt-1">
                  Nascimento: {aluno.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR') : "--"}
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/turmas/${aluno.turma_id}/alunos/${aluno.id}`} className="w-full">
                      <User className="mr-2 h-4 w-4" /> Ver Perfil
                    </Link>
                  </DropdownMenuItem>

                  {canEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onRemove(aluno)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* --- MODO DESKTOP (TABLE) --- */}
      <div className="hidden sm:block overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Data de Nascimento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlunos.map((aluno) => (
              <TableRow key={aluno.id}>
                <TableCell className="font-medium">{aluno.nome}</TableCell>
                <TableCell>{aluno.matricula}</TableCell>
                <TableCell>{aluno.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR') : "--"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {/* Perfil */}
                    <Link to={`/turmas/${aluno.turma_id}/alunos/${aluno.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver Perfil"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      >
                        <User className="h-4 w-4" />
                      </Button>
                    </Link>

                    {canEdit && (
                      <>
                        {/* Excluir */}
                        <Button
                          onClick={() => onRemove(aluno)}
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Excluir Aluno"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Empty state */}
      {filteredAlunos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {search ? "Nenhum aluno encontrado com esse termo." : "Nenhum aluno cadastrado nesta turma."}
        </div>
      )}
    </div>
  );
};

export default AlunosTable;