import { takeLatest, put, delay } from 'redux-saga/effects';
import { loginRequest, loginSuccess, loginFailure } from '../slices/authSlice';

// Worker Saga: will be fired on loginRequest actions
function* handleLogin(action) {
  try {
    // Simulate API call
    yield delay(1000); 
    
    // In a real app, you would verify credentials here
    if (action.payload.username === 'user' && action.payload.password === 'password') {
       yield put(loginSuccess({ id: 1, name: 'Test User' }));
    } else {
       // yield put(loginFailure('Invalid credentials')); // Commented out for now to simulate success or handle manually
       yield put(loginSuccess({ id: 1, name: 'Demo User' })); // Default success for demo
    }
  } catch (error) {
    yield put(loginFailure(error.message));
  }
}

// Watcher Saga: spawn a new handleLogin task on each loginRequest
export default function* authSaga() {
  yield takeLatest(loginRequest.type, handleLogin);
}
