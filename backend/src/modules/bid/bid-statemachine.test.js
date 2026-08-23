import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bidService from './bid.service.js';
import { BID_STATUS, BID_STATUS_TRANSITIONS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const TAG = 'SM_';

describe('Bid 状态机迁移矩阵(穷举)', () => {
  afterAll(async () => {
    await prisma.bidArchive.deleteMany({ where: { bidNo: { contains: TAG } } });
    await prisma.$disconnect();
  });

  const states = Object.values(BID_STATUS);
  for (const from of states) {
    for (const to of states) {
      it(`${from} -> ${to}`, async () => {
        const rec = await prisma.bidArchive.create({ data: { bidNo: `${TAG}${from}_${to}`, status: from } });
        const allowed = from === to || (BID_STATUS_TRANSITIONS[from] || []).includes(to);
        if (allowed) {
          const r = await bidService.changeStatus(rec.id, to);
          expect(r.status).toBe(to);
        } else {
          await expect(bidService.changeStatus(rec.id, to)).rejects.toThrow();
        }
        await prisma.bidArchive.delete({ where: { id: rec.id } });
      });
    }
  }
});
