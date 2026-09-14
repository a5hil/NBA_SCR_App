# Implementation Plan - Smart Classroom Management System Mobile Frontend

Build a complete, production-grade mobile frontend for a Smart Classroom Management System using React Native, Expo (SDK 57 / `expo: "57.0.9"`), and TypeScript. The application translates the dark, warm orange aesthetic from Reference Image 2 into an enterprise-grade mobile IoT command center for campus administrators.

## User Review Required

> [!IMPORTANT]
> - **Zero Native Module Issues**: All dependencies are locked to Expo SDK 57 (`react-native-safe-area-context`, `expo-blur`, `@expo/vector-icons`, `@react-native-async-storage/async-storage`, `react-native-svg`, `expo-router`).
> - **Visual Reference Fidelity**: Fully incorporates the black background (`#080908`), primary orange (`#FDA83A`), 24–32px card radii, translucent circular surfaces (`rgba(217, 217, 217, 0.12)`), floating 4-pill bottom navigation, and asymmetric energy cards from Reference Image 2.
> - **Simulation Mode**: Real backend, hardware ESP32, and camera/Bluetooth calls are safely simulated with realistic state transitions, discovery animations, and feedback toasts.
> - **Persistence**: Local modifications (device toggles, quick controls, newly added classrooms/devices, alert dismissals) will update interactive state and can persist via AsyncStorage.

## Open Questions

None. The prompt provides detailed requirements and dimensions. Sensible design defaults are applied to all unspecified minor interactions.

## Proposed Architecture & Structure

```
NBA/
├── app/                              # Expo Router file-based navigation
│   ├── _layout.tsx                   # Root layout with SafeAreaProvider & StateProvider
│   ├── (tabs)/                       # Tab group with custom FloatingBottomNav
│   │   ├── _layout.tsx               # Custom tab navigator rendering FloatingBottomNav
│   │   ├── index.tsx                 # Home screen: Command center, asymmetric energy card, quick controls, classrooms list, alerts
│   │   ├── classrooms.tsx            # Classrooms screen: live search, status filter chips, comprehensive cards
│   │   ├── energy.tsx                # Energy screen: Day/Week/Month selector, usage bar chart, metrics, classroom rankings, suggestions
│   │   └── settings.tsx              # Settings screen: Profile, management shortcuts, notification switches, reset demo data
│   ├── classroom/
│   │   └── [id].tsx                  # Classroom detail screen: 2-column device grid, health badge, power stats, recent activity, report issue
│   ├── device/
│   │   └── [id].tsx                  # Device control screen: specialized controls for Light, Fan, AC, Projector/TV, etc.
│   ├── notifications.tsx             # Grouped notifications modal (Today, Yesterday, Earlier), mark as read / delete
│   ├── add-classroom.tsx             # 5-step wizard: Details -> Controller Discovery -> Wi-Fi Config -> Devices -> Review
│   └── add-device.tsx                # Add device modal: classroom selection, relay channel validation, capability toggles
├── components/                       # Reusable UI components
│   ├── FloatingBottomNav.tsx         # 332px wide floating capsule, 4 circles (74px), active orange (#FDA83A), blur background
│   ├── ScreenHeader.tsx              # Reusable screen header with optional back button, title, actions
│   ├── HomeHeader.tsx                # "Welcome back, Nershel", avatar "NN", notification bell with unread badge, campus selector
│   ├── AsymmetricEnergyCard.tsx      # Large curved orange card (#FDA83A) with lightning icon, 21.4 kWh, and comparison
│   ├── QuickControlsBar.tsx          # Horizontal rounded control pills (Lights, Fans, ACs, Projectors, Emergency Off)
│   ├── ClassroomCard.tsx             # Dark rounded card with live status, occupancy, device count, power, temp, alerts
│   ├── DeviceGridCard.tsx            # 2-column device card with circular icon, status value, tap-to-toggle or open controls
│   ├── EnergyBarChart.tsx            # Lightweight custom SVG/View-based bar chart matching Reference Image 2 dark theme
│   ├── AlertCard.tsx                 # Dark alert card with severity pill and action
│   ├── BottomSheetModal.tsx          # Reusable dark sheet for quick actions (+ button), filters, and issue reporting
│   ├── ToastNotification.tsx         # In-app toast feedback for simulated hardware actions
│   └── ConfirmationDialog.tsx        # Danger/action confirmation modal (Emergency Off, Reset Data)
├── constants/
│   ├── colors.ts                     # Strict palette: #080908, #FDA83A, #1B1B1B, translucent greys, status colors
│   ├── layout.ts                     # Standard dimensions, card radii (24-32px), spacing, floating nav specs
│   └── config.ts                     # Placeholder WhatsApp support number, mock campus metadata
├── context/
│   └── AppContext.tsx                # Global state store for classrooms, devices, energy readings, alerts, notifications
├── types/
│   └── index.ts                      # TypeScript interfaces (Classroom, Device, Controller, Alert, Notification, etc.)
├── data/
│   └── mockData.ts                   # Realistic seed data for 10 classrooms (A101, A102, Seminar Hall, Computer Lab, etc.)
├── app.json                          # Expo configuration for SDK 57
├── package.json                      # Exact compatible dependencies
└── tsconfig.json                     # TypeScript strict configuration
```

## Proposed Changes

### Configuration & Base Setup
- Create [package.json](file:///c:/Users/X1/OneDrive/Desktop/NBA/package.json) with `expo: "57.0.9"`, `react: "19.2.3"`, `react-native: "0.86.2"`, `expo-router: "~57.0.9"`, and compatible SDK 57 peer modules.
- Create [app.json](file:///c:/Users/X1/OneDrive/Desktop/NBA/app.json) configured with dark theme, portrait orientation, and Android status bar styling.
- Create [tsconfig.json](file:///c:/Users/X1/OneDrive/Desktop/NBA/tsconfig.json) with React Native paths and strict typing.

### Core Data & State Management
- Define comprehensive TypeScript models in `types/index.ts`.
- Seed rich campus data in `data/mockData.ts` (10 classrooms, 36 connected devices, active alerts, energy time-series).
- Create `AppContext.tsx` providing reactive state:
  - Toggle individual devices & quick bulk toggles
  - Emergency shutdown flow
  - Add/edit classrooms and devices with channel collision prevention
  - Mark notifications as read / dismiss
  - Reset to original mock data

### Navigation & Screen Implementations
- Implement `FloatingBottomNav.tsx` precisely matching the Figma dimensions (332px capsule, 74px circles, backdrop blur, orange active state).
- Build the 4 primary tabs (`Home`, `Classrooms`, `Energy`, `Settings`).
- Implement the detailed secondary screens (`ClassroomDetail`, `DeviceControl`, `Notifications`, `AddClassroom`, `AddDevice`).
- Integrate the Report Issue sheet with encoded WhatsApp URL and graceful fallback.

## Verification Plan

### Automated Verification
- Run `npx tsc --noEmit` to ensure zero TypeScript errors.
- Run `npx expo config` to verify Expo SDK 57 configuration validity.

### Manual / Visual Verification
- Start project with `npx expo start`.
- Verify responsive layout on 412 × 917 and ensure floating navigation does not obscure list content.
- Test device toggle interactions and emergency power off confirmation.
- Test multi-step Add Classroom wizard and verify newly added classroom appears in Home and Classrooms lists.
- Test search and status filter chips on Classrooms screen.
- Test Energy tab period switching (Day / Week / Month).
- Test Settings switches and Reset Demo Data.
