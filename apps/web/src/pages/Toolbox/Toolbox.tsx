import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  Clock3,
  Copy,
  Cpu,
  Download,
  Library,
  Lightbulb,
  Palette,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  calculateDmxAddresses,
  calcBeamAngle,
  calcSpotSize,
  calcTotalPower,
  calculateLux,
  DIAGNOSIS_NODES,
  FAULT_TYPE_ROOTS,
  FIXTURE_PRESETS,
  generateLtcWav,
  LIGHTING_TERMS,
  LTC_ROUTING_PRESETS,
  MA_MACRO_COMMANDS,
  POWER_REFERENCES,
  TIMECODE_FRAME_RATES,
  calculateTimecodeRange,
  type TimecodeFrameRate,
} from '@lightops/toolbox-core';
import styles from './Toolbox.module.css';

const TOOLS = [
  { id: 'bpm', label: 'BPM 测速', icon: Activity },
  { id: 'dmx', label: 'DMX 多灯具链', icon: Cpu },
  { id: 'power', label: '功率负荷', icon: Zap },
  { id: 'beam', label: '光束角', icon: SlidersHorizontal },
  { id: 'lux', label: '照度计算', icon: Lightbulb },
  { id: 'color', label: 'RGB/色温', icon: Palette },
  { id: 'diagnosis', label: '故障诊断', icon: ShieldAlert },
  { id: 'macro', label: 'MA 宏命令', icon: BookOpen },
  { id: 'terms', label: '行业术语', icon: Search },
  { id: 'ltc', label: 'LTC 时码', icon: Clock3 },
  { id: 'fixture', label: '灯库制作', icon: Library },
  { id: 'layout', label: '灯位设计', icon: Sparkles },
  { id: 'theory', label: '灯光理论', icon: BookOpen },
] as const;

type ToolId = typeof TOOLS[number]['id'];

interface DmxFixtureRow {
  id: string;
  name: string;
  channels: number;
  quantity: number;
  startAddress: string;
  universe: string;
}

interface DiagnosisConclusion {
  problem: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  solution: string[];
  estimatedTime: string;
  needsExpert?: boolean;
}

const PALETTES = [
  { name: '水秀冷蓝', rgb: [38, 156, 255], cct: 8000 },
  { name: '古建暖金', rgb: [255, 178, 84], cct: 3000 },
  { name: '森林青绿', rgb: [46, 204, 113], cct: 5200 },
  { name: '节庆玫红', rgb: [255, 64, 129], cct: 4500 },
  { name: '月光白', rgb: [210, 228, 255], cct: 9000 },
];

const LAYOUT_PRESETS = [
  { name: '面光', throwM: 14, trimM: 7, targetM: 1.6, beamAngle: 25, note: '人物正面补光，避免压平层次。' },
  { name: '侧光', throwM: 10, trimM: 5, targetM: 1.4, beamAngle: 36, note: '强化身体轮廓，适合演艺和巡游点位。' },
  { name: '逆光', throwM: 12, trimM: 6, targetM: 1.7, beamAngle: 20, note: '拉开主体与背景，注意眩光控制。' },
  { name: '景观洗墙', throwM: 6, trimM: 3.5, targetM: 1, beamAngle: 50, note: '大面积铺光，关注均匀度和暗区。' },
];

const DEFAULT_FIXTURE_ATTRIBUTES = [
  'Dimmer',
  'Shutter/Strobe',
  'Pan',
  'Pan Fine',
  'Tilt',
  'Tilt Fine',
  'Color Wheel',
  'Gobo Wheel',
  'Prism',
  'Focus',
  'Frost',
  'Zoom',
  'Control/Reset',
  'Speed',
  'Macro',
  'Reserved',
].join('\n');

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

function makeFixtureRow(index: number): DmxFixtureRow {
  return {
    id: `fixture-${Date.now()}-${index}`,
    name: index === 0 ? 'Beam 330W' : `Fixture ${index + 1}`,
    channels: index === 0 ? 16 : 18,
    quantity: index === 0 ? 8 : 4,
    startAddress: '',
    universe: '',
  };
}

