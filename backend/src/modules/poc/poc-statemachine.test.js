import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import pocService from './poc.service.js';
import { POC_STATUS, POC_STATUS_TRANSITIONS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const TAG = 'SM_';

describe('POC 状态机迁移矩阵(穷举)', () => {
  afterAll(async () => {
    await prisma.pocTracking.deleteMany({ where: { goal: { contains: TAG } } });
    await prisma.$disconnect();
  });

  const states = Object.values(POC_STATUS);
  for (const from of states) {
    for (const to of states) {
      it(`${from} -> ${to}`, async () => {
        const rec = await prisma.pocTracking.create({ data: { goal: `${TAG}${from}_${to}`, status: from } });
        // 状态机允许自环 from===to；其余以迁移矩阵为准
        const allowed = from === to || (POC_STATUS_TRANSITIONS[from] || []).includes(to);
        if (allowed) {
          const r = await pocService.changeStatus(rec.id, to);
          expect(r.status).toBe(to);
        } else {
          await expect(pocService.changeStatus(rec.id, to)).rejects.toThrow();
        }
        await prisma.pocTracking.delete({ where: { id: rec.id } });
      });
    }
  }
});
