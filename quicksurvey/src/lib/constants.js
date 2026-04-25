// Colors
export const C = {
  bg: '#e4e7ec', surface: '#f5f6f8', card: '#ffffff',
  navyDark: '#111827', navyMid: '#1e3a5f',
  blue: '#2563eb', blueDim: '#2563eb12', blueBorder: '#2563eb40',
  border: '#dde1e7', borderDark: '#c4c9d4',
  text: '#111827', textDim: '#4b5563', textMuted: '#9ca3af',
  torepair: '#3b82f6', fixing: '#8b5cf6', done: '#22c55e',
  declined: '#dc2626',
  greyPin: '#9ca3af',
};

// Statuses
export const ST = { TOREPAIR: 'torepair', FIXING: 'fixing', DONE: 'done' };
export const SC = { torepair: C.torepair, fixing: C.fixing, done: C.done };
export const SL = { torepair: 'To Repair', fixing: 'Fixing', done: 'Done' };

// Roles
export const ROLES = [
  { id: 'admin',   label: 'Admin',   desc: 'Full control' },
  { id: 'manager', label: 'Manager', desc: 'Create projects, manage crew' },
  { id: 'crew',    label: 'Crew',    desc: 'Survey & repair work' },
  { id: 'client',  label: 'Client',  desc: 'Review & approve surveys' },
];

// Repair types with measurement formulas
export const RT = [
  { id: 'volumen', label: 'Volume', unit: 'L',
    fields: [{ k: 'largo', l: 'Length (mm)' }, { k: 'ancho', l: 'Width (mm)' }, { k: 'prof', l: 'Depth (mm)' }],
    calc: d => {
      const v = (parseFloat(d.largo || 0) * parseFloat(d.ancho || 0) * parseFloat(d.prof || 0)) / 1000000;
      return v > 0 ? v.toFixed(3) + ' L' : '—';
    }
  },
  { id: 'area', label: 'Area', unit: 'm²',
    fields: [{ k: 'd1', l: 'Dim 1 (mm)' }, { k: 'd2', l: 'Dim 2 (mm)' }],
    calc: d => {
      const a = (parseFloat(d.d1 || 0) * parseFloat(d.d2 || 0)) / 1000000;
      return a > 0 ? a.toFixed(4) + ' m²' : '—';
    }
  },
  { id: 'linear', label: 'Linear m', unit: 'm',
    fields: [{ k: 'len', l: 'Length (mm)' }],
    calc: d => {
      const m = parseFloat(d.len || 0) / 1000;
      return m > 0 ? m.toFixed(3) + ' m' : '—';
    }
  },
  { id: 'cantidad', label: 'Qty', unit: 'ud',
    fields: [{ k: 'qty', l: 'Quantity' }],
    calc: d => parseFloat(d.qty || 0) > 0 ? parseFloat(d.qty || 0).toFixed(0) + ' ud' : '—'
  },
  { id: 'other', label: 'Other', unit: '—',
    fields: [],
    calc: () => '—'
  },
];

// Hazard levels
export const HAZARDS = [
  { id: 'yellow', label: 'Recommendation', color: '#d97706' },
  { id: 'orange', label: 'Urgent',         color: '#ea580c' },
  { id: 'red',    label: 'Hazard',         color: '#dc2626' },
];
export const HC = { yellow: '#d97706', orange: '#ea580c', red: '#dc2626' };

// Test users for quick switching during demo
export const TEST_USERS = [
  { name: 'Lionel Melo', company: 'Altitude Access', initials: 'LM' },
  { name: 'John Smith',  company: 'Altitude Access', initials: 'JS' },
];

// Storage keys
export const SKEY_USER = 'ral-qs-user-v8';
export const APP_VERSION = 'v9-vite';
