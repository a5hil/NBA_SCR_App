import {
  User, Campus, Classroom, Controller, Device, Alert,
  NotificationItem, ActivityItem, EnergyReading,
  DeviceCategory, DeviceCapability,
} from '../types';

export const mockUser: User = {
  name: 'Nershel Nelson',
  initials: 'NN',
  role: 'Department Administrator',
  email: 'nershel@fisat.ac.in',
};

export const mockCampus: Campus = {
  name: 'FISAT',
  department: 'IMCA Department',
  buildings: ['Block A', 'Block B', 'Main Building'],
};

const now = new Date().toISOString();
const mins = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const hours = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

function makeController(id: string, name: string, status: 'online' | 'offline', channels: number[], ip: string): Controller {
  return {
    id, name, type: 'ESP32', status,
    signalStrength: status === 'online' ? 'strong' : 'weak',
    relayChannels: 8, usedChannels: channels,
    ipAddress: ip, firmwareVersion: '2.1.4', lastSeen: status === 'online' ? now : hours(3),
  };
}

function makeDev(
  id: string, name: string, category: DeviceCategory, status: 'on' | 'off' | 'offline',
  controllerId: string, relay: number, area: string,
  caps: Partial<DeviceCapability>, extras: Partial<Device> = {},
): Device {
  return {
    id, name, category, status, controllerId, relayChannel: relay, roomArea: area,
    capabilities: { power: true, ...caps },
    powerUsage: status === 'on' ? (extras.powerUsage ?? 60) : 0,
    energyToday: extras.energyToday ?? 0.3,
    lastUpdated: mins(Math.floor(Math.random() * 30)),
    ...extras,
  };
}

// ─── Classroom A101 ──────────────────────────────────
const ctrlA101 = makeController('ctrl-a101', 'ESP32-A101', 'online', [1,2,3,4,5,6], '192.168.1.101');
const devsA101: Device[] = [
  makeDev('dev-a101-light-1', 'Main Lights', 'light', 'on', 'ctrl-a101', 1, 'Ceiling', { brightness: true, timer: true }, { brightness: 80, powerUsage: 120, energyToday: 0.5 }),
  makeDev('dev-a101-light-2', 'Board Lights', 'light', 'on', 'ctrl-a101', 2, 'Front', { brightness: true }, { brightness: 100, powerUsage: 60, energyToday: 0.3 }),
  makeDev('dev-a101-fan-1', 'Ceiling Fan 1', 'fan', 'on', 'ctrl-a101', 3, 'Left', { speed: true, timer: true }, { speed: 3, powerUsage: 75, energyToday: 0.4 }),
  makeDev('dev-a101-fan-2', 'Ceiling Fan 2', 'fan', 'on', 'ctrl-a101', 4, 'Right', { speed: true, timer: true }, { speed: 4, powerUsage: 75, energyToday: 0.4 }),
  makeDev('dev-a101-ac', 'AC Unit', 'ac', 'on', 'ctrl-a101', 5, 'Wall', { temperature: true, mode: true, speed: true, timer: true }, { temperature: 24, mode: 'cool', fanSpeed: 'auto', powerUsage: 1400, energyToday: 2.8 }),
  makeDev('dev-a101-proj', 'Projector', 'projector', 'on', 'ctrl-a101', 6, 'Ceiling', { source: true, timer: true }, { source: 'HDMI 1', powerUsage: 280, energyToday: 0.6 }),
];

// ─── Classroom A102 (vacant with AC on — alert) ─────
const ctrlA102 = makeController('ctrl-a102', 'ESP32-A102', 'online', [1,2,3,4,5], '192.168.1.102');
const devsA102: Device[] = [
  makeDev('dev-a102-light-1', 'Main Lights', 'light', 'off', 'ctrl-a102', 1, 'Ceiling', { brightness: true }, { energyToday: 0.2 }),
  makeDev('dev-a102-light-2', 'Board Lights', 'light', 'off', 'ctrl-a102', 2, 'Front', { brightness: true }, { energyToday: 0.1 }),
  makeDev('dev-a102-fan-1', 'Ceiling Fan 1', 'fan', 'off', 'ctrl-a102', 3, 'Center', { speed: true }, { energyToday: 0.2 }),
  makeDev('dev-a102-fan-2', 'Ceiling Fan 2', 'fan', 'off', 'ctrl-a102', 4, 'Center', { speed: true }, { energyToday: 0.1 }),
  makeDev('dev-a102-ac', 'AC Unit', 'ac', 'on', 'ctrl-a102', 5, 'Wall', { temperature: true, mode: true, speed: true, timer: true }, { temperature: 22, mode: 'cool', fanSpeed: 'medium', powerUsage: 1500, energyToday: 1.2 }),
];

