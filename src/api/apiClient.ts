import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Định nghĩa kiểu phản hồi chuẩn từ Backend CSDL v2.5
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string | null;
  errors?: any;
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const clearApiClientAuthHeader = () => {
  delete apiClient.defaults.headers.common['Authorization'];
};

export const FORCE_LOGOUT_MESSAGE_KEY = 'ntu_force_logout_msg';
let isRedirectingToLogin = false;

export const clearStoredAuthAndRedirect = (reason?: string) => {
  const isPublicRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/giang-vien') ||
      window.location.pathname === '/dang-nhap' ||
      window.location.pathname === '/login');

  for (const st of [sessionStorage, localStorage]) {
    st.removeItem('accessToken');
    st.removeItem('token');
    st.removeItem('refreshToken');
    st.removeItem('user');
    st.removeItem('ntu_last_activity');
  }
  clearApiClientAuthHeader();

  if (typeof window !== 'undefined') {
    if (reason) {
      try {
        sessionStorage.setItem(FORCE_LOGOUT_MESSAGE_KEY, reason);
      } catch {
        // Ignore storage quota errors
      }
    }
    window.dispatchEvent(new CustomEvent('auth:session-cleared'));
    if (!isPublicRoute && !isRedirectingToLogin) {
      isRedirectingToLogin = true;
      window.location.href = '/dang-nhap';
    }
  }
};

