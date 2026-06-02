/**
 * MA 宏命令参考数据库（离线）
 * 覆盖 grandMA2 / grandMA3 常用命令语法
 */

export interface MacroCommand {
  id: string
  category: string
  name: string
  syntax: string
  description: string
  example: string
  version: 'MA2' | 'MA3' | 'BOTH'
  tags: string[]
}

export const MA_MACRO_COMMANDS: MacroCommand[] = [
  // ── 基础操作 ─────────────────────────────────────────────────────────────
  {
    id: 'basic_001',
    category: '基础操作',
    name: '清空选择',
    syntax: 'ClearAll',
    description: '清空所有已选择的灯具和参数',
    example: 'ClearAll',
    version: 'BOTH',
    tags: ['clear', '清空', '基础'],
  },
  {
    id: 'basic_002',
    category: '基础操作',
    name: '全选灯具',
    syntax: 'At [value]',
    description: '选中所有灯具并设置参数值',
    example: 'At Full // 所有灯全亮\nAt 50 // 所有灯50%亮度',
    version: 'BOTH',
    tags: ['选择', '亮度', '基础'],
  },
  {
    id: 'basic_003',
    category: '基础操作',
    name: '选择灯具范围',
    syntax: 'Fixture [start] Thru [end]',
    description: '选择指定编号范围的灯具',
    example: 'Fixture 1 Thru 20 // 选择1号到20号灯',
    version: 'BOTH',
    tags: ['选择', '灯具', '范围'],
  },
  {
    id: 'basic_004',
    category: '基础操作',
    name: '存储 Cue',
    syntax: 'Store Cue [number] [options]',
    description: '将当前舞台状态存储为 Cue',
    example: 'Store Cue 1\nStore Cue 1.5 Merge // 合并存储',
    version: 'BOTH',
    tags: ['存储', 'cue', '状态'],
  },
  {
    id: 'basic_005',
    category: '基础操作',
    name: '运行 Cue',
    syntax: 'Go Cue [number] [options]',
    description: '执行指定 Cue',
    example: 'Go Cue 1\nGo Cue 5 Time 3 // 3秒渐变运行Cue 5',
    version: 'BOTH',
    tags: ['运行', 'cue', '播放'],
  },
  // ── 灯具控制 ─────────────────────────────────────────────────────────────
  {
    id: 'fixture_001',
    category: '灯具控制',
    name: '设置 Dimmer',
    syntax: 'Attribute "Dimmer" At [value]',
    description: '设置选中灯具的亮度（0-100）',
    example: 'Fixture 1 Thru 10 Attribute "Dimmer" At 80',
    version: 'MA3',
    tags: ['dimmer', '亮度', '灯具控制'],
  },
  {
    id: 'fixture_002',
    category: '灯具控制',
    name: '设置颜色（RGB）',
    syntax: 'Attribute "Red" At [r] / Attribute "Green" At [g] / Attribute "Blue" At [b]',
    description: '分别设置 RGB 三色通道值',
    example: 'Fixture 1 Thru 5;\nAttribute "Red" At 100;\nAttribute "Green" At 0;\nAttribute "Blue" At 50;',
    version: 'MA3',
    tags: ['颜色', 'rgb', '灯具控制'],
  },
  {
    id: 'fixture_003',
    category: '灯具控制',
    name: '设置 Pan/Tilt',
    syntax: 'Attribute "Pan" At [value] Attribute "Tilt" At [value]',
    description: '控制摇头灯水平/垂直角度',
    example: 'Attribute "Pan" At 128 // 居中\nAttribute "Tilt" At 100',
    version: 'MA3',
    tags: ['pan', 'tilt', '摇头灯'],
  },
  {
    id: 'fixture_004',
    category: '灯具控制',
    name: '设置 Strobe',
    syntax: 'Attribute "Shutter" At [value]',
    description: '控制频闪速度（0=关闭，100=最快）',
    example: 'Attribute "Shutter" At 50 // 中速频闪',
    version: 'MA3',
    tags: ['频闪', 'strobe', 'shutter'],
  },
  // ── 序列与播放 ────────────────────────────────────────────────────────────
  {
    id: 'seq_001',
    category: '序列播放',
    name: '运行序列',
    syntax: 'Go Sequence [number]',
    description: '启动指定序列（Sequence）',
    example: 'Go Sequence 1',
    version: 'MA3',
    tags: ['sequence', '序列', '播放'],
  },
  {
    id: 'seq_002',
    category: '序列播放',
    name: '停止序列',
    syntax: 'Off Sequence [number]',
    description: '停止指定序列',
    example: 'Off Sequence 1',
    version: 'MA3',
    tags: ['sequence', '序列', '停止'],
  },
  {
    id: 'seq_003',
    category: '序列播放',
    name: '设置 BPM 速度',
    syntax: 'Sequence [n] Speed [bpm]',
    description: '设置序列的播放速度（BPM）',
    example: 'Sequence 1 Speed 120 // 120BPM',
    version: 'MA3',
    tags: ['速度', 'bpm', '序列'],
  },
  {
    id: 'seq_004',
    category: '序列播放',
    name: '分配序列到执行器',
    syntax: 'Assign Sequence [number] At Executor [page].[executor]',
    description: '将序列分配到指定页面的执行器，便于演出播放',
    example: 'Assign Sequence 1 At Executor 1.201',
    version: 'BOTH',
    tags: ['assign', 'executor', 'sequence', '执行器'],
  },
  {
    id: 'seq_005',
    category: '序列播放',
    name: '命名序列',
    syntax: 'Label Sequence [number] "[name]"',
    description: '为序列设置易识别的名称',
    example: 'Label Sequence 10 "Opening Wash"',
    version: 'BOTH',
    tags: ['label', '命名', 'sequence'],
  },
  {
    id: 'seq_006',
    category: '序列播放',
    name: '更新 Cue',
    syntax: 'Update Cue [number]',
    description: '将当前修改写回指定 Cue',
    example: 'Update Cue 12 /Merge',
    version: 'BOTH',
    tags: ['update', 'cue', 'merge'],
  },
  {
    id: 'seq_007',
    category: '序列播放',
    name: '复制 Cue',
    syntax: 'Copy Cue [source] At Cue [target]',
    description: '复制一个 Cue 到新的 Cue 编号',
    example: 'Copy Cue 1 At Cue 2',
    version: 'BOTH',
    tags: ['copy', 'cue', '复制'],
  },
  {
    id: 'seq_008',
    category: '序列播放',
    name: '移动 Cue',
    syntax: 'Move Cue [source] At Cue [target]',
    description: '调整 Cue 编号或顺序',
    example: 'Move Cue 3 At Cue 3.5',
    version: 'BOTH',
    tags: ['move', 'cue', '移动'],
  },
  // ── 编程技巧 ─────────────────────────────────────────────────────────────
  {
    id: 'prog_001',
    category: '编程技巧',
    name: '创建 Group',
    syntax: 'Store Group [number]',
    description: '将当前选中灯具存储为灯组',
    example: 'Fixture 1 Thru 10\nStore Group 1 // 存储为1号灯组',
    version: 'BOTH',
    tags: ['group', '灯组', '编程'],
  },
  {
    id: 'prog_002',
    category: '编程技巧',
    name: '创建 Preset',
    syntax: 'Store Preset [pool] [number]',
    description: '将当前状态存储为预设',
    example: 'Store Preset 4.1 // 存储颜色预设\nStore Preset 1.1 // 存储Dimmer预设',
    version: 'BOTH',
    tags: ['preset', '预设', '编程'],
  },
  {
    id: 'prog_003',
    category: '编程技巧',
    name: '时间渐变',
    syntax: 'Time [fade]s / Time [fade]s [delay]s',
    description: '设置渐变时间和延迟',
    example: 'Fixture 1 At Full Time 3s // 3秒渐亮\nAt 0 Time 5s 1s // 1秒延迟后5秒渐暗',
    version: 'BOTH',
    tags: ['渐变', 'time', '时间'],
  },
  {
    id: 'prog_004',
    category: '编程技巧',
    name: 'If 条件判断（MA3）',
    syntax: 'If [condition] Do [command] EndIf',
    description: 'MA3 脚本中的条件判断',
    example: 'If $fader1 > 0.5 Do\n  Go Cue 10\nEndIf',
    version: 'MA3',
    tags: ['if', '条件', '脚本', 'MA3'],
  },
  {
    id: 'prog_005',
    category: '编程技巧',
    name: 'For 循环（MA3）',
    syntax: 'For [var] = [start] To [end] Step [step]\n  [commands]\nNext',
    description: 'MA3 脚本循环语句',
    example: 'For $i = 1 To 10 Step 1\n  Fixture $i At $i * 10\nNext',
    version: 'MA3',
    tags: ['循环', 'for', '脚本', 'MA3'],
  },
  {
    id: 'prog_006',
    category: '编程技巧',
    name: '开启 Blind 编程',
    syntax: 'Blind On / Blind Off',
    description: '在不影响舞台输出的情况下编辑数据',
    example: 'Blind On\nFixture 1 At 50\nStore Cue 20\nBlind Off',
    version: 'BOTH',
    tags: ['blind', '离线编程', '排练'],
  },
  {
    id: 'prog_007',
    category: '编程技巧',
    name: '开启 Preview',
    syntax: 'Preview On / Preview Off',
    description: '预览 Cue 或序列内容，用于演出前检查',
    example: 'Preview On\nGo Cue 5\nPreview Off',
    version: 'BOTH',
    tags: ['preview', '预览', 'cue'],
  },
  {
    id: 'prog_008',
    category: '编程技巧',
    name: '高亮当前选择',
    syntax: 'Highlight On / Highlight Off',
    description: '快速识别当前选中灯具，常用于现场找灯',
    example: 'Fixture 101\nHighlight On',
    version: 'BOTH',
    tags: ['highlight', '找灯', '选择'],
  },
  {
    id: 'prog_009',
    category: '编程技巧',
    name: '停驻参数',
    syntax: 'Park [object] / Unpark [object]',
    description: '临时锁定某个灯具或参数输出，避免被 Cue 改变',
    example: 'Fixture 1 Attribute "Dimmer" Park\nFixture 1 Attribute "Dimmer" Unpark',
    version: 'BOTH',
    tags: ['park', 'unpark', '锁定', '参数'],
  },
  {
    id: 'prog_010',
    category: '编程技巧',
    name: '清除 Programmer 指定参数',
    syntax: 'Knockout [selection]',
    description: '从 Programmer 中移除指定灯具或参数值',
    example: 'Fixture 1 Thru 10 Attribute "ColorRGB" Knockout',
    version: 'BOTH',
    tags: ['knockout', 'programmer', '清除'],
  },
  {
    id: 'prog_011',
    category: '编程技巧',
    name: '克隆灯具数据',
    syntax: 'Clone Fixture [source] At Fixture [target]',
    description: '将一台或一组灯具的编程数据复制到另一台或另一组灯具',
    example: 'Clone Fixture 1 Thru 10 At Fixture 101 Thru 110',
    version: 'BOTH',
    tags: ['clone', '灯具替换', '数据迁移'],
  },
  {
    id: 'prog_012',
    category: '编程技巧',
    name: '设置变量',
    syntax: 'SetVar $[name] = "[value]"',
    description: '在宏或命令行中保存临时变量，便于复用',
    example: 'SetVar $targetSeq = "10"\nGo Sequence $targetSeq',
    version: 'MA3',
    tags: ['setvar', '变量', '脚本', 'MA3'],
  },
  // ── 系统操作 ─────────────────────────────────────────────────────────────
  {
    id: 'sys_001',
    category: '系统操作',
    name: '保存 Show 文件',
    syntax: 'SaveShow',
    description: '保存当前演出文件',
    example: 'SaveShow',
    version: 'BOTH',
    tags: ['保存', 'show', '文件'],
  },
  {
    id: 'sys_002',
    category: '系统操作',
    name: '备份文件',
    syntax: 'SaveShow "[filename]"',
    description: '将演出文件另存为指定名称',
    example: 'SaveShow "Backup_20260528"',
    version: 'BOTH',
    tags: ['备份', '保存', '文件'],
  },
  {
    id: 'sys_003',
    category: '系统操作',
    name: 'Patch 灯具',
    syntax: 'Patch [fixture_type] FID [id] DMX [universe].[address]',
    description: 'Patch 灯具到 DMX 地址',
    example: 'Patch "MAC Viper" FID 1 DMX 1.001',
    version: 'MA3',
    tags: ['patch', 'dmx', '地址'],
  },
  {
    id: 'sys_004',
    category: '系统操作',
    name: '设置时码同步',
    syntax: 'Timecode [type] [enable/disable]',
    description: '启用/禁用 SMPTE LTC 时码同步',
    example: 'Timecode LTC Enable\nTimecode MTC Enable',
    version: 'BOTH',
    tags: ['timecode', '时码', 'LTC', 'MTC', '同步'],
  },
  {
    id: 'sys_005',
    category: '系统操作',
    name: '导入 Show 文件',
    syntax: 'LoadShow "[filename]"',
    description: '载入指定演出文件，操作前应确认已保存当前文件',
    example: 'LoadShow "Tour_Backup_01"',
    version: 'BOTH',
    tags: ['loadshow', '导入', 'show', '文件'],
  },
  {
    id: 'sys_006',
    category: '系统操作',
    name: '锁定控台',
    syntax: 'Lock',
    description: '临时锁定控台，避免非操作人员误触',
    example: 'Lock',
    version: 'BOTH',
    tags: ['lock', '锁定', '安全'],
  },
  {
    id: 'sys_007',
    category: '系统操作',
    name: '进入 Patch',
    syntax: 'Menu "Patch"',
    description: '快速打开 Patch 菜单进行灯具地址或模式维护',
    example: 'Menu "Patch"',
    version: 'MA3',
    tags: ['patch', 'menu', '维护'],
  },
  {
    id: 'sys_008',
    category: '系统操作',
    name: '网络会话同步',
    syntax: 'Session [start/join/leave]',
    description: '管理多控台或 onPC 节点的网络会话',
    example: 'Session Start\nSession Join',
    version: 'BOTH',
    tags: ['session', '网络', '同步', 'onPC'],
  },
]

