import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginRequest: (state, action) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      // The API returns { token, user: {...} }
      // We want to store them separately
      const { user, token } = action.payload || {};
      state.user = user || action.payload; // Fallback if no 'user' key
      state.token = token || state.token;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
    },
    signupRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    signupSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      const { user, token } = action.payload || {};
      state.user = user || action.payload;
      state.token = token || state.token;
    },
    signupFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { loginRequest, loginSuccess, loginFailure, logout, signupRequest, signupSuccess, signupFailure } = authSlice.actions;
export default authSlice.reducer;
