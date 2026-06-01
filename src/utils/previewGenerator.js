/**
 * previewGenerator.js
 * Generates a complete banking report HTML string for the live-preview iframe.
 * Pure function — no React dependency.
 *
 * Exports:
 *   DEFAULT_HEADER_CONFIG  – customizable header/footer defaults
 *   DEFAULT_COLUMNS        – default column definitions
 *   generatePreviewHTML    – main entry point
 */

/* ═══════════════════════════════════════════════════════════
   DEFAULT CONFIGS
═══════════════════════════════════════════════════════════ */
export const DEFAULT_HEADER_CONFIG = {
  /* Bank identity */
  bankName:           'Reserve Commercial Bank Ltd.',
  bankAbbr:           'RCB',
  branchName:         'Mumbai Main Branch',
  ifscCode:           'RCBL0001001',
  micrCode:           '400001001',
  showIFSC:           true,

  /* Watermark */
  showWatermark:      false,
  watermarkText:      'CONFIDENTIAL',

  /* Report display */
  showDate:           true,

  /* Footer */
  officerName:        'Priya Sharma',
  officerDesignation: 'Branch Manager',
  showIP:             false,
  ipAddress:          '192.168.1.101',
  showTimestamp:      true,
  footerNote:         'Verify with source data before official use.',

  /* External footer — always shown */
  poweredBy:          'Powered by Virtual Galaxy',

  /* Customer information */
  customerName:        '',
  customerId:          '',
  accountType:         'Savings Account',
  customerAddress:     '',
  customerContact:     '',
  customerEmail:       '',
  showCustomerInfo:    true,

  /* Logo image (base64 data URL, null = use text abbr) */
  logoImage:           null,
};

export const DEFAULT_COLUMNS = [
  { id: 'seq',       label: '#',              visible: true,  format: 'number',   order: 0 },
  { id: 'date',      label: 'Date',            visible: true,  format: 'date',     order: 1 },
  { id: 'narration', label: 'Narration',       visible: true,  format: 'text',     order: 2 },
  { id: 'type',      label: 'Type',            visible: true,  format: 'badge',    order: 3 },
  { id: 'amount',    label: 'Amount (INR)',    visible: true,  format: 'currency', order: 4 },
  { id: 'balance',   label: 'Balance (INR)',   visible: true,  format: 'currency', order: 5 },
];

/* ═══════════════════════════════════════════════════════════
   THEMES
═══════════════════════════════════════════════════════════ */
const T = {
  navy: {
    id: 'navy',
    headerBg: '#1B3A6B', headerText: '#FFFFFF',
    accentColor: '#1B3A6B', thBg: '#1B3A6B', thText: '#FFFFFF',
    borderTop: '#1B3A6B', sectionColor: '#1B3A6B',
  },
  blue: {
    id: 'blue',
    headerBg: '#1B3A6B', headerText: '#FFFFFF',
    accentColor: '#2E6BE6', thBg: '#2E6BE6', thText: '#FFFFFF',
    borderTop: '#2E6BE6', sectionColor: '#2E6BE6',
  },
  gold: {
    id: 'gold',
    headerBg: '#1C1208', headerText: '#F5E6C8',
    accentColor: '#C9A84C', thBg: '#2C1C10', thText: '#F5E6C8',
    borderTop: '#C9A84C', sectionColor: '#C9A84C',
  },
};

function getTheme(configId) {
  switch (configId) {
    case 'executive-summary': case 'drill-down': return T.gold;
    case 'branch-activity':   case 'hierarchical': case 'comparative': return T.blue;
    default: return T.navy;
  }
}

function getTemplateName(configId) {
  const n = {
    'tabular':           'Tabular Report',
    'hierarchical':      'Hierarchical Report',
    'group-by':          'Group By Report',
    'drill-down':        'Drill Down Report',
    'comparative':       'Comparative Report',
    'monthly-summary':   'Monthly Statement Summary',
    'executive-summary': 'Executive Summary Report',
    'branch-activity':   'Branch Activity Report',
  };
  return n[configId] || 'Statement Report';
}

function getFormat(configId) {
  switch (configId) {
    case 'hierarchical':     return 'hierarchical';
    case 'group-by':
    case 'branch-activity':  return 'group-by';
    case 'drill-down':
    case 'executive-summary':return 'drill-down';
    case 'comparative':      return 'comparative';
    default:                 return 'tabular';
  }
}

