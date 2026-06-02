import { NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
};

// Home Stack
export type HomeStackParamList = {
  HomeMain: undefined;
  DeviceScan: undefined;
  Notifications: undefined;
};

// Orders Stack
export type OrdersStackParamList = {
  OrderList: { status?: string; deviceId?: string; title?: string } | undefined;
  OrderDetail: { orderId: string };
  OrderCreate: {
    deviceId?: string
    category?: string
    faultType?: string
    initialFaultDesc?: string
  } | undefined;
  OrderRepair: { orderId: string };
  AddRepairLog: { orderId: string };
  AssignOrder: { orderId: string };
};

// Toolbox Stack
export type ToolboxStackParamList = {
  ToolboxMain: undefined;
  Dmx: undefined;
  PowerCalc: undefined;
  BeamAngle: undefined;
  Bpm: undefined;
  RgbColor: undefined;
  Illuminance: undefined;
  Diagnosis: undefined;
  MaMacros: undefined;
  Terms: undefined;
  Lux: undefined;
};

// Records Stack
export type RecordsStackParamList = {
  RecordsList: { initialTab?: 'devices' | 'parts' | 'inspections' } | undefined;
  DeviceDetail: { deviceId: string };
  RecordDetail: { orderId: string };
};

// Profile Stack
export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Settings: undefined;
};

// Main Tabs
export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Orders: NavigatorScreenParams<OrdersStackParamList>;
  Toolbox: NavigatorScreenParams<ToolboxStackParamList>;
  Records: NavigatorScreenParams<RecordsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// Root
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
