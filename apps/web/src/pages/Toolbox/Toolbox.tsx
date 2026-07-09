import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  Cable,
  Clock3,
  Copy,
  Cpu,
  Download,
  Library,
  Lightbulb,
  Network,
  Palette,
  Plus,
  SlidersHorizontal,
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
  FIXTURE_PRESETS,
  generateLtcWav,
  LTC_ROUTING_PRESETS,
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
  { id: 'voltageDrop', label: '电缆压降', icon: Cable },
  { id: 'artnet', label: 'Art-Net 地址', icon: Network },
  { id: 'beam', label: '光束角', icon: SlidersHorizontal },
  { id: 'lux', label: '照度计算', icon: Lightbulb },
  { id: 'color', label: 'RGB/色温', icon: Palette },
  { id: 'ltc', label: 'LTC 时码', icon: Clock3 },
  { id: 'fixture', label: '灯库制作', icon: Library },
] as const;

type ToolId = typeof TOOLS[number]['id'];
type RgbValue = { r: number; g: number; b: number };

interface DmxFixtureRow {
  id: string;
  name: string;
  channels: number;
  quantity: number;
  startAddress: string;
  universe: string;
}

const PALETTES: Array<{ name: string; rgb: RgbValue; cct: number }> = [
  { name: '水秀冷蓝', rgb: { r: 38, g: 156, b: 255 }, cct: 8000 },
  { name: '古建暖金', rgb: { r: 255, g: 178, b: 84 }, cct: 3000 },
  { name: '森林青绿', rgb: { r: 46, g: 204, b: 113 }, cct: 5200 },
  { name: '节庆玫红', rgb: { r: 255, g: 64, b: 129 }, cct: 4500 },
  { name: '月光白', rgb: { r: 210, g: 228, b: 255 }, cct: 9000 },
  { name: '熔岩红', rgb: { r: 255, g: 48, b: 32 }, cct: 2200 },
  { name: '琥珀黄', rgb: { r: 255, g: 198, b: 64 }, cct: 2700 },
  { name: '湖水青', rgb: { r: 0, g: 210, b: 190 }, cct: 6200 },
  { name: '深海蓝', rgb: { r: 18, g: 72, b: 255 }, cct: 10000 },
  { name: '薰衣紫', rgb: { r: 145, g: 92, b: 255 }, cct: 6500 },
  { name: '舞台白', rgb: { r: 255, g: 248, b: 235 }, cct: 4200 },
  { name: '冷白', rgb: { r: 226, g: 241, b: 255 }, cct: 6500 },
];

