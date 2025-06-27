// Exemplo de como buscar os dados para a página de resultados
const { data: pesquisa, error } = await supabase
  .from('pesquisas')
  .select(`
    titulo,
    descricao,
    pesquisa_perguntas (
      texto_pergunta,
      tipo_pergunta,
      opcoes,
      pesquisa_respostas (
        resposta
      )
    )
  `)
  .eq('id', pesquisaId) // O ID vem da URL
  .single();