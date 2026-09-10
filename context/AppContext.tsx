import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User, Campus, Classroom, Device, Alert, NotificationItem, EnergyReading,
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [classrooms, setClassrooms] = useState<Classroom[]>(mockClassrooms);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);
  const [quickControls, setQuickControls] = useState<QuickControls>({
    allLights: true, allFans: true, allACs: true, projectors: false,
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadData = async () => {
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
      } finally {
        setIsReady(true);
      }
    };
    loadData();
  }, []);

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


  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Date.now().toString(), message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const toggleDevice = useCallback((classroomId: string, deviceId: string) => {
    // Simulate slight delay and show toast
    setTimeout(() => {
      let deviceName = '';
      setClassrooms(prev => prev.map(cls => {
        if (cls.id !== classroomId) return cls;
        return {
          ...cls,
          devices: cls.devices.map(dev => {
            if (dev.id !== deviceId || dev.status === 'offline') return dev;
            deviceName = dev.name;
            const newStatus = dev.status === 'on' ? 'off' as const : 'on' as const;
            return {
              ...dev,
              status: newStatus,
              powerUsage: newStatus === 'off' ? 0 : (dev.powerUsage || 60),
              lastUpdated: new Date().toISOString(),
            };
          }),
        };
      }));
      if (deviceName) {
        showToast(`${deviceName} toggled`, 'success');
      }
    }, 400); // 400ms delay for realistic feel
  }, [showToast]);

  const updateDeviceValue = useCallback((classroomId: string, deviceId: string, updates: Partial<Device>) => {
    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return {
        ...cls,
        devices: cls.devices.map(dev => {
          if (dev.id !== deviceId) return dev;
          return { ...dev, ...updates, lastUpdated: new Date().toISOString() };
        }),
      };
    }));
  }, []);

  const toggleQuickControl = useCallback((control: keyof QuickControls) => {
    setQuickControls(prev => {
      const newState = !prev[control];
      const category = categoryMap[control];
      setClassrooms(prevCls => prevCls.map(cls => ({
        ...cls,
        devices: cls.devices.map(dev => {
          if (dev.category !== category || dev.status === 'offline') return dev;
          return {
            ...dev,
            status: newState ? 'on' as const : 'off' as const,
            powerUsage: newState ? (dev.powerUsage || 60) : 0,
            lastUpdated: new Date().toISOString(),
          };
        }),
      })));
      return { ...prev, [control]: newState };
    });
  }, []);

  const emergencyOff = useCallback(() => {
    setClassrooms(prev => prev.map(cls => ({
      ...cls,
      devices: cls.devices.map(dev => ({
        ...dev,
        status: dev.status === 'offline' ? 'offline' as const : 'off' as const,
        powerUsage: 0,
        lastUpdated: new Date().toISOString(),
      })),
    })));
    setQuickControls({ allLights: false, allFans: false, allACs: false, projectors: false });
  }, []);

  const addClassroom = useCallback((classroom: Classroom) => {
    setClassrooms(prev => [...prev, classroom]);
  }, []);

  const addDevice = useCallback((classroomId: string, device: Device) => {
    setClassrooms(prev => prev.map(cls => {
      if (cls.id !== classroomId) return cls;
      return { ...cls, devices: [...cls.devices, device] };
    }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  }, []);

  const resetData = useCallback(() => {
    setClassrooms(mockClassrooms);
    setAlerts(mockAlerts);
    setNotifications(mockNotifications);
    setQuickControls({ allLights: true, allFans: true, allACs: true, projectors: false });
    AsyncStorage.clear().catch(console.error);
  }, []);

  if (!isReady) return null;

  return (
    <AppContext.Provider value={{
      user: mockUser, campus: mockCampus, classrooms, alerts, notifications,
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
