import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import incidentService from './incident.service.js';
import { EMERGENCY_STATUS, EMERGENCY_STATUS_TRANSITIONS } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const TAG = 'SM_';

describe('Incident 状态机迁移矩阵(穷举)', () => {
  afterAll(async () => {
    await prisma.emergencyResponse.deleteMany({ where: { title: { contains: TAG } } });
    await prisma.$disconnect();
  });

  const states = Object.values(EMERGENCY_STATUS);
  for (const from of states) {
    for (const to of states) {
      it(`${from} -> ${to}`, async () => {
        const rec = await prisma.emergencyResponse.create({ data: { title: `${TAG}${from}_${to}`, status: from } });
        const allowed = from === to || (EMERGENCY_STATUS_TRANSITIONS[from] || []).includes(to);
        if (allowed) {
          const r = await incidentService.changeStatus(rec.id, to);
          expect(r.status).toBe(to);
        } else {
          await expect(incidentService.changeStatus(rec.id, to)).rejects.toThrow();
        }
        await prisma.emergencyResponse.delete({ where: { id: rec.id } });
      });
    }
  }
});