function downloadHref(href: string, fileName: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  downloadHref(url, fileName);
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  if (!navigator.clipboard) {
    window.prompt('复制内容', text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

function severityText(severity: DiagnosisConclusion['severity']) {
  switch (severity) {
    case 'critical': return '紧急';
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return severity;
  }
}

export default function Toolbox() {
  const [activeTool, setActiveTool] = useState<ToolId>('bpm');
  const [bpm, setBpm] = useState(0);
  const tapsRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dmxStart, setDmxStart] = useState(1);
  const [dmxFixtures, setDmxFixtures] = useState<DmxFixtureRow[]>([makeFixtureRow(0)]);

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
  const [macroCategory, setMacroCategory] = useState('全部');
  const [macroVersion, setMacroVersion] = useState<'全部' | 'MA2' | 'MA3' | 'BOTH'>('全部');
  const [termQuery, setTermQuery] = useState('');
  const [termCategory, setTermCategory] = useState('全部');

  const diagnosisTypes = useMemo(() => Object.keys(FAULT_TYPE_ROOTS), []);
  const [diagnosisType, setDiagnosisType] = useState(diagnosisTypes[0] || '');
  const [diagnosisNodeId, setDiagnosisNodeId] = useState(diagnosisTypes[0] ? FAULT_TYPE_ROOTS[diagnosisTypes[0]] : '');
  const [diagnosisConclusion, setDiagnosisConclusion] = useState<DiagnosisConclusion | null>(null);

  const [ltc, setLtc] = useState({
    startTimecode: '01:00:00:00',
    fps: 25 as TimecodeFrameRate,
    duration: 30,
    sampleRate: 48000 as 44100 | 48000,
    routeIndex: 0,
    level: 0.72,
  });
  const [ltcMessage, setLtcMessage] = useState('');

  const [fixture, setFixture] = useState({ brand: 'Custom', model: 'Beam 330W', mode: 'Standard', channels: 16 });
  const [fixtureAttributes, setFixtureAttributes] = useState(DEFAULT_FIXTURE_ATTRIBUTES);
  const [layout, setLayout] = useState({ throwM: 12, trimM: 6, targetM: 1.6, beamAngle: 25, fixtureCount: 6, coverageWidth: 18 });

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

  const dmxResult = useMemo(() => calculateDmxAddresses(
    dmxFixtures.map((row) => ({
      id: row.id,
      name: row.name || 'Fixture',
      channels: row.channels,
      quantity: row.quantity,
      startAddress: row.startAddress ? Number(row.startAddress) : undefined,
      universe: row.universe ? Number(row.universe) : undefined,
    })),
    dmxStart,
  ), [dmxFixtures, dmxStart]);

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

  const macroCategories = useMemo(() => ['全部', ...Array.from(new Set(MA_MACRO_COMMANDS.map(item => item.category)))], []);
  const macroResults = useMemo(() => {
    const query = macroQuery.trim().toLowerCase();
    return MA_MACRO_COMMANDS
      .filter(item => macroCategory === '全部' || item.category === macroCategory)
      .filter(item => macroVersion === '全部' || item.version === macroVersion || item.version === 'BOTH')
      .filter(item => !query || `${item.category} ${item.name} ${item.syntax} ${item.description} ${item.example} ${item.tags.join(' ')}`.toLowerCase().includes(query))
      .slice(0, 40);
  }, [macroCategory, macroQuery, macroVersion]);

  const termCategories = useMemo(() => ['全部', ...Array.from(new Set(LIGHTING_TERMS.map(item => item.category)))], []);
  const termResults = useMemo(() => {
    const query = termQuery.trim().toLowerCase();
    return LIGHTING_TERMS
      .filter(item => termCategory === '全部' || item.category === termCategory)
      .filter(item => !query || `${item.chinese} ${item.english} ${item.abbreviation || ''} ${item.description || ''}`.toLowerCase().includes(query))
      .slice(0, 60);
  }, [termCategory, termQuery]);

  const currentDiagnosisNode = diagnosisNodeId ? DIAGNOSIS_NODES[diagnosisNodeId] : undefined;
  const activeRoute = LTC_ROUTING_PRESETS[ltc.routeIndex] || LTC_ROUTING_PRESETS[0];
  const timecodeRange = useMemo(() => {
    try {
      return calculateTimecodeRange(ltc.startTimecode, ltc.fps, ltc.duration);
    } catch {
      return null;
    }
  }, [ltc.duration, ltc.fps, ltc.startTimecode]);

  const layoutResult = useMemo(() => {
    const throwDistance = Math.max(layout.throwM, 0.1);
    const heightDiff = Math.max(layout.trimM - layout.targetM, 0.1);
    const tiltAngle = Math.atan(heightDiff / throwDistance) * 180 / Math.PI;
    const spot = calcSpotSize(throwDistance, clampNumber(layout.beamAngle, 1, 120));
    const count = Math.max(Math.round(layout.fixtureCount), 1);
    const coverageWidth = Math.max(layout.coverageWidth, 1);
    const spacingM = coverageWidth / count;
    const overlap = spot.diameter > 0 ? Math.round((1 - spacingM / spot.diameter) * 100) : 0;

    return {
      tiltAngle: Math.round(tiltAngle * 10) / 10,
      spotDiameter: spot.diameter,
      spotArea: spot.area,
      spacingM: Math.round(spacingM * 10) / 10,
      overlap,
    };
  }, [layout]);

  const fixtureProfile = useMemo(() => {
    const attributes = fixtureAttributes
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean);

    return {
      manufacturer: fixture.brand || 'Custom',
      model: fixture.model || 'Unnamed Fixture',
      mode: fixture.mode || 'Standard',
      protocol: 'DMX512',
      channels: Array.from({ length: clampNumber(Math.floor(fixture.channels), 1, 512) }, (_, index) => ({
        channel: index + 1,
        attribute: attributes[index] || `Attribute ${index + 1}`,
        defaultValue: 0,
        highlightValue: index === 0 ? 100 : 0,
        notes: '',
      })),
    };
  }, [fixture, fixtureAttributes]);

  const fixtureJson = JSON.stringify(fixtureProfile, null, 2);
  const fixtureCsv = [
    'Channel,Attribute,Default,Highlight,Notes',
    ...fixtureProfile.channels.map(channel => [
      channel.channel,
      `"${channel.attribute.replace(/"/g, '""')}"`,
      channel.defaultValue,
      channel.highlightValue,
      `"${channel.notes}"`,
    ].join(',')),
  ].join('\n');

  const updateDmxFixture = (id: string, patch: Partial<DmxFixtureRow>) => {
    setDmxFixtures(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addDmxFixture = () => {
    setDmxFixtures(prev => [...prev, makeFixtureRow(prev.length)]);
  };

  const removeDmxFixture = (id: string) => {
    setDmxFixtures(prev => (prev.length <= 1 ? prev : prev.filter(row => row.id !== id)));
  };

  const addPresetToDmx = (preset: typeof FIXTURE_PRESETS[number]) => {
    setDmxFixtures(prev => [
      ...prev,
      {
        id: `preset-${Date.now()}-${preset.model}`,
        name: preset.model,
        channels: preset.channels,
        quantity: 1,
        startAddress: '',
        universe: '',
      },
    ]);
  };

  const startDiagnosis = (type: string) => {
    setDiagnosisType(type);
    setDiagnosisNodeId(FAULT_TYPE_ROOTS[type]);
    setDiagnosisConclusion(null);
  };

  const generateLtc = () => {
    setLtcMessage('');
    try {
      const wav = generateLtcWav({
        startTimecode: ltc.startTimecode,
        frameRate: ltc.fps,
        durationSeconds: ltc.duration,
        sampleRate: ltc.sampleRate,
        leftChannel: activeRoute.left,
        rightChannel: activeRoute.right,
        level: ltc.level,
      });
      downloadHref(wav.dataUri, wav.fileName);
      setLtcMessage(wav.warnings.length ? wav.warnings.join('；') : `已生成 ${Math.round(wav.byteLength / 1024)} KB 立体声 WAV。`);
    } catch (err) {
      setLtcMessage(err instanceof Error ? err.message : 'LTC WAV 生成失败');
    }
  };

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
            <ToolHeader icon={Cpu} title="DMX 多灯具链地址计算" desc="支持多组灯具、手动 Universe/起始地址、冲突检测、512 通道溢出提醒和拨码开关参考。" />
            <div className={styles.formGrid}>
              <Field label="自动分配起始地址">
                <input type="number" min={1} max={512} value={dmxStart} onChange={event => setDmxStart(Number(event.target.value))} />
              </Field>
            </div>
            <div className={styles.quickList}>
              {FIXTURE_PRESETS.slice(0, 10).map(item => (
                <button key={item.model} onClick={() => addPresetToDmx(item)}>
                  <Plus size={14} /> {item.model} · {item.channels}ch
                </button>
              ))}
            </div>
            <div className={styles.fixtureRows}>
              {dmxFixtures.map((row, index) => (
                <div className={styles.fixtureRow} key={row.id}>
                  <Field label={`灯具组 ${index + 1}`}>
                    <input value={row.name} onChange={event => updateDmxFixture(row.id, { name: event.target.value })} />
                  </Field>
                  <Field label="通道数">
                    <input type="number" min={1} max={512} value={row.channels} onChange={event => updateDmxFixture(row.id, { channels: Number(event.target.value) })} />
                  </Field>
                  <Field label="数量">
                    <input type="number" min={1} value={row.quantity} onChange={event => updateDmxFixture(row.id, { quantity: Number(event.target.value) })} />
                  </Field>
                  <Field label="固定 Universe">
                    <input placeholder="自动" value={row.universe} onChange={event => updateDmxFixture(row.id, { universe: event.target.value })} />
                  </Field>
                  <Field label="固定起始地址">
                    <input placeholder="自动" value={row.startAddress} onChange={event => updateDmxFixture(row.id, { startAddress: event.target.value })} />
                  </Field>
                  <button className={styles.iconBtn} onClick={() => removeDmxFixture(row.id)} title="删除灯具组">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.inlineActions}>
              <button className={styles.secondaryBtn} onClick={addDmxFixture}><Plus size={16} /> 新增灯具组</button>
            </div>
            <div className={styles.resultGrid}>
              <Result label="总通道" value={`${dmxResult.totalChannels} ch`} />
              <Result label="Universe 数" value={`${dmxResult.universesNeeded}`} tone={dmxResult.hasOverflow ? 'warn' : 'ok'} />
              <Result label="地址冲突" value={dmxResult.hasConflicts ? '有' : '无'} tone={dmxResult.hasConflicts ? 'danger' : 'ok'} />
              <Result label="灯具实例" value={`${dmxResult.assignments.length}`} />
            </div>
            <div className={styles.dipSwitches}>
              {dmxDipSwitches(dmxStart).map((on, index) => (
                <div className={styles.dipSwitch} key={index}>
                  <div className={`${styles.dipToggle} ${on ? styles.on : ''}`}><div /></div>
                  <span>{index + 1}</span>
                </div>
              ))}
            </div>
            {dmxResult.warnings.length > 0 && (
              <div className={styles.warningList}>
                {dmxResult.warnings.map(warning => <div className={styles.warningItem} key={warning}>{warning}</div>)}
              </div>
            )}
            {dmxResult.conflicts.length > 0 && (
              <div className={styles.warningList}>
                {dmxResult.conflicts.map(conflict => (
                  <div className={styles.warningItem} key={`${conflict.fixtureA}-${conflict.fixtureB}-${conflict.addressStart}`}>
                    U{conflict.universe} 地址 {conflict.addressStart}-{conflict.addressEnd} 冲突：{conflict.fixtureA} / {conflict.fixtureB}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.tableList}>
              {dmxResult.universeUsage.map(item => (
                <div className={styles.row} key={item.universe}>
                  <span>Universe {item.universe}：{item.firstAddress}-{item.lastAddress}</span>
                  <strong>{item.usedChannels}/512 · {item.utilization}%</strong>
                </div>
              ))}
            </div>
            <div className={styles.tableList}>
              {dmxResult.assignments.slice(0, 80).map(item => (
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
            <ToolHeader icon={Zap} title="功率/负荷计算" desc="估算总功率、电流、空开负载和是否超过安全负载。" />
            <div className={styles.quickList}>
              {POWER_REFERENCES.slice(0, 8).map(item => (
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
                <Field label="光束角 deg"><input type="number" value={knownAngle} onChange={event => setKnownAngle(Number(event.target.value))} /></Field>
              )}
            </div>
            <div className={styles.resultGrid}>
              {beamMode === 'angle' && beamResult && 'beamAngle' in beamResult && (
                <>
                  <Result label="光束角" value={`${beamResult.beamAngle} deg`} />
                  <Result label="半角" value={`${beamResult.halfAngle} deg`} />
                  <Result label="光斑面积" value={`${beamResult.spotArea} m2`} />
                </>
              )}
              {beamMode === 'spot' && beamResult && 'diameter' in beamResult && (
                <>
                  <Result label="光斑直径" value={`${beamResult.diameter} m`} />
                  <Result label="半径" value={`${beamResult.radius} m`} />
                  <Result label="面积" value={`${beamResult.area} m2`} />
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
              <Field label="光束角 deg"><input type="number" value={luxBeamAngle} onChange={event => setLuxBeamAngle(Number(event.target.value))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="估算照度" value={`${luxValue} lx`} tone={luxValue < 100 ? 'warn' : 'ok'} />
              <Result label="维护照度" value={`${Math.round(luxValue * 0.8)} lx`} />
              <Result label="参考场景" value={luxValue >= 800 ? '舞台主区' : luxValue >= 300 ? '展陈重点' : '景观/通道'} />
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
        return (
          <section className={styles.panel}>
            <ToolHeader icon={ShieldAlert} title="故障诊断流程" desc="按不亮、频闪、不受控、漏电、物理损坏等场景逐步排查，并给出处理建议。" />
            <div className={styles.quickList}>
              {diagnosisTypes.map(type => (
                <button key={type} onClick={() => startDiagnosis(type)} className={type === diagnosisType ? styles.activePill : ''}>{type}</button>
              ))}
            </div>
            {currentDiagnosisNode && !diagnosisConclusion && (
              <div className={styles.rowLarge}>
                <span>{currentDiagnosisNode.question}</span>
                {currentDiagnosisNode.hint && <em>{currentDiagnosisNode.hint}</em>}
                <div className={styles.inlineActions}>
                  {currentDiagnosisNode.options.map(option => (
                    <button
                      className={styles.secondaryBtn}
                      key={option.label}
                      onClick={() => {
                        if (option.nextNodeId) setDiagnosisNodeId(option.nextNodeId);
                        if (option.conclusion) setDiagnosisConclusion(option.conclusion);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {diagnosisConclusion && (
              <div className={styles.rowLarge}>
                <span>诊断结论 · 风险 {severityText(diagnosisConclusion.severity)}</span>
                <code>{diagnosisConclusion.problem}</code>
                <em>预计处理时间：{diagnosisConclusion.estimatedTime}{diagnosisConclusion.needsExpert ? ' · 建议专业人员处理' : ''}</em>
                <ol className={styles.orderedList}>
                  {diagnosisConclusion.solution.map(step => <li key={step}>{step}</li>)}
                </ol>
                <div className={styles.inlineActions}>
                  <button className={styles.secondaryBtn} onClick={() => startDiagnosis(diagnosisType)}>重新诊断</button>
                </div>
              </div>
            )}
          </section>
        );

      case 'macro':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={BookOpen} title="MA 宏命令参考" desc="覆盖 grandMA2 / grandMA3 常用命令语法、示例、标签和使用场景，支持分类检索。" />
            <div className={styles.formGrid}>
              <SearchBox value={macroQuery} onChange={setMacroQuery} placeholder="搜索 Cue、Executor、Park、Clone、Fixture..." />
              <Field label="分类">
                <select value={macroCategory} onChange={event => setMacroCategory(event.target.value)}>
                  {macroCategories.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="控台版本">
                <select value={macroVersion} onChange={event => setMacroVersion(event.target.value as typeof macroVersion)}>
                  <option value="全部">全部</option>
                  <option value="MA2">MA2</option>
                  <option value="MA3">MA3</option>
                  <option value="BOTH">通用</option>
                </select>
              </Field>
            </div>
            <div className={styles.tableList}>
              {macroResults.map(item => (
                <div className={styles.rowLarge} key={item.id}>
                  <span>{item.category} · {item.name} · {item.version}</span>
                  <code>{item.syntax}</code>
                  <em>{item.description}</em>
                  <code>{item.example}</code>
                </div>
              ))}
            </div>
          </section>
        );

      case 'terms':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Search} title="行业术语翻译" desc="灯光行业中英对照术语库，覆盖设备、控台、协议、演出制作和运维。" />
            <div className={styles.formGrid}>
              <SearchBox value={termQuery} onChange={setTermQuery} placeholder="搜索 DMX、照度、控台、灯位、Art-Net..." />
              <Field label="分类">
                <select value={termCategory} onChange={event => setTermCategory(event.target.value)}>
                  {termCategories.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
            </div>
            <div className={styles.tableList}>
              {termResults.map(item => (
                <div className={styles.rowLarge} key={item.id}>
                  <span>{item.chinese} · {item.category}{item.abbreviation ? ` · ${item.abbreviation}` : ''}</span>
                  <code>{item.english}</code>
                  {item.description && <em>{item.description}</em>}
                </div>
              ))}
            </div>
          </section>
        );

      case 'ltc':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Clock3} title="LTC 时码生成" desc="SMPTE 时码换算、结束时码预估、立体声 LTC WAV 生成和声道路由参考。" />
            <div className={styles.formGrid}>
              <Field label="起始时码 HH:MM:SS:FF">
                <input value={ltc.startTimecode} onChange={event => setLtc(prev => ({ ...prev, startTimecode: event.target.value }))} />
              </Field>
              <Field label="帧率">
                <select value={String(ltc.fps)} onChange={event => setLtc(prev => ({ ...prev, fps: Number(event.target.value) as TimecodeFrameRate }))}>
                  {TIMECODE_FRAME_RATES.map(rate => <option key={rate} value={rate}>{rate} fps</option>)}
                </select>
              </Field>
              <Field label="导出时长 s">
                <input type="number" min={1} max={120} value={ltc.duration} onChange={event => setLtc(prev => ({ ...prev, duration: Number(event.target.value) }))} />
              </Field>
              <Field label="采样率">
                <select value={ltc.sampleRate} onChange={event => setLtc(prev => ({ ...prev, sampleRate: Number(event.target.value) as 44100 | 48000 }))}>
                  <option value={48000}>48 kHz</option>
                  <option value={44100}>44.1 kHz</option>
                </select>
              </Field>
              <Field label="电平">
                <input type="range" min={0.1} max={0.95} step={0.01} value={ltc.level} onChange={event => setLtc(prev => ({ ...prev, level: Number(event.target.value) }))} />
              </Field>
              <Field label="声道路由">
                <select value={ltc.routeIndex} onChange={event => setLtc(prev => ({ ...prev, routeIndex: Number(event.target.value) }))}>
                  {LTC_ROUTING_PRESETS.map((preset, index) => <option key={preset.name} value={index}>{preset.name}</option>)}
                </select>
              </Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="起始时码" value={timecodeRange?.startTimecode || '格式错误'} tone={timecodeRange ? 'ok' : 'danger'} />
              <Result label="结束时码" value={timecodeRange?.endTimecode || '-'} />
              <Result label="总帧数" value={`${timecodeRange?.totalFrames ?? 0}`} />
              <Result label="Drop Frame" value={timecodeRange?.dropFrame ? '是' : '否'} />
            </div>
            <div className={styles.rowLarge}>
              <span>路由用途</span>
              <em>{activeRoute.useCase}</em>
            </div>
            {timecodeRange?.warnings?.length ? (
              <div className={styles.warningList}>
                {timecodeRange.warnings.map(warning => <div className={styles.warningItem} key={warning}>{warning}</div>)}
              </div>
            ) : null}
            {ltcMessage && <div className={styles.warningItem}>{ltcMessage}</div>}
            <div className={styles.inlineActions}>
              <button className={styles.primaryBtn} onClick={generateLtc}>
                <Download size={16} /> 生成 LTC WAV
              </button>
            </div>
          </section>
        );

      case 'fixture':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Library} title="灯库制作草稿" desc="生成基础 fixture profile，可导出 JSON/CSV 作为老虎 D4、金刚控台、MA 等灯库整理草稿。" />
            <div className={styles.quickList}>
              {FIXTURE_PRESETS.slice(0, 10).map(item => (
                <button key={item.model} onClick={() => setFixture(prev => ({ ...prev, model: item.model, channels: item.channels }))}>{item.model} · {item.channels}ch</button>
              ))}
            </div>
            <div className={styles.formGrid}>
              <Field label="品牌"><input value={fixture.brand} onChange={event => setFixture(prev => ({ ...prev, brand: event.target.value }))} /></Field>
              <Field label="型号"><input value={fixture.model} onChange={event => setFixture(prev => ({ ...prev, model: event.target.value }))} /></Field>
              <Field label="模式"><input value={fixture.mode} onChange={event => setFixture(prev => ({ ...prev, mode: event.target.value }))} /></Field>
              <Field label="通道数"><input type="number" min={1} max={512} value={fixture.channels} onChange={event => setFixture(prev => ({ ...prev, channels: Number(event.target.value) }))} /></Field>
            </div>
            <Field label="通道属性，一行一个">
              <textarea className={styles.exportArea} value={fixtureAttributes} onChange={event => setFixtureAttributes(event.target.value)} />
            </Field>
            <div className={styles.inlineActions}>
              <button className={styles.secondaryBtn} onClick={() => copyText(fixtureJson)}><Copy size={16} /> 复制 JSON</button>
              <button className={styles.secondaryBtn} onClick={() => downloadTextFile(`${fixture.model || 'fixture'}.json`, fixtureJson, 'application/json;charset=utf-8')}><Download size={16} /> 下载 JSON</button>
              <button className={styles.secondaryBtn} onClick={() => downloadTextFile(`${fixture.model || 'fixture'}-channels.csv`, fixtureCsv, 'text/csv;charset=utf-8')}><Download size={16} /> 下载 CSV</button>
            </div>
            <textarea className={styles.exportArea} readOnly value={fixtureJson} />
          </section>
        );

      case 'layout':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Sparkles} title="灯位设计参考" desc="按投射距离、吊挂高度、覆盖宽度和灯具数量估算布灯角度与覆盖连续性。" />
            <div className={styles.quickList}>
              {LAYOUT_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setLayout(prev => ({
                    ...prev,
                    throwM: preset.throwM,
                    trimM: preset.trimM,
                    targetM: preset.targetM,
                    beamAngle: preset.beamAngle,
                  }))}
                  title={preset.note}
                >
                  {preset.name} · {preset.beamAngle} deg
                </button>
              ))}
            </div>
            <div className={styles.formGrid}>
              <Field label="投射距离 m"><input type="number" value={layout.throwM} onChange={event => setLayout(prev => ({ ...prev, throwM: Number(event.target.value) }))} /></Field>
              <Field label="吊挂高度 m"><input type="number" value={layout.trimM} onChange={event => setLayout(prev => ({ ...prev, trimM: Number(event.target.value) }))} /></Field>
              <Field label="目标高度 m"><input type="number" value={layout.targetM} onChange={event => setLayout(prev => ({ ...prev, targetM: Number(event.target.value) }))} /></Field>
              <Field label="光束角 deg"><input type="number" min={1} max={120} value={layout.beamAngle} onChange={event => setLayout(prev => ({ ...prev, beamAngle: Number(event.target.value) }))} /></Field>
              <Field label="灯具数量"><input type="number" min={1} value={layout.fixtureCount} onChange={event => setLayout(prev => ({ ...prev, fixtureCount: Number(event.target.value) }))} /></Field>
              <Field label="覆盖宽度 m"><input type="number" min={1} value={layout.coverageWidth} onChange={event => setLayout(prev => ({ ...prev, coverageWidth: Number(event.target.value) }))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="建议 Tilt" value={`${layoutResult.tiltAngle} deg`} />
              <Result label="单灯光斑" value={`${layoutResult.spotDiameter} m`} />
              <Result label="布灯间距" value={`${layoutResult.spacingM} m`} />
              <Result label="横向重叠" value={`${layoutResult.overlap}%`} tone={layoutResult.overlap >= 15 ? 'ok' : 'warn'} />
            </div>
            <div className={styles.rowLarge}>
              <span>覆盖判断</span>
              <em>
                当前单灯光斑面积约 {layoutResult.spotArea} m2。
                {layoutResult.overlap >= 15
                  ? ' 覆盖较连续，可继续用现场照度和视觉均匀度复核。'
                  : ' 重叠偏低，建议增加灯具、放大角度或缩小覆盖宽度。'}
              </em>
            </div>
          </section>
        );

      case 'theory':
        return <ReferencePanel icon={BookOpen} title="灯光理论速查" desc="现场布光常用灯位、角度和色彩混合基础。" items={[
          { title: '面光 Front Light', body: '常用 30-45 deg 入射角，保证主体面部可见并控制阴影。' },
          { title: '侧光 Side Light', body: '强化人物轮廓和动作质感，舞蹈/实景演出常用于身体塑形。' },
          { title: '逆光 Back Light', body: '把主体从背景中分离，雾效环境中能形成空间层次。' },
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
        <p className={styles.pageSubtitle}>Web、桌面端和移动端共用同一套灯光现场计算逻辑，核心工具支持离线使用。</p>
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

function ToolHeader({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
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

function Field({ label, children }: { label: string; children: ReactNode }) {
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

function ReferencePanel({ icon, title, desc, items }: { icon: LucideIcon; title: string; desc: string; items: Array<{ title: string; body: string }> }) {
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
