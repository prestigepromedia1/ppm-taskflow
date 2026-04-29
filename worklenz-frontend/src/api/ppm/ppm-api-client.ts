import axios from 'axios';
import config from '@/config/env';

/**
 * Separate Axios instance for PPM client portal API calls.
 * Uses session cookies (same as main apiClient) but hits /ppm/api/ routes.
 * No CSRF needed — PPM auth routes are excluded from CSRF in app.ts.
 */
const ppmApiClient = axios.create({
  baseURL: `${config.apiUrl}/ppm/api`,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Redirect to portal login on 401
ppmApiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/portal') && currentPath !== '/portal/login') {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(error);
  }
);

export default ppmApiClient;
