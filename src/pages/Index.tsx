// src/pages/Index.tsx

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
// Adicione o ícone ListChecks
import { FileText, Calendar, ClipboardList, ListChecks } from "lucide-react";
import JustificarFaltaForm from "@/components/justificativa/JustificarFaltaForm";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const advantages = [
  "Fácil controle de presença diária",
  "Consulta rápida de faltas para alunos",
  "Acesso para monitores da busca ativa e professores",
  "Dados armazenados com segurança",
  "Interface moderna e responsiva",
];

const Index: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-tr from-blue-100 via-purple-50 to-white">
      {/* HEADER */}
      <header className="py-8 px-4 sm:px-12 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-purple-700 drop-shadow">Chamada Diária</h1>
        {user ? (
          <div className="flex justify-center gap-4">
            <Link to="/dashboard">
              <Button>Ir para o Dashboard</Button>
            </Link>
          </div>
        ) : (
          <Link to="/login">
            <Button>Entrar</Button>
          </Link>
        )}
      </header>

      {/* MAIN SECTION */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-3xl w-full bg-white bg-opacity-90 rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col items-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            Controle sua presença e participe da vida escolar
          </h2>
          <p className="text-gray-600 text-center mb-6 text-base sm:text-lg">
            Ferramentas para professores, administradores e alunos.
          </p>
          
          {/* Ações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full justify-center">
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base sm:text-lg py-5 font-semibold"
              onClick={() => navigate("/login")}
            >
              <Calendar className="mr-2" />
              Área do Professor
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full border-purple-600 text-purple-700 hover:bg-purple-100 hover:border-purple-700 text-base sm:text-lg py-5 font-semibold"
              onClick={() => navigate("/consultar-faltas")}
            >
              <ClipboardList className="mr-2" />
              Consultar Faltas
            </Button>
            
            {/* NOVO BOTÃO PARA CONSULTAR PESQUISAS */}
            <Button
              variant="outline"
              size="lg"
              className="w-full border-green-600 text-green-700 hover:bg-green-100 hover:border-green-700 text-base sm:text-lg py-5 font-semibold"
              onClick={() => navigate("/responder-pesquisa")}
            >
              <ListChecks className="mr-2" />
              Responder Pesquisa
            </Button>

            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-orange-600 text-orange-700 hover:bg-orange-100 hover:border-orange-700 text-base sm:text-lg py-5 font-semibold"
                >
                  <FileText className="mr-2" />
                  Justificar falta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <JustificarFaltaForm onClose={() => setShowForm(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="text-center text-gray-500 py-6 text-sm mt-6">
        © {new Date().getFullYear()} Chamada Diária. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default Index;