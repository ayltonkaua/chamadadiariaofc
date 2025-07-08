import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';

// Componentes da UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import JustificarFaltaForm from '@/components/justificativa/JustificarFaltaForm';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from "@/hooks/use-toast";

// Ícones
import { ClipboardList, ListChecks, FileText, ArrowRight, UserCircle, LogOut, XCircle } from 'lucide-react'; // Adicionado XCircle

const PortalAlunoPage: React.FC = () => {
  const { user, loadingUser, logout } = useAuth();
  const { config: escolaConfig, loading: loadingConfig } = useEscolaConfig();
  const navigate = useNavigate();
  const [isJustifyDialogOpen, setIsJustifyDialogOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: "Não foi possível fazer logout. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // MODIFICADO: A ação de "Responder Pesquisas" agora está desativada.
  const cardActions = [
    {
      title: "Consultar Faltas",
      description: "Acesse seu histórico completo de presença, faltas e atestados.",
      icon: ClipboardList,
      action: () => navigate('/student-query'),
      cta: "Acessar Histórico",
      disabled: false,
    },
    {
      title: "Responder Pesquisas",
      description: "Esta funcionalidade está temporariamente indisponível.",
      icon: XCircle, // Ícone alterado para indicar indisponibilidade
      action: () => {}, // Ação vazia
      cta: "Indisponível",
      disabled: true, // Propriedade para desativar o card
    },
    {
      title: "Justificar Falta",
      description: "Envie um atestado ou justificativa para abonar uma ausência.",
      icon: FileText,
      action: () => setIsJustifyDialogOpen(true),
      cta: "Enviar Justificativa",
      isDialog: true,
      disabled: false,
    },
  ];

  if (loadingUser || loadingConfig) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <UserCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                Bem-vindo(a), {user?.username || 'Aluno(a)'}!
              </h1>
              <p className="text-muted-foreground">
                {escolaConfig?.nome || 'Portal do Aluno'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="shrink-0">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4">Acesso Rápido</h2>
          <Dialog open={isJustifyDialogOpen} onOpenChange={setIsJustifyDialogOpen}>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {cardActions.map((item) => (
                // MODIFICADO: Adicionado estilo para o card desativado
                <Card key={item.title} className={`flex flex-col transition-shadow ${item.disabled ? 'bg-gray-50' : 'hover:shadow-lg'}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      {/* MODIFICADO: Estilo do ícone para o card desativado */}
                      <div className={`p-2 rounded-lg ${item.disabled ? 'bg-gray-200' : 'bg-primary/10'}`}>
                        <item.icon className={`h-6 w-6 ${item.disabled ? 'text-gray-500' : 'text-primary'}`} />
                      </div>
                      <CardTitle className={item.disabled ? 'text-gray-500' : ''}>{item.title}</CardTitle>
                    </div>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow" />
                  <div className="p-6 pt-0">
                    {item.isDialog ? (
                      <DialogTrigger asChild>
                        <Button className="w-full" disabled={item.disabled}>
                          {item.cta} {!item.disabled && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                      </DialogTrigger>
                    ) : (
                      <Button className="w-full" onClick={item.action} disabled={item.disabled}>
                        {item.cta} {!item.disabled && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            
            <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Enviar Justificativa ou Atestado</DialogTitle>
              </DialogHeader>
              <JustificarFaltaForm
                isPortal={true} // Adicionando a prop para o contexto do portal
                onSuccess={() => {
                  toast({ title: 'Sucesso!', description: 'Sua justificativa foi enviada.' });
                  setIsJustifyDialogOpen(false);
                }}
                onClose={() => setIsJustifyDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </div>
  );
};

export default PortalAlunoPage;