/* ═══════════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════════ */
function fmtINR(n) {
  if (n == null || n === '') return '—';
  return new Intl.NumberFormat('en-IN').format(Math.abs(Number(n)));
}

/* ═══════════════════════════════════════════════════════════
   EDA VISUAL DECORATIONS
═══════════════════════════════════════════════════════════ */
const EDA_VISUAL = {
  1: { highlightRows: [7],    fixNarration: { 7: 'Loan EMI Deduction (Auto-filled)' } },
  2: { highlightRows: [8] },
  3: { highlightRows: [6, 7], strikeRow: 7 },
  4: { highlightRows: [2, 4] },
};

function computeDecos(issues) {
  const fixedNarrations = {}, greenRows = new Set(), yellowRows = new Set(), strikeRows = new Set();
  if (!issues) return { fixedNarrations, greenRows, yellowRows, strikeRows };
  for (const issue of issues) {
    const map = EDA_VISUAL[issue.id];
    if (!map) continue;
    if (issue.accepted === true) {
      (map.highlightRows || []).forEach(id => greenRows.add(id));
      if (map.fixNarration) Object.assign(fixedNarrations, map.fixNarration);
      if (map.strikeRow != null) strikeRows.add(map.strikeRow);
    } else if (issue.accepted === null) {
      (map.highlightRows || []).forEach(id => { if (!greenRows.has(id)) yellowRows.add(id); });
    }
  }
  return { fixedNarrations, greenRows, yellowRows, strikeRows };
}

/* ═══════════════════════════════════════════════════════════
   TABLE BUILDER  (respects columnConfig)
═══════════════════════════════════════════════════════════ */
function getCellValue(r, colId, fixedNarrations, idx) {
  switch (colId) {
    case 'seq':       return idx + 1;
    case 'date':      return r.date;
    case 'narration': return fixedNarrations[r.id] || r.narration;
    case 'type':      return r.type;
    case 'amount':    return r.amount;
    case 'balance':   return r.balance;
    default:          return '—';
  }
}

