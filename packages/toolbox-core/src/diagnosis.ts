/**
 * 故障诊断决策树（离线）
 *
 * 按照树状结构引导维修人员逐步诊断灯具故障
 */

export interface DiagnosisNode {
  id: string
  question: string
  hint?: string
  options: DiagnosisOption[]
  isLeaf?: boolean
}

export interface DiagnosisOption {
  label: string
  nextNodeId?: string
  /** 如果是终端节点，显示诊断结论 */
  conclusion?: DiagnosisConcluion
}

export interface DiagnosisConcluion {
  problem: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  solution: string[]
  estimatedTime: string
  needsExpert?: boolean
}

/** 故障诊断入口（按故障类型） */
export const FAULT_TYPE_ROOTS: Record<string, string> = {
  '不亮': 'nolight_001',
  '频闪': 'flicker_001',
  '不受控': 'uncontrolled_001',
  '漏电': 'leakage_001',
  '物理损坏': 'physical_001',
}

/** 诊断节点数据库 */
export const DIAGNOSIS_NODES: Record<string, DiagnosisNode> = {
  // ── 不亮 ─────────────────────────────────────────────────────────────────
  'nolight_001': {
    id: 'nolight_001',
    question: '灯具完全不亮。电源是否有电？',
    hint: '检查配电盘对应回路的空开是否跳闸',
    options: [
      { label: '空开跳闸', nextNodeId: 'nolight_002' },
      { label: '空开正常，但无电', nextNodeId: 'nolight_003' },
      { label: '有电，灯仍不亮', nextNodeId: 'nolight_004' },
    ],
  },
  'nolight_002': {
    id: 'nolight_002',
    question: '空开跳闸，复位后是否立即再次跳闸？',
    options: [
      { label: '立即跳闸', conclusion: {
        problem: '线路短路或灯具内部短路',
        severity: 'high',
        solution: ['断开该回路所有灯具', '逐一接入排查短路灯具', '用万用表检测电源线对地绝缘阻值', '联系专业电工处理'],
        estimatedTime: '1-3小时',
        needsExpert: true,
      }},
      { label: '复位后正常', conclusion: {
        problem: '瞬时过载跳闸',
        severity: 'medium',
        solution: ['检查该回路总功率是否超载', '减少回路灯具数量', '检查灯具是否有启动冲击电流过大问题'],
        estimatedTime: '30分钟',
      }},
    ],
  },
  'nolight_003': {
    id: 'nolight_003',
    question: '检查配电柜总开关和上级供电',
    options: [
      { label: '总开关正常，支路断路器问题', conclusion: {
        problem: '支路断路器故障或断开',
        severity: 'medium',
        solution: ['更换同规格断路器', '检查断路器接线是否松动', '重新接好断路器'],
        estimatedTime: '30-60分钟',
      }},
      { label: '上级供电中断', conclusion: {
        problem: '市电停电或主供电故障',
        severity: 'critical',
        solution: ['联系场馆物业/供电部门', '启动备用发电机（如有）', '评估演出是否可继续'],
        estimatedTime: '根据供电恢复时间',
        needsExpert: true,
      }},
    ],
  },
  'nolight_004': {
    id: 'nolight_004',
    question: '灯具指示灯状态如何？',
    hint: '观察灯具背部或侧面的状态指示灯',
    options: [
      { label: '无任何指示灯', nextNodeId: 'nolight_005' },
      { label: '红色错误指示灯', nextNodeId: 'nolight_006' },
      { label: '正常绿色指示，但不出光', nextNodeId: 'nolight_007' },
    ],
  },
  'nolight_005': {
    id: 'nolight_005',
    question: '检查电源线连接',
    options: [
      { label: '接头松动/脱落', conclusion: {
        problem: '电源接头接触不良',
        severity: 'low',
        solution: ['断电', '重新插紧电源接头', '检查PowerCon接头是否锁好', '上电测试'],
        estimatedTime: '10分钟',
      }},
      { label: '连接正常', conclusion: {
        problem: '灯具内部电源板故障',
        severity: 'high',
        solution: ['记录灯具型号和故障现象', '拆下灯具送修或联系厂商', '用备用灯具临时替换'],
        estimatedTime: '2-8小时（送修）',
        needsExpert: true,
      }},
    ],
  },
  'nolight_006': {
    id: 'nolight_006',
    question: '查看灯具显示屏或APP上的错误代码',
    options: [
      { label: '过温保护错误', conclusion: {
        problem: '灯具过热触发保护',
        severity: 'medium',
        solution: ['关闭灯具散热10-15分钟', '检查风扇是否转动（可能积尘堵转）', '清洁散热口和风扇', '检查安装环境温度是否过高'],
        estimatedTime: '15-30分钟',
      }},
      { label: '灯泡错误/光源错误', conclusion: {
        problem: '光源（灯泡/LED模组）故障',
        severity: 'high',
        solution: ['断电冷却30分钟', '更换对应型号光源', '重新初始化灯具', '若LED模组损坏，联系厂商'],
        estimatedTime: '30-60分钟',
      }},
      { label: '其他错误代码', conclusion: {
        problem: '灯具内部电路或传感器故障',
        severity: 'high',
        solution: ['查阅该型号灯具说明书对应错误代码', '尝试重启恢复出厂设置', '联系灯具厂商技术支持'],
        estimatedTime: '根据故障类型',
        needsExpert: true,
      }},
    ],
  },
  'nolight_007': {
    id: 'nolight_007',
    question: 'DMX控制信号是否正常？',
    hint: '在控台上尝试手动将Dimmer推到100%，观察灯是否响应',
    options: [
      { label: '控台无法控制该灯', nextNodeId: 'uncontrolled_001' },
      { label: '控台有控制，但不出光', conclusion: {
        problem: 'Dimmer通道或光源故障',
        severity: 'medium',
        solution: ['检查DMX地址设置是否正确', '尝试手动操作灯具上的测试按钮', '若测试按钮可以点亮，问题在DMX信号', '若测试也不亮，光源或光闸（Shutter）故障'],
        estimatedTime: '30-60分钟',
      }},
    ],
  },

  // ── 频闪 ─────────────────────────────────────────────────────────────────
  'flicker_001': {
    id: 'flicker_001',
    question: '频闪是随机的还是有规律的？',
    options: [
      { label: '随机不规则闪烁', nextNodeId: 'flicker_002' },
      { label: '有规律频闪（像频闪效果）', nextNodeId: 'flicker_003' },
      { label: '所有灯同步频闪', nextNodeId: 'flicker_004' },
    ],
  },
  'flicker_002': {
    id: 'flicker_002',
    question: '是否只有该灯频闪，其他灯正常？',
    options: [
      { label: '只有这台灯', conclusion: {
        problem: '灯具内部电源或光源接触不良',
        severity: 'medium',
        solution: ['检查灯具内部接头是否松动', '清洁光源触点', '若频繁发生，检查光源寿命', '考虑更换光源或送修'],
        estimatedTime: '30-60分钟',
      }},
      { label: '同一回路多台灯', conclusion: {
        problem: '供电回路电压不稳定',
        severity: 'high',
        solution: ['检查配电盘电压（应为220V±10%）', '检查线缆截面积是否满足功率需求', '检查接头是否氧化松动', '联系电工处理'],
        estimatedTime: '1-2小时',
        needsExpert: true,
      }},
    ],
  },
  'flicker_003': {
    id: 'flicker_003',
    question: '在控台上检查 Shutter/Strobe 通道的值',
    options: [
      { label: 'Shutter通道有非零值', conclusion: {
        problem: '频闪效果被误触发',
        severity: 'low',
        solution: ['在控台将Shutter通道设为0（关闭）', '检查是否有Sequence在自动控制频闪', '检查预设中是否包含频闪参数'],
        estimatedTime: '5分钟',
      }},
      { label: 'Shutter通道为0但仍频闪', conclusion: {
        problem: '灯具内部频闪电路故障',
        severity: 'high',
        solution: ['尝试重启灯具', '恢复出厂设置', '若问题持续，光源驱动板故障，需送修'],
        estimatedTime: '30分钟-送修',
        needsExpert: true,
      }},
    ],
  },
  'flicker_004': {
    id: 'flicker_004',
    question: '供电是否来自发电机？',
    options: [
      { label: '是，使用发电机', conclusion: {
        problem: '发电机频率或电压不稳',
        severity: 'high',
        solution: ['检查发电机转速（应为50Hz±1Hz）', '发电机负载是否过高（＞80%额定功率）', '在灯具前端加装稳压器', '联系发电机厂商'],
        estimatedTime: '根据发电机状态',
        needsExpert: true,
      }},
      { label: '使用市电', conclusion: {
        problem: '市电电压波动或谐波干扰',
        severity: 'medium',
        solution: ['用万用表测量电压是否稳定', '检查是否有大功率设备同回路', '加装稳压器或UPS', '联系供电部门'],
        estimatedTime: '1-2小时',
      }},
    ],
  },

  // ── 不受控 ───────────────────────────────────────────────────────────────
  'uncontrolled_001': {
    id: 'uncontrolled_001',
    question: '灯具是否有响应（比如移动、闪烁），只是响应异常？',
    options: [
      { label: '完全没有任何响应', nextNodeId: 'uncontrolled_002' },
      { label: '有响应但行为异常（乱动、颜色错误等）', nextNodeId: 'uncontrolled_003' },
    ],
  },
  'uncontrolled_002': {
    id: 'uncontrolled_002',
    question: '检查 DMX 信号链路',
    hint: '用DMX信号测试仪或在控台检查Universe输出',
    options: [
      { label: 'DMX信号正常，但灯不响应', nextNodeId: 'uncontrolled_004' },
      { label: '该Universe无DMX输出', conclusion: {
        problem: 'DMX输出端口故障或信号线断路',
        severity: 'high',
        solution: ['检查控台DMX输出口', '更换DMX信号线测试', '检查中间节点（信号放大器、合并器）', '用万用表检测DMX线路通断'],
        estimatedTime: '30-60分钟',
      }},
    ],
  },
  'uncontrolled_003': {
    id: 'uncontrolled_003',
    question: '同链路上其他灯具是否正常？',
    options: [
      { label: '其他灯正常，只有这台异常', conclusion: {
        problem: 'DMX地址设置错误或灯具固件问题',
        severity: 'low',
        solution: ['核对灯具DMX起始地址与控台Patch是否一致', '检查灯具通道模式（Channel Mode）是否匹配灯库', '尝试重置灯具地址', '更新灯具固件'],
        estimatedTime: '15-30分钟',
      }},
      { label: '多台灯同样异常', conclusion: {
        problem: 'DMX信号质量问题或控台Patch错误',
        severity: 'medium',
        solution: ['检查DMX线路中是否有严重干扰', '检查控台Universe输出设置', '在链路末端加装120Ω终结器', '重新Patch控台'],
        estimatedTime: '30-60分钟',
      }},
    ],
  },
  'uncontrolled_004': {
    id: 'uncontrolled_004',
    question: '灯具面板上 DMX 地址是否与控台 Patch 完全一致？',
    options: [
      { label: '地址不一致', conclusion: {
        problem: 'DMX地址错误',
        severity: 'low',
        solution: ['进入灯具设置菜单', '修改起始地址为控台Patch地址', '确认通道模式（Mode）也匹配', '保存设置后测试'],
        estimatedTime: '5-10分钟',
      }},
      { label: '地址一致，但无响应', conclusion: {
        problem: 'DMX接收电路故障或信号中断',
        severity: 'high',
        solution: ['用另一台确认正常的灯具替换到同位置测试', '检查该灯DMX输入接口是否损坏', '用DMX测试仪直接接到灯具测试', '若确认信号到达但灯不响应，内部接收板故障'],
        estimatedTime: '30分钟',
        needsExpert: true,
      }},
    ],
  },

  // ── 漏电 ─────────────────────────────────────────────────────────────────
  'leakage_001': {
    id: 'leakage_001',
    question: '⚠️ 漏电危险！请先确保安全。是否有人触电受伤？',
    hint: '发现漏电请立即切断电源，不要用手触碰灯具',
    options: [
      { label: '有人触电受伤', conclusion: {
        problem: '⚠️ 紧急情况：人员触电',
        severity: 'critical',
        solution: ['立即拨打120急救电话', '在确保自身安全的情况下切断电源', '对伤者进行急救（如有培训）', '保护现场，等待专业人员'],
        estimatedTime: '立即处理',
        needsExpert: true,
      }},
      { label: '无人受伤，发现漏电现象', conclusion: {
        problem: '灯具或线路漏电',
        severity: 'critical',
        solution: [
          '立即切断该灯具/回路电源',
          '挂警告牌，禁止他人靠近',
          '不要在未排查前接通电源',
          '联系持证电工用兆欧表检测绝缘阻值',
          '检查电源线外皮破损、接线端子松动',
          '检查灯具外壳是否带电（用氖灯测电笔）',
          '排查完成并修复前禁止使用该设备',
        ],
        estimatedTime: '需专业电工处理',
        needsExpert: true,
      }},
    ],
  },

  // ── 物理损坏 ─────────────────────────────────────────────────────────────
  'physical_001': {
    id: 'physical_001',
    question: '损坏部位是什么？',
    options: [
      { label: '外壳/铸件破损', conclusion: {
        problem: '外壳物理损坏',
        severity: 'medium',
        solution: ['评估损坏是否影响正常使用', '检查内部元件是否受影响', '若影响安全（尖锐边缘、防护失效），停用处理', '联系厂商购买备件或送修'],
        estimatedTime: '根据损坏程度',
      }},
      { label: '透镜/棱镜碎裂', conclusion: {
        problem: '光学元件损坏',
        severity: 'medium',
        solution: ['停止使用（碎片可能造成安全危害）', '清理碎片时佩戴手套和护目镜', '联系厂商购买同型号替换透镜', '安装前检查内部是否有玻璃碎片残留'],
        estimatedTime: '送修或等备件，1-7天',
      }},
      { label: '旋转部件卡死/异响', conclusion: {
        problem: '机械结构故障',
        severity: 'high',
        solution: ['立即停止该运动（避免烧毁电机）', '检查是否有异物卡入', '检查皮带/齿轮是否脱落', '润滑关节部位（使用正确润滑油）', '若电机烧毁，联系专业维修'],
        estimatedTime: '1-4小时',
        needsExpert: true,
      }},
      { label: '吊架/固定件松脱', conclusion: {
        problem: '⚠️ 安全隐患：固定件松动',
        severity: 'critical',
        solution: [
          '立即疏散灯具下方人员',
          '用安全绳临时固定灯具',
          '切断该灯具电源',
          '检查吊架螺丝、螺母是否齐全且紧固',
          '检查吊架是否变形损坏',
          '由专业舞台技术人员重新安装',
          '恢复使用前必须经过安全检查',
        ],
        estimatedTime: '根据情况',
        needsExpert: true,
      }},
    ],
  },
}
