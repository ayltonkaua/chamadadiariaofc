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
const {
    ensureBucket,
    backupSession,
    restoreSession,
    deleteSessionBackup,
} = require('./sessionStorage');

// =====================
// Instance Manager
// =====================

/** @type {Record<string, { sock: any, qr: string|null, connected: boolean, phone: string|null }>} */
const instances = {};

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
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`🔌 [${escolaId.substring(0, 8)}] Disconnected (code: ${statusCode})`);

            if (shouldReconnect) {
                console.log(`🔄 [${escolaId.substring(0, 8)}] Reconnecting in 5s...`);
                setTimeout(() => initWhatsApp(escolaId), 5000);
            } else {
                // Session logged out — clean up local + cloud
                console.log(`🚪 [${escolaId.substring(0, 8)}] Logged out — clearing session`);
                delete instances[escolaId];
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
                // Delete cloud backup
                deleteSessionBackup(escolaId).catch((err) =>
                    console.error(`❌ [${escolaId.substring(0, 8)}] Cloud cleanup error:`, err.message)
                );
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

    return sock;
}

/**
 * Get or create WhatsApp instance for a specific escola
 */
async function getInstance(escolaId) {
    if (!escolaId) throw new Error('escola_id é obrigatório');

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

    // Sanitize phone number — ensure format: 5511999999999
    const sanitized = phone.replace(/\D/g, '');
    if (sanitized.length < 10 || sanitized.length > 15) {
        throw new Error('Número de telefone inválido');
    }

    const jid = `${sanitized}@s.whatsapp.net`;

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

module.exports = {
    initWhatsApp,
    getInstance,
    getStatus,
    getQR,
    sendMessage,
    sendMessageToGroup,
    getGroups,
    disconnect,
    getActiveEscolas,
};
