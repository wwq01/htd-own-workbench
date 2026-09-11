import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import readingService from './reading.service.js';
import { READING_STATUS, READING_STATUS_TRANSITIONS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const TAG = 'SM_';

describe('Reading 状态机迁移矩阵(穷举)', () => {
  afterAll(async () => {
    await prisma.readingMaterial.deleteMany({ where: { title: { contains: TAG } } });
    await prisma.$disconnect();
  });

  const states = Object.values(READING_STATUS);
  for (const from of states) {
    for (const to of states) {
      it(`${from} -> ${to}`, async () => {
        const rec = await prisma.readingMaterial.create({
          data: { title: `${TAG}${from}_${to}`, readingStatus: from },
        });
        const allowed = from === to || (READING_STATUS_TRANSITIONS[from] || []).includes(to);
        if (allowed) {
          const r = await readingService.changeStatus(rec.id, to);
          expect(r.readingStatus).toBe(to);
        } else {
          await expect(readingService.changeStatus(rec.id, to)).rejects.toThrow();
        }
        await prisma.readingMaterial.delete({ where: { id: rec.id } });
      });
    }
  }
});
