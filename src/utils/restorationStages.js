/**
 * 修复阶段的唯一共享定义。
 *
 * 阶段名称、可执行动作、阶段间转换条件全部收拢在这里，
 * 批次卡片（status）与任务行（stage）只能通过本模块读取阶段，
 * 不允许在组件里再次硬编码阶段名称。
 *
 * 设计约束：
 * - 已落库的历史数据仍可能携带旧阶段名，resolveStage 必须可读；
 * - 只允许沿流程正向推进，非法回退一律拒绝；
 * - 空阶段（null / undefined / 空白字符串）要被识别为“空档”，
 *   不能误判为任何已知阶段。
 */

export const RESTORATION_STAGES = [
  {
    key: 'before_patching',
    label: '补纸前',
    action: {
      key: 'humidify',
      label: '喷雾回软',
      description: '喷雾回软后局部补纸，不做整页过度清洗。',
    },
    conditions: ['固色完成，虫道起止页已拍照标注'],
    next: 'humidity_controlling',
  },
  {
    key: 'humidity_controlling',
    label: '控湿中',
    action: {
      key: 'reinforce_fiber',
      label: '纤维加固',
      description: '完成降湿后再进入纤维加固，避免纸浆返潮。',
    },
    conditions: ['相对湿度稳定在控制线 50% - 55%'],
    next: 'before_boxing',
  },
  {
    key: 'before_boxing',
    label: '入盒前',
    action: {
      key: 'flatten',
      label: '平整定型',
      description: '平整定型 8 小时后转入无酸盒暂存。',
    },
    conditions: ['平整定型满 8 小时，无酸盒封套尺寸已确认'],
    next: 'before_archiving',
  },
  {
    key: 'before_archiving',
    label: '归档前',
    action: null,
    conditions: [],
    next: null,
  },
]

/**
 * 历史阶段名（含废弃叫法）到现行阶段的别名表。
 * 别名只负责让历史数据继续可读，不改变原数据内容。
 */
export const RESTORATION_STAGE_ALIASES = {
  待补纸: 'before_patching',
  待加固: 'humidity_controlling',
  待装盒: 'before_boxing',
  待归档: 'before_archiving',
}

const STAGE_BY_KEY = new Map(RESTORATION_STAGES.map((stage) => [stage.key, stage]))
const STAGE_BY_LABEL = new Map(
  RESTORATION_STAGES.map((stage) => [stage.label, stage]),
)

function isBlankStage(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

/**
 * 解析任意来源的阶段值（现行名、key、历史别名均可）。
 * @returns {{ stage: object|null, historical: boolean, blank: boolean }}
 */
export function resolveStage(value) {
  if (isBlankStage(value)) {
    return { stage: null, historical: false, blank: true }
  }

  const text = String(value).trim()

  const byKey = STAGE_BY_KEY.get(text)
  if (byKey) {
    return { stage: byKey, historical: false, blank: false }
  }

  const byLabel = STAGE_BY_LABEL.get(text)
  if (byLabel) {
    return { stage: byLabel, historical: false, blank: false }
  }

  const aliasedKey = RESTORATION_STAGE_ALIASES[text]
  if (aliasedKey) {
    return { stage: STAGE_BY_KEY.get(aliasedKey), historical: true, blank: false }
  }

  return { stage: null, historical: false, blank: false }
}

/**
 * 阶段展示名：空档返回空串，历史/未知阶段保留原始写法以便溯源。
 */
export function stageLabel(value) {
  if (isBlankStage(value)) {
    return ''
  }

  const { stage } = resolveStage(value)
  return stage ? stage.label : String(value).trim()
}

function stageOrder(stage) {
  return RESTORATION_STAGES.findIndex((item) => item.key === stage.key)
}

/**
 * 校验阶段转换是否合法。
 * @returns {{ ok: boolean, reason: string|null, action?: object, conditions: string[] }}
 */
export function canTransitionStage(from, to) {
  const fromResult = resolveStage(from)
  const toResult = resolveStage(to)

  if (fromResult.blank) {
    return {
      ok: false,
      reason: '当前阶段为空，无法判定流转方向',
      conditions: [],
    }
  }
  if (toResult.blank) {
    return {
      ok: false,
      reason: '目标阶段为空，不能转入空档',
      conditions: [],
    }
  }
  if (!fromResult.stage) {
    return {
      ok: false,
      reason: `未知的当前阶段：${String(from).trim()}`,
      conditions: [],
    }
  }
  if (!toResult.stage) {
    return {
      ok: false,
      reason: `未知的目标阶段：${String(to).trim()}`,
      conditions: [],
    }
  }

  const current = fromResult.stage
  const target = toResult.stage
  const diff = stageOrder(target) - stageOrder(current)

  if (diff < 0) {
    return {
      ok: false,
      reason: `非法回退：不能从「${current.label}」退回「${target.label}」`,
      conditions: [],
    }
  }
  if (diff === 0) {
    return {
      ok: false,
      reason: `阶段未发生变化：仍停留在「${current.label}」`,
      conditions: [],
    }
  }
  if (current.next !== target.key) {
    return {
      ok: false,
      reason: `「${current.label}」不能越级转到「${target.label}」`,
      conditions: [],
    }
  }
  if (!current.action) {
    return {
      ok: false,
      reason: `「${current.label}」没有可执行动作，流程已结束`,
      conditions: [],
    }
  }

  return {
    ok: true,
    reason: null,
    action: current.action,
    conditions: current.conditions,
  }
}
