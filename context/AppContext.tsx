import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  User, Campus, Classroom, Device, Controller, Alert, NotificationItem, ActivityItem, EnergyReading,
  DeviceCategory, DeviceStatus, DeviceCapability, ClassroomStatus, OccupancyStatus, AlertSeverity, NotificationType,
} from '../types';
import {
  mockUser, mockCampus, mockClassrooms, mockAlerts, mockNotifications, mockEnergyData,
} from '../mock_data/mockData';

interface QuickControls {
  allLights: boolean;
  allFans: boolean;
  allACs: boolean;
  projectors: boolean;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const categoryMap: Record<keyof QuickControls, string> = {
  allLights: 'light',
  allFans: 'fan',
  allACs: 'ac',
  projectors: 'projector',
};

const STORAGE_KEYS = {
  CLASSROOMS: '@classrooms',
  ALERTS: '@alerts',
  NOTIFICATIONS: '@notifications',
  QUICK_CONTROLS: '@quickControls',
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
    allLights: true, allFans: true, allACs: true, projectors: false,
  });
  const [isReady, setIsReady] = useState(false);

  const loadFromSupabase = useCallback(async (): Promise<boolean> => {
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
    setClassrooms(buildClassrooms(
      classroomRes.data as ClassroomRow[],
      controllerRes.data as ControllerRow[],
      deviceRes.data as DeviceRow[],
      alertRes.data as AlertRow[],
      activityRes.data as ActivityRow[],
    ));
    setAlerts((alertRes.data as AlertRow[]).map(mapAlert));
    setNotifications((notifRes.data as NotificationRow[]).map(mapNotification));
    setQuickControls({ allLights: true, allFans: true, allACs: true, projectors: false });
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

          if (storedClassrooms) setClassrooms(JSON.parse(storedClassrooms));
          if (storedAlerts) setAlerts(JSON.parse(storedAlerts));
          if (storedNotifications) setNotifications(JSON.parse(storedNotifications));
          if (storedQuickControls) setQuickControls(JSON.parse(storedQuickControls));
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

  // Listen for Live Updates from Supabase!
  useEffect(() => {
    if (!isReady) return;

    const channel = supabase.channel('realtime-devices')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'devices' },
        (payload) => {
          const newRecord = payload.new;
          if (newRecord && newRecord.id) {
            setClassrooms(prev => prev.map(cls => {
              // Only update if it belongs to this classroom
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
    const now = new Date().toISOString();
    for (const u of updates) {
      const { error } = await supabase.from('devices').update({ ...u.data, last_updated: now }).eq('id', u.id);
      if (error) console.error('DEVICE SYNC FAILED', u.id, error.message);
    }
  }, []);

  const toggleDevice = useCallback((classroomId: string, deviceId: string) => {
    let deviceName = '';
    let newStateStr = '';
    let sync: { id: string; data: { status: DeviceStatus; power_usage: number } } | null = null;

    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return {
        ...cls,
        devices: cls.devices.map(dev => {
          if (dev.id !== deviceId || dev.status === 'offline') return dev;
          deviceName = dev.name;
          const newStatus: DeviceStatus = dev.status === 'on' ? 'off' : 'on';
          const powerUsage = newStatus === 'off' ? 0 : (dev.powerUsage || 60);
          newStateStr = newStatus;
          sync = { id: deviceId, data: { status: newStatus, power_usage: powerUsage } };
          return {
            ...dev,
            status: newStatus,
            powerUsage,
            lastUpdated: new Date().toISOString(),
          };
        }),
      };
    }));

    if (sync) void syncDevices([sync]); else return;
    if (deviceName) {
      showToast(`${deviceName} is ${newStateStr.toUpperCase()}`, 'success');
    }
  }, [showToast, syncDevices]);

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
      return { ...prev, [control]: newState };
    });
  }, [syncDevices]);

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
    setQuickControls({ allLights: false, allFans: false, allACs: false, projectors: false });
    if (sync.length) void syncDevices(sync);
  }, [syncDevices]);

  const addClassroom = useCallback((classroom: Classroom) => {
    setClassrooms(prev => [...prev, classroom]);
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
  }, []);

  const addDevice = useCallback((classroomId: string, device: Device) => {
    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return { ...cls, devices: [...cls.devices, device] };
    }));
    void (async () => {
      const { error } = await supabase.from('devices').insert({
        id: device.id, classroom_id: classroomId, controller_id: device.controllerId, name: device.name,
        category: device.category, status: device.status, relay_channel: device.relayChannel,
        room_area: device.roomArea, capabilities: device.capabilities, settings: deviceSettings(device),
        power_usage: device.powerUsage, energy_today: device.energyToday, last_updated: device.lastUpdated,
      });
      if (error) console.error('DEVICE INSERT FAILED', error.message);
    })();
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    void supabase.from('notifications').update({ is_read: true }).eq('id', id).then(({ error }) => {
      if (error) console.error('NOTIFICATION UPDATE FAILED', error.message);
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    void supabase.from('notifications').update({ is_read: true }).eq('is_read', false).then(({ error }) => {
      if (error) console.error('NOTIFICATIONS UPDATE FAILED', error.message);
    });
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    void supabase.from('notifications').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('NOTIFICATION DELETE FAILED', error.message);
    });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
    void supabase.from('alerts').update({ is_read: true }).eq('id', id).then(({ error }) => {
      if (error) console.error('ALERT UPDATE FAILED', error.message);
    });
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
    setQuickControls({ allLights: true, allFans: true, allACs: true, projectors: false });
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