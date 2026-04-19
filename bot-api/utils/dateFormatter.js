const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    try {
        const str = String(dateStr).trim();
        // Se for o formato YYYY-MM-DD
        if (str.includes('-') && str.split('-').length === 3) {
            const [year, month, day] = str.split('-').map(Number);
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                const diaSem = DIAS_SEMANA[d.getDay()];
                return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${diaSem})`;
            }
        }
        // Se for DD/MM/YYYY, pode só retornar
        return str;
    } catch (e) {
        return String(dateStr);
    }
}

module.exports = {
    formatDateBR,
    DIAS_SEMANA
};
