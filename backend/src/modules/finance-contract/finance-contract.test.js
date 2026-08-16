import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import contractService from './finance-contract.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

describe('ContractReceivable Service', () => {
  beforeEach(async () => {
    await prisma.contractReceivable.deleteMany({ where: { contractNo: { contains: PREFIX } } });
  });
  afterEach(async () => {
    await prisma.contractReceivable.deleteMany({ where: { contractNo: { contains: PREFIX } } });
  });

  it('create 初始化节点与汇总', async () => {
    const c = await contractService.create({ contractNo: `${PREFIX}HT-001`, contractAmount: 100 });
    expect(c.totalReceived).toBe(0);
    expect(c.totalPending).toBe(100);
    const nodes = JSON.parse(c.nodes);
    expect(nodes.length).toBe(1);
    expect(nodes[0].receivedAmount).toBe(0);
  });

  it('create 缺合同号被 zod 拒绝', async () => {
    await expect(contractService.create({ contractAmount: 100 })).rejects.toThrow();
  });

  it('updateNode 重算已回款/待回款', async () => {
    const c = await contractService.create({ contractNo: `${PREFIX}HT-002`, contractAmount: 100 });
    const upd = await contractService.updateNode(c.id, 0, 40);
    expect(upd.totalReceived).toBe(40);
    expect(upd.totalPending).toBe(60);
  });

  it('updateNode 节点序号越界抛错', async () => {
    const c = await contractService.create({ contractNo: `${PREFIX}HT-003`, contractAmount: 100 });
    await expect(contractService.updateNode(c.id, 5, 10)).rejects.toThrow('节点序号超出范围');
  });

  it('update 变更合同金额重算待回款', async () => {
    const c = await contractService.create({ contractNo: `${PREFIX}HT-004`, contractAmount: 100 });
    await contractService.updateNode(c.id, 0, 30);
    const upd = await contractService.update(c.id, { contractAmount: 200 });
    expect(upd.totalPending).toBe(170);
  });

  it('list 按 keyword 匹配合同号/客户', async () => {
    await contractService.create({ contractNo: `${PREFIX}HT-AAA`, contractAmount: 10, clientName: '客户甲' });
    await contractService.create({ contractNo: `${PREFIX}HT-BBB`, contractAmount: 20 });
    const list = await contractService.list({ keyword: 'AAA' });
    expect(list.length).toBe(1);
  });

  it('delete 软删除', async () => {
    const c = await contractService.create({ contractNo: `${PREFIX}HT-DEL`, contractAmount: 10 });
    await contractService.delete(c.id);
    const raw = await prisma.contractReceivable.findUnique({ where: { id: c.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });
