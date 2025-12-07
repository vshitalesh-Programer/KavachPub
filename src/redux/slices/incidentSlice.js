import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  incidents: [],
};

const incidentSlice = createSlice({
  name: 'incidents',
  initialState,
  reducers: {
    addIncident: (state, action) => {
      // action.payload: { id, time, lat, lng, mode, ip }
      state.incidents.unshift(action.payload); // Add to top
    },
    clearIncidents: (state) => {
      state.incidents = [];
    },
    deleteIncident: (state, action) => {
       state.incidents = state.incidents.filter(item => item.id !== action.payload);
    }
  },
});

export const { addIncident, clearIncidents, deleteIncident } = incidentSlice.actions;
export default incidentSlice.reducer;
