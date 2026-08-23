import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import vulnService from './vuln.service.js';
import { VULN_FIX_STATUS, SEVERITY } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

async function cleanup() {
  await prisma.vulnTrack.deleteMany({ where: { vulnId: { contains: PREFIX } } });
}

describe('Vuln Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('create 必填 assetGroup + vulnId；默认 fixStatus=open/severity=medium', async () => {
    const v = await vulnService.create({ assetGroup: 'WEB', vulnId: `${PREFIX}CVE-001` });
    expect(v.id).toBeTruthy();
    expect(v.fixStatus).toBe(VULN_FIX_STATUS.OPEN);
    expect(v.severity).toBe(SEVERITY.MEDIUM);
    expect(v.deletedAt).toBeUndefined();
  });

  it('create 缺 assetGroup 抛错', async () => {
    await expect(vulnService.create({ vulnId: `${PREFIX}X` })).rejects.toThrow();
  });

  it('list 缺 assetGroup 返回空', async () => {
    await vulnService.create({ assetGroup: 'WEB', vulnId: `${PREFIX}A` });
    const r = await vulnService.list({});
    expect(r).toEqual([]);
  });

  it('list 按 assetGroup 隔离返回', async () => {
    await vulnService.create({ assetGroup: 'WEB', vulnId: `${PREFIX}A` });
    await vulnService.create({ assetGroup: 'NET', vulnId: `${PREFIX}B` });
    const web = await vulnService.list({ assetGroup: 'WEB' });
    const list = Array.isArray(web) ? web : web.list;
    expect(list.length).toBe(1);
    expect(list[0].assetGroup).toBe('WEB');
  });

  it('update 直接改 severity', async () => {
    const v = await vulnService.create({ assetGroup: 'WEB', vulnId: `${PREFIX}S` });
    const u = await vulnService.update({ id: v.id, severity: SEVERITY.HIGH });
    expect(u.severity).toBe(SEVERITY.HIGH);
  });

  it('delete 软删除', async () => {
    const v = await vulnService.create({ assetGroup: 'WEB', vulnId: `${PREFIX}D` });
    await vulnService.delete(v.id);
    const raw = await prisma.vulnTrack.findUnique({ where: { id: v.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('changeStatus open->fixing->fixed->closed', async () => {
    const v = await vulnService.create({ assetGroup: 'WEB', vulnId: `${PREFIX}ST` });
    expect((await vulnService.changeStatus(v.id, VULN_FIX_STATUS.FIXING)).fixStatus).toBe(VULN_FIX_STATUS.FIXING);
    expect((await vulnService.changeStatus(v.id, VULN_FIX_STATUS.FIXED)).fixStatus).toBe(VULN_FIX_STATUS.FIXED);
    expect((await vulnService.changeStatus(v.id, VULN_FIX_STATUS.CLOSED)).fixStatus).toBe(VULN_FIX_STATUS.CLOSED);
  });
});

afterAll(async () => { await prisma.$disconnect(); });
