import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import vulnService from './vuln.service.js';
import { VULN_FIX_STATUS, VULN_FIX_STATUS_TRANSITIONS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const TAG = 'SM_';

describe('Vuln 状态机迁移矩阵(穷举)', () => {
  afterAll(async () => {
    await prisma.vulnTrack.deleteMany({ where: { vulnId: { contains: TAG } } });
    await prisma.$disconnect();
  });

  const states = Object.values(VULN_FIX_STATUS);
  for (const from of states) {
    for (const to of states) {
      it(`${from} -> ${to}`, async () => {
        const rec = await prisma.vulnTrack.create({
          data: { assetGroup: 'WEB', vulnId: `${TAG}${from}_${to}`, fixStatus: from },
        });
        const allowed = from === to || (VULN_FIX_STATUS_TRANSITIONS[from] || []).includes(to);
        if (allowed) {
          const r = await vulnService.changeStatus(rec.id, to);
          expect(r.fixStatus).toBe(to);
        } else {
          await expect(vulnService.changeStatus(rec.id, to)).rejects.toThrow();
        }
        await prisma.vulnTrack.delete({ where: { id: rec.id } });
      });
    }
  }
});
