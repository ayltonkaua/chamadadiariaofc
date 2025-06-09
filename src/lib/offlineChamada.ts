import { set, get } from 'idb-keyval';

const CHAMADA_KEY = 'chamadas_pendentes';

export async function salvarChamadaOffline(chamada) {
  const pendentes = (await get(CHAMADA_KEY)) || [];
  pendentes.push({ ...chamada, timestamp: Date.now() });
  await set(CHAMADA_KEY, pendentes);
}

export async function getChamadasPendentes() {
  return (await get(CHAMADA_KEY)) || [];
}

export async function limparChamadasPendentes() {
  await set(CHAMADA_KEY, []);
} 