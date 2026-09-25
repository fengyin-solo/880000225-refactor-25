// 修复阶段共享模型：批次卡片与任务行共用同一套阶段名称、可执行动作和转换条件。
// condition 表示“离开当前阶段、顺推到下一阶段”前必须满足的转换条件。
export const restorationStages = [
  {
    key: 'pre-patching',
    label: '补纸前',
    actions: ['拍照建档', '低压除尘', '固色评估'],
    condition: '虫道起止页已标注，且固色评估通过',
  },
  {
    key: 'humidity-control',
    label: '控湿中',
    actions: ['降湿监测', '喷雾回软', '局部补纸'],
    condition: '相对湿度连续 48 小时稳定在 50% - 55%',
  },
  {
    key: 'pre-boxing',
    label: '入盒前',
    actions: ['平整定型', '封套尺寸确认', '无酸盒暂存'],
    condition: '平整定型满 8 小时，转入无酸盒暂存',
  },
]

// 历史阶段别名：旧档案里的写法只读展示，不回写已有数据。
const legacyStageAliases = {
  归档前: 'pre-boxing',
}

const stageIndexByKey = new Map(
  restorationStages.map((stage, index) => [stage.key, index]),
)

// 把阶段名称（规范名、key 或历史别名）解析为规范阶段；无法识别时返回 null。
export function resolveStage(value) {
  if (typeof value !== 'string') return null
  const label = value.trim()
  if (!label) return null

  const canonicalKey = legacyStageAliases[label] ?? label
  const stage = restorationStages.find(
    (item) => item.key === canonicalKey || item.label === canonicalKey,
  )
  return stage ?? null
}

// 展示与读取入口：任何输入都给出可读 label，未知或留空的“空档”不挂接动作与转换。
export function stageMeta(value) {
  const stage = resolveStage(value)
  const rawLabel = typeof value === 'string' ? value.trim() : ''

  if (!stage) {
    return {
      key: null,
      label: rawLabel || '未标注',
      canonicalLabel: null,
      actions: [],
      condition: null,
      known: false,
    }
  }

  return {
    key: stage.key,
    // 历史名称原样展示；按 key 引用时回退到规范名。
    label: rawLabel && rawLabel !== stage.key ? rawLabel : stage.label,
    canonicalLabel: stage.label,
    actions: stage.actions,
    condition: stage.condition,
    known: true,
  }
}

export function stageLabel(value) {
  return stageMeta(value).label
}

export function stageActions(value) {
  return stageMeta(value).actions
}

export function nextStage(value) {
  const stage = resolveStage(value)
  if (!stage) return null
  const index = stageIndexByKey.get(stage.key)
  return restorationStages[index + 1] ?? null
}

// 仅允许同阶段或顺推到下一阶段：回退、越级、空档一律拒绝。
export function canTransition(from, to) {
  const fromStage = resolveStage(from)
  const toStage = resolveStage(to)
  if (!fromStage || !toStage) return false

  const fromIndex = stageIndexByKey.get(fromStage.key)
  const toIndex = stageIndexByKey.get(toStage.key)
  if (toIndex === fromIndex) return true
  return toIndex === fromIndex + 1
}

export function assertTransition(from, to) {
  const fromStage = resolveStage(from)
  const toStage = resolveStage(to)
  if (!fromStage || !toStage) {
    throw new Error(`无法识别的修复阶段：${fromStage ? to : from}`)
  }

  const fromIndex = stageIndexByKey.get(fromStage.key)
  const toIndex = stageIndexByKey.get(toStage.key)
  if (toIndex < fromIndex) {
    throw new Error(`不允许从「${fromStage.label}」回退到「${toStage.label}」`)
  }
  if (toIndex > fromIndex + 1) {
    throw new Error(`不允许从「${fromStage.label}」越级跳到「${toStage.label}」`)
  }
  return true
}