// ─── Seminar Hall ────────────────────────────────────
const ctrlSeminar = makeController('ctrl-seminar', 'ESP32-Seminar', 'online', [1,2,3,4,5,6,7,8], '192.168.1.110');
const devsSeminar: Device[] = [
  makeDev('dev-sem-light-1', 'Hall Lights Row 1', 'light', 'on', 'ctrl-seminar', 1, 'Ceiling', { brightness: true }, { brightness: 90, powerUsage: 200, energyToday: 0.6 }),
  makeDev('dev-sem-light-2', 'Hall Lights Row 2', 'light', 'on', 'ctrl-seminar', 2, 'Ceiling', { brightness: true }, { brightness: 90, powerUsage: 200, energyToday: 0.6 }),
  makeDev('dev-sem-ac-1', 'AC Unit 1', 'ac', 'on', 'ctrl-seminar', 3, 'Left Wall', { temperature: true, mode: true, speed: true }, { temperature: 22, mode: 'cool', fanSpeed: 'high', powerUsage: 1800, energyToday: 1.4 }),
  makeDev('dev-sem-ac-2', 'AC Unit 2', 'ac', 'on', 'ctrl-seminar', 4, 'Right Wall', { temperature: true, mode: true, speed: true }, { temperature: 22, mode: 'cool', fanSpeed: 'high', powerUsage: 1800, energyToday: 1.2 }),
  makeDev('dev-sem-proj', 'Projector', 'projector', 'on', 'ctrl-seminar', 5, 'Ceiling', { source: true }, { source: 'HDMI 1', powerUsage: 350, energyToday: 0.8 }),
  makeDev('dev-sem-board', 'Smart Board', 'smart-board', 'on', 'ctrl-seminar', 6, 'Front', {}, { powerUsage: 150, energyToday: 0.4 }),
  makeDev('dev-sem-speaker', 'PA System', 'speaker', 'on', 'ctrl-seminar', 7, 'Side', { volume: true }, { volume: 65, powerUsage: 100, energyToday: 0.3 }),
  makeDev('dev-sem-cctv', 'CCTV Camera', 'cctv', 'on', 'ctrl-seminar', 8, 'Corner', {}, { powerUsage: 15, energyToday: 0.1 }),
];

// ─── Computer Lab 1 ──────────────────────────────────
const ctrlCompLab = makeController('ctrl-complab1', 'ESP32-CompLab1', 'online', [1,2,3,4,5,6], '192.168.1.120');
const devsCompLab: Device[] = [
  makeDev('dev-cl1-light-1', 'Lab Lights', 'light', 'on', 'ctrl-complab1', 1, 'Ceiling', { brightness: true }, { brightness: 100, powerUsage: 160, energyToday: 0.5 }),
  makeDev('dev-cl1-light-2', 'Task Lights', 'light', 'on', 'ctrl-complab1', 2, 'Desks', { brightness: true }, { brightness: 70, powerUsage: 80, energyToday: 0.3 }),
  makeDev('dev-cl1-ac-1', 'AC Unit 1', 'ac', 'on', 'ctrl-complab1', 3, 'Left', { temperature: true, mode: true, speed: true }, { temperature: 23, mode: 'cool', fanSpeed: 'high', powerUsage: 1800, energyToday: 1.8 }),
  makeDev('dev-cl1-ac-2', 'AC Unit 2', 'ac', 'on', 'ctrl-complab1', 4, 'Right', { temperature: true, mode: true, speed: true }, { temperature: 23, mode: 'cool', fanSpeed: 'high', powerUsage: 1800, energyToday: 1.6 }),
  makeDev('dev-cl1-proj', 'Projector', 'projector', 'on', 'ctrl-complab1', 5, 'Ceiling', { source: true }, { source: 'VGA', powerUsage: 300, energyToday: 0.7 }),
  makeDev('dev-cl1-outlet', 'Charging Station', 'charging-outlet', 'on', 'ctrl-complab1', 6, 'Desks', {}, { powerUsage: 400, energyToday: 0.8 }),
];

