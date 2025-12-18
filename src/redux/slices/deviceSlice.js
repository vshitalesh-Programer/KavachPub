import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connectedDevice: null, // { id, name, macAddress, deviceId }
  isConnected: false,
  isLoading: false,
  error: null,
  lastHex: null, // Last hex value received from device
  notificationsActive: false, // Whether notifications are currently active
};

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setConnectedDevice: (state, action) => {
      state.connectedDevice = action.payload;
      state.isConnected = !!action.payload;
      state.error = null;
    },
    clearConnectedDevice: (state) => {
      state.connectedDevice = null;
      state.isConnected = false;
      state.error = null;
    },
    setDeviceLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setDeviceError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    setLastHex: (state, action) => {
      state.lastHex = action.payload;
    },
    setNotificationsActive: (state, action) => {
      state.notificationsActive = action.payload;
    },
  },
});

export const {
  setConnectedDevice,
  clearConnectedDevice,
  setDeviceLoading,
  setDeviceError,
  setLastHex,
  setNotificationsActive,
} = deviceSlice.actions;

export default deviceSlice.reducer;
