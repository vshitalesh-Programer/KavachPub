import { call, put, takeLatest, delay } from 'redux-saga/effects';
import {
  loginRequest, loginSuccess, loginFailure,
  signupRequest, signupSuccess, signupFailure
} from '../slices/authSlice';
import ApiService from '../../services/ApiService';

// Worker Saga: will be fired on loginRequest actions
function* handleLogin(action) {
  try {
    const { email, password, googleToken, isDemo } = action.payload;

    let userData;
    if (googleToken) {
       userData = yield call([ApiService, ApiService.googleLogin], googleToken);
    } else if (isDemo) {
       yield delay(1000); // Simulate delay
       userData = {
           id: 'demo-user',
           name: 'Demo User',
           token: 'demo-token',
           email: email || 'demo@example.com'
       };
    } else {
       // Real Email Login
       userData = yield call([ApiService, ApiService.emailLogin], email, password);
    }

    // Assuming userData contains user info and token
    yield put(loginSuccess(userData));
  } catch (error) {
    yield put(loginFailure(error.message || 'Login failed'));
  }
}

function* handleSignup(action) {
  try {
    const { email, password, name } = action.payload;
    const userData = yield call([ApiService, ApiService.emailSignup], email, password, name);
    yield put(signupSuccess(userData));
  } catch (error) {
    yield put(signupFailure(error.message || 'Signup failed'));
  }
}

// Watcher Saga: spawn a new handleLogin task on each loginRequest
export default function* authSaga() {
  yield takeLatest(loginRequest.type, handleLogin);
  yield takeLatest(signupRequest.type, handleSignup);
}
