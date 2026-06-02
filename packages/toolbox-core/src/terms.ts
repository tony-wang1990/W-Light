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
  { id: 'p018', chinese: '灯光总控', english: 'Lighting Supervisor', category: '演出制作' },
  { id: 'p019', chinese: '主光', english: 'Key Light', category: '演出制作', description: '塑造主体亮度和方向的主要光源' },
  { id: 'p020', chinese: '辅助光', english: 'Fill Light', category: '演出制作', description: '降低阴影对比的辅助照明' },
  { id: 'p021', chinese: '轮廓光', english: 'Rim Light / Kicker', category: '演出制作' },
  { id: 'p022', chinese: '脚光', english: 'Footlight', category: '演出制作' },
  { id: 'p023', chinese: '烟雾机', english: 'Fog Machine', category: '演出制作' },
  { id: 'p024', chinese: '薄雾机', english: 'Haze Machine', category: '演出制作' },
  { id: 'p025', chinese: '安全绳', english: 'Safety Cable', category: '演出制作', description: '灯具吊挂的二次安全保护' },
  { id: 'p026', chinese: '吊点', english: 'Rigging Point', category: '演出制作' },
  { id: 'p027', chinese: '配重', english: 'Counterweight', category: '演出制作' },
  // ── 控台操作补充 ─────────────────────────────────────────────────────────
  { id: 'c013', chinese: '程序器', english: 'Programmer', category: '控台', description: '控台中暂存当前选择和参数编辑的工作区' },
  { id: 'c014', chinese: '盲编', english: 'Blind Programming', abbreviation: 'Blind', category: '控台', description: '不影响舞台输出的离线编辑状态' },
  { id: 'c015', chinese: '预览', english: 'Preview', category: '控台', description: '在不直接改变现场的情况下查看 Cue 或序列' },
  { id: 'c016', chinese: '高亮', english: 'Highlight', category: '控台', description: '让选中灯具以明显状态输出，便于现场找灯' },
  { id: 'c017', chinese: '停驻', english: 'Park', category: '控台', description: '锁定灯具或参数输出' },
  { id: 'c018', chinese: '解除停驻', english: 'Unpark', category: '控台' },
  { id: 'c019', chinese: '克隆', english: 'Clone', category: '控台', description: '将一组灯具的编程数据迁移到另一组灯具' },
  { id: 'c020', chinese: '敲除', english: 'Knockout', category: '控台', description: '从 Programmer 中移除指定参数' },
  { id: 'c021', chinese: '世界', english: 'World', category: '控台', description: '限制可操作灯具范围的视图或权限集合' },
  { id: 'c022', chinese: '外观', english: 'Appearance', category: '控台', description: '控台对象的颜色、图标或显示样式' },
  { id: 'c023', chinese: '布局视图', english: 'Layout View', category: '控台', description: '以平面图方式组织灯具或对象的操作视图' },
  { id: 'c024', chinese: '选择网格', english: 'Selection Grid', category: '控台', description: '灯具选择的二维排列关系，影响效果方向和分组' },
  { id: 'c025', chinese: 'MA技巧', english: 'MAtricks', category: '控台', description: 'MA 控台中用于选择、分组、镜像和排列的编程辅助工具' },
  // ── 信号与网络补充 ───────────────────────────────────────────────────────
  { id: 's011', chinese: 'RDM远程设备管理', english: 'Remote Device Management', abbreviation: 'RDM', category: '信号协议', description: '通过DMX线路双向读取或设置设备信息' },
  { id: 's012', chinese: '终结器', english: 'Terminator', category: '信号协议', description: 'DMX链路末端常用120Ω终端电阻' },
  { id: 's013', chinese: '光电隔离器', english: 'Optical Isolator', category: '信号协议', description: '隔离DMX或网络信号，减少故障扩散' },
  { id: 's014', chinese: '节点', english: 'Node', category: '信号协议', description: 'Art-Net/sACN 与 DMX 之间转换的网络设备' },
  { id: 's015', chinese: '交换机', english: 'Network Switch', category: '信号协议' },
  { id: 's016', chinese: '子网', english: 'Subnet', category: '信号协议' },
  { id: 's017', chinese: '单播', english: 'Unicast', category: '信号协议' },
  { id: 's018', chinese: '广播', english: 'Broadcast', category: '信号协议' },
  { id: 's019', chinese: '组播', english: 'Multicast', category: '信号协议' },
  { id: 's020', chinese: '会话', english: 'Session', category: '信号协议', description: '多控台或节点协同工作的网络连接状态' },
  // ── 光学与色彩补充 ───────────────────────────────────────────────────────
  { id: 'o011', chinese: '色调', english: 'Hue', category: '光学参数' },
  { id: 'o012', chinese: '饱和度', english: 'Saturation', category: '光学参数' },
  { id: 'o013', chinese: '明度', english: 'Value / Brightness', category: '光学参数' },
  { id: 'o014', chinese: '色域', english: 'Color Gamut', category: '光学参数' },
  { id: 'o015', chinese: '色偏', english: 'Tint / Green-Magenta Shift', category: '光学参数' },
  { id: 'o016', chinese: '半峰角', english: 'Half Peak Angle', category: '光学参数' },
  { id: 'o017', chinese: '光效', english: 'Luminous Efficacy', category: '光学参数', description: '单位功率产生的光通量，单位 lm/W' },
  { id: 'o018', chinese: '眩光', english: 'Glare', category: '光学参数' },
  { id: 'o019', chinese: '维护系数', english: 'Maintenance Factor', abbreviation: 'MF', category: '光学参数' },
  { id: 'o020', chinese: '显色性', english: 'Color Rendering', category: '光学参数' },
  // ── 电气与运维补充 ───────────────────────────────────────────────────────
  { id: 'e001', chinese: '断路器', english: 'Circuit Breaker', abbreviation: 'MCB', category: '电气运维' },
  { id: 'e002', chinese: '漏电保护器', english: 'Residual Current Device', abbreviation: 'RCD / RCCB', category: '电气运维' },
  { id: 'e003', chinese: '接地', english: 'Grounding / Earthing', category: '电气运维' },
  { id: 'e004', chinese: '零线', english: 'Neutral Wire', category: '电气运维' },
  { id: 'e005', chinese: '火线', english: 'Live Wire', category: '电气运维' },
  { id: 'e006', chinese: '相线', english: 'Phase Line', category: '电气运维' },
  { id: 'e007', chinese: '压降', english: 'Voltage Drop', category: '电气运维' },
  { id: 'e008', chinese: '浪涌', english: 'Surge', category: '电气运维' },
  { id: 'e009', chinese: '谐波', english: 'Harmonics', category: '电气运维' },
  { id: 'e010', chinese: '功率因数', english: 'Power Factor', abbreviation: 'PF', category: '电气运维' },
  { id: 'e011', chinese: '额定电流', english: 'Rated Current', category: '电气运维' },
  { id: 'e012', chinese: '安全负载', english: 'Safe Load', category: '电气运维' },
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
