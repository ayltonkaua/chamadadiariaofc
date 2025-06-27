import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
// Importe o novo ícone para pesquisas
import { FileText, Calendar, ClipboardList, ListChecks } from "lucide-react";
import JustificarFaltaForm from "@/components/justificativa/JustificarFaltaForm";
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
      <header className="py-4 sm:py-8 px-4 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-purple-700 drop-shadow text-center sm:text-left">Chamada Diária</h1>
        {user ? (
          <div className="w-full sm:w-auto">
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Ir para o Dashboard</Button>
            </Link>
          </div>
        ) : (
          <Link to="/login" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Entrar</Button>
          </Link>
        )}
      </header>

      {/* MAIN SECTION */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full bg-white bg-opacity-90 rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 flex flex-col items-center">
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center text-gray-900 mb-3">
            Controle sua presença de forma simples e segura
          </h2>
          <p className="text-gray-600 text-center mb-6 text-sm sm:text-base md:text-lg">
            O aplicativo Chamada Diária facilita o registro de presenças e permite que alunos consultem suas faltas com facilidade.
          </p>
          {/* Vantagens */}
          <ul className="list-none space-y-2 sm:space-y-3 mb-6 sm:mb-8 w-full">
            {advantages.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start sm:items-center text-gray-800 text-xs sm:text-sm md:text-base"
              >
                <span className="rounded-full bg-purple-100 mr-2 sm:mr-3 p-1 flex-shrink-0 mt-0.5 sm:mt-0">
                  <FileText className="text-purple-600" size={16} />
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>

          {/* Ações */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full">
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-sm sm:text-base md:text-lg py-3 sm:py-4 md:py-5 font-semibold"
              onClick={() => navigate("/login")}
            >
              <Calendar className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Fazer chamada
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full border-purple-600 text-purple-700 hover:bg-purple-100 hover:border-purple-700 text-sm sm:text-base md:text-lg py-3 sm:py-4 md:py-5 font-semibold"
              onClick={() => navigate("/student-query")}
            >
              <ClipboardList className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Consultar faltas
            </Button>
            
            {/* NOVO BOTÃO PARA CONSULTAR PESQUISAS */}
            <Button
              variant="outline"
              size="lg"
              className="w-full border-purple-600 text-purple-700 hover:bg-purple-100 hover:border-purple-700 text-sm sm:text-base md:text-lg py-3 sm:py-4 md:py-5 font-semibold"
              onClick={() => navigate("/responder-pesquisa")}
            >
              <ListChecks className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Responder Pesquisa
            </Button>

            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-purple-600 text-purple-700 hover:bg-purple-100 hover:border-purple-700 text-sm sm:text-base md:text-lg py-3 sm:py-4 md:py-5 font-semibold"
                >
                  <FileText className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Justificar falta
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                <DialogTitle>Justificar Falta</DialogTitle>
                <JustificarFaltaForm onClose={() => setShowForm(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="text-center text-gray-500 py-4 sm:py-6 text-xs sm:text-sm mt-4 sm:mt-6">
        © {new Date().getFullYear()} Chamada Diária. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default Index;