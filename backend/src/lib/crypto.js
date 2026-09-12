/**
 * V2-3 静态数据加密：主密码 → 密钥派生（scrypt，Node 内置）→ AES-256-GCM 信封。
 *
 * 设计要点：
 * - 零新增依赖：仅使用 Node 内置 `node:crypto`，不引入原生编译包。
 * - 密钥不落盘：主密码由用户在启动/解锁时输入，派生出的 AES 密钥仅存于内存。
 * - 信封自包含：密文内携带 salt + iv + authTag，解密时无需额外元数据文件。
 * - 认证加密：AES-256-GCM 提供完整性校验，密码错误或密文被篡改都会被拒绝。
 *
 * 信封二进制布局（小端无关，纯字节序）：
 *   [0..4)   MAGIC   "HTD1"
 *   [4]      VERSION 1
 *   [5..21)  SALT    16 字节（scrypt salt）
 *   [21..33) IV      12 字节（GCM 推荐 nonce 长度）
 *   [33..49) AUTH    16 字节（GCM auth tag）
 *   [49..)   CIPHERTEXT
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const MAGIC = Buffer.from('HTD1', 'ascii');
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN;

// scrypt 代价参数（本地单人应用：2^15 ≈ 数十毫秒，安全与体验平衡）
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32; // AES-256
// 内存上限提到 64MB：N=32768×r=8 约需 32MB，留足余量避免撞默认 32MB 限制
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

/**
 * 加密任意字节串。
 * @param {Buffer|string} plaintext
 * @param {string} password
 * @returns {Buffer} 自包含信封
 */
export function encrypt(plaintext, password) {
  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, authTag, enc]);
}

/**
 * 解密信封。密码错误或密文被篡改都会抛出（DECRYPT_FAILED）。
 * @param {Buffer} envelope
 * @param {string} password
 * @returns {Buffer} 原始字节
 */
export function decrypt(envelope, password) {
  if (!Buffer.isBuffer(envelope) || envelope.length < HEADER_LEN) {
    throw new Error('INVALID_ENVELOPE');
  }
  let off = 0;
  const magic = envelope.subarray(off, off + MAGIC.length); off += MAGIC.length;
  if (!magic.equals(MAGIC)) throw new Error('BAD_MAGIC');
  const version = envelope[off]; off += 1;
  if (version !== VERSION) throw new Error('UNSUPPORTED_VERSION');
  const salt = envelope.subarray(off, off + SALT_LEN); off += SALT_LEN;
  const iv = envelope.subarray(off, off + IV_LEN); off += IV_LEN;
  const authTag = envelope.subarray(off, off + TAG_LEN); off += TAG_LEN;
  const ciphertext = envelope.subarray(off);
  const key = deriveKey(password, salt);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (e) {
    throw new Error('DECRYPT_FAILED');
  }
}

/** 便捷封装：直接加密 UTF-8 文本为 Base64 字符串。 */
export function encryptString(text, password) {
  return encrypt(text, password).toString('base64');
}
/** 便捷封装：从 Base64 字符串解密回 UTF-8 文本。 */
export function decryptString(b64, password) {
  return decrypt(Buffer.from(b64, 'base64'), password).toString('utf8');
}

/** 加密文件（源文件只读，不影响原文件）。 */
export function encryptFile(inputPath, outputPath, password) {
  fs.writeFileSync(outputPath, encrypt(fs.readFileSync(inputPath), password));
}
/** 解密文件到目标路径。 */
export function decryptFile(inputPath, outputPath, password) {
  fs.writeFileSync(outputPath, decrypt(fs.readFileSync(inputPath), password));
}

export const ENVELOPE_CONSTANTS = { MAGIC, VERSION, SALT_LEN, IV_LEN, TAG_LEN, HEADER_LEN };
