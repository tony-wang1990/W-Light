/**
 * 灯光行业中英对照术语库（离线）
 */

export interface Term {
  id: string
  chinese: string
  english: string
  abbreviation?: string
  category: string
  description?: string
}

export const LIGHTING_TERMS: Term[] = [
  // ── 灯具类 ───────────────────────────────────────────────────────────────
  { id: 't001', chinese: '摇头灯', english: 'Moving Head Light', abbreviation: 'MH', category: '灯具', description: '可以水平和垂直运动的舞台灯具' },
  { id: 't002', chinese: '摇头光束灯', english: 'Moving Head Beam', category: '灯具', description: '发出平行窄光柱的摇头灯' },
  { id: 't003', chinese: '摇头洗灯', english: 'Moving Head Wash', category: '灯具', description: '大面积柔和铺光的摇头灯' },
  { id: 't004', chinese: '聚光灯', english: 'Spot Light / Profile', category: '灯具' },
  { id: 't005', chinese: '柔光灯', english: 'Fresnel Light', category: '灯具', description: '配有菲涅尔透镜，产生柔和光线' },
  { id: 't006', chinese: '平凸聚光灯', english: 'PC Light', category: '灯具' },
  { id: 't007', chinese: '椭球聚光灯', english: 'Ellipsoidal Reflector Spotlight', abbreviation: 'ERS / Leko', category: '灯具' },
  { id: 't008', chinese: '帕灯', english: 'PAR Can / PAR Light', category: '灯具' },
  { id: 't009', chinese: '天排灯', english: 'Strip Light / Cyclorama Light', abbreviation: 'CYC', category: '灯具' },
  { id: 't010', chinese: '追光灯', english: 'Follow Spot', category: '灯具' },
  { id: 't011', chinese: '频闪灯', english: 'Strobe Light', category: '灯具' },
  { id: 't012', chinese: '激光灯', english: 'Laser Light', category: '灯具' },
  { id: 't013', chinese: 'LED洗灯', english: 'LED Wash Light', category: '灯具' },
  { id: 't014', chinese: '像素灯', english: 'Pixel Light / Matrix Light', category: '灯具' },
  // ── 控台类 ───────────────────────────────────────────────────────────────
  { id: 'c001', chinese: '灯光控台', english: 'Lighting Console / Lighting Desk', category: '控台' },
  { id: 'c002', chinese: 'MA2控台', english: 'grandMA2 Console', abbreviation: 'MA2', category: '控台' },
  { id: 'c003', chinese: 'MA3控台', english: 'grandMA3 Console', abbreviation: 'MA3', category: '控台' },
  { id: 'c004', chinese: '序列', english: 'Sequence / Cue List', category: '控台', description: 'MA3中的播放列表' },
  { id: 'c005', chinese: '线索（Cue）', english: 'Cue', category: '控台', description: '记录了一个舞台状态的快照' },
  { id: 'c006', chinese: '预设（Preset）', english: 'Preset', category: '控台', description: '可复用的参数状态' },
  { id: 'c007', chinese: '灯组', english: 'Group', category: '控台' },
  { id: 'c008', chinese: '宏命令', english: 'Macro', category: '控台' },
  { id: 'c009', chinese: '执行器', english: 'Executor', category: '控台' },
  { id: 'c010', chinese: '推子', english: 'Fader', category: '控台' },
  { id: 'c011', chinese: '页面', english: 'Page', category: '控台' },
  { id: 'c012', chinese: '补丁', english: 'Patch', category: '控台', description: '将灯具类型与DMX地址关联' },
  // ── 信号协议类 ───────────────────────────────────────────────────────────
  { id: 's001', chinese: 'DMX信号', english: 'DMX512', abbreviation: 'DMX', category: '信号协议', description: '舞台灯光控制标准协议，每Universe512通道' },
  { id: 's002', chinese: '地址码', english: 'DMX Address', category: '信号协议' },
  { id: 's003', chinese: '宇宙（Universe）', english: 'Universe', category: '信号协议', description: '一条DMX线路，最多512个通道' },
  { id: 's004', chinese: '时码', english: 'Timecode', abbreviation: 'TC', category: '信号协议' },
  { id: 's005', chinese: 'LTC时码', english: 'Linear Timecode', abbreviation: 'LTC', category: '信号协议', description: 'SMPTE线性时码，通过音频信号传输' },
  { id: 's006', chinese: 'MTC时码', english: 'MIDI Timecode', abbreviation: 'MTC', category: '信号协议' },
  { id: 's007', chinese: 'Art-Net', english: 'Art-Net', category: '信号协议', description: '基于以太网的DMX传输协议' },
  { id: 's008', chinese: 'sACN', english: 'Streaming ACN', abbreviation: 'sACN / E1.31', category: '信号协议' },
  { id: 's009', chinese: '以太网', english: 'Ethernet', category: '信号协议' },
  { id: 's010', chinese: 'MIDI', english: 'Musical Instrument Digital Interface', abbreviation: 'MIDI', category: '信号协议' },
  // ── 光学参数类 ───────────────────────────────────────────────────────────
  { id: 'o001', chinese: '照度', english: 'Illuminance', category: '光学参数', description: '单位：勒克斯（lux / lx）' },
  { id: 'o002', chinese: '光强', english: 'Luminous Intensity', category: '光学参数', description: '单位：坎德拉（cd）' },
  { id: 'o003', chinese: '光通量', english: 'Luminous Flux', category: '光学参数', description: '单位：流明（lm）' },
  { id: 'o004', chinese: '亮度', english: 'Luminance', category: '光学参数', description: '单位：坎德拉/平方米（cd/m²）' },
  { id: 'o005', chinese: '色温', english: 'Color Temperature', category: '光学参数', description: '单位：开尔文（K）' },
  { id: 'o006', chinese: '显色指数', english: 'Color Rendering Index', abbreviation: 'CRI / Ra', category: '光学参数' },
  { id: 'o007', chinese: '光束角', english: 'Beam Angle', category: '光学参数' },
  { id: 'o008', chinese: '场角', english: 'Field Angle', category: '光学参数' },
  { id: 'o009', chinese: '频闪', english: 'Strobe / Flicker', category: '光学参数' },
  { id: 'o010', chinese: '渐变', english: 'Fade / Cross Fade', category: '光学参数' },
  // ── 演出制作类 ───────────────────────────────────────────────────────────
  { id: 'p001', chinese: '灯位图', english: 'Light Plot / Lighting Plan', category: '演出制作' },
  { id: 'p002', chinese: '灯光设计师', english: 'Lighting Designer', abbreviation: 'LD', category: '演出制作' },
  { id: 'p003', chinese: '灯光师', english: 'Lighting Operator / LX Operator', abbreviation: 'LXOp', category: '演出制作' },
  { id: 'p004', chinese: '舞台总监', english: 'Stage Manager', abbreviation: 'SM', category: '演出制作' },
  { id: 'p005', chinese: '彩排', english: 'Rehearsal', category: '演出制作' },
  { id: 'p006', chinese: '技术彩排', english: 'Tech Rehearsal', abbreviation: 'Tech', category: '演出制作' },
  { id: 'p007', chinese: '走台', english: 'Dry Tech / Walk Through', category: '演出制作' },
  { id: 'p008', chinese: '焦点', english: 'Focus', category: '演出制作', description: '调整灯具照射方向和光斑形状' },
  { id: 'p009', chinese: '调光台', english: 'Dimmer Rack', category: '演出制作' },
  { id: 'p010', chinese: '吊桁', english: 'Batten / Lighting Bar', category: '演出制作' },
  { id: 'p011', chinese: '侧光', english: 'Side Light', category: '演出制作' },
  { id: 'p012', chinese: '顶光', english: 'Top Light / Down Light', category: '演出制作' },
  { id: 'p013', chinese: '面光', english: 'Front Light', category: '演出制作' },
  { id: 'p014', chinese: '逆光', english: 'Back Light', category: '演出制作' },
  { id: 'p015', chinese: '染色灯', english: 'Color Wash', category: '演出制作' },
  { id: 'p016', chinese: '色纸', english: 'Gel / Color Filter', category: '演出制作' },
  { id: 'p017', chinese: 'Gobo图案', english: 'Gobo / Pattern', category: '演出制作', description: '插入灯具中产生投影图案的金属/玻璃片' },
]

/**
 * 搜索术语
 */
export function searchTerms(query: string, category?: string): Term[] {
  const q = query.toLowerCase()
  return LIGHTING_TERMS.filter(term => {
    if (category && term.category !== category) return false
    return (
      term.chinese.toLowerCase().includes(q) ||
      term.english.toLowerCase().includes(q) ||
      (term.abbreviation?.toLowerCase().includes(q) ?? false) ||
      (term.description?.toLowerCase().includes(q) ?? false)
    )
  })
}

/** 获取所有分类 */
export function getTermCategories(): string[] {
  return [...new Set(LIGHTING_TERMS.map(t => t.category))]
}

// ─── Adapter exports for TermsScreen ────────────────────────────────────────

export interface LightingTerm {
  cn: string
  en: string
  abbr?: string
  category?: string
  desc?: string
}

export const MA_TERMS: LightingTerm[] = LIGHTING_TERMS.map(t => ({
  cn: t.chinese,
  en: t.english,
  abbr: t.abbreviation,
  category: t.category,
  desc: t.description,
}))
