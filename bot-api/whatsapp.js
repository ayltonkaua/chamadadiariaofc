/**
 * WhatsApp Multi-Tenant Session Manager
 * 
 * Each escola gets its own isolated Baileys session:
 *   bot-api/sessions/{escola_id}/
 * 
 * Sessions are backed up to Supabase Storage for persistence
 * across server restarts (ephemeral filesystems like Render).
 * 
 * Never shares connections between schools.
 */

const path = require('path');
const fs = require('fs');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const { validateEscola } = require('./supabase');
const { toBaileysJid } = require('./utils/formatMessage');
const {
    ensureBucket,
    backupSession,
    restoreSession,
    deleteSessionBackup,
} = require('./sessionStorage');
const { setupInboundListener } = require('./inbound');

// =====================
// Instance Manager
// =====================

/** @type {Record<string, { sock: any, qr: string|null, connected: boolean, phone: string|null }>} */
const instances = {};

/** @type {Map<string, Promise<any>>} Prevents parallel connections per escola */
const connectingLocks = new Map();

const SESSIONS_DIR = path.join(__dirname, 'sessions');

// Ensure sessions root directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Ensure Supabase Storage bucket exists on startup
ensureBucket().catch((err) => console.error('❌ Bucket init error:', err.message));

/**
 * Initialize a WhatsApp connection for a specific escola
 */
async function initWhatsApp(escolaId) {
    // If already connecting, wait for that to finish
    if (connectingLocks.has(escolaId)) {
        console.log(`⏳ [${escolaId.substring(0, 8)}] Already connecting, waiting...`);
        return await connectingLocks.get(escolaId);
    }

    const connectPromise = _doInitWhatsApp(escolaId);
    connectingLocks.set(escolaId, connectPromise);

    try {
        return await connectPromise;
    } finally {
        connectingLocks.delete(escolaId);
    }
}

/**
 * Internal: actual connection logic (called only by initWhatsApp with lock)
 */
async function _doInitWhatsApp(escolaId) {
    // Cleanup any existing socket before creating a new one
    if (instances[escolaId]?.sock) {
        try {
            instances[escolaId].sock.ev.removeAllListeners();
            instances[escolaId].sock.end();
        } catch (e) { /* ignore cleanup errors */ }
        delete instances[escolaId];
    }

    // Validate escola exists and is active
    const validation = await validateEscola(escolaId);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const sessionPath = path.join(SESSIONS_DIR, escolaId);

    // Try to restore session from Supabase Storage if not present locally
    await restoreSession(escolaId);

    // Create session directory if it doesn't exist
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['ChamadaDiaria', 'Bot', '1.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
    });

    // Initialize instance state
    instances[escolaId] = {
        sock,
        qr: null,
        connected: false,
        phone: null,
    };

    // Save credentials on update + backup to Supabase Storage
    sock.ev.on('creds.update', async () => {
        await saveCreds();
        // Backup to cloud (non-blocking)
        backupSession(escolaId).catch((err) =>
            console.error(`❌ [${escolaId.substring(0, 8)}] Backup error:`, err.message)
        );
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Generate QR code as data URL
            try {
                instances[escolaId].qr = await QRCode.toDataURL(qr);
                instances[escolaId].connected = false;
                console.log(`📱 [${escolaId.substring(0, 8)}] QR Code generated — scan to connect`);
            } catch (err) {
                console.error(`❌ [${escolaId.substring(0, 8)}] QR generation error:`, err.message);
            }
        }

        if (connection === 'close') {
            instances[escolaId].connected = false;
            instances[escolaId].phone = null;

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const isConflict = statusCode === 440 || statusCode === 408;

            console.log(`🔌 [${escolaId.substring(0, 8)}] Disconnected (code: ${statusCode})`);

            if (isLoggedOut) {
                // Session logged out — clean up local + cloud
                console.log(`🚪 [${escolaId.substring(0, 8)}] Logged out — clearing session`);
                try { sock.ev.removeAllListeners(); } catch (e) { }
                delete instances[escolaId];
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
                // Delete cloud backup
                deleteSessionBackup(escolaId).catch((err) =>
                    console.error(`❌ [${escolaId.substring(0, 8)}] Cloud cleanup error:`, err.message)
                );
            } else if (isConflict) {
                // Conflict (another session replaced us) — wait longer before retrying
                // and only if no other connection is already in progress
                console.log(`⚠️ [${escolaId.substring(0, 8)}] Session conflict — waiting 30s before retry`);
                try { sock.ev.removeAllListeners(); } catch (e) { }
                delete instances[escolaId];
                setTimeout(() => {
                    if (!instances[escolaId] && !connectingLocks.has(escolaId)) {
                        initWhatsApp(escolaId).catch(console.error);
                    }
                }, 30000);
            } else {
                // Normal disconnect — reconnect after short delay
                console.log(`🔄 [${escolaId.substring(0, 8)}] Reconnecting in 5s...`);
                try { sock.ev.removeAllListeners(); } catch (e) { }
                delete instances[escolaId];
                setTimeout(() => {
                    if (!instances[escolaId] && !connectingLocks.has(escolaId)) {
                        initWhatsApp(escolaId).catch(console.error);
                    }
                }, 5000);
            }
        }

        if (connection === 'open') {
            instances[escolaId].connected = true;
            instances[escolaId].qr = null;

            // Extract phone number from connection
            const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || null;
            instances[escolaId].phone = phoneNumber;

            console.log(`✅ [${escolaId.substring(0, 8)}] Connected as ${phoneNumber}`);

            // Backup session after successful connection
            backupSession(escolaId).catch((err) =>
                console.error(`❌ [${escolaId.substring(0, 8)}] Post-connect backup error:`, err.message)
            );
        }
    });

    // Iniciar escuta para respostas do Bot (Chatbot de Atestados)
    setupInboundListener(sock, escolaId);

    return sock;
}

