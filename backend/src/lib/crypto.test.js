import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { encrypt, decrypt, encryptString, decryptString, ENVELOPE_CONSTANTS } from './crypto.js';

describe('crypto 模块（V2-3 静态加密）', () => {
  const password = 'master-password-demo-2026';

  it('字符串往返：加密后解密得到原文', () => {
    const text = '荒天帝工作台 — 本地优先的个人工作生活一体化平台';
    const enc = encryptString(text, password);
    expect(enc).to.be.a('string');
    expect(decryptString(enc, password)).to.equal(text);
  });

  it('字节串往返：二进制数据无损', () => {
    const buf = crypto.randomBytes(2048);
    const out = decrypt(encrypt(buf, password), password);
    expect(Buffer.compare(out, buf)).to.equal(0);
  });

  it('大体积缓冲（5MB）往返一致', () => {
    const big = crypto.randomBytes(5 * 1024 * 1024);
    const out = decrypt(encrypt(big, password), password);
    expect(Buffer.compare(out, big)).to.equal(0);
  });

  it('错误密码 → 解密抛 DECRYPT_FAILED', () => {
    const enc = encrypt('secret payload', password);
    expect(() => decrypt(enc, 'wrong-password')).to.throw(/DECRYPT_FAILED/);
  });

  it('密文被篡改 → 解密抛 DECRYPT_FAILED', () => {
    const enc = encrypt('tamper-me', password);
    const tampered = Buffer.from(enc);
    // 翻转最后一个密文字节
    const last = tampered.length - 1;
    tampered[last] = tampered[last] ^ 0xff;
    expect(() => decrypt(tampered, password)).to.throw(/DECRYPT_FAILED/);
  });

  it('非法信封（长度不足）→ 抛 INVALID_ENVELOPE', () => {
    expect(() => decrypt(Buffer.from('short'), password)).to.throw(/INVALID_ENVELOPE/);
  });

  it('错误 MAGIC → 抛 BAD_MAGIC', () => {
    const env = encrypt('x', password);
    const mutated = Buffer.from(env);
    mutated[0] = mutated[0] ^ 0xff; // 破坏 MAGIC
    expect(() => decrypt(mutated, password)).to.throw(/BAD_MAGIC/);
  });

  it('相同明文 + 相同密码 → 每次密文不同（随机 salt/iv）', () => {
    const a = encrypt('deterministic?', password);
    const b = encrypt('deterministic?', password);
    expect(Buffer.compare(a, b)).to.not.equal(0);
  });

  it('信封头布局符合约定（MAGIC/版本/长度）', () => {
    const env = encrypt('layout', password);
    expect(env.subarray(0, 4).toString('ascii')).to.equal('HTD1');
    expect(env[4]).to.equal(ENVELOPE_CONSTANTS.VERSION);
    expect(env.length).to.be.greaterThan(ENVELOPE_CONSTANTS.HEADER_LEN);
  });
});
