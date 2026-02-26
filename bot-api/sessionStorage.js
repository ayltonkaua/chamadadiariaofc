/**
 * Session Storage — Supabase Storage Backup/Restore
 * 
 * Backs up Baileys session files to Supabase Storage so they survive
 * server restarts on ephemeral filesystems (e.g. Render without Disk).
 * 
 * Bucket: whatsapp-sessions
 * Path:   {escola_id}/{filename}
 */

const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabase');

const BUCKET = 'whatsapp-sessions';
const SESSIONS_DIR = path.join(__dirname, 'sessions');

/**
 * Ensure the Supabase Storage bucket exists.
 * Creates it if missing (private, no public access).
 */
async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);

    if (!exists) {
        const { error } = await supabase.storage.createBucket(BUCKET, {
            public: false,
            fileSizeLimit: 5 * 1024 * 1024, // 5MB max per file
        });
        if (error && !error.message.includes('already exists')) {
            console.error('❌ Failed to create storage bucket:', error.message);
        } else {
            console.log('📦 Created Supabase Storage bucket:', BUCKET);
        }
    }
}

/**
 * Upload all session files for an escola to Supabase Storage.
 * Called after creds.update to keep the backup fresh.
 */
async function backupSession(escolaId) {
    const sessionPath = path.join(SESSIONS_DIR, escolaId);

    if (!fs.existsSync(sessionPath)) return;

    try {
        const files = fs.readdirSync(sessionPath);
        let uploaded = 0;

        for (const file of files) {
            const filePath = path.join(sessionPath, file);
            const stat = fs.statSync(filePath);

            // Only upload files (not directories), max 5MB
            if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;

            const content = fs.readFileSync(filePath);
            const storagePath = `${escolaId}/${file}`;

            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, content, {
                    upsert: true,
                    contentType: 'application/octet-stream',
                });

            if (error) {
                console.error(`❌ [${escolaId.substring(0, 8)}] Backup failed for ${file}:`, error.message);
            } else {
                uploaded++;
            }
        }

        if (uploaded > 0) {
            console.log(`☁️  [${escolaId.substring(0, 8)}] Backed up ${uploaded} session files to Supabase Storage`);
        }
    } catch (err) {
        console.error(`❌ [${escolaId.substring(0, 8)}] Session backup error:`, err.message);
    }
}

/**
 * Restore session files from Supabase Storage to local filesystem.
 * Called before initializing Baileys to recover from server restarts.
 * Returns true if files were restored, false otherwise.
 */
async function restoreSession(escolaId) {
    const sessionPath = path.join(SESSIONS_DIR, escolaId);

    // If session files already exist locally, skip restore
    if (fs.existsSync(sessionPath)) {
        const files = fs.readdirSync(sessionPath);
        if (files.length > 0) {
            console.log(`📂 [${escolaId.substring(0, 8)}] Local session exists (${files.length} files), skipping restore`);
            return false;
        }
    }

    try {
        // List files in storage for this escola
        const { data: files, error } = await supabase.storage
            .from(BUCKET)
            .list(escolaId, { limit: 100 });

        if (error || !files || files.length === 0) {
            return false;
        }

        // Create session directory
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        let restored = 0;

        for (const file of files) {
            if (!file.name || file.name.startsWith('.')) continue;

            const storagePath = `${escolaId}/${file.name}`;
            const { data, error: dlError } = await supabase.storage
                .from(BUCKET)
                .download(storagePath);

            if (dlError || !data) {
                console.error(`❌ [${escolaId.substring(0, 8)}] Restore failed for ${file.name}:`, dlError?.message);
                continue;
            }

            // Convert blob to buffer and write
            const buffer = Buffer.from(await data.arrayBuffer());
            fs.writeFileSync(path.join(sessionPath, file.name), buffer);
            restored++;
        }

        if (restored > 0) {
            console.log(`⬇️  [${escolaId.substring(0, 8)}] Restored ${restored} session files from Supabase Storage`);
            return true;
        }

        return false;
    } catch (err) {
        console.error(`❌ [${escolaId.substring(0, 8)}] Session restore error:`, err.message);
        return false;
    }
}

/**
 * Delete all session files from Supabase Storage for an escola.
 * Called when a session is logged out.
 */
async function deleteSessionBackup(escolaId) {
    try {
        const { data: files } = await supabase.storage
            .from(BUCKET)
            .list(escolaId, { limit: 100 });

        if (files && files.length > 0) {
            const paths = files.map((f) => `${escolaId}/${f.name}`);
            await supabase.storage.from(BUCKET).remove(paths);
            console.log(`🗑️  [${escolaId.substring(0, 8)}] Deleted ${paths.length} session files from Supabase Storage`);
        }
    } catch (err) {
        console.error(`❌ [${escolaId.substring(0, 8)}] Delete backup error:`, err.message);
    }
}

module.exports = {
    ensureBucket,
    backupSession,
    restoreSession,
    deleteSessionBackup,
};