const CCT_PRESETS = [2200, 2700, 3200, 4000, 5600, 6500, 8000, 10000];
const CABLE_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

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

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toHex(value: number) {
  return Math.round(clampNumber(value, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
}

function rgbToHex(rgb: RgbValue) {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToCss(rgb: RgbValue) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function hexToRgb(value: string): RgbValue | null {
  const normalized = value.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function cctToRgb(kelvin: number): RgbValue {
  const temp = clampNumber(kelvin, 1000, 40000) / 100;
  let r = 255;
  let g = 255;
  let b = 255;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * ((temp - 60) ** -0.1332047592);
    g = 288.1221695283 * ((temp - 60) ** -0.0755148492);
    b = 255;
  }

  return {
    r: Math.round(clampNumber(r, 0, 255)),
    g: Math.round(clampNumber(g, 0, 255)),
    b: Math.round(clampNumber(b, 0, 255)),
  };
}

function dmxDipSwitches(address: number) {
  const normalized = clampNumber(Math.floor(address), 1, 512);
  return Array.from({ length: 10 }, (_, index) => (normalized & (1 << index)) !== 0);
}

function calcVoltageDrop(params: {
  voltage: number;
  current: number;
  lengthM: number;
  sectionMm2: number;
  phase: 'single' | 'three';
}) {
  const copperResistivity = 0.0175;
  const multiplier = params.phase === 'three' ? Math.sqrt(3) : 2;
  const dropV = multiplier * params.current * copperResistivity * params.lengthM / Math.max(params.sectionMm2, 0.1);
  const dropPercent = params.voltage > 0 ? dropV / params.voltage * 100 : 0;
  return {
    dropV: round(dropV, 2),
    dropPercent: round(dropPercent, 1),
    endVoltage: round(params.voltage - dropV, 1),
  };
}

function parseIpv4(ip: string) {
  const parts = ip.split('.').map(part => Number(part.trim()));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return [2, 0, 0, 10];
  }
  return parts;
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

  const [cable, setCable] = useState({
    voltage: 220,
    current: 16,
    lengthM: 60,
    sectionMm2: 2.5,
    phase: 'single' as 'single' | 'three',
  });

  const [artnet, setArtnet] = useState({
    net: 0,
    subnet: 0,
    universe: 0,
    nodeCount: 4,
    startIp: '2.0.0.10',
  });

  const [beamMode, setBeamMode] = useState<'angle' | 'spot'>('angle');
  const [beamDistance, setBeamDistance] = useState(18);
  const [spotDiameter, setSpotDiameter] = useState(4);
  const [knownAngle, setKnownAngle] = useState(12);

  const [lumens, setLumens] = useState(12000);
  const [luxDistance, setLuxDistance] = useState(12);
  const [luxBeamAngle, setLuxBeamAngle] = useState(25);

  const [rgb, setRgb] = useState<RgbValue>({ r: 38, g: 156, b: 255 });
  const [cct, setCct] = useState(8000);

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

  useEffect(() => () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  }, []);

  const handleTap = () => {
    const now = Date.now();
    const previousTap = tapsRef.current[tapsRef.current.length - 1];
    if (previousTap && now - previousTap > 2000) tapsRef.current = [];

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
    dmxFixtures.map(row => ({
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
  const hexColor = rgbToHex(rgb);
  const voltageDrop = useMemo(() => calcVoltageDrop(cable), [cable]);
  const recommendedCableSection = useMemo(() => (
    CABLE_SECTIONS.find(section => calcVoltageDrop({ ...cable, sectionMm2: section }).dropPercent <= 3) ?? CABLE_SECTIONS[CABLE_SECTIONS.length - 1]
  ), [cable]);
  const artnetUniverseIndex = useMemo(() => (
    clampNumber(Math.floor(artnet.net), 0, 127) * 256
    + clampNumber(Math.floor(artnet.subnet), 0, 15) * 16
    + clampNumber(Math.floor(artnet.universe), 0, 15)
  ), [artnet.net, artnet.subnet, artnet.universe]);
  const artnetIpList = useMemo(() => {
    const base = parseIpv4(artnet.startIp);
    const nodeCount = Math.floor(clampNumber(artnet.nodeCount, 1, 64));
    return Array.from({ length: nodeCount }, (_, index) => {
      const octets = [...base];
      octets[3] = clampNumber((base[3] ?? 10) + index, 1, 254);
      return octets.join('.');
    });
  }, [artnet.nodeCount, artnet.startIp]);
  const activeRoute = LTC_ROUTING_PRESETS[ltc.routeIndex] ?? LTC_ROUTING_PRESETS[0];
  const timecodeRange = useMemo(() => {
    try {
      return calculateTimecodeRange(ltc.startTimecode, ltc.fps, ltc.duration);
    } catch {
      return null;
    }
  }, [ltc.duration, ltc.fps, ltc.startTimecode]);

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
      channels: Array.from({ length: Math.floor(clampNumber(fixture.channels, 1, 512)) }, (_, index) => ({
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

  const applyColor = (nextRgb: RgbValue, nextCct = cct) => {
    setRgb(nextRgb);
    setCct(nextCct);
  };

  const applyCct = (nextCct: number) => {
    setCct(nextCct);
    setRgb(cctToRgb(nextCct));
  };

  const generateLtc = () => {
    if (!activeRoute) return;
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
      setLtcMessage(wav.warnings.length ? wav.warnings.join('；') : `已生成 ${Math.round(wav.byteLength / 1024)} KB 立体声 WAV`);
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
            <ToolHeader icon={Cpu} title="DMX 多灯具链地址计算" desc="支持多组灯具、手动 Universe、固定起始地址、冲突检测和拨码开关参考。" />
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
                  <span>Universe {item.universe}: {item.firstAddress}-{item.lastAddress}</span>
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
            <ToolHeader icon={Zap} title="功率/负荷计算" desc="估算总功率、电流、空开负载和安全余量。" />
            <div className={styles.quickList}>
              {POWER_REFERENCES.slice(0, 8).map(item => (
                <button key={item.name} onClick={() => setPowerW(item.powerW)}>{item.name} · {item.powerW}W</button>
              ))}
            </div>
            <div className={styles.formGrid}>
              <Field label="单台功率 W"><input type="number" value={powerW} onChange={event => setPowerW(Number(event.target.value))} /></Field>
              <Field label="数量"><input type="number" value={powerQuantity} onChange={event => setPowerQuantity(Number(event.target.value))} /></Field>
              <Field label="电压 V"><input type="number" value={powerVoltage} onChange={event => setPowerVoltage(Number(event.target.value))} /></Field>
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

      case 'voltageDrop':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Cable} title="电缆压降计算" desc="按供电方式、电流、线长和线径估算末端电压，辅助现场选线和分电。" />
            <div className={styles.formGrid}>
              <Field label="供电类型">
                <select value={cable.phase} onChange={event => setCable(prev => ({ ...prev, phase: event.target.value as 'single' | 'three' }))}>
                  <option value="single">单相 220V</option>
                  <option value="three">三相 380V</option>
                </select>
              </Field>
              <Field label="电压 V"><input type="number" value={cable.voltage} onChange={event => setCable(prev => ({ ...prev, voltage: Number(event.target.value) }))} /></Field>
              <Field label="负载电流 A"><input type="number" value={cable.current} onChange={event => setCable(prev => ({ ...prev, current: Number(event.target.value) }))} /></Field>
              <Field label="单程线长 m"><input type="number" value={cable.lengthM} onChange={event => setCable(prev => ({ ...prev, lengthM: Number(event.target.value) }))} /></Field>
              <Field label="线径 mm2">
                <select value={cable.sectionMm2} onChange={event => setCable(prev => ({ ...prev, sectionMm2: Number(event.target.value) }))}>
                  {CABLE_SECTIONS.map(section => <option key={section} value={section}>{section} mm2</option>)}
                </select>
              </Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="压降" value={`${voltageDrop.dropV} V`} tone={voltageDrop.dropPercent > 5 ? 'danger' : voltageDrop.dropPercent > 3 ? 'warn' : 'ok'} />
              <Result label="压降比例" value={`${voltageDrop.dropPercent}%`} tone={voltageDrop.dropPercent > 5 ? 'danger' : voltageDrop.dropPercent > 3 ? 'warn' : 'ok'} />
              <Result label="末端电压" value={`${voltageDrop.endVoltage} V`} />
              <Result label="建议线径" value={`${recommendedCableSection} mm2`} tone={recommendedCableSection > cable.sectionMm2 ? 'warn' : 'ok'} />
            </div>
            <div className={styles.quickList}>
              {CABLE_SECTIONS.map(section => (
                <button key={section} onClick={() => setCable(prev => ({ ...prev, sectionMm2: section }))}>
                  {section} mm2 · {calcVoltageDrop({ ...cable, sectionMm2: section }).dropPercent}%
                </button>
              ))}
            </div>
          </section>
        );

      case 'artnet':
        return (
          <section className={styles.panel}>
            <ToolHeader icon={Network} title="Art-Net 地址规划" desc="快速换算 Net / Sub-Net / Universe、sACN Universe，并生成现场节点 IP 参考。" />
            <div className={styles.formGrid}>
              <Field label="Net 0-127"><input type="number" min={0} max={127} value={artnet.net} onChange={event => setArtnet(prev => ({ ...prev, net: Number(event.target.value) }))} /></Field>
              <Field label="Sub-Net 0-15"><input type="number" min={0} max={15} value={artnet.subnet} onChange={event => setArtnet(prev => ({ ...prev, subnet: Number(event.target.value) }))} /></Field>
              <Field label="Universe 0-15"><input type="number" min={0} max={15} value={artnet.universe} onChange={event => setArtnet(prev => ({ ...prev, universe: Number(event.target.value) }))} /></Field>
              <Field label="起始节点 IP"><input value={artnet.startIp} onChange={event => setArtnet(prev => ({ ...prev, startIp: event.target.value }))} /></Field>
              <Field label="节点数量"><input type="number" min={1} max={64} value={artnet.nodeCount} onChange={event => setArtnet(prev => ({ ...prev, nodeCount: Number(event.target.value) }))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="Art-Net Universe" value={`${artnetUniverseIndex}`} />
              <Result label="显示编号" value={`U ${artnetUniverseIndex + 1}`} />
              <Result label="sACN Universe" value={`${artnetUniverseIndex + 1}`} />
              <Result label="Hex" value={`0x${artnetUniverseIndex.toString(16).toUpperCase().padStart(4, '0')}`} />
            </div>
            <div className={styles.tableList}>
              {artnetIpList.map((ip, index) => (
                <div className={styles.row} key={`${ip}-${index}`}>
                  <span>节点 {index + 1}</span>
                  <strong>{ip}</strong>
                </div>
              ))}
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
            <ToolHeader icon={Palette} title="RGB 调色/色温取色盘" desc="点击色块或取色器，自动换算 RGB、HEX、DMX 百分比和常用色温参考。" />
            <div className={styles.colorPreview} style={{ background: hexColor }}>
              <strong>{hexColor}</strong>
              <span>RGB({rgb.r}, {rgb.g}, {rgb.b}) · {cct}K</span>
            </div>
            <div className={styles.formGrid}>
              <Field label="取色盘">
                <input
                  className={styles.colorInput}
                  type="color"
                  value={hexColor}
                  onChange={event => {
                    const next = hexToRgb(event.target.value);
                    if (next) setRgb(next);
                  }}
                />
              </Field>
              {(['r', 'g', 'b'] as const).map(channel => (
                <Field key={channel} label={channel.toUpperCase()}>
                  <input type="range" min={0} max={255} value={rgb[channel]} onChange={event => setRgb(prev => ({ ...prev, [channel]: Number(event.target.value) }))} />
                </Field>
              ))}
              <Field label="色温 K"><input type="range" min={2000} max={10000} step={100} value={cct} onChange={event => applyCct(Number(event.target.value))} /></Field>
            </div>
            <div className={styles.resultGrid}>
              <Result label="RGB" value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} />
              <Result label="HEX" value={hexColor} />
              <Result label="DMX 百分比" value={`${Math.round(rgb.r / 255 * 100)} / ${Math.round(rgb.g / 255 * 100)} / ${Math.round(rgb.b / 255 * 100)}%`} />
              <Result label="色温参考" value={`${cct}K`} />
            </div>
            <h4 className={styles.subTitle}>现场常用色</h4>
            <div className={styles.paletteGrid}>
              {PALETTES.map(item => (
                <button key={item.name} onClick={() => applyColor(item.rgb, item.cct)}>
                  <span style={{ background: rgbToCss(item.rgb) }} />
                  {item.name}
                  <em>RGB({item.rgb.r}, {item.rgb.g}, {item.rgb.b})</em>
                </button>
              ))}
            </div>
            <h4 className={styles.subTitle}>色温快捷</h4>
            <div className={styles.paletteGrid}>
              {CCT_PRESETS.map(kelvin => {
                const presetRgb = cctToRgb(kelvin);
                return (
                  <button key={kelvin} onClick={() => applyCct(kelvin)}>
                    <span style={{ background: rgbToHex(presetRgb) }} />
                    {kelvin}K
                    <em>RGB({presetRgb.r}, {presetRgb.g}, {presetRgb.b})</em>
                  </button>
                );
              })}
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
              <em>{activeRoute?.useCase || '-'}</em>
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
            <ToolHeader icon={Library} title="灯库制作草稿" desc="生成基础 fixture profile，可导出 JSON/CSV 作为灯库整理草稿。" />
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

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>专业工具箱</h1>
        <p className={styles.pageSubtitle}>现场常用灯光计算工具，保留实操入口，支持快速取色、地址规划、负荷和时码计算。</p>
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

function Result({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className={`${styles.resultCard} ${tone ? styles[tone] : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
