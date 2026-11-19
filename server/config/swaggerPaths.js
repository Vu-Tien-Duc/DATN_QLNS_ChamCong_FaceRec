// Đặc tả các endpoint và schema cho OpenAPI 3.0 (Swagger UI)

const swaggerComponents = {
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Nhập Token JWT (sau khi login tại /api/xac-thuc/dang-nhap) theo định dạng: Bearer <token>',
    },
  },
  schemas: {
    ApiResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Thực hiện thao tác thành công.' },
        data: { type: 'object' },
      },
    },
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        ho_ten: { type: 'string', example: 'TS. Trần Thị Bích' },
        email: { type: 'string', example: 'giangvien.bich@university.edu.vn' },
        ma_can_bo: { type: 'string', example: 'GV001' },
        so_dien_thoai: { type: 'string', example: '0901234567' },
        hoc_vi: { type: 'string', example: 'tien_si' },
        vai_tro_chinh: {
          type: 'string',
          enum: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'giang_vien', 'nhan_vien'],
          example: 'giang_vien',
        },
        don_vi_chinh_id: { type: 'string', example: '00000000-0000-4000-8000-000000000002' },
        han_muc_phep_nam: { type: 'number', example: 12 },
        kich_hoat: { type: 'boolean', example: true },
        tao_luc: { type: 'string', format: 'date-time' },
        cap_nhat_luc: { type: 'string', format: 'date-time' },
      },
    },
    Department: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000002' },
        ten_phong_ban: { type: 'string', example: 'Khoa Công nghệ Thông tin' },
        loai_don_vi: { type: 'string', enum: ['khoa', 'bo_mon', 'phong_ban'], example: 'khoa' },
        don_vi_cha_id: { type: 'string', nullable: true, example: null },
        truong_don_vi_id: { type: 'string', nullable: true, example: '00000000-0000-4000-8000-000000000001' },
        vi_do: { type: 'number', example: 20.9752 },
        kinh_do: { type: 'number', example: 105.7628 },
      },
    },
    ShiftConfig: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000003' },
        ten_ca: { type: 'string', example: 'Tiết 1-3 (Sáng)' },
        gio_bat_dau: { type: 'string', example: '07:00' },
        gio_ket_thuc: { type: 'string', example: '09:30' },
        nguong_di_muon_phut: { type: 'number', example: 15 },
        kich_hoat: { type: 'boolean', example: true },
      },
    },
    Schedule: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000004' },
        nguoi_dung_id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        ca_id: { type: 'string', example: '00000000-0000-4000-8000-000000000003' },
        mon_hoc_id: { type: 'string', example: '00000000-0000-4000-8000-000000000005' },
        phong_hoc: { type: 'string', example: 'A1-402' },
        vi_do: { type: 'number', example: 20.9752 },
        kinh_do: { type: 'number', example: 105.7628 },
        thu_trong_tuan: { type: 'integer', description: '0: CN, 1: T2, ..., 6: T7', example: 2 },
        ngay_bat_dau: { type: 'string', format: 'date', example: '2026-01-01' },
        ngay_ket_thuc: { type: 'string', format: 'date', example: '2026-12-31' },
      },
    },
    Subject: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000005' },
        ma_mon: { type: 'string', example: 'INT3105' },
        ten_mon: { type: 'string', example: 'Lập trình Web nâng cao' },
        so_tin_chi: { type: 'number', example: 3 },
        phong_ban_id: { type: 'string', nullable: true, example: '00000000-0000-4000-8000-000000000002' },
        mo_ta: { type: 'string', example: 'Học phần Lập trình Web chuyên ngành CNTT' },
        kich_hoat: { type: 'boolean', example: true },
      },
    },
    AttendanceLog: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000006' },
        nguoi_dung_id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        ca_id: { type: 'string', example: '00000000-0000-4000-8000-000000000003' },
        lich_trinh_id: { type: 'string', nullable: true, example: '00000000-0000-4000-8000-000000000004' },
        thoi_gian_vao: { type: 'string', format: 'date-time' },
        thoi_gian_ra: { type: 'string', format: 'date-time', nullable: true },
        trang_thai: {
          type: 'string',
          enum: ['on_time', 'late', 'early_leave', 'absent', 'excused_absence'],
          example: 'on_time',
        },
        phuong_thuc: {
          type: 'string',
          enum: ['face_ai', 'qr_code', 'gps_mobile', 'thu_cong_admin', 'system_auto'],
          example: 'gps_mobile',
        },
        co_gian_lan: { type: 'boolean', example: false },
      },
    },
    LeaveRequest: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000007' },
        nguoi_dung_id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        loai_don: {
          type: 'string',
          enum: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng', 'giai_trinh_cong'],
          example: 'nghi_phep',
        },
        ngay_bat_dau: { type: 'string', format: 'date', example: '2026-09-10' },
        ngay_ket_thuc: { type: 'string', format: 'date', example: '2026-09-12' },
        ly_do: { type: 'string', example: 'Bận việc gia đình cá nhân' },
        tep_dinh_kem: { type: 'string', nullable: true },
        trang_thai: {
          type: 'string',
          enum: ['pending', 'pending_dean', 'pending_bgh', 'approved', 'rejected', 'cancelled'],
          example: 'pending',
        },
        nguoi_duyet_id: { type: 'string', nullable: true },
        ly_do_tu_choi: { type: 'string', nullable: true },
      },
    },
    AuditLog: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000008' },
        nguoi_thuc_hien_id: { type: 'string', nullable: true },
        hanh_dong: { type: 'string', example: 'USER_LOGIN' },
        loai_doi_tuong: { type: 'string', example: 'nguoi_dung' },
        doi_tuong_id: { type: 'string', nullable: true },
        dia_chi_ip: { type: 'string', example: '127.0.0.1' },
        ket_qua: { type: 'string', enum: ['success', 'failed'], example: 'success' },
        thoi_diem: { type: 'string', format: 'date-time' },
        chi_tiet: { type: 'object' },
      },
    },
    Payroll: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000009' },
        nguoi_dung_id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        thang: { type: 'integer', example: 10 },
        nam: { type: 'integer', example: 2026 },
        luong_co_ban: { type: 'number', example: 2530000 },
        he_so_luong: { type: 'number', example: 2.34 },
        so_tiet_nghia_vu: { type: 'number', example: 45 },
        so_tiet_thuc_day: { type: 'number', example: 52 },
        so_tiet_vuot_gio: { type: 'number', example: 7 },
        don_gia_tiet_vuot: { type: 'number', example: 120000 },
        tien_vuot_gio: { type: 'number', example: 840000 },
        tong_phu_cap: { type: 'number', example: 1500000 },
        dong_bao_hiem: { type: 'number', example: 1890000 },
        thue_thu_nhap_ca_nhan: { type: 'number', example: 372500 },
        thuc_linh: { type: 'number', example: 21327500 },
        trang_thai: { type: 'string', enum: ['nhap', 'cho_duyet', 'da_duyet', 'da_chi_tra'], example: 'da_duyet' },
        da_khoa: { type: 'boolean', example: true },
        thoi_gian_duyet: { type: 'string', format: 'date-time', nullable: true },
      },
    },
    FaceTemplate: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000010' },
        nguoi_dung_id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        so_luong_mau: { type: 'integer', example: 5 },
        so_chieu_vector: { type: 'integer', example: 512 },
        mac_dinh: { type: 'boolean', example: true },
        ngay_dang_ky: { type: 'string', format: 'date-time' },
      },
    },
    SystemConfig: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000011' },
        khoa_cau_hinh: { type: 'string', example: 'GEOFENCE_TRUONG' },
        gia_tri: { type: 'object', example: 150 },
        mo_ta: { type: 'string', example: 'Bán kính GPS hợp lệ quanh khuôn viên cơ sở (mét)' },
        nhom: { type: 'string', example: 'CHAM_CONG' },
      },
    },
    Holiday: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000012' },
        ten_ngay_le: { type: 'string', example: 'Tết Nguyên Đán 2026' },
        ngay_bat_dau: { type: 'string', format: 'date', example: '2026-02-15' },
        ngay_ket_thuc: { type: 'string', format: 'date', example: '2026-02-22' },
        nam: { type: 'integer', example: 2026 },
        huong_luong: { type: 'boolean', example: true },
        mo_ta: { type: 'string', example: 'Nghỉ Tết Âm lịch theo quy định Nhà nước' },
      },
    },
    PunchLog: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '00000000-0000-4000-8000-000000000013' },
        cham_cong_id: { type: 'string', example: '00000000-0000-4000-8000-000000000006' },
        nguoi_dung_id: { type: 'string', example: '00000000-0000-4000-8000-000000000001' },
        loai_quet: { type: 'string', enum: ['check_in', 'check_out'], example: 'check_in' },
        thoi_gian_quet: { type: 'string', format: 'date-time' },
        phuong_thuc: { type: 'string', enum: ['face_ai', 'qr_code', 'gps_mobile', 'thu_cong_admin', 'system_auto'], example: 'face_ai' },
        do_tin_cay_ai: { type: 'number', example: 0.95 },
        diem_mat_that: { type: 'number', example: 0.92 },
        vi_tri_gia_lap: { type: 'boolean', example: false },
        hop_le: { type: 'boolean', example: true },
        ly_do_khong_hop_le: { type: 'string', nullable: true },
      },
    },
    Notification: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
        userId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
        title: { type: 'string', example: 'Nhắc nhở chấm công' },
        message: { type: 'string', example: 'Bạn có tiết giảng dạy lúc 07:00 tại phòng A1-402.' },
        type: { type: 'string', enum: ['info', 'warning', 'success', 'error'], example: 'info' },
        isRead: { type: 'boolean', example: false },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};

