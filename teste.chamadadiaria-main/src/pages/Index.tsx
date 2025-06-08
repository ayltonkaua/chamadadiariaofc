import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Calendar, ClipboardList } from "lucide-react";
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
          <div className="space-y-4">
            <div className="flex justify-center gap-4">
              <Link to="/dashboard">
                <Button>Ir para o Dashboard</Button>
              </Link>
            </div>
          </div>
        ) : (
          <Link to="/login">
            <Button>Entrar</Button>
          </Link>
        )}
      </header>

      {/* MAIN SECTION */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-white bg-opacity-90 rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col items-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            Controle sua presença de forma simples e segura
          </h2>
          <p className="text-gray-600 text-center mb-6 text-base sm:text-lg">
            O aplicativo Chamada Diária facilita o registro de presenças e permite que alunos consultem suas faltas com facilidade.
          </p>
          {/* Vantagens */}
          <ul className="list-none space-y-3 mb-8 w-full">
            {advantages.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center text-gray-800 text-sm sm:text-base"
              >
                <span className="rounded-full bg-purple-100 mr-3 p-1">
                  <FileText className="text-purple-600" size={20} />
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base sm:text-lg py-5 font-semibold"
              onClick={() => navigate("/login")}
            >
              <Calendar className="mr-2" />
              Fazer chamada
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-purple-600 text-purple-700 hover:bg-purple-100 hover:border-purple-700 text-base sm:text-lg py-5 font-semibold"
              onClick={() => navigate("/student-query")}
            >
              <ClipboardList className="mr-2" />
              Consultar faltas
            </Button>

            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-purple-600 text-purple-700 hover:bg-purple-100 hover:border-purple-700 text-base sm:text-lg py-5 font-semibold"
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
