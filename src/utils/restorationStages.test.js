import assert from 'node:assert/strict'
import test from 'node:test'

import { restorationBatches, restorationTasks } from '../data/restorationData.js'
import {
  assertTransition,
  canTransition,
  nextStage,
  resolveStage,
  restorationStages,
  stageActions,
  stageLabel,
  stageMeta,
} from './restorationStages.js'

test('共享定义完整：每个阶段都有名称、可执行动作和转换条件', () => {
  assert.ok(restorationStages.length >= 3)
  for (const stage of restorationStages) {
    assert.ok(stage.key)
    assert.ok(stage.label)
    assert.ok(stage.actions.length > 0)
    assert.ok(stage.condition)
  }
})

test('历史阶段可读：归档前解析到入盒前，展示名原样保留', () => {
  const meta = stageMeta('归档前')
  assert.equal(meta.known, true)
  assert.equal(meta.key, 'pre-boxing')
  assert.equal(meta.label, '归档前')
  assert.equal(meta.canonicalLabel, '入盒前')
  assert.deepEqual(stageActions('归档前'), stageActions('入盒前'))
})

test('已有批次与任务数据：阶段全部可解析，且显示文本与原始数据一致', () => {
  const statuses = [
    ...restorationBatches.map((item) => item.status),
    ...restorationTasks.map((item) => item.stage),
  ]
  for (const status of statuses) {
    assert.ok(resolveStage(status), `无法识别阶段：${status}`)
    assert.equal(stageLabel(status), status)
  }
})

test('合法转换：同阶段与顺推下一阶段放行', () => {
  assert.equal(canTransition('补纸前', '补纸前'), true)
  assert.equal(canTransition('补纸前', '控湿中'), true)
  assert.equal(canTransition('控湿中', '入盒前'), true)
  assert.equal(canTransition('归档前', '归档前'), true)
  assert.equal(assertTransition('控湿中', '入盒前'), true)
})

test('非法回退被拒绝：包括历史别名参与的回退', () => {
  assert.equal(canTransition('控湿中', '补纸前'), false)
  assert.equal(canTransition('入盒前', '补纸前'), false)
  assert.equal(canTransition('归档前', '控湿中'), false)
  assert.throws(() => assertTransition('入盒前', '控湿中'), /回退/)
})

test('越级跳段被拒绝：不允许留下空档工序', () => {
  assert.equal(canTransition('补纸前', '入盒前'), false)
  assert.throws(() => assertTransition('补纸前', '入盒前'), /越级/)
})

test('空档不误判：未知或留空阶段不可读作合法阶段，也不参与转换', () => {
  for (const gap of ['', '   ', null, undefined, '不存在的阶段']) {
    assert.equal(resolveStage(gap), null)
    assert.equal(canTransition(gap, '补纸前'), false)
    assert.equal(canTransition('补纸前', gap), false)
    assert.throws(() => assertTransition(gap, '补纸前'), /无法识别/)
  }

  assert.equal(stageMeta('').label, '未标注')
  assert.equal(stageMeta('').known, false)
  assert.deepEqual(stageMeta('').actions, [])
  assert.equal(stageMeta('不存在的阶段').label, '不存在的阶段')
  assert.equal(nextStage(''), null)
})

test('阶段顺序：nextStage 依次顺推，末阶段之后为 null', () => {
  assert.equal(nextStage('补纸前').label, '控湿中')
  assert.equal(nextStage('控湿中').label, '入盒前')
  assert.equal(nextStage('入盒前'), null)
  assert.equal(nextStage('归档前'), null)
})