const swaggerPaths = {
  // 1. Kiểm tra trạng thái hệ thống
  '/api/suc-khoe': {
    get: {
      tags: ['17 - Hạ Tầng & Kiểm Tra Hệ Thống (Health Check)'],
      summary: '[🔓 Public] Kiểm tra trạng thái máy chủ và 24 bảng SQL Server CSDL 3NF',
      responses: {
        200: {
          description: 'Hệ thống hoạt động bình thường',
          content: {
            'application/json': {
              example: {
                status: 'OK',
                database: 'CONNECTED',
                uptimeSeconds: 3600,
                environment: 'development',
                message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
                collectionsCount: 14,
                collections: [
                  'nguoi_dung',
                  'mau_khuon_mat',
                  'phong_ban',
                  'ca_lam_viec',
                  'mon_hoc',
                  'lich_trinh',
                  'ngay_nghi_le',
                  'luot_quet_cham_cong',
                  'nhat_ky_cham_cong',
                  'don_nghi_phep',
                  'phieu_luong',
                  'ma_lam_moi',
                  'cau_hinh_he_thong',
                  'nhat_ky_kiem_toan',
                ],
                timestamp: '2026-10-18T12:00:00.000Z',
              },
            },
          },
        },
      },
    },
  },

  // 2. Xác thực & Phiên đăng nhập
  '/api/xac-thuc/dang-nhap': {
    post: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔓 Public] Đăng nhập người dùng (Rate Limit 5 lần/15p, JWT Access & Refresh Token)',
      description: 'Đăng nhập vào hệ thống bằng Email hoặc Mã cán bộ và Mật khẩu.\n\n**Danh sách tài khoản Demo (Mật khẩu chung: `password123`):**\n- Quản trị viên (Admin): `admin@university.edu.vn` hoặc `daihocdtd@gmail.com`\n- Hiệu trưởng (BGH): `hieutruong@university.edu.vn`\n- Trưởng khoa CNTT: `truongkhoa.cntt@university.edu.vn`\n- Giảng viên: `giangvien.bich@university.edu.vn`\n- Nhân viên: `nhanvien.ha@university.edu.vn`',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', example: 'admin@university.edu.vn' },
                password: { type: 'string', example: 'password123' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Đăng nhập thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Đăng nhập thành công.',
                data: {
                  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  user: {
                    _id: '00000000-0000-4000-8000-000000000',
                    fullName: 'Quản Trị Viên Hệ Thống (Admin Trường)',
                    email: 'daihocdtd@gmail.com',
                    role: 'admin',
                    departmentId: '00000000-0000-4000-8000-000000000',
                    annualLeaveQuota: 15,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        401: { description: 'Email hoặc mật khẩu không chính xác' },
      },
    },
  },

  '/api/xac-thuc/ho-so': {
    get: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔒 Cá nhân] Lấy thông tin cá nhân hiện tại của người dùng đang đăng nhập',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Lấy thông tin thành công',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
            },
          },
        },
        401: { description: 'Chưa xác thực hoặc Token không hợp lệ' },
      },
    },
  },

  '/api/xac-thuc/lam-moi-token': {
    post: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔓 Public] Cấp mới Access Token từ Refresh Token',
      description: 'Đọc Refresh Token (ma_lam_moi) từ httpOnly cookie hoặc JSON Request Body để cấp mới Access Token 15 phút.',
      security: [],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ma_lam_moi: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cấp token mới thành công' },
        400: { description: 'Thiếu Refresh Token trong Cookie hoặc Body' },
        403: { description: 'Refresh token không hợp lệ hoặc đã hết hạn' },
      },
    },
  },

  '/api/xac-thuc/dang-xuat': {
    post: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔒 Xác thực] Đăng xuất khỏi hệ thống (Blacklist Access Token, xóa Refresh Token & clear Cookie)',
      description: 'Đưa Access Token hiện tại vào Blacklist để vô hiệu hóa ngay lập tức, xóa Refresh Token trong CSDL và xóa httpOnly cookie.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Đăng xuất thành công' },
      },
    },
  },

  '/api/xac-thuc/quen-mat-khau': {
    post: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔓 Public] Yêu cầu mã OTP đặt lại mật khẩu (Hạn 10 phút)',
      description: 'Gửi mã OTP 6 chữ số đến email để xác thực yêu cầu đổi mật khẩu mới.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', example: 'daihocdtd@gmail.com' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Mã OTP đặt lại mật khẩu đã được gửi đến email (hạn 10 phút)' },
        400: { description: 'Thiếu email' },
        403: { description: 'Tài khoản chưa được kích hoạt hoặc đã bị vô hiệu hóa' },
        404: { description: 'Không tìm thấy tài khoản với email này' },
      },
    },
  },

  '/api/xac-thuc/dat-lai-mat-khau': {
    post: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔓 Public] Xác thực OTP và đặt lại mật khẩu mới',
      description: 'Nhập mã OTP 6 số còn hiệu lực (< 10 phút) và mật khẩu mới để đổi mật khẩu (thu hồi các token cũ).',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'otp', 'newPassword'],
              properties: {
                email: { type: 'string', example: 'daihocdtd@gmail.com' },
                otp: { type: 'string', example: '123456' },
                newPassword: { type: 'string', example: 'new_password123' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Đặt lại mật khẩu thành công' },
        400: { description: 'Mã OTP không hợp lệ, đã hết hạn (>10 phút) hoặc mật khẩu dưới 6 ký tự' },
        404: { description: 'Không tìm thấy tài khoản' },
      },
    },
  },

  '/api/xac-thuc/doi-mat-khau': {
    put: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔒 Cá nhân] Đổi mật khẩu tài khoản đang đăng nhập',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['oldPassword', 'newPassword'],
              properties: {
                oldPassword: { type: 'string', example: 'password123' },
                newPassword: { type: 'string', example: 'new_secret_pass_2026' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Đổi mật khẩu thành công' },
        400: { description: 'Mật khẩu cũ không chính xác hoặc mật khẩu mới dưới 6 ký tự' },
      },
    },
  },

  '/api/xac-thuc/anh-dai-dien': {
    put: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔒 Cá nhân] Cập nhật ảnh đại diện cá nhân (PUT - Upload file hoặc URL)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                avatar: { type: 'string', format: 'binary', description: 'File ảnh JPG/PNG' },
              },
            },
          },
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                avatarUrl: { type: 'string', example: '/uploads/avatar_user.png' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật ảnh đại diện thành công' },
      },
    },
    post: {
      tags: ['01 - Xác Thực & Phiên Làm Việc (Auth)'],
      summary: '[🔒 Cá nhân] Cập nhật ảnh đại diện cá nhân (POST - Upload file hoặc URL)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                avatar: { type: 'string', format: 'binary' },
              },
            },
          },
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                avatarUrl: { type: 'string', example: '/uploads/avatar_user.png' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật ảnh đại diện thành công' },
      },
    },
  },

  // 3. Quản lý nhân sự
  '/api/nguoi-dung': {
    get: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin / Trưởng khoa] Lấy danh sách người dùng (Admin xem toàn trường, Trưởng khoa chỉ xem khoa mình)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'giang_vien', 'nhan_vien'] }, description: 'Lọc theo chức vụ' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo mã phòng ban (Chỉ có tác dụng với Admin)' },
        { name: 'isActive', in: 'query', schema: { type: 'boolean' }, description: 'Lọc tài khoản còn hoạt động hay không' },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo họ tên hoặc email' },
      ],
      responses: {
        200: { description: 'Lấy danh sách thành công' },
        403: { description: 'Không có quyền truy cập' },
      },
    },
    post: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin] Thêm người dùng mới (Ghi Audit Log)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fullName', 'email', 'password', 'departmentId'],
              properties: {
                fullName: { type: 'string', example: 'TS. Lê Thanh Sơn' },
                email: { type: 'string', example: 'lethanhson@university.edu.vn' },
                password: { type: 'string', example: 'password123' },
                role: { type: 'string', enum: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'giang_vien', 'nhan_vien'], example: 'giang_vien' },
                departmentId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                annualLeaveQuota: { type: 'number', example: 12 },
                staffCode: { type: 'string', example: 'GV001' },
                phoneNumber: { type: 'string', example: '0901234567' },
                academicTitle: { type: 'string', example: 'Tiến sĩ' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo người dùng thành công' },
        400: { description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại' },
        403: { description: 'Chỉ Admin mới có quyền thực hiện' },
      },
    },
  },

  '/api/nguoi-dung/{id}': {
    get: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin / Trưởng khoa] Xem thông tin chi tiết một người dùng',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy thông tin thành công' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
    put: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin / Trưởng khoa] Cập nhật thông tin người dùng (Ghi Audit Log)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                fullName: { type: 'string', example: 'TS. Trần Thị Bích (Cập nhật)' },
                departmentId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                role: { type: 'string', enum: ['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'giang_vien', 'nhan_vien'] },
                isActive: { type: 'boolean' },
                annualLeaveQuota: { type: 'number', example: 14 },
                staffCode: { type: 'string', example: 'GV001' },
                phoneNumber: { type: 'string', example: '0901234567' },
                academicTitle: { type: 'string', example: 'Tiến sĩ' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
    delete: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin] Vô hiệu hóa người dùng (Soft Delete: isActive = false, Ghi Audit Log)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Vô hiệu hóa tài khoản thành công' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
  },

  '/api/nguoi-dung/{id}/khuon-mat': {
    post: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin] Đăng ký Face ID đa góc từ ảnh bằng InsightFace (512 chiều)',
      description: 'Gửi tối đa 5 ảnh góc độ JPEG, PNG hoặc WebP dạng multipart/form-data (chính diện, nghiêng trái, nghiêng phải, ngửa lên, cúi xuống). Face Service trích xuất embedding 512 chiều; backend lưu vector trong face_templates.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID người dùng cần gán Face ID' }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['images'],
              properties: {
                images: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: 5 },
                sampleAngles: { type: 'string', description: 'Mảng JSON hoặc chuỗi danh mục các góc mặt' },
                force: { type: 'string', enum: ['true', 'false'] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Đăng ký Face ID thành công' },
        400: { description: 'Vector không đúng chuẩn 512 chiều hoặc ảnh không phát hiện khuôn mặt' },
        403: { description: 'Chỉ Admin mới có quyền thực hiện' },
        404: { description: 'Không tìm thấy người dùng' },
        409: { description: 'Khuôn mặt đã được đăng ký cho người khác (USER_003)' },
      },
    },
    delete: {
      tags: ['02 - Quản Lý Người Dùng (Users)'],
      summary: '[🔒 Admin] Xóa dữ liệu Face ID của nhân sự',
      description: 'Xóa mẫu khuôn mặt khỏi collection face_templates và đặt lại faceRegistered = false để cho phép đăng ký lại.',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID người dùng cần xóa Face ID' }],
      responses: {
        200: { description: 'Xóa Face ID thành công' },
        403: { description: 'Chỉ Admin mới có quyền thực hiện' },
        404: { description: 'Không tìm thấy người dùng' },
      },
    },
  },

  // 4. Khoa & Phòng ban
  '/api/phong-ban': {
    get: {
      tags: ['03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: '[🔒 Xác thực] Lấy danh sách Khoa / Viện / Phòng ban (Cây phân cấp)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'tree', in: 'query', schema: { type: 'boolean', default: true }, description: 'Trả về cấu trúc dạng cây phân cấp (true/false)' },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['khoa', 'bo_mon', 'phong_ban'] }, description: 'Lọc theo loại' },
        { name: 'parentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID đơn vị cha' },
      ],
      responses: {
        200: { description: 'Lấy danh sách thành công' },
      },
    },
    post: {
      tags: ['03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: '[🔒 Admin] Tạo mới Khoa / Phòng ban / Bộ môn',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'type'],
              properties: {
                name: { type: 'string', example: 'Bộ môn Khoa học Dữ liệu' },
                type: { type: 'string', enum: ['khoa', 'bomon', 'phongban'], example: 'bomon' },
                parentId: { type: 'string', example: '00000000-0000-4000-8000-000000000', nullable: true },
                managerId: { type: 'string', example: '00000000-0000-4000-8000-000000000', nullable: true },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo đơn vị thành công' },
        400: { description: 'Thiếu thông tin bắt buộc hoặc vi phạm quy tắc phân cấp / managerId không hợp lệ' },
      },
    },
  },

  '/api/phong-ban/cay': {
    get: {
      tags: ['03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: '[🔒 Xác thực] Lấy cây cơ cấu tổ chức phân cấp (Trường > Khoa > Bộ môn)',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Lấy cây tổ chức thành công' },
      },
    },
  },

  '/api/phong-ban/{id}': {
    get: {
      tags: ['03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: '[🔒 Xác thực] Lấy chi tiết Khoa / Phòng ban',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy chi tiết thành công' },
        404: { description: 'Không tìm thấy phòng ban' },
      },
    },
    put: {
      tags: ['03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: '[🔒 Admin / Trưởng khoa] Cập nhật thông tin Khoa / Phòng ban',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Khoa CNTT & Truyền thông' },
                managerId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
      },
    },
    delete: {
      tags: ['03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)'],
      summary: '[🔒 Admin] Xóa Khoa / Phòng ban (Ràng buộc nhân sự & đơn vị con)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Xóa thành công' },
        400: { description: 'Không thể xóa do còn nhân sự hoặc đơn vị con trực thuộc' },
      },
    },
  },

  // 5. Ca làm việc
  '/api/ca-lam-viec': {
    get: {
      tags: ['04 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: '[🔒 Xác thực] Danh sách cấu hình ca làm việc / tiết học',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Lấy danh sách thành công' },
      },
    },
    post: {
      tags: ['04 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: '[🔒 Admin] Thêm mới ca làm việc / tiết dạy',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'code', 'startTime', 'endTime'],
              properties: {
                ten_ca: { type: 'string', example: 'Tiết 10-12 (Tối)' },
                gio_bat_dau: { type: 'string', example: '18:00' },
                gio_ket_thuc: { type: 'string', example: '20:30' },
                nguong_di_muon_phut: { type: 'number', default: 15, example: 15 },
                kich_hoat: { type: 'boolean', default: true, example: true },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo ca làm việc thành công' },
      },
    },
  },

  '/api/ca-lam-viec/{id}': {
    get: {
      tags: ['04 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: '[🔒 Xác thực] Chi tiết ca làm việc theo ID',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy chi tiết thành công' },
        404: { description: 'Không tìm thấy ca làm việc' },
      },
    },
    put: {
      tags: ['04 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: '[🔒 Admin] Cập nhật ca làm việc',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                startTime: { type: 'string', example: '07:15' },
                endTime: { type: 'string', example: '09:45' },
                lateThresholdMinutes: { type: 'number' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
      },
    },
    delete: {
      tags: ['04 - Ca Làm Việc & Tiết Học (Shifts)'],
      summary: '[🔒 Admin] Xóa ca làm việc',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Xóa thành công' },
      },
    },
  },

  // 6. Lịch trình & Thời khóa biểu
  '/api/lich-trinh': {
    get: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Xác thực] Tra cứu lịch giảng dạy và lịch làm việc',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID giảng viên' },
        { name: 'shiftId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID ca' },
        { name: 'weekday', in: 'query', schema: { type: 'integer' }, description: 'Thứ trong tuần (0: CN, 1: T2, ..., 6: T7)' },
        { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Lọc lịch học vào ngày cụ thể (YYYY-MM-DD)' },
      ],
      responses: {
        200: { description: 'Lấy danh sách lịch thành công' },
      },
    },
    post: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Admin / Trưởng khoa] Tạo mới lịch phân công giảng dạy',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'shiftId', 'roomId', 'weekday', 'startDate', 'endDate'],
              properties: {
                userId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                shiftId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                roomId: { type: 'string', example: 'A1-402' },
                weekday: { type: 'integer', example: 2 },
                startDate: { type: 'string', format: 'date', example: '2026-09-01' },
                endDate: { type: 'string', format: 'date', example: '2026-12-31' },
                notes: { type: 'string', example: 'Hệ điều hành nâng cao - K21' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Tạo lịch phân công thành công' },
        400: { description: 'Xung đột lịch giảng dạy hoặc dữ liệu thiếu' },
      },
    },
  },

  '/api/lich-trinh/hom-nay': {
    get: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Xác thực] Lấy danh sách lịch giảng dạy hiệu lực trong ngày hôm nay',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Ngày cần tra cứu (mặc định là hôm nay)' },
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID giảng viên (Dành cho Admin/Trưởng khoa)' },
      ],
      responses: {
        200: { description: 'Lấy danh sách lịch trong ngày thành công' },
      },
    },
  },

  '/api/lich-trinh/{id}': {
    get: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Xác thực] Xem chi tiết một lịch giảng dạy',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy thông tin thành công' },
      },
    },
    put: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Admin / Trưởng khoa] Cập nhật lịch giảng dạy',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                roomId: { type: 'string', example: 'B2-205' },
                notes: { type: 'string', example: 'Chuyển phòng học thực hành' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật thành công' },
      },
    },
    delete: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Admin / Trưởng khoa] Xóa lịch giảng dạy',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Xóa thành công' },
      },
    },
  },

  '/api/lich-trinh/{id}/ngoai-le': {
    post: {
      tags: ['06 - Lịch Phân Công Giảng Dạy (Schedules)'],
      summary: '[🔒 Giảng viên / Trưởng khoa / Admin] Ghi nhận ngoại lệ lịch giảng dạy (Nghỉ / Dạy bù)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['ngay'],
              properties: {
                ngay: { type: 'string', format: 'date', example: '2026-09-18' },
                trang_thai: { type: 'string', enum: ['nghi', 'day_bu'], default: 'nghi' },
                ly_do: { type: 'string', example: 'Công tác hội đồng khoa học' },
                ngay_day_bu: { type: 'string', format: 'date', nullable: true },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Ghi nhận ngoại lệ lịch thành công' },
      },
    },
  },

  // 7. Chấm công & Điểm danh
  '/api/cham-cong/vao-ca': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Cá nhân] Điểm danh đầu ca (Check-in GPS / QR / Manual)',
      description: 'Hệ thống tự động tìm lịch dạy phù hợp của người dùng trong khoảng [startTime - 30p, endTime] và đánh giá trạng thái Đúng giờ / Đi muộn.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                phuong_thuc: { type: 'string', enum: ['gps_mobile', 'thu_cong_admin'], default: 'gps_mobile', example: 'gps_mobile' },
                thiet_bi_id: { type: 'string', example: 'MOBILE_APP' },
                vi_do: { type: 'number', example: 20.9752 },
                kinh_do: { type: 'number', example: 105.7628 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Điểm danh Check-in thành công' },
        400: { description: 'Đã check-in ca này rồi hoặc không có lịch phù hợp trong khung giờ hiện tại' },
      },
    },
  },

  '/api/cham-cong/tan-ca': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Cá nhân] Điểm danh kết thúc ca (Check-out)',
      description: 'Tự động tìm kiếm bản ghi check-in mở gần nhất trong ngày để đóng ca và cập nhật thời gian check-out.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Điểm danh Check-out thành công' },
        404: { description: 'Không tìm thấy lượt check-in mở nào trong ngày' },
      },
    },
  },

  '/api/cham-cong/lich-su': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Xác thực] Lịch sử chấm công (Phân quyền: GV cá nhân, Trưởng khoa xem khoa, Admin toàn trường)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo nhân sự' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo phòng ban' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['on_time', 'late', 'early_leave', 'absent', 'excused_absence'] }, description: 'Lọc theo trạng thái' },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Từ ngày (YYYY-MM-DD)' },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Đến ngày (YYYY-MM-DD)' },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Số trang' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Số bản ghi / trang' },
      ],
      responses: {
        200: { description: 'Lấy lịch sử chấm công thành công' },
      },
    },
  },

  '/api/cham-cong/lich-su-cua-toi': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Cá nhân] Tra cứu lịch sử chấm công của chính tài khoản đang đăng nhập',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Lấy lịch sử chấm công cá nhân thành công' },
      },
    },
  },

  '/api/cham-cong/{id}': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Xác thực] Xem chi tiết bản ghi chấm công',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Lấy thông tin thành công' },
      },
    },
  },

  '/api/cham-cong/{id}/dieu-chinh': {
    put: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Admin / BGH / Trưởng khoa] Điều chỉnh bản ghi chấm công (Ghi Audit Log)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['ly_do_ghi_de'],
              properties: {
                trang_thai: { type: 'string', enum: ['on_time', 'late', 'early_leave', 'absent', 'excused_absence'], example: 'on_time' },
                thoi_gian_vao: { type: 'string', format: 'date-time' },
                thoi_gian_ra: { type: 'string', format: 'date-time' },
                ly_do_ghi_de: { type: 'string', example: 'Điều chỉnh bổ sung do giảng viên quên quẹt thẻ có sự xác nhận' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Điều chỉnh chấm công thành công' },
      },
    },
  },

  '/api/cham-cong/quet-vang-mat': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Admin] Kích hoạt thủ công tiến trình quét vắng mặt',
      description: 'Kích hoạt thủ công tiến trình cron kiểm tra vắng mặt ngay lập tức mà không cần đợi cuối ngày.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'ngay',
          in: 'query',
          schema: { type: 'string', format: 'date', example: '2026-09-14' },
          description: 'Ngày cần kiểm tra (YYYY-MM-DD). Mặc định là hôm nay.',
        },
      ],
      responses: {
        200: { description: 'Kích hoạt tiến trình quét vắng mặt thành công' },
        403: { description: 'Không có quyền truy cập (Chỉ Admin)' },
      },
    },
  },

  '/api/cham-cong/khuon-mat': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Máy chấm công] Điểm danh nhận diện khuôn mặt qua Máy chấm công Face ID',
      description: 'Xác thực qua header x-terminal-key hoặc Bearer Token kèm rate limit 15 req/phút. Gửi ảnh multipart/form-data để Face Service nhận diện bằng InsightFace 512D, tự động tìm ca dạy phù hợp trong ngày và ghi nhận điểm danh.',
      security: [],
      parameters: [
        {
          name: 'x-terminal-key',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'Khóa bảo mật của thiết bị Máy chấm công Face ID, được cấu hình qua biến môi trường TERMINAL_KEY.',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: {
                  type: 'string',
                  format: 'binary',
                  description: 'Ảnh JPEG/PNG chụp từ camera máy chấm công gửi tới InsightFace',
                },
                mode: {
                  type: 'string',
                  enum: ['auto', 'check_in', 'check_out'],
                  default: 'auto',
                },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Điểm danh Face ID thành công' },
        400: { description: 'Vector không hợp lệ hoặc không có ca/lịch phù hợp' },
        401: { description: 'Thiếu header x-terminal-key' },
        403: { description: 'Khóa xác thực máy chấm công không hợp lệ' },
        404: { description: 'Không nhận diện được khuôn mặt' },
        409: { description: 'Giảng viên đã check-in cho ca này hôm nay rồi' },
      },
    },
  },

  '/api/cham-cong/khuon-mat-hang-loat': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Máy chấm công] Điểm danh nhận diện khuôn mặt hàng loạt (Batch)',
      description: 'Nhận danh sách nhiều vector khuôn mặt quét được đồng thời trong một khung hình camera Máy chấm công để xử lý điểm danh song song.',
      security: [],
      parameters: [
        {
          name: 'x-terminal-key',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'Khóa bảo mật của thiết bị Máy chấm công Face ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['descriptors'],
              properties: {
                descriptors: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                  description: 'Danh sách mảng vector 128 số thực',
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Xử lý batch điểm danh thành công' },
      },
    },
  },

  '/api/cham-cong/qr/tao-ma': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔓 Public] Sinh mã QR Động TOTP (Hiệu lực 15-20s) phục vụ điểm danh Máy chấm công / Lớp học',
      description: 'Sinh chuỗi mã hóa ký HMAC-SHA256 kèm timestamp làm mới liên tục mỗi 15-20 giây để hiển thị trên màn hình Máy chấm công hoặc máy chiếu giảng đường.',
      security: [],
      responses: {
        200: {
          description: 'Sinh mã QR động thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Tạo mã QR thành công.',
                data: {
                  qrToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  expiresIn: 15,
                  generatedAt: '2026-09-23T12:00:00.000Z',
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/cham-cong/qr/quet-ma': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Cá nhân] Quét mã QR Động trên di động để điểm danh vào ca',
      description: 'Giảng viên dùng điện thoại di động quét mã QR động hiển thị trên máy chiếu / Máy chấm công kết hợp xác thực tọa độ GPS khuôn viên trường (Geofence).',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['qrToken'],
              properties: {
                qrToken: { type: 'string', description: 'Token trích xuất từ mã QR động' },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
                deviceId: { type: 'string', example: 'MOBILE_CLIENT_IPHONE15' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Điểm danh qua QR thành công' },
        400: { description: 'Mã QR đã hết hạn, không hợp lệ hoặc vị trí GPS ngoài khuôn viên' },
      },
    },
  },

  '/api/cham-cong/cau-hinh-khuon-vien': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔓 Public] Lấy cấu hình tọa độ khuôn viên trường & bán kính Geofencing GPS',
      description: 'Trả về tọa độ trung tâm khuôn viên trường đại học và bán kính hợp lệ (mét) cho phép điểm danh di động.',
      security: [],
      responses: {
        200: {
          description: 'Lấy cấu hình thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                data: {
                  campusCenter: { lat: 21.028511, lng: 105.854444 },
                  radiusMeters: 500,
                  name: 'Khuôn viên Cơ sở Chính',
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Admin] Cập nhật tọa độ khuôn viên trường & bán kính Geofencing GPS',
      description: 'Chỉ Quản trị viên (Admin) mới có quyền hiệu chỉnh tọa độ trung tâm và bán kính cho phép chấm công GPS.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['lat', 'lng', 'radiusMeters'],
              properties: {
                lat: { type: 'number', example: 21.028511 },
                lng: { type: 'number', example: 105.854444 },
                radiusMeters: { type: 'number', example: 600 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Cập nhật cấu hình khuôn viên thành công' },
        403: { description: 'Chỉ Admin mới có quyền thực hiện' },
      },
    },
  },

  '/api/cham-cong/{id}/minh-chung': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Xác thực] Lấy ảnh chụp minh chứng điểm danh của bản ghi chấm công',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy ảnh minh chứng thành công' },
        404: { description: 'Không tìm thấy minh chứng ảnh' },
      },
    },
  },

  '/api/cham-cong/hang-doi/thong-ke': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Admin/Kiểm tra] Thống kê hàng đợi chấm công bất đồng bộ BullMQ Redis',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Lấy thống kê hàng đợi thành công' },
      },
    },
  },

  '/api/cham-cong/chi-so-vector/thong-ke': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Admin/Kiểm tra] Trạng thái RAM FAISS Index 512D tìm kiếm siêu tốc',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Lấy thống kê FAISS thành công' },
      },
    },
  },

  '/api/cham-cong/chi-so-vector/dong-bo': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔒 Admin] Đồng bộ lại FAISS Index từ CSDL SQL Server lên RAM',
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'Đồng bộ FAISS Index thành công' },
      },
    },
  },

  '/api/cham-cong/thu-thach-mat-that': {
    get: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔓 Public] Sinh thử thách cử động sống (Liveness Challenge)',
      description: 'Trả về chuỗi hành động ngẫu nhiên (chớp mắt, quay trái, mỉm cười) kèm JWT token xác thực phiên sống.',
      security: [],
      responses: {
        200: { description: 'Sinh thử thách thành công' },
      },
    },
  },

  '/api/cham-cong/xac-thuc-mat-that': {
    post: {
      tags: ['09 - Quản Lý Chấm Công (Attendance & PunchLog)'],
      summary: '[🔓 Public] Xác minh ảnh khuôn mặt theo thử thách cử động sống',
      security: [],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                image: { type: 'string', format: 'binary' },
                challengeToken: { type: 'string' },
                action: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Xác minh liveness thành công' },
        400: { description: 'Thử thách không hợp lệ hoặc không phát hiện đúng cử động' },
      },
    },
  },

  // 8. Đơn nghỉ phép, dạy bù & đổi ca
  '/api/don-nghi-phep': {
    post: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Cá nhân] Tạo đơn xin nghỉ phép / dạy bù / đổi ca',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['type', 'reason', 'startDate', 'endDate'],
              properties: {
                type: { type: 'string', enum: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng', 'giai_trinh_cong'], example: 'nghi_phep' },
                startDate: { type: 'string', format: 'date', example: '2026-09-15' },
                endDate: { type: 'string', format: 'date', example: '2026-09-17' },
                reason: { type: 'string', example: 'Đi tham dự hội thảo khoa học quốc tế' },
                attachmentUrl: { type: 'string', example: 'https://cdn.university.edu.vn/giay-moi-hoi-thao.pdf' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Gửi đơn thành công' },
        400: { description: 'Thiếu dữ liệu hoặc ngày kết thúc trước ngày bắt đầu' },
      },
    },
    get: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Xác thực] Danh sách đơn xin nghỉ phép (Phân quyền theo vai trò)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] }, description: 'Lọc trạng thái' },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['nghi_phep', 'day_bu', 'doi_ca', 'nghi_om', 'viec_rieng', 'giai_trinh_cong'] }, description: 'Lọc loại đơn' },
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo ID người làm đơn' },
      ],
      responses: {
        200: { description: 'Lấy danh sách đơn thành công' },
      },
    },
  },

  '/api/don-nghi-phep/so-du': {
    get: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Cá nhân / Xác thực] Xem số ngày phép còn lại trong năm (Leave Balance)',
      description: 'Dùng Aggregate pipeline tính tổng ngày phép tiêu chuẩn, ngày đã sử dụng và ngày còn lại.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'ID người dùng cần tra cứu (Mặc định là chính mình)' },
      ],
      responses: {
        200: {
          description: 'Tính toán hạn mức phép thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy thông tin số ngày phép thành công.',
                data: {
                  userId: '00000000-0000-4000-8000-000000000',
                  year: 2026,
                  quota: 12,
                  usedDays: 3,
                  remainingDays: 9,
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/don-nghi-phep/{id}': {
    get: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Xác thực] Xem chi tiết một đơn xin nghỉ',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Lấy chi tiết thành công' },
        404: { description: 'Không tìm thấy đơn' },
      },
    },
  },

  '/api/don-nghi-phep/{id}/phe-duyet': {
    put: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Admin / Trưởng khoa] Phê duyệt đơn xin nghỉ (Hỗ trợ Optimistic Locking qua version)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                approvalNote: { type: 'string', example: 'Đồng ý cho nghỉ phép, khoa đã bố trí giảng viên dạy thay.' },
                version: { type: 'integer', example: 0, description: 'Phiên bản tài liệu kiểm soát khóa lạc quan' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Duyệt đơn thành công' },
        409: { description: 'Xung đột phiên bản dữ liệu (Optimistic Locking Conflict)' },
      },
    },
  },

  '/api/don-nghi-phep/{id}/tu-choi': {
    put: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Admin / Trưởng khoa] Từ chối đơn xin nghỉ',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                rejectionReason: { type: 'string', example: 'Trùng lịch thi kết thúc học phần, đề nghị chọn ngày khác.' },
                version: { type: 'integer', example: 0 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Từ chối đơn thành công' },
      },
    },
  },

  '/api/don-nghi-phep/{id}/huy': {
    put: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Người tạo đơn / Admin] Hủy đơn xin nghỉ phép đã nộp',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Hủy đơn thành công' },
        400: { description: 'Đơn đã được phê duyệt, không thể tự hủy' },
        404: { description: 'Không tìm thấy đơn' },
      },
    },
  },

  // 9. Tải lên tệp đính kèm
  '/api/tai-tep': {
    post: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔒 Đã đăng nhập] Tải file minh chứng đính kèm (ảnh, PDF, tài liệu)',
      description: 'Hỗ trợ tải lên file minh chứng (giấy khám sức khỏe, minh chứng đổi ca...) với định dạng PNG, JPG, WEBP, PDF, DOC, DOCX. Giới hạn 10MB.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'File tài liệu hoặc ảnh cần tải lên',
                },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Tải lên file thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Tải lên file thành công.',
                data: {
                  originalName: 'giay_kham_benh.pdf',
                  filename: 'attachment-1726410000000-123456789.pdf',
                  mimetype: 'application/pdf',
                  size: 204800,
                  fileUrl: '/api/tai-tep/tep/attachment-1726410000000-123456789.pdf',
                },
              },
            },
          },
        },
        400: { description: 'File không hợp lệ hoặc vượt quá 10MB' },
      },
    },
  },

  '/api/tai-tep/tep/{filename}': {
    get: {
      tags: ['10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)'],
      summary: '[🔓 Public] Tải xuống hoặc xem tệp đính kèm / ảnh minh chứng đã tải lên',
      security: [],
      parameters: [{ name: 'filename', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Nội dung tệp tin' },
        404: { description: 'Không tìm thấy tệp' },
      },
    },
  },

  // 10. Báo cáo & Thống kê
  '/api/bao-cao/cham-cong': {
    get: {
      tags: ['12 - Báo Cáo & Thống Kê (Reports)'],
      summary: '[🔒 Cá nhân / Trưởng khoa / Admin] Báo cáo tổng hợp số liệu chấm công và ngày phép',
      description: 'Giảng viên/Nhân viên chỉ xem của chính mình; Trưởng khoa xem của khoa; Admin xem toàn trường.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo giảng viên / nhân viên (chỉ dành cho Trưởng khoa và Admin)' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo khoa / phòng ban (chỉ dành cho Admin)' },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Từ ngày (YYYY-MM-DD)' },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Đến ngày (YYYY-MM-DD)' },
      ],
      responses: {
        200: {
          description: 'Lấy báo cáo thống kê thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy báo cáo thống kê chấm công thành công.',
                data: {
                  totalRecords: 15,
                  onTimeCount: 12,
                  lateCount: 2,
                  earlyLeaveCount: 1,
                  absentCount: 0,
                  excusedAbsenceCount: 0,
                  approvedLeaveDays: 2,
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/bao-cao/hang-thang': {
    get: {
      tags: ['12 - Báo Cáo & Thống Kê (Reports)'],
      summary: '[🔒 Admin / Trưởng khoa] Báo cáo tổng hợp ngày công chi tiết theo tháng',
      description: 'Tổng hợp chi tiết danh sách từng nhân sự trong tháng gồm: tổng buổi dạy, đúng giờ, đi muộn, về sớm, vắng mặt, nghỉ có phép.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'integer', example: 10 }, description: 'Tháng (1-12)' },
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 }, description: 'Năm (YYYY)' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo mã Khoa / Phòng ban (chỉ dành cho Admin)' },
      ],
      responses: {
        200: {
          description: 'Lấy báo cáo tháng thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy báo cáo tổng hợp tháng 10/2026 thành công.',
                data: {
                  month: 10,
                  year: 2026,
                  totalUsers: 5,
                  report: [
                    {
                      user: {
                        id: '00000000-0000-4000-8000-000000000',
                        fullName: 'TS. Trần Thị Bích',
                        email: 'giangvien.bich@university.edu.vn',
                        role: 'giang_vien',
                      },
                      totalWorkingDays: 16,
                      onTimeCount: 14,
                      lateCount: 1,
                      earlyLeaveCount: 1,
                      absentCount: 0,
                      excusedCount: 2,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/bao-cao/du-lieu-xuat': {
    get: {
      tags: ['12 - Báo Cáo & Thống Kê (Reports)'],
      summary: '[🔒 Xác thực] Trích xuất dữ liệu đa chiều 5 Sheets phục vụ xuất file Excel tổng hợp',
      description: 'Trả về cấu trúc dữ liệu hoàn chỉnh 5 sheet: Tổng hợp công, Bảng chấm công chi tiết, Danh sách đi muộn/về sớm, Thống kê đơn nghỉ phép, và Phân bổ giờ giảng theo khoa.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'integer', example: 9 }, description: 'Tháng cần xuất (1-12)' },
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 }, description: 'Năm (YYYY)' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo khoa (Admin có thể lọc, Trưởng khoa tự động giới hạn)' },
      ],
      responses: {
        200: {
          description: 'Lấy dữ liệu xuất báo cáo thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy dữ liệu xuất báo cáo thành công.',
                data: {
                  summarySheet: [],
                  dailyAttendanceSheet: [],
                  lateEarlySheet: [],
                  leaveRequestsSheet: [],
                  departmentStatsSheet: [],
                },
              },
            },
          },
        },
      },
    },
  },

  // 11. Thông báo người dùng
  '/api/thong-bao': {
    get: {
      tags: ['15 - Hệ Thống Thông Báo (Notifications)'],
      summary: '[🔒 Cá nhân] Lấy danh sách thông báo của người dùng (kết quả duyệt đơn, cảnh báo đi muộn/vắng mặt)',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'isRead', in: 'query', schema: { type: 'boolean' }, description: 'Lọc thông báo đã đọc hoặc chưa đọc' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Số lượng thông báo' },
      ],
      responses: {
        200: {
          description: 'Lấy danh sách thông báo thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                data: [
                  {
                    _id: '00000000-0000-4000-8000-000000000',
                    title: 'Đơn nghỉ phép đã được phê duyệt',
                    message: 'Đơn nghỉ phép ngày 25/09/2026 của Thầy/Cô đã được Trưởng khoa phê duyệt.',
                    type: 'LEAVE_APPROVED',
                    isRead: false,
                    createdAt: '2026-09-23T08:30:00.000Z',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  // 12. Nhật ký kiểm toán (Audit Logs)
  '/api/nhat-ky-kiem-toan': {
    get: {
      tags: ['13 - Nhật Ký Kiểm Toán (Audit Logs)'],
      summary: '[🔒 Admin/BGH] Tra cứu nhật ký kiểm toán hệ thống (Audit Logs)',
      description: 'Chỉ dành cho Admin, Hiệu trưởng và Hiệu phó. Hỗ trợ lọc theo actor, action, targetType, status, khoảng thời gian và phân trang.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'actor', in: 'query', schema: { type: 'string' }, description: 'ID người thực hiện hoặc SYSTEM' },
        { name: 'action', in: 'query', schema: { type: 'string' }, description: 'Tên hành động (e.g. USER_LOGIN, LOCK_PAYROLL)' },
        { name: 'targetType', in: 'query', schema: { type: 'string' }, description: 'Loại đối tượng (User, Payroll, LeaveRequest)' },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['success', 'failed'] }, description: 'Trạng thái thành công hay thất bại' },
        { name: 'keyword', in: 'query', schema: { type: 'string' }, description: 'Từ khóa tìm kiếm' },
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Từ ngày' },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Đến ngày' },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: {
          description: 'Lấy danh sách nhật ký kiểm toán thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Lấy danh sách nhật ký kiểm toán (Audit Logs) thành công.',
                data: {
                  totalRecords: 1,
                  logs: [
                    {
                      _id: '00000000-0000-4000-8000-000000000',
                      actor: { _id: '00000000-0000-4000-8000-000000000', fullName: 'Quản trị viên', email: 'admin@university.edu.vn', role: 'admin' },
                      action: 'UPDATE_SYSTEM_CONFIG',
                      targetType: 'SystemConfig',
                      targetId: 'CAMPUS_GPS_RADIUS_METERS',
                      status: 'success',
                      timestamp: '2026-10-16T08:00:00.000Z',
                    },
                  ],
                  pagination: { page: 1, limit: 20, totalPages: 1, totalDocs: 1 },
                },
              },
            },
          },
        },
      },
    },
  },

  '/api/nhat-ky-kiem-toan/xac-minh-toan-ven': {
    get: {
      tags: ['13 - Nhật Ký Kiểm Toán (Audit Logs)'],
      summary: '[🔒 Admin/BGH] Xác thực tính toàn vẹn chuỗi hash SHA-256 nhật ký kiểm toán',
      description: 'Kiểm tra chuỗi hash liên kết giữa các bản ghi audit log để phát hiện mọi hành vi can thiệp hoặc sửa đổi dữ liệu trái phép.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Kiểm tra toàn vẹn thành công',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Toàn bộ chuỗi hash nhật ký kiểm toán nguyên vẹn, không phát hiện vi phạm.',
                data: {
                  isValid: true,
                  totalChecked: 150,
                  tamperedRecordsCount: 0,
                },
              },
            },
          },
        },
      },
    },
  },

  // 13. Phiếu lương & Khóa sổ lương
  '/api/phieu-luong/khoi-tao': {
    post: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH/Trưởng khoa] Tạo & tính toán Snapshot bảng lương năm 2026',
      description: 'Tính toán giờ dạy thực tế, giờ vượt chuẩn, phụ cấp, trích nộp BHXH 10.5% và thuế TNCN lũy tiến 5 bậc.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['month', 'year'],
              properties: {
                month: { type: 'integer', example: 10, description: 'Tháng tính lương (1-12) hoặc thang' },
                year: { type: 'integer', example: 2026, description: 'Năm tính lương hoặc nam' },
                departmentId: { type: 'string', example: '00000000-0000-4000-8000-000000000', description: 'Mã khoa (tùy chọn) hoặc phong_ban_id' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tạo hoặc làm mới bảng lương thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong': {
    get: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH/Trưởng khoa] Lấy danh sách bảng lương toàn trường/khoa',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'integer', example: 10 }, description: 'Tháng (hoặc thang)' },
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 }, description: 'Năm (hoặc nam)' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['CHUA_KHOA', 'da_khoa'] } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: {
          description: 'Lấy danh sách bảng lương thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/cua-toi': {
    get: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Cá nhân] Giảng viên/Nhân viên tra cứu bảng lương của chính mình',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'integer', example: 10 } },
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
      ],
      responses: {
        200: {
          description: 'Lấy phiếu lương cá nhân thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/tong-hop': {
    get: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH] Tổng hợp thống kê quỹ lương, tổng giờ vượt chuẩn và thuế TNCN',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'integer', example: 10 }, description: 'Tháng' },
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 }, description: 'Năm' },
      ],
      responses: {
        200: {
          description: 'Lấy báo cáo tổng hợp quỹ lương thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/khoa': {
    post: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH] Khóa sổ bảng lương theo tháng & chốt công',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['month', 'year'],
              properties: {
                month: { type: 'integer', example: 10 },
                year: { type: 'integer', example: 2026 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Khóa sổ lương thành công' },
      },
    },
  },
  '/api/phieu-luong/mo-khoa': {
    post: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH] Mở khóa sổ bảng lương theo tháng kèm lý do',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['month', 'year', 'reason'],
              properties: {
                month: { type: 'integer', example: 10 },
                year: { type: 'integer', example: 2026 },
                reason: { type: 'string', example: 'Điều chỉnh bổ sung giờ vượt chuẩn' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Mở khóa bảng lương thành công' },
      },
    },
  },
  '/api/phieu-luong/{id}': {
    get: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Chi tiết] Xem chi tiết một phiếu lương kèm snapshot các buổi dạy',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Chi tiết phiếu lương và snapshot',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/{id}/khoa': {
    put: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH] Khóa bảng lương chống sửa đổi (qua ID phiếu lương)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Khóa bảng lương thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/{id}/mo-khoa': {
    put: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH] Mở khóa bảng lương (qua ID phiếu lương)',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                reason: { type: 'string', example: 'Mở khóa điều chỉnh' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Mở khóa bảng lương thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/xuat-excel': {
    get: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH/Trưởng khoa] Xuất file Excel bảng lương toàn trường/khoa',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'month', in: 'query', schema: { type: 'integer', example: 10 } },
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
        { name: 'departmentId', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Dữ liệu file Excel bảng lương',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/phieu-luong/{id}/xuat-pdf': {
    get: {
      tags: ['11 - Quản Lý Bảng Lương & Snapshot (Payrolls)'],
      summary: '[🔒 Admin/BGH/Cá nhân] Xuất dữ liệu in ấn phiếu lương PDF theo ID',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Dữ liệu in ấn phiếu lương PDF',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },

  // 14. Sinh trắc học khuôn mặt (Face AI)
  '/api/khuon-mat/phat-hien-tu-the': {
    post: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Điểm danh/Đăng ký] Kiểm tra tư thế đầu 3D (Pitch, Yaw, Roll) & độ nét khuôn mặt',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                image: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Phát hiện tư thế khuôn mặt thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/khuon-mat/dang-ky-da-goc': {
    post: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Admin/Trưởng khoa/Tự đăng ký] Đăng ký khuôn mặt 5 góc chuẩn ArcFace 512D',
      description: 'Nhận 5 ảnh các góc (chính diện, trái, phải, ngửa, cúi), trích xuất 5 vector ArcFace 512D và tính toán vector Centroid L2 chuẩn hóa.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                userId: { type: 'string', description: 'ID người dùng (Admin có thể chỉ định, mặc định là bản thân)' },
                image_front: { type: 'string', format: 'binary' },
                image_left: { type: 'string', format: 'binary' },
                image_right: { type: 'string', format: 'binary' },
                image_up: { type: 'string', format: 'binary' },
                image_down: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Đăng ký khuôn mặt 5 góc thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/khuon-mat/trang-thai-dang-ky': {
    get: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Cá nhân] Kiểm tra trạng thái đã đăng ký khuôn mặt của chính mình',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Trạng thái khuôn mặt của bản thân',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/khuon-mat/trang-thai-dang-ky/{nguoiDungId}': {
    get: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Admin/Trưởng khoa] Kiểm tra trạng thái đã đăng ký khuôn mặt của người dùng',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Trạng thái khuôn mặt của người dùng',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/khuon-mat/du-lieu-cua-toi': {
    delete: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Cá nhân] Tự xóa dữ liệu mẫu khuôn mặt của bản thân (Tuân thủ quyền xóa dữ liệu cá nhân)',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Xóa dữ liệu khuôn mặt thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/khuon-mat/du-lieu/{nguoiDungId}': {
    delete: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Admin/Trưởng khoa] Xóa toàn bộ dữ liệu mẫu khuôn mặt của nhân sự và xóa khỏi RAM FAISS',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Xóa dữ liệu khuôn mặt thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/khuon-mat/vao-ca': {
    post: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Điểm danh] Check-in điểm danh qua Camera nhận diện khuôn mặt Face ID',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: { type: 'string', format: 'binary', description: 'Ảnh chụp khuôn mặt từ camera webcam/di động' },
                location: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number', example: 21.028511 },
                    lng: { type: 'number', example: 105.854444 },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Điểm danh Check-in qua khuôn mặt thành công' },
        400: { description: 'Không tìm thấy khuôn mặt hoặc không khớp nhân viên nào' },
      },
    },
  },
  '/api/khuon-mat/tan-ca': {
    post: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Điểm danh] Check-out kết thúc ca qua Camera nhận diện khuôn mặt Face ID',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: { type: 'string', format: 'binary', description: 'Ảnh chụp khuôn mặt từ camera webcam/di động' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Điểm danh Check-out qua khuôn mặt thành công' },
        400: { description: 'Không tìm thấy lượt check-in mở tương ứng' },
      },
    },
  },
  '/api/khuon-mat/suc-khoe': {
    get: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔓 Public/Kiểm tra] Kiểm tra tình trạng kết nối tới Python FastAPI InsightFace Microservice',
      responses: {
        200: {
          description: 'Face Service đang hoạt động tốt',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },

  '/api/khuon-mat/kiem-thu-nhan-dien': {
    post: {
      tags: ['08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)'],
      summary: '[🔒 Admin] Kiểm thử nhận diện khuôn mặt 1:N trực tiếp với ảnh mẫu',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Trả về kết quả nhận diện kiểm thử' },
      },
    },
  },

  // 15. Cấu hình hệ thống tập trung
  '/api/he-thong/cau-hinh': {
    get: {
      tags: ['14 - Cấu Hình Hệ Thống Tập Trung (System Configs)'],
      summary: '[🔒 Admin] Lấy toàn bộ tham số cấu hình hệ thống (In-memory Cache)',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Lấy danh sách cấu hình hệ thống thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    put: {
      tags: ['14 - Cấu Hình Hệ Thống Tập Trung (System Configs)'],
      summary: '[🔒 Admin] Cập nhật tham số cấu hình (tự động ghi Audit Log & làm mới RAM Cache)',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                key: { type: 'string', example: 'CAMPUS_GPS_RADIUS_METERS' },
                value: { example: 100 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Cập nhật cấu hình thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },

  // 16. Danh mục môn học
  '/api/mon-hoc': {
    get: {
      tags: ['05 - Danh Mục Môn Học & Học Phần (Subjects)'],
      summary: '[🔒 Xác thực] Lấy danh sách môn học/học phần đào tạo',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo mã hoặc tên môn học' },
        { name: 'departmentId', in: 'query', schema: { type: 'string' }, description: 'Lọc theo khoa/bộ môn' },
      ],
      responses: {
        200: {
          description: 'Lấy danh sách môn học thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    post: {
      tags: ['05 - Danh Mục Môn Học & Học Phần (Subjects)'],
      summary: '[🔒 Admin/Trưởng khoa] Tạo môn học/học phần mới',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'name'],
              properties: {
                code: { type: 'string', example: 'INT3105' },
                name: { type: 'string', example: 'Lập trình Web nâng cao' },
                credits: { type: 'number', example: 3 },
                departmentId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                description: { type: 'string', example: 'Học phần Lập trình Web chuyên ngành CNTT' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Tạo môn học thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/mon-hoc/{id}': {
    get: {
      tags: ['05 - Danh Mục Môn Học & Học Phần (Subjects)'],
      summary: '[🔒 Xác thực] Lấy thông tin chi tiết một môn học',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Lấy chi tiết môn học thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    put: {
      tags: ['05 - Danh Mục Môn Học & Học Phần (Subjects)'],
      summary: '[🔒 Admin/Trưởng khoa] Cập nhật thông tin môn học',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INT3105' },
                name: { type: 'string', example: 'Lập trình Web nâng cao (2026)' },
                credits: { type: 'number', example: 3 },
                departmentId: { type: 'string', example: '00000000-0000-4000-8000-000000000' },
                description: { type: 'string', example: 'Cập nhật đề cương học phần' },
                isActive: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Cập nhật môn học thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    delete: {
      tags: ['05 - Danh Mục Môn Học & Học Phần (Subjects)'],
      summary: '[🔒 Admin] Xóa môn học khỏi hệ thống',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Xóa môn học thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },

  // 17. Danh mục ngày nghỉ lễ
  '/api/ngay-nghi-le': {
    get: {
      tags: ['07 - Danh Mục Ngày Nghỉ Lễ (Holidays)'],
      summary: '[🔒 Admin] Lấy danh sách ngày nghỉ lễ toàn trường',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 }, description: 'Lọc theo năm dương lịch' },
      ],
      responses: {
        200: {
          description: 'Lấy danh sách ngày nghỉ lễ thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    post: {
      tags: ['07 - Danh Mục Ngày Nghỉ Lễ (Holidays)'],
      summary: '[🔒 Admin] Tạo ngày nghỉ lễ mới',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'startDate', 'endDate'],
              properties: {
                name: { type: 'string', example: 'Nghỉ lễ Giỗ Tổ Hùng Vương 2026' },
                startDate: { type: 'string', format: 'date', example: '2026-04-26' },
                endDate: { type: 'string', format: 'date', example: '2026-04-26' },
                year: { type: 'integer', example: 2026 },
                isPaid: { type: 'boolean', example: true },
                description: { type: 'string', example: 'Nghỉ lễ theo quy định nhà nước' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Tạo ngày nghỉ lễ thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },
  '/api/ngay-nghi-le/{id}': {
    get: {
      tags: ['07 - Danh Mục Ngày Nghỉ Lễ (Holidays)'],
      summary: '[🔒 Admin] Lấy chi tiết một ngày nghỉ lễ',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Lấy chi tiết ngày nghỉ lễ thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    put: {
      tags: ['07 - Danh Mục Ngày Nghỉ Lễ (Holidays)'],
      summary: '[🔒 Admin] Cập nhật thông tin ngày nghỉ lễ',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Nghỉ lễ Giỗ Tổ Hùng Vương (Điều chỉnh)' },
                startDate: { type: 'string', format: 'date', example: '2026-04-26' },
                endDate: { type: 'string', format: 'date', example: '2026-04-27' },
                isPaid: { type: 'boolean', example: true },
                description: { type: 'string', example: 'Hoán đổi ngày nghỉ theo thông báo' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Cập nhật ngày nghỉ lễ thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
    delete: {
      tags: ['07 - Danh Mục Ngày Nghỉ Lễ (Holidays)'],
      summary: '[🔒 Admin] Xóa ngày nghỉ lễ khỏi hệ thống',
      security: [{ BearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Xóa ngày nghỉ lễ thành công',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
      },
    },
  },

  // 18. Cổng thông tin công khai Giảng viên
  '/api/cong-khai/giang-vien/thong-ke': {
    get: {
      tags: ['17 - Cổng Thông Tin Giảng Viên Công Khai (Public Faculty)'],
      summary: '[🌐 Public] Lấy số liệu thống kê tổng quan danh bạ giảng viên',
      description: 'Trả về tổng số giảng viên, số GS, PGS, Tiến sĩ, tỷ lệ TS trở lên và danh sách các khoa đào tạo.',
      security: [],
      responses: {
        200: { description: 'Lấy số liệu thống kê thành công' },
      },
    },
  },
  '/api/cong-khai/giang-vien': {
    get: {
      tags: ['17 - Cổng Thông Tin Giảng Viên Công Khai (Public Faculty)'],
      summary: '[🌐 Public] Lấy danh bạ giảng viên (hỗ trợ phân trang, tìm kiếm & bộ lọc)',
      description: 'Lấy danh sách giảng viên đang công tác, hỗ trợ lọc theo Khoa, Học hàm, Học vị, từ khóa tìm kiếm. Áp dụng chuẩn bảo mật Zero Data Leakage.',
      security: [],
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Từ khóa tìm kiếm theo họ tên, email, hướng nghiên cứu' },
        { name: 'phong_ban_id', in: 'query', schema: { type: 'string' }, description: 'Mã định danh Khoa/Viện' },
        { name: 'hoc_ham', in: 'query', schema: { type: 'string', enum: ['tat_ca', 'giao_su', 'pho_giao_su'] } },
        { name: 'hoc_vi', in: 'query', schema: { type: 'string', enum: ['tat_ca', 'tien_si', 'thac_si'] } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
      ],
      responses: {
        200: { description: 'Lấy danh bạ giảng viên thành công' },
      },
    },
  },
  '/api/cong-khai/giang-vien/{id}': {
    get: {
      tags: ['17 - Cổng Thông Tin Giảng Viên Công Khai (Public Faculty)'],
      summary: '[🌐 Public] Lấy chi tiết hồ sơ khoa học của giảng viên theo ID',
      description: 'Trả về tiểu sử khoa học, chức vụ, học vị, hướng nghiên cứu, phòng làm việc và danh sách môn học đảm nhiệm.',
      security: [],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Mã ID giảng viên' }],
      responses: {
        200: { description: 'Lấy hồ sơ giảng viên thành công' },
        404: { description: 'Không tìm thấy hồ sơ giảng viên' },
      },
    },
  },
  '/api/tro-ly-ai/che-do': {
    get: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Lấy danh sách chế độ trò chuyện AI hỗ trợ',
      security: [],
      responses: {
        200: { description: 'Thành công' },
      },
    },
  },
  '/api/tro-ly-ai/nha-cung-cap': {
    get: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Lấy danh sách nhà cung cấp AI khả dụng (Gemini / Groq / OpenAI)',
      security: [],
      responses: {
        200: { description: 'Thành công' },
      },
    },
  },
  '/api/tro-ly-ai/tro-chuyen': {
    post: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Trò chuyện với Trợ lý AI tích hợp RAG và đính kèm tệp',
      responses: {
        200: { description: 'Phản hồi AI kèm nguồn trích dẫn RAG' },
      },
    },
  },
  '/api/tro-ly-ai/tai-lieu': {
    get: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Liệt kê tài liệu trong Kho tri thức RAG',
      responses: {
        200: { description: 'Danh sách tài liệu RAG' },
      },
    },
    post: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Tải lên và phân đoạn tài liệu vào Kho tri thức RAG (PDF/DOCX/DOC/TXT/MD)',
      responses: {
        201: { description: 'Nạp tài liệu thành công' },
      },
    },
  },
  '/api/tro-ly-ai/tai-lieu/{id}': {
    get: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Xem chi tiết tài liệu RAG',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Chi tiết tài liệu' },
      },
    },
    delete: {
      tags: ['18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)'],
      summary: 'Xóa tài liệu khỏi Kho tri thức RAG',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Xóa thành công' },
      },
    },
  },
};

const swaggerTags = [
  { name: '01 - Xác Thực & Phiên Làm Việc (Auth)', description: 'Đăng nhập, cấp mới Token JWT và phân quyền' },
  { name: '02 - Quản Lý Người Dùng (Users)', description: 'Quản lý thông tin giảng viên, nhân viên, phân quyền' },
  { name: '03 - Cơ Cấu Tổ Chức & Phòng Ban (Departments)', description: 'Quản lý cây đơn vị Trường > Khoa > Bộ môn/Phòng ban' },
  { name: '04 - Ca Làm Việc & Tiết Học (Shifts)', description: 'Định nghĩa khung giờ tiết học, ca hành chính và ngưỡng đi muộn/về sớm' },
  { name: '05 - Danh Mục Môn Học & Học Phần (Subjects)', description: 'Quản lý danh mục môn học, số tín chỉ, khoa/bộ môn quản lý' },
  { name: '06 - Lịch Phân Công Giảng Dạy (Schedules)', description: 'Thời khóa biểu, lịch giảng dạy và công tác' },
  { name: '07 - Danh Mục Ngày Nghỉ Lễ (Holidays)', description: 'Quản lý danh mục các ngày nghỉ lễ toàn trường/quốc gia' },
  { name: '08 - Sinh Trắc Học Khuôn Mặt (Face Biometrics)', description: 'Đăng ký khuôn mặt 5 góc chuẩn ArcFace 512D, kiểm tra tư thế và FAISS Index' },
  { name: '09 - Quản Lý Chấm Công (Attendance & PunchLog)', description: 'Check-in, Check-out tự động khớp ca, điểm danh FaceID, QR động, tọa độ GPS' },
  { name: '10 - Đơn Nghỉ Phép & Đổi Ca (Leave Requests)', description: 'Quy trình tạo đơn, tính hạn mức nghỉ phép (balance) và phê duyệt' },
  { name: '11 - Quản Lý Bảng Lương & Snapshot (Payrolls)', description: 'Bảng lương Snapshot năm 2026, khóa lương và thuế TNCN lũy tiến 5 bậc' },
  { name: '12 - Báo Cáo & Thống Kê (Reports)', description: 'Thống kê tổng hợp số giờ dạy, đi muộn, nghỉ phép' },
  { name: '13 - Nhật Ký Kiểm Toán (Audit Logs)', description: 'Lưu vết lịch sử thao tác quan trọng để giám sát' },
  { name: '14 - Cấu Hình Hệ Thống Tập Trung (System Configs)', description: 'Quản lý các tham số vận hành: ngưỡng AI, cooldown, bán kính GPS, hạn mức nghỉ phép' },
  { name: '15 - Hệ Thống Thông Báo (Notifications)', description: 'Quản lý thông báo người dùng, cảnh báo chấm công và kết quả phê duyệt đơn' },
  { name: '16 - Hạ Tầng & Kiểm Tra Hệ Thống (Health Check)', description: 'Kiểm tra trạng thái máy chủ và kết nối CSDL SQL Server' },
  { name: '17 - Cổng Thông Tin Giảng Viên Công Khai (Public Faculty)', description: 'Website Phenikaa: Danh bạ giảng viên, hồ sơ khoa học, môn học và số liệu thống kê công khai' },
  { name: '18 - Trợ Lý AI & Kho Tri Thức RAG (AI Assistant)', description: 'Trò chuyện AI đa phương thức và quản lý kho tri thức quy chế RAG' },
];

module.exports = {
  swaggerPaths,
  swaggerComponents,
  swaggerTags,
};