/**
 * 搜索宏命令
 * @param query 搜索关键词
 * @param category 可选分类筛选
 * @param version 可选版本筛选
 */
export function searchMacros(
  query: string,
  category?: string,
  version?: 'MA2' | 'MA3' | 'BOTH',
): MacroCommand[] {
  const q = query.toLowerCase()
  return MA_MACRO_COMMANDS.filter(cmd => {
    if (category && cmd.category !== category) return false
    if (version && cmd.version !== version && cmd.version !== 'BOTH') return false
    return (
      cmd.name.toLowerCase().includes(q) ||
      cmd.syntax.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.tags.some(t => t.toLowerCase().includes(q))
    )
  })
}

/** 获取所有分类 */
export function getMacroCategories(): string[] {
  return [...new Set(MA_MACRO_COMMANDS.map(c => c.category))]
}

// ─── Adapter exports for MaMacrosScreen ──────────────────────────────────────

export interface MaMacro {
  name: string
  command: string
  description: string
  category: string
  example?: string
  versions?: string[]
  color?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  '基础操作': '#58A6FF',
  '灯具控制': '#3FB950',
  '序列播放': '#BC8CFF',
  '编程技巧': '#F9A825',
  '系统操作': '#FF6B6B',
  '排练现场': '#00B4D8',
  '网络同步': '#8B5CF6',
}

export const MA_MACROS: MaMacro[] = MA_MACRO_COMMANDS.map(cmd => ({
  name: cmd.name,
  command: cmd.syntax,
  description: cmd.description,
  category: cmd.category,
  example: cmd.example,
  versions: cmd.version === 'BOTH' ? ['MA2', 'MA3'] : [cmd.version],
  color: CATEGORY_COLORS[cmd.category] || '#8B949E',
}))

