import axios from 'axios';

const BASE_URL = 'https://y4mjzpsx3x.us-east-1.awsapprunner.com';
const AUTH_PREFIX = '/api/auth';
const API_V1_PREFIX = '/api/v1';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.token = null;

    // Add interceptor to inject token
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
          console.log(`[API Request] ${(config.method || 'GET').toUpperCase()} ${config.url}`);
          console.log(`[API Request] Bearer Token: ${this.token}`);
        } else {
          console.log(`[API Request] ${(config.method || 'GET').toUpperCase()} ${config.url} - No token`);
        }
        const method = (config.method || 'GET').toUpperCase();
        console.log(`[API Request] ${method} ${config.url}`, config.data ? config.data : '');
        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Add interceptor to log responses and normalize errors
    this.api.interceptors.response.use(
      (response) => {
        console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const payload = error.response?.data;
        const message = payload?.message || error.message || 'Request failed';
        console.error('[API Response Error]', status ? `${status} ${message}` : message, payload || '');
        
        if (status === 401 && this.onLogout) {
          console.log('[ApiService] 401 Unauthorized - Triggering auto-logout');
          this.onLogout();
        }

        return Promise.reject(new Error(message));
      }
    );
  }

  setLogoutCallback(callback) {
    this.onLogout = callback;
  }

  setToken(token) {
    this.token = token || null;
    if (this.token) {
      this.api.defaults.headers.common.Authorization = `Bearer ${this.token}`;
    } else {
      delete this.api.defaults.headers.common.Authorization;
    }
  }

  unwrapResponse(response) {
    if (!response) {
      return null;
    }
    // Many APIs wrap the payload under data; handle both shapes.
    return response.data?.data ?? response.data;
  }

  // --- Authentication ---
  async googleLogin(idToken) {
    const response = await this.api.post(`${AUTH_PREFIX}/sign-in/social`, {
      provider: 'google',
      idToken: {
        token: idToken,
      },
    });
    const data = this.unwrapResponse(response);
    // Store the access token from the response
    // Normalize to always have 'token' field for consistency
    const accessToken = data?.token || data?.accessToken;
    if (accessToken) {
      this.setToken(accessToken);
      // Normalize response to always have 'token' field
      if (data && !data.token && data.accessToken) {
        data.token = data.accessToken;
      }
    }
    return data;
  }

  async emailLogin(email, password) {
    const response = await this.api.post(`${AUTH_PREFIX}/sign-in/email`, {
      email,
      password,
    });
    const data = this.unwrapResponse(response);
    if (data && data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async emailSignup(email, password, name) {
    const response = await this.api.post(`${AUTH_PREFIX}/sign-up/email`, {
      email,
      password,
      name,
    });
    const data = this.unwrapResponse(response);
    if (data && data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  // --- Contacts ---
  async getContacts() {
    const response = await this.api.get(`${API_V1_PREFIX}/contacts`);
    return this.unwrapResponse(response); // Expecting { contacts: [] } or []
  }

  async createContact(contactData) {
    // contactData: { name, phone, relation, country?, autoCall?, autoText? }
    const response = await this.api.post(`${API_V1_PREFIX}/contacts`, contactData);
    return this.unwrapResponse(response);
  }

  async updateContact(id, contactData) {
    const response = await this.api.put(`${API_V1_PREFIX}/contacts/${id}`, contactData);
    return this.unwrapResponse(response);
  }

  async deleteContact(id) {
    const response = await this.api.delete(`${API_V1_PREFIX}/contacts/${id}`);
    return this.unwrapResponse(response);
  }

  // --- Emergency Trigger ---
  async triggerEmergency(data) {
    // data: { latitude, longitude, deviceId, deviceInfo }
    const response = await this.api.post(`${API_V1_PREFIX}/trigger`, data);
    return this.unwrapResponse(response);
  }

  async getTriggerHistory() {
    const response = await this.api.get(`${API_V1_PREFIX}/trigger/history`);
    return this.unwrapResponse(response); // Expecting { triggers: [] } or []
  }

  // --- Devices ---
  async getDevices() {
    const response = await this.api.get(`${API_V1_PREFIX}/devices`);
    return this.unwrapResponse(response); // Expecting { devices: [] } or []
  }

  async createDevice(deviceData) {
    // deviceData: { deviceId: string } - deviceId will be sent as array
    // API expects: { deviceId: [""] }
    const response = await this.api.post(`${API_V1_PREFIX}/devices`, {
      deviceId: [deviceData.deviceId || deviceData.id || ''],
    });
    return this.unwrapResponse(response);
  }

  async deleteDevice(deviceId) {
    // deviceId: string - the device ID to delete
    const response = await this.api.delete(`${API_V1_PREFIX}/devices/${deviceId}`);
    return this.unwrapResponse(response);
  }
}

export default new ApiService();
