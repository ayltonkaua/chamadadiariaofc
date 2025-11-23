import { set, get, del } from 'idb-keyval';
import { supabase } from "@/integrations/supabase/client";

const CHAMADA_KEY = 'chamadas_pendentes';
const CHAMADA_SESSION_KEY = 'chamada_session';
const CACHE_ESCOLA_KEY = 'cache_dados_escola';

export interface ChamadaOffline {
  aluno_id: string;
  turma_id: string;
  escola_id: string; 
  presente: boolean;
  falta_justificada: boolean;
  data_chamada: string;
  timestamp: number;
}

export interface ChamadaSession {
  turmaId: string;
  date: string;
  presencas: Record<string, 'presente' | 'falta' | 'atestado' | null>;
  timestamp: number;
}

interface DadosEscolaOffline {
  timestamp: number;
  turmas: any[];
  alunos: any[]; 
  escola_id: string;
}

// ==============================================================================
// FUNÇÕES: CACHE DE DADOS (DOWNLOAD PARA OFFLINE)
// ==============================================================================

export async function baixarDadosEscola(escolaId: string) {
  try {
    console.log("Iniciando download de dados para offline...");
    
    // 1. Buscar todas as turmas
    const { data: turmas, error: turmasError } = await supabase
      .from('turmas')
      .select('*')
      .eq('escola_id', escolaId);

    if (turmasError) throw turmasError;

    if (!turmas || turmas.length === 0) {
      return { success: true, turmasCount: 0, alunosCount: 0 };
    }

    // 2. Buscar todos os alunos dessas turmas
    const turmasIds = turmas.map(t => t.id);
    const { data: alunos, error: alunosError } = await supabase
      .from('alunos')
      .select('*')
      .in('turma_id', turmasIds);

    if (alunosError) throw alunosError;

    // 3. Salvar no IndexedDB
    const pacoteOffline: DadosEscolaOffline = {
      timestamp: Date.now(),
      escola_id: escolaId,
      turmas: turmas || [],
      alunos: alunos || []
    };

    await set(CACHE_ESCOLA_KEY, pacoteOffline);
    
    console.log(`Dados baixados: ${turmas?.length} turmas e ${alunos?.length} alunos.`);
    return { success: true, turmasCount: turmas?.length, alunosCount: alunos?.length };

  } catch (error) {
    console.error("Erro ao baixar dados para offline:", error);
    return { success: false, error };
  }
}

export async function getDadosEscolaOffline() {
  try {
    const dados = await get<DadosEscolaOffline>(CACHE_ESCOLA_KEY);
    return dados || null;
  } catch (error) {
    console.error("Erro ao ler cache offline:", error);
    return null;
  }
}

export async function getAlunosDaTurmaOffline(turmaId: string) {
  const dados = await getDadosEscolaOffline();
  if (!dados) return [];
  return dados.alunos.filter(a => a.turma_id === turmaId);
}

// ==============================================================================
// NOVA FUNÇÃO HÍBRIDA (SOLUÇÃO DO PROBLEMA A)
// ==============================================================================
/**
 * Tenta buscar turmas online. Se falhar (offline), busca do cache local.
 * Use isso no seu TurmasCards ao invés de chamar o supabase direto.
 */
export async function buscarTurmasHibrido(escolaId: string) {
  // 1. Tentar Online primeiro
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('turmas')
        .select('*')
        .eq('escola_id', escolaId);
      
      if (!error && data) {
        // Se deu certo online, atualiza o cache em background para garantir que o offline esteja fresco
        // Não esperamos o await aqui para não travar a UI
        baixarDadosEscola(escolaId).then(() => console.log("Cache atualizado em background"));
        return { data, fonte: 'online' };
      }
    } catch (err) {
      console.warn("Falha ao buscar online, tentando cache...", err);
    }
  }

  // 2. Se falhou ou está offline, busca do Cache
  console.log("Buscando turmas do cache offline...");
  const dadosOffline = await getDadosEscolaOffline();
  
  if (dadosOffline && dadosOffline.turmas) {
    return { data: dadosOffline.turmas, fonte: 'offline' };
  }

  return { data: [], fonte: 'vazio' };
}

