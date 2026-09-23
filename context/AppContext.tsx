import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  User, Campus, Classroom, Device, Controller, Alert, NotificationItem, ActivityItem, EnergyReading,
  DeviceCategory, DeviceStatus, DeviceCapability, ClassroomStatus, OccupancyStatus, AlertSeverity, NotificationType,
  ESP32Telemetry,
} from '../types';
import {
  mockUser, mockCampus, mockClassrooms, mockAlerts, mockNotifications, mockEnergyData,
} from '../mock_data/mockData';

interface QuickControls {
  allLights: boolean;
  allFans: boolean;
  allCurtains: boolean;
}

interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User;
  campus: Campus;
  classrooms: Classroom[];
  alerts: Alert[];
  notifications: NotificationItem[];
  energyData: { hourly: EnergyReading[]; daily: EnergyReading[]; weekly: EnergyReading[] };
  quickControls: QuickControls;
  toast: ToastState | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  toggleDevice: (classroomId: string, deviceId: string) => void;
  toggleQuickControl: (control: keyof QuickControls) => void;
  emergencyOff: () => void;
  addClassroom: (classroom: Classroom) => void;
  addDevice: (classroomId: string, device: Device) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  dismissAlert: (id: string) => void;
  resetData: () => void;
  updateDeviceValue: (classroomId: string, deviceId: string, updates: Partial<Device>) => void;
  esp32Ip: string;
  setEsp32Ip: (ip: string) => Promise<void>;
  esp32Connected: boolean;
  esp32Telemetry: ESP32Telemetry | null;
  systemMode: 'auto' | 'manual';
  setSystemMode: (mode: 'auto' | 'manual') => Promise<void>;
  syncWithEsp32: () => Promise<boolean>;
  openEsp32WebConsole: () => void;
  toggleEsp32Mode: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const categoryMap: Record<keyof QuickControls, string> = {
  allLights: 'light',
  allFans: 'fan',
  allCurtains: 'curtain',
};

const STORAGE_KEYS = {
  CLASSROOMS: '@classrooms',
  ALERTS: '@alerts',
  NOTIFICATIONS: '@notifications',
  QUICK_CONTROLS: '@quickControls',
  ESP32_IP: '@esp32_ip',
  SYSTEM_MODE: '@system_mode',
};

const SETTING_KEYS = ['brightness', 'speed', 'temperature', 'mode', 'fanSpeed', 'volume', 'source', 'direction', 'colorTemp'] as const;

function deviceSettings(dev: Device): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  const record = dev as unknown as Record<string, unknown>;
  for (const k of SETTING_KEYS) {
    if (record[k] !== undefined) s[k] = record[k];
  }
  return s;
}

// ─── ESP32 Hardware Integration Helpers ──────────────────────────────
function mapDeviceToEsp32Code(classroomId: string, device: Device): string {
  const isC1 = classroomId.includes('101') || classroomId === 'cls-a101';
  const isC2 = classroomId.includes('102') || classroomId === 'cls-a102';
  const isCorr = classroomId.includes('corr') || classroomId === 'cls-corridor';

  if (isCorr) {
    return device.id.includes('2') ? 'cr2' : 'cr1';
  }
  if (isC2) {
    if (device.category === 'light') return 'l2';
    if (device.category === 'fan') return 'f2';
    if (device.category === 'curtain') return 'c2';
  }
  if (isC1) {
    if (device.category === 'light') return 'l1';
    if (device.category === 'fan') return 'f1';
    if (device.category === 'curtain') return 'c1';
  }
  return isC2 ? 'l2' : 'l1';
}

