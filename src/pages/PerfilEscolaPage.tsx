import React from 'react';

const PerfilEscolaPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-purple-700 mb-2 text-center">Perfil da Escola</h1>
      <p className="text-gray-600 mb-8 text-center">Gerencie as informações institucionais da sua escola.</p>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-gray-500 text-center py-12">
          <span>Em breve: edição de nome, endereço, contato, logo, etc.</span>
        </div>
      </div>
    </div>
  );
};

export default PerfilEscolaPage; 