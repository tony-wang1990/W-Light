import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  Clock3,
  Cpu,
  Library,
  Lightbulb,
  Palette,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  calculateDmxAddresses,
  calcBeamAngle,
  calcSpotSize,
  calcTotalPower,
  calculateLux,
  FIXTURE_PRESETS,
  POWER_REFERENCES,
} from '@lightops/toolbox-core';
import styles from './Toolbox.module.css';

const TOOLS = [
  { id: 'bpm', label: 'BPM 测速', icon: Activity },
  { id: 'dmx', label: 'DMX 地址', icon: Cpu },
  { id: 'power', label: '功率负荷', icon: Zap },
  { id: 'beam', label: '光束角', icon: SlidersHorizontal },
  { id: 'lux', label: '照度计算', icon: Lightbulb },
  { id: 'color', label: 'RGB/色温', icon: Palette },
  { id: 'diagnosis', label: '故障诊断', icon: ShieldAlert },
  { id: 'macro', label: 'MA 宏命令', icon: BookOpen },
  { id: 'terms', label: '行业术语', icon: Search },
  { id: 'ltc', label: 'LTC 时码', icon: Clock3 },
  { id: 'fixture', label: '灯库制作', icon: Library },
  { id: 'theory', label: '灯位理论', icon: Sparkles },
] as const;

type ToolId = typeof TOOLS[number]['id'];

const MACRO_REFERENCES = [
  { category: '基础操作', name: '清空选择', syntax: 'ClearAll', desc: '清空当前选择和 Programmer。' },
  { category: '灯具选择', name: '选择范围', syntax: 'Fixture 1 Thru 20', desc: '选择指定编号范围内灯具。' },
  { category: 'Cue', name: '存储 Cue', syntax: 'Store Cue 1 /Merge', desc: '将当前状态写入或合并到 Cue。' },
  { category: '执行器', name: '分配序列', syntax: 'Assign Sequence 1 At Executor 1.201', desc: '将序列分配到执行器。' },
  { category: '现场', name: '高亮找灯', syntax: 'Highlight On / Highlight Off', desc: '让选中灯具明显输出，便于现场定位。' },
  { category: '维护', name: '停驻参数', syntax: 'Fixture 1 Attribute "Dimmer" Park', desc: '锁定某个灯具或参数输出。' },
  { category: '数据迁移', name: '克隆灯具', syntax: 'Clone Fixture 1 Thru 10 At Fixture 101 Thru 110', desc: '把灯具编程数据迁移到新灯具。' },
  { category: '文件', name: '保存演出', syntax: 'SaveShow "Backup_20260606"', desc: '保存或另存当前 show 文件。' },
];

const TERMS = [
  ['摇头光束灯', 'Moving Head Beam', '发出窄角度光束的摇头灯。'],
  ['洗墙灯', 'Wash Light', '用于大面积铺光和均匀染色。'],
  ['DMX Universe', 'DMX Universe', '一组 512 通道 DMX 控制空间。'],
  ['RDM', 'Remote Device Management', '通过 DMX 线路双向管理设备。'],
  ['Art-Net', 'Art-Net', '基于以太网传输 DMX 的协议。'],
  ['sACN', 'Streaming ACN / E1.31', '以太网灯光控制协议。'],
  ['照度', 'Illuminance / Lux', '单位面积接收到的光通量。'],
  ['色温', 'Color Temperature / CCT', '用 K 表示的光色冷暖。'],
  ['显色指数', 'CRI / Ra', '光源还原物体颜色的能力。'],
  ['安全绳', 'Safety Cable', '灯具吊挂的二次安全保护。'],
];

