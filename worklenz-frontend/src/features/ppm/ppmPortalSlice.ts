import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  ppmAuthApi,
  ppmPortalApi,
  IPpmClientUser,
  IPpmDeliverable,
} from '@/api/ppm/ppm-portal.api';

interface PpmPortalState {
  // Auth
  user: IPpmClientUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  magicLinkSent: boolean;

  // Deliverables
  deliverables: IPpmDeliverable[];
  deliverablesTotal: number;
  deliverablesLoading: boolean;
  currentDeliverable: IPpmDeliverable | null;
  currentDeliverableLoading: boolean;

  // Filters
  statusFilter: string | null;
  page: number;
  pageSize: number;
}

const initialState: PpmPortalState = {
  user: null,
  isAuthenticated: false,
  authLoading: false,
  authError: null,
  magicLinkSent: false,

  deliverables: [],
  deliverablesTotal: 0,
  deliverablesLoading: false,
  currentDeliverable: null,
  currentDeliverableLoading: false,

  statusFilter: null,
  page: 1,
  pageSize: 20,
};

// ── Async Thunks ──

export const requestMagicLink = createAsyncThunk(
  'ppmPortal/requestMagicLink',
  async (email: string, { rejectWithValue }) => {
    try {
      const res = await ppmAuthApi.requestMagicLink(email);
      if (!res.done) return rejectWithValue(res.message || 'Failed to send magic link');
      return res.body;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Network error');
    }
  }
);

export const verifyMagicLink = createAsyncThunk(
  'ppmPortal/verifyMagicLink',
  async (token: string, { rejectWithValue }) => {
    try {
      const res = await ppmAuthApi.verifyMagicLink(token);
      if (!res.done) return rejectWithValue(res.message || 'Invalid or expired link');
      return res.body;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Invalid or expired link');
    }
  }
);

export const fetchPortalUser = createAsyncThunk(
  'ppmPortal/fetchUser',
  async (_, { rejectWithValue }) => {
    try {
      const res = await ppmAuthApi.me();
      if (!res.done) return rejectWithValue(res.message);
      return res.body;
    } catch {
      return rejectWithValue('Not authenticated');
    }
  }
);

export const fetchDeliverables = createAsyncThunk(
  'ppmPortal/fetchDeliverables',
  async (params: { status?: string; page?: number; size?: number } | undefined, { rejectWithValue }) => {
    try {
      const res = await ppmPortalApi.listDeliverables(params);
      if (!res.done) return rejectWithValue(res.message);
      return res.body;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load deliverables');
    }
  }
);

export const fetchDeliverable = createAsyncThunk(
  'ppmPortal/fetchDeliverable',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await ppmPortalApi.getDeliverable(id);
      if (!res.done) return rejectWithValue(res.message);
      return res.body;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load deliverable');
    }
  }
);

export const updateDeliverableStatus = createAsyncThunk(
  'ppmPortal/updateStatus',
  async ({ id, status, feedback }: { id: string; status: string; feedback?: string }, { rejectWithValue }) => {
    try {
      const res = await ppmPortalApi.updateStatus(id, status, feedback);
      if (!res.done) return rejectWithValue(res.message);
      return res.body;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update status');
    }
  }
);

// ── Slice ──

const ppmPortalSlice = createSlice({
  name: 'ppmPortal',
  initialState,
  reducers: {
    setStatusFilter: (state, action: PayloadAction<string | null>) => {
      state.statusFilter = action.payload;
      state.page = 1;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    resetAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.authError = null;
      state.magicLinkSent = false;
    },
  },
  extraReducers: builder => {
    // Magic link request
    builder
      .addCase(requestMagicLink.pending, state => {
        state.authLoading = true;
        state.authError = null;
        state.magicLinkSent = false;
      })
      .addCase(requestMagicLink.fulfilled, state => {
        state.authLoading = false;
        state.magicLinkSent = true;
      })
      .addCase(requestMagicLink.rejected, (state, action) => {
        state.authLoading = false;
        state.authError = action.payload as string;
      });

    // Magic link verify
    builder
      .addCase(verifyMagicLink.pending, state => {
        state.authLoading = true;
        state.authError = null;
      })
      .addCase(verifyMagicLink.fulfilled, (state, action) => {
        state.authLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload as IPpmClientUser;
      })
      .addCase(verifyMagicLink.rejected, (state, action) => {
        state.authLoading = false;
        state.authError = action.payload as string;
      });

    // Fetch user (session check)
    builder
      .addCase(fetchPortalUser.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload as IPpmClientUser;
      })
      .addCase(fetchPortalUser.rejected, state => {
        state.isAuthenticated = false;
        state.user = null;
      });

    // Deliverables list
    builder
      .addCase(fetchDeliverables.pending, state => {
        state.deliverablesLoading = true;
      })
      .addCase(fetchDeliverables.fulfilled, (state, action) => {
        state.deliverablesLoading = false;
        state.deliverables = action.payload?.data || [];
        state.deliverablesTotal = action.payload?.total || 0;
      })
      .addCase(fetchDeliverables.rejected, state => {
        state.deliverablesLoading = false;
      });

    // Single deliverable
    builder
      .addCase(fetchDeliverable.pending, state => {
        state.currentDeliverableLoading = true;
      })
      .addCase(fetchDeliverable.fulfilled, (state, action) => {
        state.currentDeliverableLoading = false;
        state.currentDeliverable = action.payload as IPpmDeliverable;
      })
      .addCase(fetchDeliverable.rejected, state => {
        state.currentDeliverableLoading = false;
      });

    // Status update
    builder
      .addCase(updateDeliverableStatus.fulfilled, (state, action) => {
        const updated = action.payload as IPpmDeliverable;
        if (state.currentDeliverable?.id === updated.id) {
          state.currentDeliverable = updated;
        }
        state.deliverables = state.deliverables.map(d =>
          d.id === updated.id ? { ...d, ...updated } : d
        );
      });
  },
});

export const { setStatusFilter, setPage, resetAuth } = ppmPortalSlice.actions;
export default ppmPortalSlice.reducer;
