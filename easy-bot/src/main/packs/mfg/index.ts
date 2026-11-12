import { DomainPack } from '../types.js';

export const MfgPack: DomainPack = {
  id: 'pack-mfg',
  name: 'MfgPack (智能制造与工业运维适配包)',
  description: '为高端制造、离散装配与工业园区打造的垂直适配包，提供数控机床维保、制程质检合规与物料BOM核算',
  version: '1.0.0',
  roleAliases: {
    plant_manager: 'admin',
    engineer: 'manager',
    operator: 'member',
    technician: 'member'
  },
  identityMapping: (attrs: Record<string, any>) => {
    const ou = String(attrs.ou || attrs.department || '').toLowerCase();
    const isLead = ou.includes('manager') || ou.includes('engineer') || ou.includes('supervisor');
    return {
      role: isLead ? 'manager' : 'member',
      department: attrs.department || (isLead ? '总装二车间工程部' : '智能制造一产线'),
      groups: isLead ? ['grp_plant_engineers', 'grp_maintenance_leads'] : ['grp_line_operators']
    };
  },
  specialists: [
    {
      id: 'exp-equip',
      name: '马工',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=equip',
      title: '设备运维与故障诊断专家 (Maintenance Engineer)',
      description: '精通数控机床、自动化产线、注塑冲压与工业电气维保；快速解读设备报错代码 (E-xx) 并提供安全排错步骤。',
      systemPrompt: '你是资深工业设备运维专家马工。熟悉机械电气结构、PLC报警代码与设备日常点检维保。回答严谨条理，优先给出停机排查逻辑、安全断电规程与应急处置指南。',
      skills: ['equipment-diagnostics', 'fault-code-lookup', 'safety-reset'],
      model: 'default-chat-model',
      status: 'online',
      color: '#1677ff',
      tags: ['设备排错', '故障代码', '维保SOP', '电气安全']
    },
    {
      id: 'exp-qa',
      name: '刘主管',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=qa',
      title: '生产工艺与质检合规专家 (Quality & Process)',
      description: '熟悉作业指导书 (SOP)、公差配合、制程检验标准 (IPQC/FQC) 与不良品缺陷成因排查。',
      systemPrompt: '你是资深生产工艺与质检主管刘主管。熟悉加工工艺规程、尺寸公差与质检检验标准。擅长分析产品缺陷（起泡、尺寸偏差、划痕、缩水）原因，提供纠偏与工艺参数优化建议。',
      skills: ['process-sop-verify', 'tolerance-check', 'defect-root-cause'],
      model: 'default-chat-model',
      status: 'online',
      color: '#52c41a',
      tags: ['工艺指导书', '质检标准', '缺陷排查', '制程把控']
    },
    {
      id: 'exp-bom',
      name: '王科长',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=bom',
      title: '物料BOM与采购核算员 (BOM & Costing)',
      description: '擅长多层级物料清单 (BOM) 核对、工艺定额损耗计算、非标定制件技术参数比对与快速成本预估。',
      systemPrompt: '你是物料与成本核算专家王科长。熟悉原材料规格、BOM结构与生产定额损耗。擅长比对非标订单与物料参数，提供准确的损耗估算与报价辅助。',
      skills: ['bom-diff', 'material-loss-calc', 'cost-estimation'],
      model: 'default-chat-model',
      status: 'online',
      color: '#faad14',
      tags: ['BOM比对', '物料损耗', '定额核算', '成本预估']
    }
  ],
  channels: [
    {
      id: 'chan-equip',
      name: '设备运维与工控排错',
      description: 'PLC/CNC 报错排查、设备预防性巡检与电气控制排障协作',
      isGroup: true,
      expertIds: ['exp-equip'],
      unreadCount: 0
    },
    {
      id: 'chan-qa',
      name: '工艺标准与质检追溯',
      description: '制程巡检 (IPQC)、公差匹配审核、出厂检验与不合格品归因评审',
      isGroup: true,
      expertIds: ['exp-qa'],
      unreadCount: 0
    },
    {
      id: 'chan-bom',
      name: '物料清单与成本核算',
      description: '结构件BOM比对、定额损耗测算、供应商非标参数复核',
      isGroup: true,
      expertIds: ['exp-bom'],
      unreadCount: 0
    }
  ],
  workflows: [
    {
      id: 'wf-equip-emergency',
      name: 'CNC 设备急停与报警代码排查流程',
      description: '从产线现场抓取报警日志，诊断停机原因并生成安全复位作业指导书',
      entryNodeId: 'step-1',
      nodes: [
        {
          id: 'step-1',
          name: '读取报警快照',
          type: 'MCP_TOOL',
          nextNodeId: 'step-2',
          config: {
            toolName: 'workspace_file_read',
            toolArgs: { path: 'alarm_log.txt' },
            outputKey: 'raw_alarm'
          }
        },
        {
          id: 'step-2',
          name: '故障代码研判与安全规程匹配',
          type: 'LLM_PROMPT',
          nextNodeId: 'step-3',
          config: {
            promptTemplate: '针对以下工业产线现场告警日志，给出故障根本原因、安全断电步骤与排障复位流程：\n\n{{raw_alarm}}',
            outputKey: 'sop_instructions'
          }
        },
        {
          id: 'step-3',
          name: '生成急停复位作业单',
          type: 'MCP_TOOL',
          config: {
            toolName: 'workspace_file_write',
            toolArgs: {
              path: 'emergency_reset_sop.md',
              content: '# ⚠️ 工业设备应急处置与复位作业单\n\n{{sop_instructions}}\n\n*生成状态: 经 MfgPack 工业安全策略校验完成*'
            },
            outputKey: 'report_file'
          }
        }
      ]
    }
  ],
  customTools: [
    {
      definition: {
        name: 'mfg_plc_fault_lookup',
        description: 'Queries industrial PLC and CNC error codes to obtain diagnostic recovery SOPs',
        serverId: 'pack-mfg',
        inputSchema: {
          type: 'object',
          properties: {
            faultCode: { type: 'string', description: 'Fault code (e.g. E-06, ALM-201, ERR_SERVO_OVERLOAD)' }
          },
          required: ['faultCode']
        }
      },
      handler: async (args: Record<string, any>) => {
        const code = String(args.faultCode || '').toUpperCase().trim();
        let diag = '未知报警代码，请执行电气全面点检并查阅主控柜原理图。';
        let severity = 'MEDIUM';
        if (code.includes('06') || code.includes('OVERHEAT')) {
          diag = '主轴伺服驱动器过热保护动作。排查：1. 冷却风扇运转状态；2. 散热片积灰；3. 长期超负荷切削。';
          severity = 'HIGH';
        } else if (code.includes('201') || code.includes('PRESSURE')) {
          diag = '主液压站油压低于设定下限值 (2.5MPa)。排查：1. 液压泵电机接触器；2. 吸油滤芯堵塞；3. 油路接头泄漏。';
          severity = 'CRITICAL';
        }
        return JSON.stringify({
          faultCode: code,
          severity,
          actionRequired: 'LOTO (Lockout/Tagout) 安全断电确认',
          diagnosticConclusion: diag,
          recommendedParts: ['伺服散热风机', '液压滤芯-HYD-50U']
        }, null, 2);
      }
    }
  ],
  keywordRouting: {
    '设备': 'exp-equip',
    '故障': 'exp-equip',
    '报警': 'exp-equip',
    '机床': 'exp-equip',
    '维保': 'exp-equip',
    'plc': 'exp-equip',
    '工艺': 'exp-qa',
    '质检': 'exp-qa',
    '公差': 'exp-qa',
    '缺陷': 'exp-qa',
    'sop': 'exp-qa',
    '物料': 'exp-bom',
    'bom': 'exp-bom',
    '成本': 'exp-bom',
    '损耗': 'exp-bom'
  }
};
