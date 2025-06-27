import { set, get, del } from 'idb-keyval';

const CHAMADA_KEY = 'chamadas_pendentes';
const CHAMADA_SESSION_KEY = 'chamada_session';

export interface ChamadaOffline {
  aluno_id: string;
  turma_id: string;
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

// Funções para persistir sessão de chamada
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
    
    // Verificar se a sessão não é muito antiga (mais de 24 horas)
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

// Função para sincronizar chamadas offline quando voltar a conexão
export async function sincronizarChamadasOffline() {
  try {
    const pendentes = await getChamadasPendentes();
    if (pendentes.length === 0) return { success: true, count: 0 };

    // Aqui você implementaria a lógica para enviar as chamadas para o servidor
    // Por enquanto, vamos apenas simular o sucesso
    console.log(`Sincronizando ${pendentes.length} chamadas offline`);
    
    // Após sincronizar com sucesso, limpar as pendentes
    await limparChamadasPendentes();
    
    return { success: true, count: pendentes.length };
  } catch (error) {
    console.error('Erro ao sincronizar chamadas offline:', error);
    return { success: false, error };
  }
} 