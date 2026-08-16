/**
 * 合同回款模块 - Service 服务层
 */
import contractRepository from './finance-contract.repository.js';
import {
  createContractSchema,
  updateContractSchema,
  listContractSchema,
  contractIdSchema,
  updateNodeSchema,
} from './finance-contract.schema.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

/**
 * 金额保留两位小数
 */
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * 安全解析 nodes JSON 字符串为数组
 */
function safeParseNodes(nodes) {
  if (!nodes) return [];
  try {
    const arr = typeof nodes === 'string' ? JSON.parse(nodes) : nodes;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * 计算已回款总额
 */
function sumReceived(nodes) {
  return nodes.reduce((sum, n) => sum + (Number(n.receivedAmount) || 0), 0);
}

class ContractReceivableService {
  /**
   * 列表查询：关键字模糊匹配合同编号 / 客户名称
   */
  async list(query = {}) {
    const q = listContractSchema.parse(query);
    const where = {};
    if (q.keyword) {
      where.OR = [
        { contractNo: { contains: q.keyword } },
        { clientName: { contains: q.keyword } },
      ];
    }
    if (q.clientName) where.clientName = { contains: q.clientName };
    return contractRepository.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  /**
   * 根据 ID 获取详情
   */
  async getById(id) {
    contractIdSchema.parse({ id });
    const contract = await contractRepository.findById(id);
    if (!contract) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '合同回款记录不存在');
    }
    return contract;
  }

  /**
   * 新增合同回款记录
   */
  async create(payload) {
    const data = createContractSchema.parse(payload);
    const parsedNodes = safeParseNodes(data.nodes);
    const nodes = (Array.isArray(parsedNodes) && parsedNodes.length > 0)
      ? JSON.stringify(parsedNodes)
      : JSON.stringify([{ receivedAmount: 0, receivedAt: null }]);
    const amount = round2(data.contractAmount);
    return contractRepository.create({
      contractNo: data.contractNo,
      contractAmount: amount,
      clientName: data.clientName || null,
      nodes,
      totalReceived: 0,
      totalPending: amount,
      remark: data.remark || null,
    });
  }

  /**
   * 编辑合同回款记录（部分字段更新）
   */
  async update(idOrPayload, payload) {
    let id;
    let fields;
    if (typeof idOrPayload === 'object' && idOrPayload !== null) {
      ({ id, ...fields } = idOrPayload);
    } else {
      id = idOrPayload;
      fields = payload || {};
    }
    const parsed = updateContractSchema.parse({ id, ...fields });
    const { id: pid, ...valid } = parsed;
    const exists = await contractRepository.findById(pid);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '合同回款记录不存在');
    }

    const updateData = {};
    if (valid.contractNo !== undefined) updateData.contractNo = valid.contractNo;
    if ('clientName' in valid) updateData.clientName = valid.clientName || null;
    if (valid.nodes !== undefined) updateData.nodes = valid.nodes;
    if ('remark' in valid) updateData.remark = valid.remark || null;
    if (valid.contractAmount !== undefined) {
      const amt = round2(valid.contractAmount);
      updateData.contractAmount = amt;
      // 合同金额变更时，按当前节点回款重新计算待回款
      const nodes = safeParseNodes(exists.nodes);
      const totalReceived = round2(sumReceived(nodes));
      updateData.totalReceived = totalReceived;
      updateData.totalPending = round2(amt - totalReceived);
    }

    return contractRepository.updateById(pid, updateData);
  }

  /**
   * 软删除合同回款记录
   */
  async delete(id) {
    contractIdSchema.parse({ id });
    const exists = await contractRepository.findById(id);
    if (!exists) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '合同回款记录不存在');
    }
    return contractRepository.softDeleteById(id);
  }

  /**
   * 更新单个回款节点的已回款金额，并重算合同汇总
   */
  async updateNode(contractId, nodeIndex, receivedAmount, receivedAt) {
    const data = updateNodeSchema.parse({ contractId, nodeIndex, receivedAmount, receivedAt });
    const contract = await contractRepository.findById(data.contractId);
    if (!contract) {
      throw new BusinessError(ErrorCodes.DB_NOT_FOUND, '合同回款记录不存在');
    }

    const nodes = safeParseNodes(contract.nodes);
    if (data.nodeIndex < 0 || data.nodeIndex >= nodes.length) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '节点序号超出范围');
    }

    nodes[data.nodeIndex].receivedAmount = round2(data.receivedAmount);
    nodes[data.nodeIndex].receivedAt = data.receivedAt || null;

    const totalReceived = round2(sumReceived(nodes));
    const totalPending = round2(Number(contract.contractAmount) - totalReceived);

    return contractRepository.updateById(data.contractId, {
      nodes: JSON.stringify(nodes),
      totalReceived,
      totalPending,
    });
  }
}

export default new ContractReceivableService();
