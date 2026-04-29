import ppmApiClient from './ppm-api-client';
import { IServerResponse } from '@/types/common.types';

// ── Types ──

export interface IPpmClientUser {
  client_user_id: string;
  email: string;
  client_id: string;
  role: 'viewer' | 'reviewer' | 'admin';
  display_name?: string;
  client_name?: string;
  branding_config?: IPpmBrandingConfig;
}

export interface IPpmBrandingConfig {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font?: string;
}

export interface IPpmDeliverable {
  id: string;
  title: string;
  description?: string;
  status: string;
  status_label?: string;
  visibility: string;
  send_date?: string;
  due_date?: string;
  asset_review_link?: string;
  estimated_hours?: number;
  actual_hours?: number;
  month_completed?: string;
  created_at: string;
  updated_at: string;
  type_label?: string;
  type_color?: string;
  channel_label?: string;
  channel_color?: string;
  priority_label?: string;
  priority_color?: string;
  // Internal-only fields (not returned by portal endpoints)
  client_id?: string;
  client_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  worklenz_task_id?: string;
}

export interface IPpmDeliverableList {
  total: number;
  data: IPpmDeliverable[];
}

// ── Auth API ──

export const ppmAuthApi = {
  async requestMagicLink(email: string) {
    const res = await ppmApiClient.post<IServerResponse<{ message: string; token?: string }>>(
      '/auth/magic-link',
      { email }
    );
    return res.data;
  },

  async verifyMagicLink(token: string) {
    const res = await ppmApiClient.get<IServerResponse<IPpmClientUser>>(
      `/auth/verify?token=${encodeURIComponent(token)}`
    );
    return res.data;
  },

  async me() {
    const res = await ppmApiClient.get<IServerResponse<IPpmClientUser>>('/auth/me');
    return res.data;
  },

  async logout() {
    const res = await ppmApiClient.post<IServerResponse<null>>('/auth/logout');
    return res.data;
  },
};

// ── Portal Deliverables API ──

export const ppmPortalApi = {
  async listDeliverables(params?: { status?: string; page?: number; size?: number }) {
    const res = await ppmApiClient.get<IServerResponse<IPpmDeliverableList>>(
      '/portal/deliverables',
      { params }
    );
    return res.data;
  },

  async getDeliverable(id: string) {
    const res = await ppmApiClient.get<IServerResponse<IPpmDeliverable>>(
      `/portal/deliverables/${id}`
    );
    return res.data;
  },

  async updateStatus(id: string, status: string, feedback?: string) {
    const res = await ppmApiClient.patch<IServerResponse<IPpmDeliverable>>(
      `/portal/deliverables/${id}/status`,
      { status, ...(feedback ? { feedback } : {}) }
    );
    return res.data;
  },
};