// ─── Classroom B204 (offline controller) ─────────────
const ctrlB204 = makeController('ctrl-b204', 'ESP32-B204', 'offline', [1,2,3,4,5], '192.168.1.204');
const devsB204: Device[] = [
  makeDev('dev-b204-light-1', 'Main Lights', 'light', 'offline', 'ctrl-b204', 1, 'Ceiling', { brightness: true }, { energyToday: 0.1 }),
  makeDev('dev-b204-light-2', 'Board Lights', 'light', 'offline', 'ctrl-b204', 2, 'Front', { brightness: true }, { energyToday: 0.05 }),
  makeDev('dev-b204-fan-1', 'Ceiling Fan 1', 'fan', 'offline', 'ctrl-b204', 3, 'Center', { speed: true }, { energyToday: 0.1 }),
  makeDev('dev-b204-fan-2', 'Ceiling Fan 2', 'fan', 'offline', 'ctrl-b204', 4, 'Center', { speed: true }, { energyToday: 0.05 }),
  makeDev('dev-b204-ac', 'AC Unit', 'ac', 'offline', 'ctrl-b204', 5, 'Wall', { temperature: true, mode: true }, { energyToday: 0.2 }),
];

// ─── Electronics Lab ─────────────────────────────────
const ctrlELab = makeController('ctrl-elab', 'ESP32-ELab', 'online', [1,2,3,4,5,6,7], '192.168.1.130');
const devsELab: Device[] = [
  makeDev('dev-elab-light-1', 'Lab Lights', 'light', 'on', 'ctrl-elab', 1, 'Ceiling', { brightness: true }, { brightness: 100, powerUsage: 120, energyToday: 0.4 }),
  makeDev('dev-elab-fan-1', 'Exhaust Fan', 'exhaust-fan', 'on', 'ctrl-elab', 2, 'Wall', {}, { powerUsage: 80, energyToday: 0.3 }),
  makeDev('dev-elab-fan-2', 'Ceiling Fan', 'fan', 'on', 'ctrl-elab', 3, 'Center', { speed: true }, { speed: 4, powerUsage: 75, energyToday: 0.3 }),
  makeDev('dev-elab-ac', 'AC Unit', 'ac', 'on', 'ctrl-elab', 4, 'Wall', { temperature: true, mode: true, speed: true }, { temperature: 24, mode: 'cool', fanSpeed: 'auto', powerUsage: 1400, energyToday: 1.1 }),
  makeDev('dev-elab-proj', 'Projector', 'projector', 'off', 'ctrl-elab', 5, 'Ceiling', { source: true }, { energyToday: 0.1 }),
  makeDev('dev-elab-outlet', 'Workbench Power', 'charging-outlet', 'on', 'ctrl-elab', 6, 'Benches', {}, { powerUsage: 300, energyToday: 0.5 }),
  makeDev('dev-elab-cctv', 'CCTV', 'cctv', 'on', 'ctrl-elab', 7, 'Corner', {}, { powerUsage: 15, energyToday: 0.1 }),
];

// ─── Classroom A201 ──────────────────────────────────
const ctrlA201 = makeController('ctrl-a201', 'ESP32-A201', 'online', [1,2,3,4,5,6], '192.168.1.201');
const devsA201: Device[] = [
  makeDev('dev-a201-light-1', 'Main Lights', 'light', 'on', 'ctrl-a201', 1, 'Ceiling', { brightness: true }, { brightness: 85, powerUsage: 120, energyToday: 0.3 }),
  makeDev('dev-a201-light-2', 'Board Lights', 'light', 'on', 'ctrl-a201', 2, 'Front', { brightness: true }, { brightness: 100, powerUsage: 60, energyToday: 0.2 }),
  makeDev('dev-a201-fan-1', 'Ceiling Fan 1', 'fan', 'on', 'ctrl-a201', 3, 'Left', { speed: true }, { speed: 3, powerUsage: 75, energyToday: 0.2 }),
  makeDev('dev-a201-fan-2', 'Ceiling Fan 2', 'fan', 'on', 'ctrl-a201', 4, 'Right', { speed: true }, { speed: 3, powerUsage: 75, energyToday: 0.2 }),
  makeDev('dev-a201-ac', 'AC Unit', 'ac', 'on', 'ctrl-a201', 5, 'Wall', { temperature: true, mode: true, speed: true, timer: true }, { temperature: 23, mode: 'cool', fanSpeed: 'auto', powerUsage: 1400, energyToday: 0.9 }),
  makeDev('dev-a201-tv', 'Smart TV', 'television', 'off', 'ctrl-a201', 6, 'Front', { volume: true, source: true, direction: true }, { energyToday: 0.1 }),
];