// Request Interceptor: Gắn Bearer Token & chống cache trình duyệt cho request GET
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (config.headers) {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }
      if (String(config.method || 'get').toLowerCase() === 'get') {
        config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        config.headers['Pragma'] = 'no-cache';
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Tự động xoay vòng Refresh Token khi gặp lỗi 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Chuẩn hóa thông báo lỗi từ máy chủ sang Tiếng Việt thân thiện, loại bỏ tên trường CSDL kỹ thuật
 */
export function formatFriendlyErrorMessage(msg?: string): string {
  if (!msg || typeof msg !== 'string') {
    return 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
  }

  // Trường hợp trùng lặp điểm danh
  if (msg.includes('nguoi_dung_id này đã tồn tại') || msg.includes('nhat_ky_cham_cong')) {
    return 'Bản ghi chấm công của cán bộ trong ngày hôm nay đã tồn tại trên hệ thống.';
  }

  const DICTIONARY: Record<string, string> = {
    nguoi_dung_id: 'Cán bộ / Người dùng',
    ca_id: 'Ca làm việc',
    ma_can_bo: 'Mã cán bộ / giảng viên',
    so_dien_thoai: 'Số điện thoại',
    ten_dang_nhap: 'Tên đăng nhập',
    so_cccd_ma_hoa: 'Số CCCD/CMND',
    ma_ca: 'Mã ca làm việc',
    ten_ca: 'Tên ca làm việc',
    ma_mon: 'Mã môn học',
    ten_mon: 'Tên môn học',
    ma_phong_ban: 'Mã khoa / phòng ban',
    ten_phong_ban: 'Tên khoa / phòng ban',
    phong_ban_id: 'Khoa / Phòng ban',
    ngay_cong: 'Ngày công',
    khoa_cong: 'Khóa chấm công',
    lich_trinh_id: 'Lịch trình giảng dạy',
  };

  let result = msg;
  for (const [key, label] of Object.entries(DICTIONARY)) {
    if (result.includes(`${key} này đã tồn tại`)) {
      result = result.replace(`${key} này đã tồn tại`, `${label} này đã tồn tại`);
    }
  }

  return result;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    // Tự động làm sạch và chuẩn hóa thông báo lỗi từ máy chủ
    if (error.response?.data?.message) {
      error.response.data.message = formatFriendlyErrorMessage(error.response.data.message);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _getRetryCount?: number;
    };

    // Tự động retry tối đa 2 lần cho GET khi server đang khởi động lại / lỗi proxy tạm thời (502/503/504 hoặc ECONNREFUSED)
    const method = String(originalRequest?.method || '').toLowerCase();
    const status = error.response?.status;
    const isTransientProxyOrNetworkError =
      (!error.response && error.code !== 'ECONNABORTED' && error.code !== 'ERR_CANCELED') ||
      status === 502 ||
      status === 503 ||
      status === 504;

    if (
      originalRequest &&
      method === 'get' &&
      isTransientProxyOrNetworkError &&
      (originalRequest._getRetryCount ?? 0) < 2
    ) {
      originalRequest._getRetryCount = (originalRequest._getRetryCount ?? 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 800 * (originalRequest._getRetryCount ?? 1)));
      return apiClient(originalRequest);
    }

    const requestUrl = originalRequest?.url || '';
    const isAuthBypassRoute =
      requestUrl.includes('/xac-thuc/dang-nhap') ||
      requestUrl.includes('/xac-thuc/lam-moi-token') ||
      requestUrl.includes('/xac-thuc/dang-xuat') ||
      requestUrl.includes('/xac-thuc/quen-mat-khau') ||
      requestUrl.includes('/xac-thuc/dat-lai-mat-khau');

    // Tự động đăng xuất ngay nếu tài khoản bị vô hiệu hóa / khóa mềm hoặc đã nghỉ việc
    const responseStatus = error.response?.status;
    const responseErrorCode = error.response?.data?.errorCode;
    const responseMessage = error.response?.data?.message || '';
    const isAccountDisabled =
      responseStatus === 403 &&
      !isAuthBypassRoute &&
      (responseErrorCode === 'ACCOUNT_DISABLED' ||
        responseMessage.includes('đã bị vô hiệu hóa hoặc đã nghỉ việc'));

    if (isAccountDisabled) {
      clearStoredAuthAndRedirect(
        responseMessage || 'Tài khoản của bạn đã bị vô hiệu hóa hoặc đã nghỉ việc.'
      );
      return Promise.reject(error);
    }

    // Bỏ qua nếu lỗi không phải 401 hoặc thuộc các endpoint xác thực công khai/đăng xuất
    if (!error.response || error.response.status !== 401 || isAuthBypassRoute) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;
    const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');

    if (!refreshToken) {
      isRefreshing = false;
      clearStoredAuthAndRedirect();
      return Promise.reject(error);
    }

    try {
      const res = await axios.post<ApiResponse<{ token: string; ma_lam_moi?: string }>>(
        '/api/xac-thuc/lam-moi-token',
        { ma_lam_moi: refreshToken },
        { withCredentials: true }
      );

      const newToken = res.data.data?.token;
      const newRefreshToken = res.data.data?.ma_lam_moi;

      if (newToken) {
        const targetStorage = sessionStorage.getItem('token') || sessionStorage.getItem('refreshToken') ? sessionStorage : localStorage;
        targetStorage.setItem('token', newToken);
        targetStorage.setItem('ntu_last_activity', String(Date.now()));
        if (newRefreshToken) {
          targetStorage.setItem('refreshToken', newRefreshToken);
        }

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth:tokens-updated', {
              detail: { token: newToken, refreshToken: newRefreshToken || refreshToken },
            })
          );
        }
        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } else {
        throw new Error('Không nhận được token mới');
      }
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      clearStoredAuthAndRedirect();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export function extractArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  // Unpack nested Axios response or API envelope
  const payload = data?.data !== undefined ? data.data : data;
  if (Array.isArray(payload)) return payload;

  const target = payload && typeof payload === 'object' ? payload : data;
  if (Array.isArray(target)) return target;

  if (Array.isArray(target.schedules)) return target.schedules;
  if (Array.isArray(target.users)) return target.users;
  if (Array.isArray(target.shifts)) return target.shifts;
  if (Array.isArray(target.subjects)) return target.subjects;
  if (Array.isArray(target.departments)) return target.departments;
  if (Array.isArray(target.items)) return target.items;
  if (Array.isArray(target.data)) return target.data;
  if (Array.isArray(target.records)) return target.records;
  if (Array.isArray(target.docs)) return target.docs;

  // Check fallback on raw data if target didn't match
  if (target !== data && data && typeof data === 'object') {
    if (Array.isArray(data.schedules)) return data.schedules;
    if (Array.isArray(data.users)) return data.users;
    if (Array.isArray(data.shifts)) return data.shifts;
    if (Array.isArray(data.subjects)) return data.subjects;
    if (Array.isArray(data.departments)) return data.departments;
    if (Array.isArray(data.items)) return data.items;
  }

  // Iterate object values for any array
  if (typeof target === 'object') {
    for (const key of Object.keys(target)) {
      if (Array.isArray(target[key])) {
        return target[key];
      }
    }
  }

  return [];
}