/**
 * Get or create WhatsApp instance for a specific escola
 */
async function getInstance(escolaId) {
    if (!escolaId) throw new Error('escola_id é obrigatório');

    // If a connection is in progress, wait for it
    if (connectingLocks.has(escolaId)) {
        await connectingLocks.get(escolaId);
    }

    // Return existing connected instance
    if (instances[escolaId]?.sock && instances[escolaId]?.connected) {
        return instances[escolaId].sock;
    }

    // Initialize new instance if none exists
    if (!instances[escolaId]) {
        return await initWhatsApp(escolaId);
    }

    // Instance exists but not connected — return what we have
    return instances[escolaId].sock;
}

/**
 * Get connection status for a specific escola
 */
function getStatus(escolaId) {
    const instance = instances[escolaId];
    if (!instance) {
        return {
            escola_id: escolaId,
            connected: false,
            phone: null,
            hasQR: false,
        };
    }

    return {
        escola_id: escolaId,
        connected: instance.connected,
        phone: instance.phone,
        hasQR: !!instance.qr,
    };
}

/**
 * Get QR Code data URL for a specific escola
 * Returns null if already connected or no QR available
 */
function getQR(escolaId) {
    return instances[escolaId]?.qr || null;
}

/**
 * Send a WhatsApp message from a specific escola's connection
 */
async function sendMessage(escolaId, phone, message) {
    const sock = await getInstance(escolaId);

    if (!instances[escolaId]?.connected) {
        throw new Error('WhatsApp não conectado para esta escola. Escaneie o QR Code primeiro.');
    }

    // Sanitize phone number
    const sanitized = phone.replace(/\D/g, '');
    if (sanitized.length < 10 || sanitized.length > 15) {
        throw new Error('Número de telefone inválido');
    }

    // Convert to Baileys JID (removes 9th digit for BR numbers)
    const jid = toBaileysJid(sanitized);
    if (!jid) {
        throw new Error('Número de telefone inválido para envio');
    }

    await sock.sendMessage(jid, { text: message });
    return { success: true, phone: sanitized };
}

/**
 * Disconnect a specific escola's WhatsApp session
 */