// ─── Classroom B101 (vacant, all off) ────────────────
const ctrlB101 = makeController('ctrl-b101', 'ESP32-B101', 'online', [1,2,3,4,5], '192.168.1.150');
const devsB101: Device[] = [
  makeDev('dev-b101-light-1', 'Main Lights', 'light', 'off', 'ctrl-b101', 1, 'Ceiling', { brightness: true }, { energyToday: 0.1 }),
  makeDev('dev-b101-fan-1', 'Ceiling Fan 1', 'fan', 'off', 'ctrl-b101', 2, 'Center', { speed: true }, { energyToday: 0.1 }),
  makeDev('dev-b101-fan-2', 'Ceiling Fan 2', 'fan', 'off', 'ctrl-b101', 3, 'Center', { speed: true }, { energyToday: 0.05 }),
  makeDev('dev-b101-ac', 'AC Unit', 'ac', 'off', 'ctrl-b101', 4, 'Wall', { temperature: true, mode: true }, { energyToday: 0.1 }),
  makeDev('dev-b101-proj', 'Projector', 'projector', 'off', 'ctrl-b101', 5, 'Ceiling', { source: true }, { energyToday: 0.05 }),
];

// ─── Library Hall ────────────────────────────────────
const ctrlLibrary = makeController('ctrl-library', 'ESP32-Library', 'online', [1,2,3,4,5,6,7,8], '192.168.1.160');
const devsLibrary: Device[] = [
  makeDev('dev-lib-light-1', 'Reading Lights', 'light', 'on', 'ctrl-library', 1, 'Ceiling', { brightness: true }, { brightness: 70, powerUsage: 160, energyToday: 0.4 }),
  makeDev('dev-lib-light-2', 'Ambient Lights', 'light', 'on', 'ctrl-library', 2, 'Walls', { brightness: true, colorTemp: true }, { brightness: 50, powerUsage: 80, energyToday: 0.2 }),
  makeDev('dev-lib-ac-1', 'AC Unit 1', 'ac', 'on', 'ctrl-library', 3, 'Left', { temperature: true, mode: true, speed: true }, { temperature: 22, mode: 'cool', fanSpeed: 'low', powerUsage: 1200, energyToday: 0.9 }),
  makeDev('dev-lib-ac-2', 'AC Unit 2', 'ac', 'on', 'ctrl-library', 4, 'Right', { temperature: true, mode: true, speed: true }, { temperature: 22, mode: 'cool', fanSpeed: 'low', powerUsage: 1200, energyToday: 0.8 }),
  makeDev('dev-lib-cctv-1', 'CCTV Entry', 'cctv', 'on', 'ctrl-library', 5, 'Entrance', {}, { powerUsage: 15, energyToday: 0.1 }),
  makeDev('dev-lib-cctv-2', 'CCTV Hall', 'cctv', 'on', 'ctrl-library', 6, 'Center', {}, { powerUsage: 15, energyToday: 0.1 }),
  makeDev('dev-lib-lock', 'Smart Lock', 'smart-lock', 'on', 'ctrl-library', 7, 'Main Door', {}, { powerUsage: 5, energyToday: 0.02 }),
  makeDev('dev-lib-curtain', 'Window Blinds', 'curtain', 'on', 'ctrl-library', 8, 'Windows', {}, { powerUsage: 10, energyToday: 0.03 }),
];