async function sendEsp32Command(ip: string, dev: string, st: boolean) {
  if (!ip || ip.trim() === '') return;
  const baseUrl = ip.startsWith('http') ? ip.trim() : `http://${ip.trim()}`;
  const url = `${baseUrl}/ctrl?dev=${encodeURIComponent(dev)}&st=${st ? '1' : '0'}&force=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    await fetch(url, { signal: controller.signal });
  } catch (e) {
    // Non-intrusive logging - gracefully handles offline controllers or simulation mode
    console.log(`[ESP32 Sync] Controller at ${ip} offline/simulated:`, (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Supabase row types ──────────────────────────────────────────────
interface CampusRow { id: string; name: string; department: string; buildings: string[] | null; }
interface ClassroomRow {
  id: string; name: string; room_number: string; department: string; building: string; floor: string;
  capacity: number; occupancy_status: string; status: string; temperature: number; current_load: number;
  energy_today: number; estimated_cost: number;
}
interface ControllerRow {
  id: string; classroom_id: string; name: string; type: string; status: string; signal_strength: string;
  ip_address: string | null; firmware_version: string | null; relay_channels: number | null;
  used_channels: number[] | null; last_seen: string;
}
interface DeviceRow {
  id: string; classroom_id: string; controller_id: string; name: string; category: string; status: string;
  relay_channel: number; room_area: string; capabilities: Record<string, boolean> | null;
  settings: Record<string, unknown> | null; power_usage: number; energy_today: number; last_updated: string;
}
interface AlertRow {
  id: string; classroom_id: string | null; classroom_name: string | null; severity: string;
  message: string; is_read: boolean; created_at: string;
}
interface NotificationRow {
  id: string; type: string; title: string; message: string; classroom_id: string | null;
  classroom_name: string | null; is_read: boolean; created_at: string;
}
interface ActivityRow { id: string; classroom_id: string | null; action: string; user: string; created_at: string; }

function mapCampus(row: CampusRow): Campus {
  return { name: row.name, department: row.department, buildings: row.buildings ?? [] };
}

function mapController(row: ControllerRow): Controller {
  return {
    id: row.id, name: row.name, type: row.type, status: row.status as Controller['status'],
    signalStrength: row.signal_strength as Controller['signalStrength'],
    relayChannels: row.relay_channels ?? 8, usedChannels: row.used_channels ?? [],
    ipAddress: row.ip_address ?? '', firmwareVersion: row.firmware_version ?? '',
    lastSeen: row.last_seen,
  };
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id, name: row.name, category: row.category as DeviceCategory,
    status: row.status as DeviceStatus, controllerId: row.controller_id,
    relayChannel: row.relay_channel, roomArea: row.room_area,
    capabilities: (row.capabilities as DeviceCapability | null) ?? { power: true },
    powerUsage: row.power_usage, energyToday: row.energy_today, lastUpdated: row.last_updated,
    ...(row.settings ?? {}),
  };
}

function mapAlert(row: AlertRow): Alert {
  return {
    id: row.id, classroomId: row.classroom_id ?? '', classroomName: row.classroom_name ?? '',
    severity: row.severity as AlertSeverity, message: row.message,
    time: row.created_at, isRead: row.is_read,
  };
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id, type: row.type as NotificationType, title: row.title, message: row.message,
    classroomId: row.classroom_id ?? undefined, classroomName: row.classroom_name ?? undefined,
    time: row.created_at, isRead: row.is_read,
  };
}

function mapActivity(row: ActivityRow): ActivityItem {
  return {
    id: row.id, action: row.action, user: row.user, time: row.created_at,
    classroomId: row.classroom_id ?? undefined,
  };
}

function buildClassrooms(
  classroomRows: ClassroomRow[],
  controllerRows: ControllerRow[],
  deviceRows: DeviceRow[],
  alertRows: AlertRow[],
  activityRows: ActivityRow[],
): Classroom[] {
  const controllersByClass = new Map<string, Controller>();
  for (const r of controllerRows) controllersByClass.set(r.classroom_id, mapController(r));

  const devicesByClass = new Map<string, Device[]>();
  for (const r of deviceRows) {
    if (r.id === 'dev-system-mode') continue;
    const list = devicesByClass.get(r.classroom_id) ?? [];
    list.push(mapDevice(r));
    devicesByClass.set(r.classroom_id, list);
  }

  const alertsByClass = new Map<string, Alert[]>();
  for (const r of alertRows) {
    if (!r.classroom_id) continue;
    const list = alertsByClass.get(r.classroom_id) ?? [];
    list.push(mapAlert(r));
    alertsByClass.set(r.classroom_id, list);
  }

  const activityByClass = new Map<string, ActivityItem[]>();
  for (const r of activityRows) {
    if (!r.classroom_id) continue;
    const list = activityByClass.get(r.classroom_id) ?? [];
    list.push(mapActivity(r));
    activityByClass.set(r.classroom_id, list);
  }

  return classroomRows.map((r) => ({
    id: r.id, name: r.name, number: r.room_number, department: r.department,
    building: r.building, floor: r.floor, capacity: r.capacity,
    occupancy: r.occupancy_status as OccupancyStatus, status: r.status as ClassroomStatus,
    temperature: r.temperature, currentLoad: r.current_load, energyToday: r.energy_today,
    estimatedCost: r.estimated_cost,
    controller: controllersByClass.get(r.id) ?? {
      id: '', name: '', type: '', status: 'offline', signalStrength: 'weak',
      relayChannels: 8, usedChannels: [], ipAddress: '', firmwareVersion: '', lastSeen: new Date().toISOString(),
    },
    devices: devicesByClass.get(r.id) ?? [],
    alerts: alertsByClass.get(r.id) ?? [],
    recentActivity: activityByClass.get(r.id) ?? [],
  }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [campus, setCampus] = useState<Campus>(mockCampus);
  const [classrooms, setClassrooms] = useState<Classroom[]>(mockClassrooms);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);
  const [quickControls, setQuickControls] = useState<QuickControls>({
    allLights: false, allFans: false, allCurtains: false,
  });
  const [isReady, setIsReady] = useState(false);

  // ESP32 Integration State
  const [esp32Ip, setEsp32IpState] = useState<string>(
    process.env.EXPO_PUBLIC_DEFAULT_ESP32_IP || '192.168.1.101'
  );
  const [esp32Connected, setEsp32Connected] = useState<boolean>(false);
  const [esp32Telemetry, setEsp32Telemetry] = useState<ESP32Telemetry | null>(null);
  const [systemMode, setSystemModeState] = useState<'auto' | 'manual'>('manual');
  const isLanReachableRef = useRef<boolean>(false);

  const setEsp32Ip = useCallback(async (ip: string) => {
    setEsp32IpState(ip);
    await AsyncStorage.setItem(STORAGE_KEYS.ESP32_IP, ip).catch(console.error);
  }, []);

  const openEsp32WebConsole = useCallback(() => {
    if (!esp32Ip) return;
    const url = esp32Ip.startsWith('http') ? esp32Ip : `http://${esp32Ip}`;
    Linking.openURL(url).catch(err => {
      console.error('Failed to open ESP32 web portal:', err);
    });
  }, [esp32Ip]);

  const loadFromSupabase = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    const [campusRes, classroomRes, controllerRes, deviceRes, alertRes, notifRes, activityRes] = await Promise.all([
      supabase.from('campuses').select('*'),
      supabase.from('classrooms').select('*'),
      supabase.from('controllers').select('*'),
      supabase.from('devices').select('*'),
      supabase.from('alerts').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('activity').select('*'),
    ]);
    const responses = [campusRes, classroomRes, controllerRes, deviceRes, alertRes, notifRes, activityRes];
    for (const r of responses) {
      if (r.error) throw new Error(r.error.message);
    }
    setCampus(campusRes.data?.[0] ? mapCampus(campusRes.data[0] as CampusRow) : mockCampus);
    const validRooms = (classroomRes.data as ClassroomRow[]).filter(
      c => c.id === 'cls-a101' || c.id === 'cls-a102' || c.id === 'cls-corridor'
    );
    const controllers = controllerRes.data as ControllerRow[];
    const esp32Ctrl = controllers.find(c => c.id === 'ctrl-esp32');
    if (esp32Ctrl) {
      if (esp32Ctrl.ip_address) setEsp32IpState(esp32Ctrl.ip_address);
      if (esp32Ctrl.status === 'online') setEsp32Connected(true);
    }

    const modeDev = (deviceRes.data as DeviceRow[]).find(d => d.id === 'dev-system-mode');
    if (modeDev && (modeDev.status === 'auto' || modeDev.status === 'manual')) {
      setSystemModeState(modeDev.status);
    }

    setClassrooms(buildClassrooms(
      validRooms,
      controllers,
      deviceRes.data as DeviceRow[],
      alertRes.data as AlertRow[],
      activityRes.data as ActivityRow[],
    ));
    setAlerts((alertRes.data as AlertRow[]).map(mapAlert));
    setNotifications((notifRes.data as NotificationRow[]).map(mapNotification));
    setQuickControls({ allLights: false, allFans: false, allCurtains: false });
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let ok = false;
      try {
        ok = await loadFromSupabase();
      } catch (error) {
        console.error('Failed to load data from Supabase, falling back to cache', error);
      }
      if (cancelled) return;
      if (!ok) {
        try {
          const storedClassrooms = await AsyncStorage.getItem(STORAGE_KEYS.CLASSROOMS);
          const storedAlerts = await AsyncStorage.getItem(STORAGE_KEYS.ALERTS);
          const storedNotifications = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
          const storedQuickControls = await AsyncStorage.getItem(STORAGE_KEYS.QUICK_CONTROLS);
          const storedEsp32Ip = await AsyncStorage.getItem(STORAGE_KEYS.ESP32_IP);
          const storedSystemMode = await AsyncStorage.getItem(STORAGE_KEYS.SYSTEM_MODE);

          if (storedClassrooms) {
            try {
              const parsed = JSON.parse(storedClassrooms);
              const valid = Array.isArray(parsed)
                ? parsed.filter((c: any) => c.id === 'cls-a101' || c.id === 'cls-a102' || c.id === 'cls-corridor')
                : [];
              if (valid.length === 3) {
                setClassrooms(valid);
              } else {
                setClassrooms(mockClassrooms);
                void AsyncStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(mockClassrooms));
              }
            } catch {
              setClassrooms(mockClassrooms);
            }
          }
          if (storedAlerts) setAlerts(JSON.parse(storedAlerts));
          if (storedNotifications) setNotifications(JSON.parse(storedNotifications));
          if (storedQuickControls) setQuickControls(JSON.parse(storedQuickControls));
          if (storedEsp32Ip) setEsp32IpState(storedEsp32Ip);
          if (storedSystemMode === 'auto' || storedSystemMode === 'manual') setSystemModeState(storedSystemMode);
        } catch (error) {
          console.error('Failed to load data from storage', error);
        }
      }
      setIsReady(true);
    };
    init();
    return () => { cancelled = true; };
  }, [loadFromSupabase]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classrooms)).catch(console.error);
  }, [classrooms, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts)).catch(console.error);
  }, [alerts, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications)).catch(console.error);
  }, [notifications, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.QUICK_CONTROLS, JSON.stringify(quickControls)).catch(console.error);
  }, [quickControls, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.SYSTEM_MODE, systemMode).catch(console.error);
  }, [systemMode, isReady]);

  // Listen for Live Updates from Supabase (Devices, Sensor Telemetry & Controller Heartbeats)!
  useEffect(() => {
    if (!isReady || !isSupabaseConfigured) return;

    const channel = supabase.channel('realtime-smart-classroom')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'devices' },
        (payload) => {
          const newRecord = payload.new;
          if (newRecord && newRecord.id) {
            if (newRecord.id === 'dev-system-mode') {
              if (newRecord.status === 'auto' || newRecord.status === 'manual') {
                setSystemModeState(newRecord.status);
              }
              return;
            }
            setClassrooms(prev => prev.map(cls => {
              if (cls.id !== newRecord.classroom_id) return cls;
              return {
                ...cls,
                devices: cls.devices.map(dev => {
                  if (dev.id !== newRecord.id) return dev;
                  return {
                    ...dev,
                    status: newRecord.status as DeviceStatus,
                    powerUsage: newRecord.power_usage,
                    capabilities: newRecord.capabilities ?? dev.capabilities,
                    lastUpdated: newRecord.last_updated ?? new Date().toISOString()
                  };
                })
              };
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'classrooms' },
        (payload) => {
          const newRecord = payload.new;
          if (newRecord && newRecord.id) {
            setClassrooms(prev => prev.map(cls => {
              if (cls.id !== newRecord.id) return cls;
              return {
                ...cls,
                occupancy: (newRecord.occupancy_status as 'occupied' | 'vacant') || cls.occupancy,
                temperature: typeof newRecord.temperature === 'number' ? newRecord.temperature : cls.temperature,
                currentLoad: typeof newRecord.current_load === 'number' ? newRecord.current_load : cls.currentLoad,
                status: (newRecord.status as 'online' | 'offline') || cls.status,
              };
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'controllers' },
        (payload) => {
          const newRecord = payload.new;
          if (newRecord && newRecord.id === 'ctrl-esp32') {
            if (newRecord.status === 'online') setEsp32Connected(true);
            if (newRecord.ip_address) setEsp32IpState(newRecord.ip_address);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isReady]);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Date.now().toString(), message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const syncDevices = useCallback(async (updates: { id: string; data: Record<string, unknown> }[]) => {
    if (!isSupabaseConfigured) return;
    const now = new Date().toISOString();
    for (const u of updates) {
      const { error } = await supabase.from('devices').update({ ...u.data, last_updated: now }).eq('id', u.id);
      if (error) console.error('DEVICE SYNC FAILED', u.id, error.message);
    }
  }, []);

  // Synchronize Live Telemetry from physical ESP32
  const syncWithEsp32 = useCallback(async (): Promise<boolean> => {
    if (!esp32Ip || esp32Ip.trim() === '') return false;
    const baseUrl = esp32Ip.startsWith('http') ? esp32Ip.trim() : `http://${esp32Ip.trim()}`;
    const controller = new AbortController();
    const timeoutMs = isLanReachableRef.current ? 1800 : 900;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/status`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      isLanReachableRef.current = true;
      setEsp32Connected(true);
      const telemetry: ESP32Telemetry = {
        ip: data.controller?.ip || esp32Ip,
        mode: data.mode || 'auto',
        temperature: Number(data.temperature) || 24,
        humidity: Number(data.humidity) || 50,
        totalLoadWatts: Number(data.total_load_watts) || 0,
        rssi: data.controller?.rssi,
        uptimeSec: data.controller?.uptime_sec,
        firmware: data.controller?.firmware || '2.2.0',
        c1: {
          occupied: Boolean(data.classroom1?.occupied),
          light: Boolean(data.classroom1?.light),
          fan: Boolean(data.classroom1?.fan),
          curtain: Boolean(data.classroom1?.curtain),
          curtainAngle: Number(data.classroom1?.curtain_angle) || 0,
          loadWatts: Number(data.classroom1?.load_watts) || 0,
        },
        c2: {
          occupied: Boolean(data.classroom2?.occupied),
          light: Boolean(data.classroom2?.light),
          fan: Boolean(data.classroom2?.fan),
          curtain: Boolean(data.classroom2?.curtain),
          curtainAngle: Number(data.classroom2?.curtain_angle) || 0,
          loadWatts: Number(data.classroom2?.load_watts) || 0,
        },
        corridors: {
          ldr1Raw: Number(data.corridors?.ldr1_raw) || 0,
          ldr2Raw: Number(data.corridors?.ldr2_raw) || 0,
          light1: Boolean(data.corridors?.light1),
          light2: Boolean(data.corridors?.light2),
        },
      };
      setEsp32Telemetry(telemetry);
      if (telemetry.mode === 'auto' || telemetry.mode === 'manual') {
        setSystemModeState(telemetry.mode);
      }

      // Reflect hardware states into Classroom models
      setClassrooms(prev => prev.map(cls => {
        // Classroom A101 (Classroom 1)
        if (cls.id === 'cls-a101' || cls.id.includes('101')) {
          return {
            ...cls,
            temperature: telemetry.temperature,
            occupancy: telemetry.c1.occupied ? 'occupied' : 'vacant',
            currentLoad: telemetry.c1.loadWatts,
            status: 'online',
            controller: {
              ...cls.controller,
              status: 'online',
              ipAddress: esp32Ip,
              signalStrength: (telemetry.rssi && telemetry.rssi > -60) ? 'strong' : (telemetry.rssi && telemetry.rssi > -75) ? 'medium' : 'weak',
              lastSeen: new Date().toISOString(),
            },
            devices: cls.devices.map(dev => {
              if (dev.category === 'light') {
                const isOn = telemetry.c1.light;
                return { ...dev, status: isOn ? 'on' : 'off', powerUsage: isOn ? (dev.powerUsage || 60) : 0 };
              }
              if (dev.category === 'fan') {
                const isOn = telemetry.c1.fan;
                return { ...dev, status: isOn ? 'on' : 'off', powerUsage: isOn ? (dev.powerUsage || 75) : 0 };
              }
              if (dev.category === 'curtain') {
                const isOn = telemetry.c1.curtain;
                return { ...dev, status: isOn ? 'on' : 'off' };
              }
              return dev;
            }),
          };
        }

        // Classroom A102 (Classroom 2)
        if (cls.id === 'cls-a102' || cls.id.includes('102')) {
          return {
            ...cls,
            temperature: telemetry.temperature,
            occupancy: telemetry.c2.occupied ? 'occupied' : 'vacant',
            currentLoad: telemetry.c2.loadWatts,
            status: 'online',
            controller: {
              ...cls.controller,
              status: 'online',
              ipAddress: esp32Ip,
              signalStrength: (telemetry.rssi && telemetry.rssi > -60) ? 'strong' : (telemetry.rssi && telemetry.rssi > -75) ? 'medium' : 'weak',
              lastSeen: new Date().toISOString(),
            },
            devices: cls.devices.map(dev => {
              if (dev.category === 'light') {
                const isOn = telemetry.c2.light;
                return { ...dev, status: isOn ? 'on' : 'off', powerUsage: isOn ? (dev.powerUsage || 60) : 0 };
              }
              if (dev.category === 'fan') {
                const isOn = telemetry.c2.fan;
                return { ...dev, status: isOn ? 'on' : 'off', powerUsage: isOn ? (dev.powerUsage || 75) : 0 };
              }
              if (dev.category === 'curtain') {
                const isOn = telemetry.c2.curtain;
                return { ...dev, status: isOn ? 'on' : 'off' };
              }
              return dev;
            }),
          };
        }

        // Corridors & Hallways (Corridor Zone)
        if (cls.id === 'cls-corridor' || cls.id.includes('corr')) {
          const corLoad = (telemetry.corridors.light1 ? 40 : 0) + (telemetry.corridors.light2 ? 40 : 0);
          return {
            ...cls,
            currentLoad: corLoad,
            status: 'online',
            devices: cls.devices.map(dev => {
              const isDev1 = dev.id.includes('1');
              const isOn = isDev1 ? telemetry.corridors.light1 : telemetry.corridors.light2;
              return { ...dev, status: isOn ? 'on' : 'off', powerUsage: isOn ? (dev.powerUsage || 40) : 0 };
            }),
          };
        }

        return cls;
      }));

      return true;
    } catch {
      isLanReachableRef.current = false;
      // Direct LAN fetch failed (phone is on cellular data or remote network).
      setEsp32Telemetry(null);

      // Synchronize state via Supabase Cloud!
      if (isSupabaseConfigured) {
        try {
          const [ctrlRes, devRes, clsRes] = await Promise.all([
            supabase.from('controllers').select('status, ip_address').eq('id', 'ctrl-esp32').single(),
            supabase.from('devices').select('id, classroom_id, status, power_usage, last_updated'),
            supabase.from('classrooms').select('id, temperature, occupancy_status, current_load, status'),
          ]);

          if (ctrlRes.data && ctrlRes.data.status === 'online') {
            setEsp32Connected(true);
            if (ctrlRes.data.ip_address && ctrlRes.data.ip_address !== esp32Ip) {
              setEsp32IpState(ctrlRes.data.ip_address);
            }
          }

          if (devRes.data && devRes.data.length > 0) {
            const modeDev = devRes.data.find(d => d.id === 'dev-system-mode');
            if (modeDev && (modeDev.status === 'auto' || modeDev.status === 'manual')) {
              setSystemModeState(modeDev.status);
            }
            const devMap = new Map(devRes.data.map(d => [d.id, d]));
            setClassrooms(prev => prev.map(cls => ({
              ...cls,
              devices: cls.devices.map(dev => {
                const cloudDev = devMap.get(dev.id);
                if (!cloudDev) return dev;
                // Protect recent optimistic toggle from being overwritten by in-flight cloud sync
                const localUpdated = dev.lastUpdated ? new Date(dev.lastUpdated).getTime() : 0;
                if (Date.now() - localUpdated < 4000) return dev;
                return {
                  ...dev,
                  status: cloudDev.status as DeviceStatus,
                  powerUsage: cloudDev.power_usage ?? dev.powerUsage,
                  lastUpdated: cloudDev.last_updated || dev.lastUpdated,
                };
              }),
            })));
          }

          if (clsRes.data && clsRes.data.length > 0) {
            const clsMap = new Map(clsRes.data.map(c => [c.id, c]));
            setClassrooms(prev => prev.map(cls => {
              const cloudCls = clsMap.get(cls.id);
              if (!cloudCls) return cls;
              return {
                ...cls,
                occupancy: (cloudCls.occupancy_status as 'occupied' | 'vacant') || cls.occupancy,
                temperature: typeof cloudCls.temperature === 'number' ? cloudCls.temperature : cls.temperature,
                currentLoad: typeof cloudCls.current_load === 'number' ? cloudCls.current_load : cls.currentLoad,
                status: (cloudCls.status as 'online' | 'offline') || cls.status,
              };
            }));
          }

          return true;
        } catch {
          // Supabase unreachable
        }
      }
      setEsp32Connected(false);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }, [esp32Ip]);

  const setSystemMode = useCallback(async (mode: 'auto' | 'manual') => {
    setSystemModeState(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.SYSTEM_MODE, mode).catch(console.error);

    // 1. FAST LAN PATH (if connected on local Wi-Fi)
    if (esp32Ip && esp32Telemetry) {
      const cleanIp = esp32Ip.trim();
      const baseUrl = cleanIp.startsWith('http') ? cleanIp : `http://${cleanIp}`;
      void fetch(`${baseUrl}/mode?auto=${mode === 'auto' ? 1 : 0}`).catch(() => {});
    }

    // 2. SUPABASE CLOUD PATH (Works on 4G/5G mobile data + syncs all remote apps)
    if (isSupabaseConfigured) {
      void supabase.from('devices')
        .update({ status: mode, last_updated: new Date().toISOString() })
        .eq('id', 'dev-system-mode')
        .then(({ error }) => {
          if (error) console.error('SYSTEM MODE SYNC FAILED:', error.message);
        });
    }

    showToast(`Switched to ${mode.toUpperCase()} Mode`, 'info');
  }, [esp32Ip, esp32Telemetry, showToast]);

  const toggleEsp32Mode = useCallback(async () => {
    const nextMode = systemMode === 'auto' ? 'manual' : 'auto';
    await setSystemMode(nextMode);
  }, [systemMode, setSystemMode]);

  const toggleDevice = useCallback((classroomId: string, deviceId: string) => {
    const targetClass = classrooms.find(c => c.id === classroomId);
    const targetDev = targetClass?.devices.find(d => d.id === deviceId);
    if (!targetDev || targetDev.status === 'offline') return;

    const nextState = targetDev.status !== 'on';
    const newStatus: DeviceStatus = nextState ? 'on' : 'off';
    const powerUsage = nextState ? (targetDev.powerUsage || 60) : 0;
    const deviceName = targetDev.name;
    const effectiveIp = esp32Ip || targetClass?.controller?.ipAddress;

    // 1. FAST PATH: Dispatch command directly to ESP32 hardware immediately (<5ms!) if on LAN
    if (effectiveIp && esp32Telemetry) {
      const devCode = mapDeviceToEsp32Code(classroomId, targetDev);
      void sendEsp32Command(effectiveIp, devCode, nextState);
    }

    // 2. Optimistic local React state update
    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return {
        ...cls,
        devices: cls.devices.map(dev => {
          if (dev.id !== deviceId) return dev;
          return {
            ...dev,
            status: newStatus,
            powerUsage,
            lastUpdated: new Date().toISOString(),
          };
        }),
      };
    }));

    // 3. Asynchronous cloud persistence in background
    void syncDevices([{ id: deviceId, data: { status: newStatus, power_usage: powerUsage } }]);

    // 4. Manual override disarms Auto Mode so sensors don't fight user commands
    if (systemMode === 'auto') {
      void setSystemMode('manual');
      showToast('Manual Override: Switched to MANUAL Mode', 'info');
    } else if (deviceName) {
      showToast(`${deviceName} is ${newStatus.toUpperCase()}`, 'success');
    }
  }, [classrooms, esp32Ip, esp32Telemetry, setSystemMode, showToast, syncDevices, systemMode]);

  const updateDeviceValue = useCallback((classroomId: string, deviceId: string, updates: Partial<Device>) => {
    let settings: Record<string, unknown> | null = null;
    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return {
        ...cls,
        devices: cls.devices.map(dev => {
          if (dev.id !== deviceId) return dev;
          const updated = { ...dev, ...updates, lastUpdated: new Date().toISOString() };
          settings = deviceSettings(updated);
          return updated;
        }),
      };
    }));
    if (settings) void syncDevices([{ id: deviceId, data: { settings } }]);
  }, [syncDevices]);

  const toggleQuickControl = useCallback((control: keyof QuickControls) => {
    setQuickControls(prev => {
      const newState = !prev[control];
      const category = categoryMap[control];
      const sync: { id: string; data: { status: DeviceStatus; power_usage: number } }[] = [];
      setClassrooms(prevCls => prevCls.map(cls => ({
        ...cls,
        devices: cls.devices.map(dev => {
          if (dev.category !== category || dev.status === 'offline') return dev;
          const newStatus: DeviceStatus = newState ? 'on' : 'off';
          const powerUsage = newStatus === 'off' ? 0 : (dev.powerUsage || 60);
          sync.push({ id: dev.id, data: { status: newStatus, power_usage: powerUsage } });
          return { ...dev, status: newStatus, powerUsage, lastUpdated: new Date().toISOString() };
        }),
      })));
      if (sync.length) void syncDevices(sync);

      // Dispatch to ESP32
      if (esp32Ip) {
        if (control === 'allLights') {
          void sendEsp32Command(esp32Ip, 'l1', newState);
          void sendEsp32Command(esp32Ip, 'l2', newState);
          void sendEsp32Command(esp32Ip, 'cr1', newState);
          void sendEsp32Command(esp32Ip, 'cr2', newState);
        } else if (control === 'allFans') {
          void sendEsp32Command(esp32Ip, 'f1', newState);
          void sendEsp32Command(esp32Ip, 'f2', newState);
        } else if (control === 'allCurtains') {
          void sendEsp32Command(esp32Ip, 'c1', newState);
          void sendEsp32Command(esp32Ip, 'c2', newState);
        }
        setTimeout(() => {
          void syncWithEsp32();
        }, 300);
      }

      if (systemMode === 'auto') {
        void setSystemMode('manual');
        showToast('Manual Override: Switched to MANUAL Mode', 'info');
      }

      return { ...prev, [control]: newState };
    });
  }, [esp32Ip, setSystemMode, showToast, syncDevices, syncWithEsp32, systemMode]);

  const emergencyOff = useCallback(() => {
    const sync: { id: string; data: { status: DeviceStatus; power_usage: number } }[] = [];
    setClassrooms(prev => prev.map(cls => ({
      ...cls,
      devices: cls.devices.map(dev => {
        if (dev.status === 'offline') return dev;
        sync.push({ id: dev.id, data: { status: 'off' as const, power_usage: 0 } });
        return {
          ...dev,
          status: 'off' as const,
          powerUsage: 0,
          lastUpdated: new Date().toISOString(),
        };
      }),
    })));
    setQuickControls({ allLights: false, allFans: false, allCurtains: false });
    if (sync.length) void syncDevices(sync);

    // Hardware sync: Trigger emergency all-off on all connected ESP32 controllers
    if (esp32Ip) {
      void sendEsp32Command(esp32Ip, 'all', false);
    }
    setTimeout(() => {
      void syncWithEsp32();
    }, 300);

    if (systemMode === 'auto') {
      void setSystemMode('manual');
    }
  }, [esp32Ip, setSystemMode, syncDevices, syncWithEsp32, systemMode]);

  // Periodic Polling of ESP32 (every 3 seconds)
  useEffect(() => {
    if (!isReady || !esp32Ip) return;
    void syncWithEsp32();
    const interval = setInterval(() => {
      void syncWithEsp32();
    }, 3000);
    return () => clearInterval(interval);
  }, [isReady, esp32Ip, syncWithEsp32]);

  const addClassroom = useCallback((classroom: Classroom) => {
    setClassrooms(prev => [...prev, classroom]);
    if (isSupabaseConfigured) {
      void (async () => {
        const { error: cErr } = await supabase.from('classrooms').insert({
          id: classroom.id, name: classroom.name, room_number: classroom.number,
          department: classroom.department, building: classroom.building, floor: classroom.floor,
          capacity: classroom.capacity, occupancy_status: classroom.occupancy, status: classroom.status,
          temperature: classroom.temperature, current_load: classroom.currentLoad,
          energy_today: classroom.energyToday, estimated_cost: classroom.estimatedCost,
        });
        if (cErr) console.error('CLASSROOM INSERT FAILED', cErr.message);

        const c = classroom.controller;
        const { error: ctErr } = await supabase.from('controllers').upsert({
          id: c.id, classroom_id: classroom.id, name: c.name, type: c.type, status: c.status,
          signal_strength: c.signalStrength, ip_address: c.ipAddress || null,
          firmware_version: c.firmwareVersion || null, relay_channels: c.relayChannels,
          used_channels: c.usedChannels, last_seen: c.lastSeen,
        }, { onConflict: 'id' });
        if (ctErr) console.error('CONTROLLER INSERT FAILED', ctErr.message);

        for (const dev of classroom.devices) {
          const { error: dErr } = await supabase.from('devices').insert({
            id: dev.id, classroom_id: classroom.id, controller_id: dev.controllerId, name: dev.name,
            category: dev.category, status: dev.status, relay_channel: dev.relayChannel,
            room_area: dev.roomArea, capabilities: dev.capabilities, settings: deviceSettings(dev),
            power_usage: dev.powerUsage, energy_today: dev.energyToday, last_updated: dev.lastUpdated,
          });
          if (dErr) console.error('DEVICE INSERT FAILED', dErr.message);
        }
      })();
    }
  }, []);

  const addDevice = useCallback((classroomId: string, device: Device) => {
    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return { ...cls, devices: [...cls.devices, device] };
    }));
    if (isSupabaseConfigured) {
      void (async () => {
        const { error } = await supabase.from('devices').insert({
          id: device.id, classroom_id: classroomId, controller_id: device.controllerId, name: device.name,
          category: device.category, status: device.status, relay_channel: device.relayChannel,
          room_area: device.roomArea, capabilities: device.capabilities, settings: deviceSettings(device),
          power_usage: device.powerUsage, energy_today: device.energyToday, last_updated: device.lastUpdated,
        });
        if (error) console.error('DEVICE INSERT FAILED', error.message);
      })();
    }
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (isSupabaseConfigured) {
      void supabase.from('notifications').update({ is_read: true }).eq('id', id).then(({ error }) => {
        if (error) console.error('NOTIFICATION UPDATE FAILED', error.message);
      });
    }
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (isSupabaseConfigured) {
      void supabase.from('notifications').update({ is_read: true }).eq('is_read', false).then(({ error }) => {
        if (error) console.error('NOTIFICATIONS UPDATE FAILED', error.message);
      });
    }
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (isSupabaseConfigured) {
      void supabase.from('notifications').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('NOTIFICATION DELETE FAILED', error.message);
      });
    }
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
    if (isSupabaseConfigured) {
      void supabase.from('alerts').update({ is_read: true }).eq('id', id).then(({ error }) => {
        if (error) console.error('ALERT UPDATE FAILED', error.message);
      });
    }
  }, []);

  const resetData = useCallback(() => {
    void (async () => {
      try {
        await loadFromSupabase();
      } catch (error) {
        console.error('Failed to reload from Supabase', error);
        setClassrooms(mockClassrooms);
        setAlerts(mockAlerts);
        setNotifications(mockNotifications);
      }
    })();
    setQuickControls({ allLights: false, allFans: false, allCurtains: false });
    AsyncStorage.clear().catch(console.error);
  }, [loadFromSupabase]);

  if (!isReady) return null;

  return (
    <AppContext.Provider value={{
      user: mockUser, campus, classrooms, alerts, notifications,
      energyData: mockEnergyData, quickControls, toast,
      showToast, hideToast,
      toggleDevice, toggleQuickControl, emergencyOff,
      addClassroom, addDevice,
      markNotificationRead, markAllNotificationsRead, deleteNotification,
      dismissAlert, resetData, updateDeviceValue,
      esp32Ip, setEsp32Ip, esp32Connected, esp32Telemetry,
      systemMode, setSystemMode,
      syncWithEsp32, openEsp32WebConsole, toggleEsp32Mode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}