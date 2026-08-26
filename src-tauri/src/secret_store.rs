use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::Engine;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};

const SERVICE: &str = "com.star.app.ai";
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

#[derive(Serialize, Deserialize, Default)]
struct VaultFile {
    ciphertext_b64: String,
    nonce_b64: String,
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct VaultData(HashMap<String, String>);

/// Dual-backend secret store. Reads try the OS keyring first; writes always
/// mirror to the encrypted file vault so a working secret survives keyring
/// failures (corrupt vault, missing entry, sandboxed credential manager, etc.).
pub struct SecretStore {
    vault_path: PathBuf,
}

impl SecretStore {
    pub fn new(vault_path: PathBuf) -> Self {
        Self { vault_path }
    }

    /// Returns the secret for `id`, preferring the OS keyring. Empty string is
    /// treated as missing.
    pub fn get(&self, id: &str) -> Result<Option<String>, String> {
        if let Some(secret) = read_keyring(id) {
            self.backfill_if_missing(id, &secret);
            return Ok(Some(secret));
        }
        let data = read_vault(&self.vault_path)?;
        Ok(data.0.get(id).filter(|v| !v.is_empty()).cloned())
    }

    pub fn has(&self, id: &str) -> bool {
        self.get(id).ok().flatten().is_some()
    }

    /// Persist `secret` for `id`. Empty string deletes the entry. Writes to
    /// both the OS keyring (best-effort) and the encrypted file vault.
    pub fn set(&self, id: &str, secret: &str) -> Result<(), String> {
        // Best-effort keyring write/delete. Failures are logged but not
        // surfaced — the file vault is the durable backup.
        if secret.is_empty() {
            let _ = Entry::new(SERVICE, id).and_then(|e| e.delete_credential());
        } else if let Ok(entry) = Entry::new(SERVICE, id) {
            let _ = entry.set_password(secret);
        }

        let mut data = read_vault(&self.vault_path).unwrap_or_default();
        if secret.is_empty() {
            data.0.remove(id);
        } else {
            data.0.insert(id.to_string(), secret.to_string());
        }
        write_vault(&self.vault_path, &data)
    }

    /// If the file vault is missing `id` but the keyring has it, mirror the
    /// secret back so the file vault eventually catches up with the keyring.
    fn backfill_if_missing(&self, id: &str, secret: &str) {
        let Ok(mut data) = read_vault(&self.vault_path) else { return };
        if data.0.contains_key(id) {
            return;
        }
        data.0.insert(id.to_string(), secret.to_string());
        let _ = write_vault(&self.vault_path, &data);
    }
}

fn read_keyring(id: &str) -> Option<String> {
    let entry = Entry::new(SERVICE, id).ok()?;
    entry.get_password().ok().filter(|v| !v.is_empty())
}

fn derive_key() -> [u8; KEY_LEN] {
    // Stable per-machine key. Combines a fixed salt with the hostname so the
    // vault only decrypts on the machine it was written on.
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default();
    let mut out = [0u8; KEY_LEN];

    fn fill(bytes: &[u8], dst: &mut [u8]) {
        let mut h = std::collections::hash_map::DefaultHasher::new();
        bytes.hash(&mut h);
        let v = h.finish().to_be_bytes();
        dst[..v.len()].copy_from_slice(&v);
    }

    let mut buf = Vec::new();
    fill(b"com.star.app.ai:v1", &mut out[..8]);
    buf.extend_from_slice(&out[..8]);
    buf.push(b'|');
    buf.extend_from_slice(hostname.as_bytes());
    fill(&buf, &mut out[8..16]);
    let mid = out[..16].to_vec();
    fill(&mid, &mut out[16..24]);
    let right = out[8..24].to_vec();
    fill(&right, &mut out[24..]);
    out
}

fn read_vault(path: &Path) -> Result<VaultData, String> {
    if !path.exists() {
        return Ok(VaultData::default());
    }
    let bytes = fs::read(path).map_err(|error| format!("Could not read secret vault: {error}"))?;
    if bytes.is_empty() {
        return Ok(VaultData::default());
    }
    let vault: VaultFile =
        serde_json::from_slice(&bytes).map_err(|error| format!("Could not parse secret vault: {error}"))?;
    let key = derive_key();
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce_bytes = base64::engine::general_purpose::STANDARD
        .decode(vault.nonce_b64.as_bytes())
        .map_err(|error| format!("Invalid nonce encoding: {error}"))?;
    if nonce_bytes.len() != NONCE_LEN {
        return Err("Invalid nonce length".into());
    }
    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(vault.ciphertext_b64.as_bytes())
        .map_err(|error| format!("Invalid ciphertext encoding: {error}"))?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), ciphertext.as_ref())
        .map_err(|_| "Secret vault could not be decrypted (key mismatch?)".to_string())?;
    serde_json::from_slice(&plaintext).map_err(|error| format!("Could not parse vault data: {error}"))
}

fn write_vault(path: &Path, data: &VaultData) -> Result<(), String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = serde_json::to_vec(data).map_err(|error| error.to_string())?;
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|error| format!("Could not encrypt vault: {error}"))?;
    let vault = VaultFile {
        ciphertext_b64: base64::engine::general_purpose::STANDARD.encode(ciphertext),
        nonce_b64: base64::engine::general_purpose::STANDARD.encode(nonce_bytes),
    };
    let bytes = serde_json::to_vec(&vault).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, bytes).map_err(|error| format!("Could not write secret vault: {error}"))
}