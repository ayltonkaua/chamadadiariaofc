const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    try {
        const str = String(dateStr).trim();
        
        // Formato BR (DD/MM/YYYY)
        if (str.includes('/') && str.split('/').length === 3) {
            return str;
        }

        // Tentar jogar direto no Date (funciona bem pra YYYY-MM-DD e ISO)
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            // Em ISO, ajustamos pro fuso horário tirando o offset manual pra não cair no dia anterior se vier GMT midnight
            const [year, month, day] = d.toISOString().split('T')[0].split('-');
            const dateLocal = new Date(year, parseInt(month) - 1, day);
            const diaSem = DIAS_SEMANA[dateLocal.getDay()];
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${diaSem})`;
        }

        return str;
    } catch (e) {
        return String(dateStr);
    }
}

module.exports = {
    formatDateBR,
    DIAS_SEMANA
};