// ─── Workshop ────────────────────────────────────────
const ctrlWorkshop = makeController('ctrl-workshop', 'ESP32-Workshop', 'online', [1,2,3,4,5,6], '192.168.1.170');
const devsWorkshop: Device[] = [
  makeDev('dev-ws-light-1', 'Bay Lights', 'light', 'on', 'ctrl-workshop', 1, 'Ceiling', { brightness: true }, { brightness: 100, powerUsage: 240, energyToday: 0.5 }),
  makeDev('dev-ws-fan-1', 'Exhaust Fan 1', 'exhaust-fan', 'on', 'ctrl-workshop', 2, 'Wall', {}, { powerUsage: 120, energyToday: 0.3 }),
  makeDev('dev-ws-fan-2', 'Exhaust Fan 2', 'exhaust-fan', 'on', 'ctrl-workshop', 3, 'Wall', {}, { powerUsage: 120, energyToday: 0.3 }),
  makeDev('dev-ws-outlet-1', 'Power Strip A', 'charging-outlet', 'on', 'ctrl-workshop', 4, 'Workbench', {}, { powerUsage: 800, energyToday: 0.8 }),
  makeDev('dev-ws-outlet-2', 'Power Strip B', 'charging-outlet', 'on', 'ctrl-workshop', 5, 'Workbench', {}, { powerUsage: 600, energyToday: 0.6 }),
  makeDev('dev-ws-cctv', 'CCTV', 'cctv', 'on', 'ctrl-workshop', 6, 'Corner', {}, { powerUsage: 15, energyToday: 0.1 }),
];

function makeActivity(id: string, action: string, user: string, time: string, classroomId?: string): ActivityItem {
  return { id, action, user, time, classroomId };
}

