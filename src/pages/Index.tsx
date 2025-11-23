import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, LogIn, UserPlus } from "lucide-react"; // Adicionado UserPlus

const advantages = [
  "Fácil controle de presença diária",
  "Consulta rápida de faltas para alunos",
  "Acesso para gestores, professores, alunos e monitores da busca ativa",
  "Interface moderna e responsiva",
];

const Index: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-tr from-blue-100 via-purple-50 to-white">
      {/* HEADER MODIFICADO: Agora com Login e Cadastro */}
      <header className="py-4 sm:py-8 px-4 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-purple-700 drop-shadow text-center sm:text-left">
          Chamada Diária
        </h1>
        
        {!isAuthenticated && (
          <div className="flex gap-3 w-full sm:w-auto">
            <Link to="/register" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full sm:w-auto border-purple-600 text-purple-700 hover:bg-purple-50">
                Cadastrar
              </Button>
            </Link>
            <Link to="/login" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700">
                Entrar
              </Button>
            </Link>
          </div>
        )}
      </header>

      {/* MAIN SECTION */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full bg-white bg-opacity-90 rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 flex flex-col items-center animate-in fade-in zoom-in duration-500">
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

          {/* Ações MODIFICADAS: Login Principal e Opção de Cadastro */}
          <div className="flex flex-col gap-3 w-full">
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-sm sm:text-base md:text-lg py-6 font-semibold shadow-lg transition-all hover:scale-[1.02]"
              onClick={() => navigate("/login")}
            >
              <LogIn className="mr-2 h-5 w-5" />
              Fazer Login
            </Button>

            {!isAuthenticated && (
              <Button
                variant="outline"
                size="lg"
                className="w-full border-2 border-purple-100 text-purple-700 hover:bg-purple-50 hover:border-purple-200 text-sm sm:text-base md:text-lg py-6 font-semibold transition-all"
                onClick={() => navigate("/register")}
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Criar nova conta
              </Button>
            )}
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