import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import incidentReducer from './slices/incidentSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  incidents: incidentReducer,
});

export default rootReducer;