async function disconnect(escolaId) {
    const instance = instances[escolaId];
    if (instance?.sock) {
        try {
            await instance.sock.logout();
        } catch (err) {
            console.error(`❌ [${escolaId.substring(0, 8)}] Logout error:`, err.message);
            // Force cleanup even if logout fails
            try { instance.sock.end(); } catch { }
        }
        delete instances[escolaId];

        // Clean up local session files
        const sessionPath = path.join(SESSIONS_DIR, escolaId);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }

        // Clean up cloud backup
        await deleteSessionBackup(escolaId);

        console.log(`🔌 [${escolaId.substring(0, 8)}] Disconnected and session cleaned`);
    }
}

/**
 * Get all active escola connections (for cron jobs)
 */
function getActiveEscolas() {
    return Object.entries(instances)
        .filter(([_, inst]) => inst.connected)
        .map(([escolaId, inst]) => ({
            escolaId,
            phone: inst.phone,
        }));
}

/**
 * Get all WhatsApp groups from the connected account
 * Returns groups with id, subject (name), and participant count
 */
async function getGroups(escolaId) {
    const sock = await getInstance(escolaId);

    if (!instances[escolaId]?.connected) {
        throw new Error('WhatsApp não conectado');
    }

    try {
        const groups = await sock.groupFetchAllParticipating();

        const result = [];
        for (const [jid, group] of Object.entries(groups)) {
            result.push({
                id: jid,
                name: group.subject || 'Grupo sem nome',
                participants: group.participants?.length || 0,
                creation: group.creation || null,
                desc: group.desc || '',
            });
        }

        result.sort((a, b) => a.name.localeCompare(b.name));

        console.log(`📋 [${escolaId.substring(0, 8)}] Found ${result.length} WhatsApp groups`);
        return result;
    } catch (err) {
        console.error(`❌ [${escolaId.substring(0, 8)}] Error fetching groups:`, err.message);
        throw new Error('Erro ao buscar grupos do WhatsApp: ' + err.message);
    }
}

/**
 * Send a message to a WhatsApp group (JID ending in @g.us)
 */
async function sendMessageToGroup(escolaId, groupJid, message) {
    const sock = await getInstance(escolaId);

    if (!instances[escolaId]?.connected) {
        throw new Error('WhatsApp não conectado');
    }

    if (!groupJid.endsWith('@g.us')) {
        throw new Error('JID de grupo inválido');
    }

    await sock.sendMessage(groupJid, { text: message });
    return { success: true, groupJid };
}

/**
 * Add participants to a WhatsApp group
 * Limited to 5 numbers per call with 5s delay between each addition
 * The connected number must be an admin of the group
 */
async function addParticipantsToGroup(escolaId, groupJid, phones) {
    const sock = await getInstance(escolaId);

    if (!instances[escolaId]?.connected) {
        throw new Error('WhatsApp não conectado');
    }

    if (!groupJid.endsWith('@g.us')) {
        throw new Error('JID de grupo inválido');
    }

    if (!phones || phones.length === 0) {
        throw new Error('Nenhum número informado');
    }

    if (phones.length > 5) {
        throw new Error('Máximo de 5 números por vez para evitar bloqueio');
    }

    const results = [];
    for (const phone of phones) {
        const jid = toBaileysJid(phone);
        if (!jid) {
            results.push({ phone, success: false, error: 'Número inválido' });
            continue;
        }

        try {
            await sock.groupParticipantsUpdate(groupJid, [jid], 'add');
            results.push({ phone, success: true });
            console.log(`✅ [${escolaId.substring(0, 8)}] Added ${phone} to group`);
        } catch (err) {
            results.push({ phone, success: false, error: err.message });
            console.error(`❌ [${escolaId.substring(0, 8)}] Failed to add ${phone}:`, err.message);
        }

        // Delay between additions to avoid WhatsApp ban (15s)
        if (phones.indexOf(phone) < phones.length - 1) {
            await new Promise(r => setTimeout(r, 15000));
        }
    }

    return results;
}

module.exports = {
    initWhatsApp,
    getInstance,
    getStatus,
    getQR,
    sendMessage,
    sendMessageToGroup,
    getGroups,
    addParticipantsToGroup,
    disconnect,
    getActiveEscolas,
};