export const mockClassrooms: Classroom[] = [
  {
    id: 'cls-a101', name: 'Classroom A101', number: 'A101', department: 'IMCA', building: 'Block A', floor: '1st Floor',
    capacity: 60, occupancy: 'occupied', status: 'online', temperature: 24, currentLoad: 2010, energyToday: 5.0,
    estimatedCost: 40.0, controller: ctrlA101, devices: devsA101, alerts: [],
    recentActivity: [
      makeActivity('act-1', 'Main Lights turned on', 'Nershel', mins(15), 'cls-a101'),
      makeActivity('act-2', 'AC temperature set to 24°C', 'Nershel', mins(30), 'cls-a101'),
      makeActivity('act-3', 'Projector turned on', 'Prof. Mathew', hours(1), 'cls-a101'),
    ],
  },
  {
    id: 'cls-a102', name: 'Classroom A102', number: 'A102', department: 'IMCA', building: 'Block A', floor: '1st Floor',
    capacity: 40, occupancy: 'vacant', status: 'online', temperature: 26, currentLoad: 1500, energyToday: 1.8,
    estimatedCost: 14.4, controller: ctrlA102, devices: devsA102,
    alerts: [{ id: 'alert-1', classroomId: 'cls-a102', classroomName: 'Classroom A102', severity: 'warning', message: 'AC running in vacant Classroom A102', time: mins(10), isRead: false }],
    recentActivity: [
      makeActivity('act-4', 'Classroom became vacant', 'System', mins(45), 'cls-a102'),
      makeActivity('act-5', 'Lights turned off automatically', 'System', mins(44), 'cls-a102'),
    ],
  },
  {
    id: 'cls-seminar', name: 'Seminar Hall', number: 'SH-01', department: 'IMCA', building: 'Main Building', floor: 'Ground Floor',
    capacity: 200, occupancy: 'occupied', status: 'online', temperature: 22, currentLoad: 4615, energyToday: 5.4,
    estimatedCost: 43.2, controller: ctrlSeminar, devices: devsSeminar,
    alerts: [{ id: 'alert-3', classroomId: 'cls-seminar', classroomName: 'Seminar Hall', severity: 'warning', message: 'Projector left on for 2 hours in Seminar Hall', time: hours(2), isRead: false }],
    recentActivity: [
      makeActivity('act-6', 'Smart Board turned on', 'Prof. Kumar', mins(20), 'cls-seminar'),
      makeActivity('act-7', 'PA System volume set to 65%', 'Admin', mins(25), 'cls-seminar'),
    ],
  },
  {
    id: 'cls-complab1', name: 'Computer Lab 1', number: 'CL-01', department: 'IMCA', building: 'Block A', floor: '2nd Floor',
    capacity: 50, occupancy: 'occupied', status: 'online', temperature: 23, currentLoad: 4540, energyToday: 5.7,
    estimatedCost: 45.6, controller: ctrlCompLab, devices: devsCompLab,
    alerts: [{ id: 'alert-4', classroomId: 'cls-complab1', classroomName: 'Computer Lab 1', severity: 'info', message: 'High power consumption in Computer Lab 1', time: mins(5), isRead: false }],
    recentActivity: [
      makeActivity('act-8', 'All systems powered on', 'Lab Admin', hours(2), 'cls-complab1'),
    ],
  },
  {
    id: 'cls-b204', name: 'Classroom B204', number: 'B204', department: 'IMCA', building: 'Block B', floor: '2nd Floor',
    capacity: 45, occupancy: 'vacant', status: 'offline', temperature: 28, currentLoad: 0, energyToday: 0.5,
    estimatedCost: 4.0, controller: ctrlB204, devices: devsB204,
    alerts: [{ id: 'alert-2', classroomId: 'cls-b204', classroomName: 'Classroom B204', severity: 'critical', message: 'Controller offline in Classroom B204', time: hours(1), isRead: false }],
    recentActivity: [
      makeActivity('act-9', 'Controller went offline', 'System', hours(1), 'cls-b204'),
    ],
  },
  {
    id: 'cls-elab', name: 'Electronics Lab', number: 'EL-01', department: 'IMCA', building: 'Block B', floor: '1st Floor',
    capacity: 35, occupancy: 'occupied', status: 'online', temperature: 24, currentLoad: 1990, energyToday: 2.8,
    estimatedCost: 22.4, controller: ctrlELab, devices: devsELab,
    alerts: [{ id: 'alert-5', classroomId: 'cls-elab', classroomName: 'Electronics Lab', severity: 'warning', message: 'Exhaust fan not responding in Electronics Lab', time: mins(20), isRead: false }],
    recentActivity: [
      makeActivity('act-10', 'Lab session started', 'Prof. Rajan', hours(1.5), 'cls-elab'),
    ],
  },
  {
    id: 'cls-a201', name: 'Classroom A201', number: 'A201', department: 'IMCA', building: 'Block A', floor: '2nd Floor',
    capacity: 55, occupancy: 'occupied', status: 'online', temperature: 23, currentLoad: 1730, energyToday: 1.9,
    estimatedCost: 15.2, controller: ctrlA201, devices: devsA201, alerts: [],
    recentActivity: [
      makeActivity('act-11', 'AC turned on', 'Nershel', mins(60), 'cls-a201'),
    ],
  },
  {
    id: 'cls-b101', name: 'Classroom B101', number: 'B101', department: 'IMCA', building: 'Block B', floor: '1st Floor',
    capacity: 50, occupancy: 'vacant', status: 'online', temperature: 27, currentLoad: 0, energyToday: 0.4,
    estimatedCost: 3.2, controller: ctrlB101, devices: devsB101, alerts: [],
    recentActivity: [
      makeActivity('act-12', 'All devices turned off', 'System', hours(2), 'cls-b101'),
    ],
  },
  {
    id: 'cls-library', name: 'Library Hall', number: 'LH-01', department: 'IMCA', building: 'Main Building', floor: '1st Floor',
    capacity: 100, occupancy: 'occupied', status: 'online', temperature: 22, currentLoad: 2685, energyToday: 2.55,
    estimatedCost: 20.4, controller: ctrlLibrary, devices: devsLibrary, alerts: [],
    recentActivity: [
      makeActivity('act-13', 'Smart lock unlocked', 'Librarian', hours(4), 'cls-library'),
    ],
  },
  {
    id: 'cls-workshop', name: 'Workshop', number: 'WS-01', department: 'IMCA', building: 'Block B', floor: 'Ground Floor',
    capacity: 30, occupancy: 'occupied', status: 'online', temperature: 25, currentLoad: 1895, energyToday: 2.6,
    estimatedCost: 20.8, controller: ctrlWorkshop, devices: devsWorkshop, alerts: [],
    recentActivity: [
      makeActivity('act-14', 'Workshop session started', 'Prof. Singh', hours(1), 'cls-workshop'),
    ],
  },
];