const DIAGNOSIS = [
  {
    name: '灯具不亮',
    risk: '中高',
    steps: ['确认回路空开和供电电压', '检查 PowerCON/电源线接触', '查看灯具屏幕错误代码', '手动测试 Dimmer/Shutter', '必要时更换光源或电源板'],
  },
  {
    name: '频闪/闪烁',
    risk: '中',
    steps: ['排除控台 Strobe 通道误触发', '测量回路电压是否波动', '检查 DMX 线和终端电阻', '单台频闪时检查光源驱动和内部接插件'],
  },
  {
    name: '不受控',
    risk: '中',
    steps: ['核对 DMX 地址和通道模式', '检查 Universe 输出和节点配置', '替换 DMX 信号线', '链路末端加 120Ω 终端', '确认灯库 Profile 是否匹配'],
  },
  {
    name: '漏电/跳闸',
    risk: '高',
    steps: ['立即断电并隔离区域', '用兆欧表检查绝缘', '检查线缆外皮和接地', '分段接入定位故障设备', '由持证电工复核后恢复'],
  },
];

const PALETTES = [
  { name: '水秀冷蓝', rgb: [38, 156, 255], cct: 8000 },
  { name: '古建暖金', rgb: [255, 178, 84], cct: 3000 },
  { name: '森林青绿', rgb: [46, 204, 113], cct: 5200 },
  { name: '节庆玫红', rgb: [255, 64, 129], cct: 4500 },
  { name: '月光白', rgb: [210, 228, 255], cct: 9000 },
];

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function toHex(value: number) {
  return clampNumber(value, 0, 255).toString(16).padStart(2, '0').toUpperCase();
}

function dmxDipSwitches(address: number) {
  const normalized = clampNumber(Math.floor(address), 1, 512);
  return Array.from({ length: 10 }, (_, index) => (normalized & (1 << index)) !== 0);
}

