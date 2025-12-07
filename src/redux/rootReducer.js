import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import incidentReducer from './slices/incidentSlice';
import contactReducer from './slices/contactSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  incidents: incidentReducer,
  contacts: contactReducer,
});

export default rootReducer;