// ==============================================================================
// FUNÇÕES: REGISTRO DE CHAMADA E SESSÃO
// ==============================================================================

export async function salvarChamadaOffline(chamadas: Omit<ChamadaOffline, 'timestamp'>[]) {
  try {
    const pendentes = (await get(CHAMADA_KEY)) || [];
    const novasChamadas = chamadas.map(chamada => ({
      ...chamada,
      timestamp: Date.now()
    }));
    pendentes.push(...novasChamadas);
    await set(CHAMADA_KEY, pendentes);
    return true;
  } catch (error) {
    console.error('Erro ao salvar chamada offline:', error);
    return false;
  }
}

export async function getChamadasPendentes(): Promise<ChamadaOffline[]> {
  try {
    return (await get(CHAMADA_KEY)) || [];
  } catch (error) {
    console.error('Erro ao buscar chamadas pendentes:', error);
    return [];
  }
}

export async function limparChamadasPendentes() {
  try {
    await set(CHAMADA_KEY, []);
    return true;
  } catch (error) {
    console.error('Erro ao limpar chamadas pendentes:', error);
    return false;
  }
}

export async function removerChamadaPendente(timestamp: number) {
  try {
    const pendentes = await getChamadasPendentes();
    const filtradas = pendentes.filter(chamada => chamada.timestamp !== timestamp);
    await set(CHAMADA_KEY, filtradas);
    return true;
  } catch (error) {
    console.error('Erro ao remover chamada pendente:', error);
    return false;
  }
}

export async function salvarSessaoChamada(session: Omit<ChamadaSession, 'timestamp'>) {
  try {
    const sessionData: ChamadaSession = {
      ...session,
      timestamp: Date.now()
    };
    await set(CHAMADA_SESSION_KEY, sessionData);
    return true;
  } catch (error) {
    console.error('Erro ao salvar sessão de chamada:', error);
    return false;
  }
}

export async function getSessaoChamada(): Promise<ChamadaSession | null> {
  try {
    const session = await get(CHAMADA_SESSION_KEY);
    if (!session) return null;
    
    const agora = Date.now();
    const vinteQuatroHoras = 24 * 60 * 60 * 1000;
    
    if (agora - session.timestamp > vinteQuatroHoras) {
      await del(CHAMADA_SESSION_KEY);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Erro ao buscar sessão de chamada:', error);
    return null;
  }
}

export async function limparSessaoChamada() {
  try {
    await del(CHAMADA_SESSION_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao limpar sessão de chamada:', error);
    return false;
  }
}

// ==============================================================================
// FUNÇÃO DE SINCRONIZAÇÃO
// ==============================================================================

export async function sincronizarChamadasOffline() {
  try {
    const pendentes = await getChamadasPendentes();
    if (pendentes.length === 0) return { success: true, count: 0 };

    console.log(`Iniciando sincronização MANUAL de ${pendentes.length} registros...`);

    const payload = pendentes.map(p => ({
       aluno_id: p.aluno_id,
       turma_id: p.turma_id,
       escola_id: p.escola_id, 
       data_chamada: p.data_chamada,
       presente: p.presente,
       falta_justificada: p.falta_justificada ?? false 
    }));

    const { error } = await supabase
      .from('presencas')
      .upsert(payload, { 
        onConflict: 'escola_id, aluno_id, data_chamada',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Erro Detalhado do Supabase:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    await limparChamadasPendentes();
    
    console.log('Sincronização concluída com sucesso!');
    return { success: true, count: pendentes.length };
  } catch (error: any) {
    console.error('Erro ao sincronizar chamadas offline:', error);
    return { success: false, error };
  }
}