export const mockAlerts: Alert[] = [
  { id: 'alert-1', classroomId: 'cls-a102', classroomName: 'Classroom A102', severity: 'warning', message: 'AC running in vacant Classroom A102', time: mins(10), isRead: false },
  { id: 'alert-2', classroomId: 'cls-b204', classroomName: 'Classroom B204', severity: 'critical', message: 'Controller offline in Classroom B204', time: hours(1), isRead: false },
  { id: 'alert-3', classroomId: 'cls-seminar', classroomName: 'Seminar Hall', severity: 'warning', message: 'Projector left on for 2 hours in Seminar Hall', time: hours(2), isRead: false },
  { id: 'alert-4', classroomId: 'cls-complab1', classroomName: 'Computer Lab 1', severity: 'info', message: 'High power consumption in Computer Lab 1', time: mins(5), isRead: false },
  { id: 'alert-5', classroomId: 'cls-elab', classroomName: 'Electronics Lab', severity: 'warning', message: 'Exhaust fan not responding in Electronics Lab', time: mins(20), isRead: false },
];

export const mockNotifications: NotificationItem[] = [
  { id: 'notif-1', type: 'device-left-on', title: 'AC Left Running', message: 'AC is still running in vacant Classroom A102', classroomId: 'cls-a102', classroomName: 'Classroom A102', time: mins(10), isRead: false },
  { id: 'notif-2', type: 'device-offline', title: 'Controller Offline', message: 'ESP32-B204 controller is not responding', classroomId: 'cls-b204', classroomName: 'Classroom B204', time: hours(1), isRead: false },
  { id: 'notif-3', type: 'high-consumption', title: 'High Power Usage', message: 'Computer Lab 1 consuming 4.5 kW — 30% above average', classroomId: 'cls-complab1', classroomName: 'Computer Lab 1', time: mins(5), isRead: false },
  { id: 'notif-4', type: 'device-left-on', title: 'Projector Left On', message: 'Projector has been on for 2 hours in Seminar Hall', classroomId: 'cls-seminar', classroomName: 'Seminar Hall', time: hours(2), isRead: false },
  { id: 'notif-5', type: 'classroom-vacant', title: 'Classroom Vacant', message: 'Classroom A102 is now vacant', classroomId: 'cls-a102', classroomName: 'Classroom A102', time: mins(45), isRead: true },
  { id: 'notif-6', type: 'controller-reconnected', title: 'Controller Back Online', message: 'ESP32-A201 reconnected successfully', classroomId: 'cls-a201', classroomName: 'Classroom A201', time: hours(5), isRead: true },
  { id: 'notif-7', type: 'maintenance-reminder', title: 'Maintenance Due', message: 'AC filter cleaning due for Seminar Hall', classroomId: 'cls-seminar', classroomName: 'Seminar Hall', time: hours(24), isRead: true },
  { id: 'notif-8', type: 'device-offline', title: 'Exhaust Fan Issue', message: 'Exhaust fan in Electronics Lab not responding', classroomId: 'cls-elab', classroomName: 'Electronics Lab', time: hours(26), isRead: true },
  { id: 'notif-9', type: 'high-consumption', title: 'Daily Report', message: 'Yesterday\'s total consumption: 19.8 kWh — 5% lower than average', time: hours(30), isRead: true },
  { id: 'notif-10', type: 'maintenance-reminder', title: 'Projector Lamp', message: 'Projector lamp in A101 approaching end of life (2100 hrs)', classroomId: 'cls-a101', classroomName: 'Classroom A101', time: hours(48), isRead: true },
];

export const mockEnergyData: { hourly: EnergyReading[]; daily: EnergyReading[]; weekly: EnergyReading[] } = {
  hourly: Array.from({ length: 24 }, (_, i) => ({
    time: `${i.toString().padStart(2, '0')}:00`,
    value: i < 6 ? 0.2 + Math.random() * 0.3
      : i < 9 ? 0.5 + Math.random() * 1.0
      : i < 17 ? 1.5 + Math.random() * 2.0
      : i < 20 ? 0.8 + Math.random() * 1.0
      : 0.3 + Math.random() * 0.4,
  })),
  daily: [
    { time: 'Mon', value: 18.2 }, { time: 'Tue', value: 22.1 },
    { time: 'Wed', value: 19.8 }, { time: 'Thu', value: 23.4 },
    { time: 'Fri', value: 21.4 }, { time: 'Sat', value: 8.2 },
    { time: 'Sun', value: 4.1 },
  ],
  weekly: [
    { time: 'Week 1', value: 112 }, { time: 'Week 2', value: 108 },
    { time: 'Week 3', value: 119 }, { time: 'Week 4', value: 104 },
  ],
};
