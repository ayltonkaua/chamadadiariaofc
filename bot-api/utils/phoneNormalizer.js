function formatPhoneDisplay(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const p1 = cleaned.substring(4, 5);
        const p2 = cleaned.substring(5, 9);
        const p3 = cleaned.substring(9, 13);
        return `(${ddd}) ${p1} ${p2}-${p3}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const p1 = cleaned.substring(4, 8);
        const p2 = cleaned.substring(8, 12);
        return `(${ddd}) ${p1}-${p2}`;
    }
    return phone;
}

function normalizePhone(phoneString) {
    let cleanPhone = phoneString.split('@')[0].replace(/\D/g, '');
    
    // Variações do número brasileiro (com e sem nono dígito)
    let phoneCom9 = cleanPhone;
    let phoneSem9 = cleanPhone;
    
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone[4] === '9') {
        phoneSem9 = cleanPhone.substring(0, 4) + cleanPhone.substring(5);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
        phoneCom9 = cleanPhone.substring(0, 4) + '9' + cleanPhone.substring(4);
    }

    const sessionKey = cleanPhone;

    return { sessionKey, rawCleanPhone: cleanPhone, phoneCom9, phoneSem9 };
}

module.exports = {
    formatPhoneDisplay,
    normalizePhone
};
