use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;

use crate::generated_data_pack::{
  DATA_PACK_KEY_HEX, DATA_PACK_NONCE_HEX, EXPECTED_DATA_PACK_SHA256,
};

static ENCRYPTED_DATA_PACK: &[u8] = include_bytes!("../resources/desktop-data/game-data.ltpkg");

#[derive(Debug, Deserialize)]
struct PackedDesignerData {
  files: Vec<PackedDesignerFile>,
}

#[derive(Debug, Deserialize)]
struct PackedDesignerFile {
  name: String,
  sha256: String,
  bytes: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDataFileResponse {
  name: String,
  bytes_base64: String,
}

fn sha256_hex(bytes: &[u8]) -> String {
  let digest = Sha256::digest(bytes);
  hex::encode(digest)
}

fn read_pack_payload() -> Result<PackedDesignerData, String> {
  if EXPECTED_DATA_PACK_SHA256.is_empty() || DATA_PACK_KEY_HEX.is_empty() || DATA_PACK_NONCE_HEX.is_empty() {
    return Err("desktop data pack has not been generated".to_string());
  }

  let actual_hash = sha256_hex(ENCRYPTED_DATA_PACK);
  if actual_hash != EXPECTED_DATA_PACK_SHA256 {
    return Err("desktop data pack integrity check failed".to_string());
  }

  let key = hex::decode(DATA_PACK_KEY_HEX).map_err(|_| "invalid desktop data key".to_string())?;
  let nonce = hex::decode(DATA_PACK_NONCE_HEX).map_err(|_| "invalid desktop data nonce".to_string())?;
  let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "invalid desktop data cipher key".to_string())?;
  let decrypted = cipher
    .decrypt(Nonce::from_slice(&nonce), ENCRYPTED_DATA_PACK)
    .map_err(|_| "desktop data pack decrypt failed".to_string())?;

  let mut decoder = GzDecoder::new(decrypted.as_slice());
  let mut json = String::new();
  decoder
    .read_to_string(&mut json)
    .map_err(|_| "desktop data pack decompress failed".to_string())?;

  serde_json::from_str::<PackedDesignerData>(&json)
    .map_err(|_| "desktop data pack parse failed".to_string())
}

#[tauri::command]
pub fn read_desktop_data_file(file_name: String) -> Result<DesktopDataFileResponse, String> {
  let pack = read_pack_payload()?;
  let file = pack
    .files
    .into_iter()
    .find(|entry| entry.name == file_name)
    .ok_or_else(|| format!("desktop data file not found: {file_name}"))?;

  let bytes = BASE64
    .decode(file.bytes.as_bytes())
    .map_err(|_| format!("desktop data file is not valid base64: {}", file.name))?;
  if sha256_hex(&bytes) != file.sha256 {
    return Err(format!("desktop data file integrity check failed: {}", file.name));
  }

  Ok(DesktopDataFileResponse {
    name: file.name,
    bytes_base64: BASE64.encode(bytes),
  })
}
