import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function DisciplinasTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaDisciplina, setNovaDisciplina] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDisciplinas();
  }, [user?.escola_id]);

  const fetchDisciplinas = async () => {
    if (!user?.escola_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("disciplinas")
      .select("*")
      .eq("escola_id", user.escola_id)
      .order("nome");
    
    if (!error) setDisciplinas(data || []);
    setLoading(false);
  };

  const handleAdicionar = async () => {
    if (!novaDisciplina.trim() || !user?.escola_id) return;
    setSaving(true);

    try {
      const { error } = await supabase.from("disciplinas").insert({
        nome: novaDisciplina.trim(),
        escola_id: user.escola_id,
        cor: "#6366f1" // Cor padrão (Indigo)
      });

      if (error) throw error;

      toast({ title: "Disciplina adicionada!" });
      setNovaDisciplina("");
      setIsDialogOpen(false);
      fetchDisciplinas();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Tem certeza? Isso não apagará as notas já lançadas, mas impedirá novos lançamentos.")) return;
    
    try {
      const { error } = await supabase.from("disciplinas").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Disciplina removida." });
      fetchDisciplinas();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: "Talvez existam dados vinculados.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Grade Curricular</CardTitle>
          <CardDescription>Gerencie as matérias oferecidas pela escola.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4" /> Nova Disciplina
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Disciplina</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input 
                placeholder="Nome da matéria (ex: Matemática)" 
                value={novaDisciplina}
                onChange={(e) => setNovaDisciplina(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleAdicionar} disabled={saving}>
                {saving ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : disciplinas.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-slate-50 rounded-lg border border-dashed">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>Nenhuma disciplina cadastrada.</p>
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Disciplina</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disciplinas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemover(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}