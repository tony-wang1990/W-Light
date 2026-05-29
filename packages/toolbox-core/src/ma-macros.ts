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

