const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    try {
        const str = String(dateStr).trim();
        
        // Formato BR (DD/MM/YYYY)
        if (str.includes('/') && str.split('/').length === 3) {
            return str;
        }

        // Tentar verificar se é uma data Excel (número de 5 dígitos como 46120)
        if (/^\d{5}$/.test(str)) {
            const excelSerial = parseInt(str, 10);
            // 25569 = diferença de dias entre 01/01/1900 e 01/01/1970
            const jsDate = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
            const day = jsDate.getUTCDate();
            const month = jsDate.getUTCMonth() + 1;
            const year = jsDate.getUTCFullYear();
            const diaSem = DIAS_SEMANA[jsDate.getUTCDay()];
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${diaSem})`;
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
