const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const diaSem = DIAS_SEMANA[d.getDay()];
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${diaSem})`;
}

module.exports = {
    formatDateBR,
    DIAS_SEMANA
};
