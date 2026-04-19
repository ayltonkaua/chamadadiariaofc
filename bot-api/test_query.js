require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testQuery() {
    console.log("Testing Supabase Query...");
    // Mock matricula
    const matriculas = ['123', '456'];

    const { data: students, error: err1 } = await supabase
        .from('alunos')
        .select('*')
        .limit(1);

    console.log("Students sample:");
    if (students && students.length > 0) {
        matriculas.push(students[0].matricula);
        console.log("Found matricula:", students[0].matricula);
    }
            
    const { data, error } = await supabase
        .from('programas_registros')
        .select(`
            id, dados_pagamento, matricula_beneficiario,
            programas_sociais(nome, ativo)
        `)
        .limit(2);
        
    console.log("Error:", error);
    console.log("Data:", JSON.stringify(data, null, 2));
}

testQuery();