export default function Toolbox() {
  const [activeTool, setActiveTool] = useState<ToolId>('bpm');
  const [bpm, setBpm] = useState(0);
  const tapsRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dmxStart, setDmxStart] = useState(1);
  const [dmxChannels, setDmxChannels] = useState(16);
  const [dmxQuantity, setDmxQuantity] = useState(8);
  const [dmxName, setDmxName] = useState('Beam 330W');

  const [powerW, setPowerW] = useState(330);
  const [powerQuantity, setPowerQuantity] = useState(12);
  const [powerVoltage, setPowerVoltage] = useState(220);
  const [powerBreaker, setPowerBreaker] = useState(32);
  const [powerPhase, setPowerPhase] = useState<'single' | 'three'>('single');

  const [beamMode, setBeamMode] = useState<'angle' | 'spot'>('angle');
  const [beamDistance, setBeamDistance] = useState(18);
  const [spotDiameter, setSpotDiameter] = useState(4);
  const [knownAngle, setKnownAngle] = useState(12);

  const [lumens, setLumens] = useState(12000);
  const [luxDistance, setLuxDistance] = useState(12);
  const [luxBeamAngle, setLuxBeamAngle] = useState(25);

  const [rgb, setRgb] = useState({ r: 38, g: 156, b: 255 });
  const [cct, setCct] = useState(8000);
  const [macroQuery, setMacroQuery] = useState('');
  const [termQuery, setTermQuery] = useState('');

  const [ltc, setLtc] = useState({ hour: 1, minute: 0, second: 0, frame: 0, fps: 25, duration: 60 });
  const [fixture, setFixture] = useState({ brand: 'Custom', model: 'Beam 330W', mode: 'Standard', channels: 16 });

  useEffect(() => () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  }, []);

  const handleTap = () => {
    const now = Date.now();
    if (tapsRef.current.length > 0 && now - tapsRef.current[tapsRef.current.length - 1] > 2000) {
      tapsRef.current = [];
    }
    tapsRef.current.push(now);
    if (tapsRef.current.length > 8) tapsRef.current.shift();

    if (tapsRef.current.length >= 2) {
      const intervals = tapsRef.current.slice(1).map((tap, index) => tap - tapsRef.current[index]);
      const avgInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      setBpm(Math.round(60000 / avgInterval));
    }

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapsRef.current = [];
    }, 3000);
  };

  const dmxResult = useMemo(() => calculateDmxAddresses([{
    id: 'web-fixture',
    name: dmxName || 'Fixture',
    channels: dmxChannels,
    quantity: dmxQuantity,
  }], dmxStart), [dmxChannels, dmxName, dmxQuantity, dmxStart]);

  const powerResult = useMemo(() => calcTotalPower([{
    id: 'power-fixture',
    name: 'Fixture',
    quantity: powerQuantity,
    powerW,
  }], powerVoltage, 0.8, 0.85, powerPhase, powerBreaker), [powerBreaker, powerPhase, powerQuantity, powerVoltage, powerW]);

  const beamResult = useMemo(() => {
    try {
      return beamMode === 'angle'
        ? calcBeamAngle(beamDistance, spotDiameter)
        : calcSpotSize(beamDistance, knownAngle);
    } catch {
      return null;
    }
  }, [beamDistance, beamMode, knownAngle, spotDiameter]);

  const luxValue = useMemo(() => calculateLux(lumens, luxDistance, luxBeamAngle), [lumens, luxBeamAngle, luxDistance]);
  const hexColor = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  const macroResults = MACRO_REFERENCES.filter(item => `${item.category} ${item.name} ${item.syntax} ${item.desc}`.toLowerCase().includes(macroQuery.toLowerCase())).slice(0, 8);
  const termResults = TERMS.filter(item => item.join(' ').toLowerCase().includes(termQuery.toLowerCase())).slice(0, 8);
  const totalFrames = ((ltc.hour * 3600 + ltc.minute * 60 + ltc.second) * ltc.fps) + ltc.frame;
  const fixtureExport = JSON.stringify({
    manufacturer: fixture.brand,
    model: fixture.model,
    mode: fixture.mode,
    protocol: 'DMX512',
    channels: Array.from({ length: fixture.channels }, (_, index) => ({
      channel: index + 1,
      attribute: index === 0 ? 'Dimmer' : index === 1 ? 'Shutter' : index === 2 ? 'Pan' : index === 3 ? 'Tilt' : `Attribute ${index + 1}`,
      defaultValue: 0,
    })),
  }, null, 2);

  const renderTool = () => {
    switch (activeTool) {
      case 'bpm':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Activity} title="BPM 测速打拍" desc="现场音乐、喷泉、水秀和灯光追节奏时快速估算 BPM。" />
            <div className={styles.bpmLayout}>
              <div className={styles.bpmDisplay}>
                <strong>{bpm || '---'}</strong>
                <span>BPM</span>
                {bpm > 0 && <em>{Math.round(60000 / bpm)} ms / beat · 半速 {Math.round(bpm / 2)} · 双速 {bpm * 2}</em>}
              </div>
              <button className={styles.tapBtn} onClick={handleTap}>TAP</button>
              <button className={styles.secondaryBtn} onClick={() => { tapsRef.current = []; setBpm(0); }}>重置</button>
            </div>
          </section>
        );
      case 'dmx':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Cpu} title="DMX 地址码计算" desc="支持多台灯具连续地址展开、Universe 统计和拨码开关。" />
            <div className={styles.formGrid}>
              <Field label="灯具名称"><input value={dmxName} onChange={event => setDmxName(event.target.value)} /></Field>
              <Field label="起始地址"><input type="number" min={1} max={512} value={dmxStart} onChange={event => setDmxStart(Number(event.target.value))} /></Field>
              <Field label="通道数"><input type="number" min={1} max={512} value={dmxChannels} onChange={event => setDmxChannels(Number(event.target.value))} /></Field>
              <Field label="数量"><input type="number" min={1} value={dmxQuantity} onChange={event => setDmxQuantity(Number(event.target.value))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="总通道" value={`${dmxResult.totalChannels} ch`} />
              <Result label="Universe" value={`${dmxResult.universesNeeded}`} tone={dmxResult.hasOverflow ? 'warn' : 'ok'} />
              <Result label="冲突" value={dmxResult.hasConflicts ? '有' : '无'} tone={dmxResult.hasConflicts ? 'danger' : 'ok'} />
            </div>
            <div className={styles.dipSwitches}>
              {dmxDipSwitches(dmxStart).map((on, index) => (
                <div className={styles.dipSwitch} key={index}>
                  <div className={`${styles.dipToggle} ${on ? styles.on : ''}`}><div /></div>
                  <span>{index + 1}</span>
                </div>
              ))}
            </div>
            <div className={styles.tableList}>
              {dmxResult.assignments.slice(0, 12).map(item => (
                <div className={styles.row} key={item.id}>
                  <span>{item.label}</span>
                  <strong>U{item.universe} · {item.startAddress}-{item.endAddress}</strong>
                </div>
              ))}
            </div>
          </section>
        );
      case 'power':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Zap} title="功率/负荷计算" desc="估算总功率、电流、空开负载和是否超安全负载。" />
            <div className={styles.quickList}>
              {POWER_REFERENCES.slice(0, 6).map(item => (
                <button key={item.name} onClick={() => setPowerW(item.powerW)}>{item.name} · {item.powerW}W</button>
              ))}
            </div>
            <div className={styles.formGrid}>
              <Field label="单台功率 W"><input type="number" value={powerW} onChange={event => setPowerW(Number(event.target.value))} /></Field>
              <Field label="数量"><input type="number" value={powerQuantity} onChange={event => setPowerQuantity(Number(event.target.value))} /></Field>
              <Field label="电压"><input type="number" value={powerVoltage} onChange={event => setPowerVoltage(Number(event.target.value))} /></Field>
              <Field label="空开 A"><input type="number" value={powerBreaker} onChange={event => setPowerBreaker(Number(event.target.value))} /></Field>
              <Field label="供电类型">
                <select value={powerPhase} onChange={event => setPowerPhase(event.target.value as 'single' | 'three')}>
                  <option value="single">单相</option>
                  <option value="three">三相</option>
                </select>
              </Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="总功率" value={`${powerResult.totalPowerKW} kW`} />
              <Result label="电流" value={`${powerResult.currentA} A`} />
              <Result label="建议空开" value={`${powerResult.recommendedBreakerA} A`} />
              <Result label="空开负载" value={`${powerResult.breakerLoadPercent}%`} tone={powerResult.isOverloaded ? 'danger' : 'ok'} />
            </div>
          </section>
        );
      case 'beam':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={SlidersHorizontal} title="光束角/光斑计算" desc="按投射距离、光斑直径或已知角度互推布光参数。" />
            <div className={styles.segmented}>
              <button className={beamMode === 'angle' ? styles.active : ''} onClick={() => setBeamMode('angle')}>算角度</button>
              <button className={beamMode === 'spot' ? styles.active : ''} onClick={() => setBeamMode('spot')}>算光斑</button>
            </div>
            <div className={styles.formGrid}>
              <Field label="投射距离 m"><input type="number" value={beamDistance} onChange={event => setBeamDistance(Number(event.target.value))} /></Field>
              {beamMode === 'angle' ? (
                <Field label="光斑直径 m"><input type="number" value={spotDiameter} onChange={event => setSpotDiameter(Number(event.target.value))} /></Field>
              ) : (
                <Field label="光束角 °"><input type="number" value={knownAngle} onChange={event => setKnownAngle(Number(event.target.value))} /></Field>
              )}
            </div>
            <div className={styles.resultGrid}>
              {beamMode === 'angle' && beamResult && 'beamAngle' in beamResult && (
                <>
                  <Result label="光束角" value={`${beamResult.beamAngle}°`} />
                  <Result label="半角" value={`${beamResult.halfAngle}°`} />
                  <Result label="光斑面积" value={`${beamResult.spotArea} m²`} />
                </>
              )}
              {beamMode === 'spot' && beamResult && 'diameter' in beamResult && (
                <>
                  <Result label="光斑直径" value={`${beamResult.diameter} m`} />
                  <Result label="半径" value={`${beamResult.radius} m`} />
                  <Result label="面积" value={`${beamResult.area} m²`} />
                </>
              )}
            </div>
          </section>
        );
      case 'lux':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Lightbulb} title="环境光照度计算" desc="按光通量、距离和光束角估算目标位置照度。" />
            <div className={styles.formGrid}>
              <Field label="光通量 lm"><input type="number" value={lumens} onChange={event => setLumens(Number(event.target.value))} /></Field>
              <Field label="距离 m"><input type="number" value={luxDistance} onChange={event => setLuxDistance(Number(event.target.value))} /></Field>
              <Field label="光束角 °"><input type="number" value={luxBeamAngle} onChange={event => setLuxBeamAngle(Number(event.target.value))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="估算照度" value={`${luxValue} lx`} tone={luxValue < 100 ? 'warn' : 'ok'} />
              <Result label="维护照度" value={`${Math.round(luxValue * 0.8)} lx`} />
              <Result label="参考" value={luxValue >= 800 ? '舞台主区' : luxValue >= 300 ? '展陈重点' : '景观/通道'} />
            </div>
          </section>
        );
      case 'color':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Palette} title="RGB 调色/色温配色" desc="现场快速记录 RGB、HEX、色温和文旅常用场景配色。" />
            <div className={styles.colorPreview} style={{ background: hexColor }}>
              <strong>{hexColor}</strong>
              <span>RGB({rgb.r}, {rgb.g}, {rgb.b}) · {cct}K</span>
            </div>
            <div className={styles.formGrid}>
              {(['r', 'g', 'b'] as const).map(channel => (
                <Field key={channel} label={channel.toUpperCase()}>
                  <input type="range" min={0} max={255} value={rgb[channel]} onChange={event => setRgb(prev => ({ ...prev, [channel]: Number(event.target.value) }))} />
                </Field>
              ))}
              <Field label="色温 K"><input type="range" min={2000} max={10000} step={100} value={cct} onChange={event => setCct(Number(event.target.value))} /></Field>
            </div>
            <div className={styles.paletteGrid}>
              {PALETTES.map(item => (
                <button key={item.name} onClick={() => { setRgb({ r: item.rgb[0], g: item.rgb[1], b: item.rgb[2] }); setCct(item.cct); }}>
                  <span style={{ background: `rgb(${item.rgb.join(',')})` }} />
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        );
      case 'diagnosis':
        return <ReferencePanel icon={ShieldAlert} title="故障分析流程" desc="常见故障的安全优先排查路径。" items={DIAGNOSIS.map(item => ({ title: `${item.name} · 风险 ${item.risk}`, body: item.steps.join(' → ') }))} />;
      case 'macro':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={BookOpen} title="MA 宏命令参考" desc="常用 MA2/MA3 命令、语法和使用场景。" />
            <SearchBox value={macroQuery} onChange={setMacroQuery} placeholder="搜索 Cue、Executor、Park、Clone..." />
            <div className={styles.tableList}>
              {macroResults.map(item => (
                <div className={styles.rowLarge} key={item.syntax}>
                  <span>{item.category} · {item.name}</span>
                  <code>{item.syntax}</code>
                  <em>{item.desc}</em>
                </div>
              ))}
            </div>
          </section>
        );
      case 'terms':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Search} title="行业术语翻译" desc="灯光行业中英对照术语库，支持模糊搜索。" />
            <SearchBox value={termQuery} onChange={setTermQuery} placeholder="搜索 DMX、照度、控台、灯位..." />
            <div className={styles.tableList}>
              {termResults.map(item => (
                <div className={styles.rowLarge} key={item[0]}>
                  <span>{item[0]}</span>
                  <code>{item[1]}</code>
                  <em>{item[2]}</em>
                </div>
              ))}
            </div>
          </section>
        );
      case 'ltc':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Clock3} title="LTC 时码工具" desc="SMPTE 时码换算、帧率估算和立体声路由参考。" />
            <div className={styles.formGrid}>
              <Field label="时"><input type="number" value={ltc.hour} onChange={event => setLtc(prev => ({ ...prev, hour: Number(event.target.value) }))} /></Field>
              <Field label="分"><input type="number" value={ltc.minute} onChange={event => setLtc(prev => ({ ...prev, minute: Number(event.target.value) }))} /></Field>
              <Field label="秒"><input type="number" value={ltc.second} onChange={event => setLtc(prev => ({ ...prev, second: Number(event.target.value) }))} /></Field>
              <Field label="帧"><input type="number" value={ltc.frame} onChange={event => setLtc(prev => ({ ...prev, frame: Number(event.target.value) }))} /></Field>
              <Field label="帧率">
                <select value={ltc.fps} onChange={event => setLtc(prev => ({ ...prev, fps: Number(event.target.value) }))}>
                  <option value={24}>24</option>
                  <option value={25}>25</option>
                  <option value={30}>30</option>
                </select>
              </Field>
              <Field label="导出时长 s"><input type="number" value={ltc.duration} onChange={event => setLtc(prev => ({ ...prev, duration: Number(event.target.value) }))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="总帧数" value={`${totalFrames}`} />
              <Result label="时码" value={`${String(ltc.hour).padStart(2, '0')}:${String(ltc.minute).padStart(2, '0')}:${String(ltc.second).padStart(2, '0')}:${String(ltc.frame).padStart(2, '0')}`} />
              <Result label="路由" value="L: LTC / R: Click" />
            </div>
          </section>
        );
      case 'fixture':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Library} title="灯库制作" desc="生成基础 fixture profile JSON，可作为老虎 D4、金刚等控台灯库整理草稿。" />
            <div className={styles.quickList}>
              {FIXTURE_PRESETS.slice(0, 8).map(item => (
                <button key={item.model} onClick={() => setFixture(prev => ({ ...prev, model: item.model, channels: item.channels }))}>{item.model} · {item.channels}ch</button>
              ))}
            </div>
            <div className={styles.formGrid}>
              <Field label="品牌"><input value={fixture.brand} onChange={event => setFixture(prev => ({ ...prev, brand: event.target.value }))} /></Field>
              <Field label="型号"><input value={fixture.model} onChange={event => setFixture(prev => ({ ...prev, model: event.target.value }))} /></Field>
              <Field label="模式"><input value={fixture.mode} onChange={event => setFixture(prev => ({ ...prev, mode: event.target.value }))} /></Field>
              <Field label="通道数"><input type="number" min={1} max={512} value={fixture.channels} onChange={event => setFixture(prev => ({ ...prev, channels: Number(event.target.value) }))} /></Field>
            </div>
            <textarea className={styles.exportArea} readOnly value={fixtureExport} />
          </section>
        );
      case 'theory':
        return <ReferencePanel icon={Sparkles} title="灯位与理论速查" desc="现场布光常用灯位、角度和色彩混合基础。" items={[
          { title: '面光 Front Light', body: '常用 30°-45° 入射角，保证主体面部可见并控制阴影。' },
          { title: '侧光 Side Light', body: '强化人物轮廓和动作质感，舞蹈/实景演出常用于身体塑形。' },
          { title: '逆光 Back Light', body: '把主体从背景中分离，雾效环境中能形成层次。' },
          { title: '顶光 Top Light', body: '用于空间氛围和特殊造型，注意避免面部阴影过重。' },
          { title: '色彩混合', body: 'RGB 适合 LED 加色混合，CMY 常见于摇头灯减色系统。' },
        ]} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>专业工具箱</h1>
        <p className={styles.pageSubtitle}>Web、桌面端和手机端共用同一套灯光现场计算逻辑，核心工具支持离线使用。</p>
      </div>

      <div className={styles.toolGrid}>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.toolButtonActive : ''}`}
            onClick={() => setActiveTool(tool.id)}
          >
            <tool.icon size={18} />
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      {renderTool()}
    </div>
  );
}

function ToolHeader({ icon: Icon, title, desc }: { icon: typeof Activity; title: string; desc: string }) {
  return (
    <div className={styles.cardHeader}>
      <div className={styles.iconBox}><Icon size={20} /></div>
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Result({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className={`${styles.resultCard} ${tone ? styles[tone] : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className={styles.searchBox}>
      <Search size={16} />
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ReferencePanel({ icon, title, desc, items }: { icon: typeof Activity; title: string; desc: string; items: Array<{ title: string; body: string }> }) {
  return (
    <section className={styles.panel}>
      <ToolHeader icon={icon} title={title} desc={desc} />
      <div className={styles.referenceGrid}>
        {items.map(item => (
          <div className={styles.referenceItem} key={item.title}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
