import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import incidentReducer from './slices/incidentSlice';
import contactReducer from './slices/contactSlice';
import deviceReducer from './slices/deviceSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  incidents: incidentReducer,
  contacts: contactReducer,
  device: deviceReducer,
});

export default rootReducer;