function buildTable(records, columns, decos, theme) {
  const visCols = [...columns].filter(c => c.visible).sort((a, b) => a.order - b.order);

  /* Skeleton when no data */
  if (!records || records.length === 0) {
    const head = visCols.map(c => `<th>${c.label}</th>`).join('');
    const body = Array.from({ length: 5 }, (_, i) =>
      `<tr>${visCols.map(() => `<td><div style="height:9px;background:#E8EEF8;border-radius:3px;width:${70 + i * 12}px"></div></td>`).join('')}</tr>`
    ).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  const { fixedNarrations, greenRows, yellowRows, strikeRows } = decos;

  const head = visCols.map(c => {
    const isRight = c.format === 'currency';
    return `<th style="${isRight ? 'text-align:right' : ''}">${c.label}</th>`;
  }).join('');

  const body = records.map((r, idx) => {
    let bg = idx % 2 === 1 ? '#F4F6FB' : '#FFFFFF';
    let lb = '';
    if (greenRows.has(r.id))       { bg = '#E8F5EE'; lb = 'border-left:3px solid #1A7A4A;'; }
    else if (yellowRows.has(r.id)) { bg = '#FEF9E8'; lb = 'border-left:3px solid #D4700A;'; }
    const struck = strikeRows.has(r.id);
    const ts = struck ? 'text-decoration:line-through;opacity:.45;' : '';

    const cells = visCols.map(c => {
      const val = getCellValue(r, c.id, fixedNarrations, idx);
      if (c.format === 'badge') {
        const cr = val === 'Credit';
        const col = cr ? '#1A7A4A' : '#C0392B';
        const bg2 = cr ? '#E8F5EE' : '#FDECEA';
        return `<td><span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:9999px;background:${bg2};color:${col}${struck ? ';opacity:.45' : ''}">${val}</span></td>`;
      }
      if (c.format === 'currency') {
        const cr = r.type === 'Credit' && c.id === 'amount';
        const dr = r.type === 'Debit'  && c.id === 'amount';
        const col = cr ? '#1A7A4A' : dr ? '#C0392B' : '#0A1628';
        return `<td style="text-align:right;color:${col};font-weight:600;${ts}">₹${fmtINR(val)}</td>`;
      }
      if (c.format === 'number') {
        return `<td style="text-align:center;color:#6B7A99;font-size:10px;width:28px;${ts}">${val}</td>`;
      }
      const display = val || '<em style="color:#C0392B">Missing</em>';
      return `<td style="${ts}">${display}</td>`;
    }).join('');

    return `<tr style="background:${bg};${lb}">${cells}</tr>`;
  }).join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/* ═══════════════════════════════════════════════════════════
   SUMMARY BOXES
═══════════════════════════════════════════════════════════ */
function buildSummary(summary, theme, large) {
  if (!summary) return '';
  const isGold = theme.id === 'gold';
  const boxes  = [
    { value: `₹${fmtINR(summary.totalCredits)}`,  label: 'Total Credits',   color: '#1A7A4A' },
    { value: `₹${fmtINR(summary.totalDebits)}`,   label: 'Total Debits',    color: '#C0392B' },
    { value: `₹${fmtINR(summary.closingBalance)}`, label: 'Closing Balance', color: theme.accentColor },
    { value: summary.totalRecords ?? '—',          label: 'Transactions',    color: '#0A1628' },
  ];
  const sz = large ? '20px' : '16px';
  return `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:${large ? 8 : 20}px">
      ${boxes.map(b => `
        <div style="border:${isGold ? '2px' : '1px'} solid ${isGold ? theme.accentColor : '#C5D5ED'};
                    border-radius:6px;padding:${large ? '18px' : '13px'};text-align:center;
                    background:${isGold ? '#FFFBF2' : '#fff'}">
          <div style="font-size:${sz};font-weight:700;color:${b.color};margin-bottom:3px">${b.value}</div>
          <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.4px">${b.label}</div>
        </div>`).join('')}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   SECTION HEADING HELPER
═══════════════════════════════════════════════════════════ */
function sectionHead(text, theme, extra) {
  return `<div style="font-size:10px;font-weight:700;color:${theme.sectionColor};text-transform:uppercase;
                       letter-spacing:.6px;border-left:3px solid ${theme.sectionColor};padding-left:8px;
                       margin:14px 0 6px;display:flex;justify-content:space-between;align-items:center">
    <span>${text}</span>${extra ? `<span style="font-size:9px;font-weight:400;color:#6B7A99">${extra}</span>` : ''}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   FORMAT BUILDERS
═══════════════════════════════════════════════════════════ */

/* — Tabular ——————————————————————————————————————————————— */
function buildTabular(records, cols, decos, summary, theme) {
  return sectionHead('Transaction Details', theme) +
         buildTable(records, cols, decos, theme) +
         buildSummary(summary, theme);
}

/* — Hierarchical (group by month) ———————————————————————— */
function buildHierarchical(records, cols, decos, summary, theme) {
  if (!records || !records.length) return buildTable([], cols, decos, theme) + buildSummary(null, theme);

  const groups = {}, order = [];
  for (const r of records) {
    const [, mon, yr] = r.date.split(' ');
    const key = `${mon} ${yr}`;
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(r);
  }

  let html = '';
  for (const mon of order) {
    const gr  = groups[mon];
    const cr  = gr.filter(r => r.type === 'Credit').reduce((s, r) => s + r.amount, 0);
    const dr  = gr.filter(r => r.type === 'Debit').reduce((s, r) => s + r.amount, 0);
    html += sectionHead(mon, theme, `Cr ₹${fmtINR(cr)} · Dr ₹${fmtINR(dr)}`) +
            buildTable(gr, cols, decos, theme);
  }
  return html + buildSummary(summary, theme);
}

/* — Group By (Credit / Debit sections) ——————————————————— */
function buildGroupBy(records, cols, decos, summary, theme) {
  if (!records || !records.length) return buildTable([], cols, decos, theme) + buildSummary(null, theme);
  const credits = records.filter(r => r.type === 'Credit');
  const debits  = records.filter(r => r.type === 'Debit');
  return `
    <div style="font-size:10px;font-weight:700;color:#1A7A4A;text-transform:uppercase;
                letter-spacing:.6px;border-left:3px solid #1A7A4A;padding-left:8px;margin:8px 0 6px">
      Credits &nbsp;<span style="font-size:9px;font-weight:400">(${credits.length} transactions)</span>
    </div>
    ${buildTable(credits, cols, decos, theme)}
    <div style="font-size:10px;font-weight:700;color:#C0392B;text-transform:uppercase;
                letter-spacing:.6px;border-left:3px solid #C0392B;padding-left:8px;margin:18px 0 6px">
      Debits &nbsp;<span style="font-size:9px;font-weight:400">(${debits.length} transactions)</span>
    </div>
    ${buildTable(debits, cols, decos, theme)}
    ${buildSummary(summary, theme)}`;
}

/* — Drill Down (KPI first, top-5 table) —————————————————— */
function buildDrillDown(records, cols, decos, summary, theme) {
  const top5 = records ? [...records].sort((a, b) => b.amount - a.amount).slice(0, 5) : [];
  return `
    ${sectionHead('Key Performance Indicators', theme)}
    ${buildSummary(summary, theme, true)}
    ${sectionHead('Top Transactions by Value', theme)}
    ${buildTable(top5, cols, decos, theme)}
    <div style="font-size:9px;color:#6B7A99;margin-top:8px;font-style:italic;padding-left:2px">
      Showing top 5 of ${records ? records.length : 0} transactions · expand for full detail
    </div>`;
}

/* — Comparative (month × metric matrix) —————————————————— */
function buildComparative(records, cols, decos, summary, theme) {
  if (!records || !records.length) {
    return `<p style="color:#6B7A99;text-align:center;padding:24px;font-size:11px">No data for comparison.</p>`;
  }

  const months = {}, mOrder = [];
  for (const r of records) {
    const [, mon, yr] = r.date.split(' ');
    const key = `${mon} ${yr}`;
    if (!months[key]) { months[key] = { cr: 0, dr: 0, cnt: 0, bal: 0 }; mOrder.push(key); }
    if (r.type === 'Credit') months[key].cr += r.amount;
    else months[key].dr += r.amount;
    months[key].cnt++;
    months[key].bal = r.balance;
  }

  const mcols = mOrder.slice(0, 4);
  const metrics = [
    { label: 'Total Credits',   fn: m => `₹${fmtINR(months[m]?.cr  || 0)}`, color: '#1A7A4A' },
    { label: 'Total Debits',    fn: m => `₹${fmtINR(months[m]?.dr  || 0)}`, color: '#C0392B' },
    { label: 'Net Change',      fn: m => `₹${fmtINR((months[m]?.cr || 0) - (months[m]?.dr || 0))}`, color: '#0A1628' },
    { label: 'Closing Balance', fn: m => `₹${fmtINR(months[m]?.bal || 0)}`, color: theme.accentColor },
    { label: 'Transactions',    fn: m =>  months[m]?.cnt || 0,               color: '#0A1628' },
  ];

  const headerRow = `<tr>
    <th style="min-width:150px">Metric</th>
    ${mcols.map(m => `<th style="text-align:right">${m}</th>`).join('')}
  </tr>`;

  const bodyRows = metrics.map((met, i) => `
    <tr style="background:${i % 2 === 1 ? '#F4F6FB' : '#fff'}">
      <td style="font-weight:600;color:#0A1628">${met.label}</td>
      ${mcols.map(m => `<td style="text-align:right;color:${met.color};font-weight:500">${met.fn(m)}</td>`).join('')}
    </tr>`).join('');

  return `
    ${sectionHead('Period-wise Comparison', theme)}
    <table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>
    ${sectionHead('Transaction Details', theme)}
    ${buildTable(records, cols, decos, theme)}`;
}

/* ═══════════════════════════════════════════════════════════
   EDA BANNER
═══════════════════════════════════════════════════════════ */
function buildEdaBanner(issues) {
  if (!issues) return '';
  const accepted = issues.filter(i => i.accepted === true).length;
  const rejected = issues.filter(i => i.accepted === false).length;
  const pending  = issues.filter(i => i.accepted === null).length;
  if (accepted + rejected === 0) return '';
  return `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;padding:7px 12px;
                background:#F4F6FB;border-radius:4px;font-size:10px;border-left:3px solid #1A7A4A">
      <span style="color:#1A7A4A;font-weight:700">${accepted} fix${accepted !== 1 ? 'es' : ''} applied</span>
      ${rejected ? `<span style="color:#9BA5B8">·</span><span style="color:#6B7A99">${rejected} skipped</span>` : ''}
      ${pending  ? `<span style="color:#9BA5B8">·</span><span style="color:#D4700A;font-weight:600">${pending} pending</span>` : ''}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   MAIN ENTRY POINT
═══════════════════════════════════════════════════════════ */
export function generatePreviewHTML(context, stepKey, opts = {}) {
  const {
    liveFormData   = {},
    issues,
    pendingConfig,
    liveHeaderConfig,
    liveColumns,
    liveRecords,
  } = opts;

  /* Resolve configs */
  const hc   = liveHeaderConfig || context.headerConfig || DEFAULT_HEADER_CONFIG;
  const cols = liveColumns      || context.columnConfig  || DEFAULT_COLUMNS;

  /* Resolve template */
  const activeConfig = pendingConfig || context.promptConfig;
  const configId     = activeConfig?.id ?? 'tabular';
  const theme        = getTheme(configId);
  const templateName = getTemplateName(configId);
  const format       = getFormat(configId);

  /* Data */
  const data       = context.edaResult || context.importedData;
  const account    = (data?.account || liveFormData.account || 'ACC-XXXXXX').toUpperCase();
  const procedure  = data?.procedure || liveFormData.procedure || '';
  const periodFrom = data?.period?.from || liveFormData.dateFrom || '—';
  const periodTo   = data?.period?.to   || liveFormData.dateTo   || '—';
  const records    = liveRecords || data?.records || [];
  const summary    = data?.summary || null;

  /* Timestamps */
  const now     = new Date();
  const genDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const genTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  /* Build content */
  const decos    = computeDecos(issues);
  const edaBanner = buildEdaBanner(issues);

  let mainContent;
  switch (format) {
    case 'hierarchical': mainContent = buildHierarchical(records, cols, decos, summary, theme); break;
    case 'group-by':     mainContent = buildGroupBy(records, cols, decos, summary, theme);     break;
    case 'drill-down':   mainContent = buildDrillDown(records, cols, decos, summary, theme);   break;
    case 'comparative':  mainContent = buildComparative(records, cols, decos, summary, theme); break;
    default:             mainContent = buildTabular(records, cols, decos, summary, theme);     break;
  }

  /* Template-specific extras */
  const execBanner = (configId === 'executive-summary' || configId === 'drill-down') ? `
    <div style="background:${theme.accentColor};color:${theme.headerBg};padding:5px 16px;font-size:10px;
                font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;
                margin-bottom:14px;border-radius:3px">
      EXECUTIVE REPORT — STRICTLY CONFIDENTIAL
    </div>` : '';

  /* Watermark */
  const watermarkCSS = hc.showWatermark ? `
    body::before {
      content: '${hc.watermarkText}';
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%,-50%) rotate(-45deg);
      font-size: 72px; font-weight: 900;
      color: rgba(0,0,0,0.04);
      white-space: nowrap; pointer-events: none; z-index: 0; letter-spacing: 8px;
    }` : '';

  /* Footer */
  const footerLeft = `
    <div>
      <div style="font-weight:600;color:#0A1628;font-size:10px;margin-bottom:2px">${hc.bankName}</div>
      <div>${hc.footerNote}</div>
      ${hc.showTimestamp ? `<div style="margin-top:2px">Generated: ${genDate} at ${genTime}</div>` : ''}
      ${hc.showIP && hc.ipAddress ? `<div style="margin-top:2px">Terminal IP: ${hc.ipAddress}</div>` : ''}
    </div>`;

  const footerRight = `
    <div style="text-align:right">
      <div style="border-top:1px solid #0A1628;width:140px;margin:32px 0 4px auto"></div>
      <div style="font-size:11px;font-weight:600;color:#0A1628">${hc.officerName || 'Authorised Signatory'}</div>
      <div style="font-size:10px;color:#6B7A99">${hc.officerDesignation}, ${hc.branchName}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#0A1628;
       padding:28px 36px 0;background:#fff;min-width:620px;position:relative}
  table{width:100%;border-collapse:collapse}
  th{background:${theme.thBg};color:${theme.thText};padding:7px 10px;font-size:9px;font-weight:600;
     text-transform:uppercase;letter-spacing:.5px;text-align:left;white-space:nowrap}
  td{padding:7px 10px;border-bottom:1px solid #E8EEF8;font-size:11px;color:#2C3E60;vertical-align:middle}
  ${watermarkCSS}
</style>
</head>
<body>

<!-- ── Report Header ──────────────────────────────────────── -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;
            padding-bottom:14px;border-bottom:3px solid ${theme.borderTop};margin-bottom:18px">
  <div style="display:flex;gap:12px;align-items:center">
    ${hc.logoImage
      ? `<img src="${hc.logoImage}" style="width:44px;height:44px;object-fit:contain;border-radius:6px;flex-shrink:0;" alt="${hc.bankAbbr}" />`
      : `<div style="width:44px;height:44px;background:${theme.thBg};border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${theme.thText};letter-spacing:1px">${hc.bankAbbr}</div>`
    }
    <div>
      <div style="font-size:18px;font-weight:700;color:${theme.headerBg};letter-spacing:-.3px">
        ${hc.bankName}
      </div>
      <div style="font-size:10px;color:#6B7A99;margin-top:3px">
        ${hc.branchName}
        ${hc.showIFSC ? ` &nbsp;|&nbsp; IFSC: ${hc.ifscCode} &nbsp;|&nbsp; MICR: ${hc.micrCode}` : ''}
      </div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:14px;font-weight:600;color:#0A1628">${templateName}</div>
    ${procedure ? `<div style="font-size:10px;color:${theme.accentColor};margin-top:2px;font-family:monospace;font-weight:600">${procedure}</div>` : ''}
    ${hc.showDate ? `<div style="font-size:10px;color:#6B7A99;margin-top:2px">${genDate}</div>` : ''}
  </div>
</div>

${execBanner}

<!-- ── Meta Row ───────────────────────────────────────────── -->
<div style="display:flex;gap:18px;background:#F4F6FB;padding:10px 14px;border-radius:5px;
            margin-bottom:18px;flex-wrap:wrap">
  <div>
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Account No.</div>
    <div style="font-size:12px;font-weight:600;color:#0A1628">${account}</div>
  </div>
  <div>
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Account Type</div>
    <div style="font-size:12px;font-weight:600;color:#0A1628">Current Account</div>
  </div>
  <div>
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Period</div>
    <div style="font-size:12px;font-weight:600;color:#0A1628">${periodFrom} — ${periodTo}</div>
  </div>
  <div>
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Branch</div>
    <div style="font-size:12px;font-weight:600;color:#0A1628">${hc.branchName}</div>
  </div>
  ${procedure ? `
  <div>
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Procedure</div>
    <div style="font-size:11px;font-weight:600;color:${theme.accentColor};font-family:monospace">${procedure}</div>
  </div>` : ''}
  <div>
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Format</div>
    <div style="font-size:11px;font-weight:600;color:${theme.accentColor}">${templateName}</div>
  </div>
  ${hc.showCustomerInfo && hc.customerName ? `
  <div style="border-left:2px solid ${theme.accentColor};padding-left:10px">
    <div style="font-size:9px;color:#6B7A99;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Account Holder</div>
    <div style="font-size:12px;font-weight:600;color:#0A1628">${hc.customerName}</div>
    ${hc.customerId ? `<div style="font-size:9px;color:#6B7A99">CIF: ${hc.customerId}</div>` : ''}
  </div>` : ''}
</div>

${edaBanner}

<!-- ── Main Content ───────────────────────────────────────── -->
${mainContent}

<!-- ── Footer ─────────────────────────────────────────────── -->
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;
            padding-top:12px;border-top:1px solid #C5D5ED;font-size:9px;color:#6B7A99">
  ${footerLeft}
  ${footerRight}
</div>

<!-- ── Powered-by strip ───────────────────────────────────── -->
<div style="margin-top:10px;padding:6px 36px;background:#0A1628;
            margin-left:-36px;margin-right:-36px;
            font-size:9px;color:rgba(255,255,255,.45);text-align:center;letter-spacing:.5px">
  ${hc.poweredBy}
</div>

</body>
</html>`;
}
