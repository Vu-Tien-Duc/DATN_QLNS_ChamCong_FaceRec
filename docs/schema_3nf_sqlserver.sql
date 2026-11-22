-- =============================================================================
-- CƠ SỞ DỮ LIỆU MICROSOFT SQL SERVER 2022 - CHUẨN HÓA DẠNG CHUẨN 3 (3NF) HOÀN CHỈNH
-- PHIÊN BẢN CHỐT: TỐI ƯU HIỆU NĂNG (NEWSEQUENTIALID) & TOÀN VẸN DỮ LIỆU TUYỆT ĐỐI
-- ĐỀ TÀI: HỆ THỐNG QUẢN LÝ NHÂN SỰ & CHẤM CÔNG ỨNG DỤNG THỊ GIÁC MÁY TÍNH
-- SINH VIÊN THỰC HIỆN: VŨ TIẾN ĐỨC - MSV: 2310900023
-- =============================================================================

USE [DATN_QLNS_ChamCong_FaceRec];
GO

-- =============================================================================
-- DỌN DẸP AN TOÀN TOÀN BỘ BẢNG & KHÓA NGOẠI CŨ TRƯỚC KHI TẠO MỚI
-- =============================================================================
DECLARE @dropFkSql NVARCHAR(MAX) = N'';
SELECT @dropFkSql += N'ALTER TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';' + CHAR(13)
FROM sys.foreign_keys f
INNER JOIN sys.tables t ON f.parent_object_id = t.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id;
IF LEN(@dropFkSql) > 0 EXEC sp_executesql @dropFkSql;

DECLARE @dropTblSql NVARCHAR(MAX) = N'';
SELECT @dropTblSql += N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(13)
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id;
IF LEN(@dropTblSql) > 0 EXEC sp_executesql @dropTblSql;
GO

-- =============================================================================
-- NHÓM 1: CẤU HÌNH HỆ THỐNG & CƠ CẤU TỔ CHỨC
-- =============================================================================

-- 1. Cấu hình hệ thống chung (System Config)
CREATE TABLE [cau_hinh_he_thong] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [khoa_cau_hinh] NVARCHAR(100) NOT NULL,
    [gia_tri] NVARCHAR(MAX) NOT NULL,
    [nhom] NVARCHAR(50) NOT NULL DEFAULT N'SYSTEM',
    [mo_ta] NVARCHAR(500) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_cau_hinh_he_thong] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_cau_hinh_he_thong_khoa] UNIQUE ([khoa_cau_hinh])
);
CREATE NONCLUSTERED INDEX [IX_cau_hinh_he_thong_nhom] ON [cau_hinh_he_thong] ([nhom]);
GO

-- 2. Ngày nghỉ lễ (Holiday)
CREATE TABLE [ngay_nghi_le] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ten_ngay_le] NVARCHAR(150) NOT NULL,
    [ngay_bat_dau] DATE NOT NULL,
    [ngay_ket_thuc] DATE NOT NULL,
    [huong_luong] BIT NOT NULL DEFAULT 1,
    [mo_ta] NVARCHAR(500) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ngay_nghi_le] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_ngay_nghi_le_thoi_gian] CHECK ([ngay_ket_thuc] >= [ngay_bat_dau])
);
CREATE NONCLUSTERED INDEX [IX_ngay_nghi_le_thoi_gian] ON [ngay_nghi_le] ([ngay_bat_dau], [ngay_ket_thuc]);
GO

-- 3. Khung giờ ca làm việc / ca giảng dạy (Shift Config)
CREATE TABLE [ca_lam_viec] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ten_ca] NVARCHAR(100) NOT NULL,
    [gio_bat_dau] TIME NOT NULL,
    [gio_ket_thuc] TIME NOT NULL,
    [nguong_di_muon_phut] INT NOT NULL DEFAULT 15,
    [kich_hoat] BIT NOT NULL DEFAULT 1,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ca_lam_viec] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_ca_nguong_di_muon] CHECK ([nguong_di_muon_phut] >= 0)
);
GO

-- 4. Đơn vị tổ chức (Khoa, Phòng ban, Bộ môn) (Department)
CREATE TABLE [phong_ban] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ten_phong_ban] NVARCHAR(150) NOT NULL,
    [loai_don_vi] NVARCHAR(50) NOT NULL,
    [don_vi_cha_id] UNIQUEIDENTIFIER NULL,
    [truong_don_vi_id] UNIQUEIDENTIFIER NULL,
    [vi_do] DECIMAL(10, 8) NULL,
    [kinh_do] DECIMAL(11, 8) NULL,
    [ban_kinh_met] INT NOT NULL DEFAULT 200,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_phong_ban] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_phong_ban_cha] FOREIGN KEY ([don_vi_cha_id]) REFERENCES [phong_ban] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_phong_ban_loai] CHECK ([loai_don_vi] IN (N'khoa', N'bo_mon', N'phong_ban')),
    CONSTRAINT [CK_phong_ban_ban_kinh] CHECK ([ban_kinh_met] > 0),
    CONSTRAINT [CK_phong_ban_cha_khac_minh] CHECK ([don_vi_cha_id] IS NULL OR [don_vi_cha_id] <> [id])
);
CREATE NONCLUSTERED INDEX [IX_phong_ban_cha] ON [phong_ban] ([don_vi_cha_id]);
GO

-- =============================================================================
-- NHÓM 2: TÀI KHOẢN, PHÂN QUYỀN RBAC & HỒ SƠ NHÂN SỰ
-- =============================================================================

-- 5. Người dùng (Tài khoản cốt lõi) (User)
CREATE TABLE [nguoi_dung] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ho_ten] NVARCHAR(100) NOT NULL,
    [email] VARCHAR(150) NOT NULL,
    [ma_can_bo] VARCHAR(50) NULL,
    [mat_khau_ma_hoa] VARCHAR(255) NOT NULL,
    [so_dien_thoai] VARCHAR(20) NULL,
    [anh_dai_dien] NVARCHAR(500) NULL,
    [don_vi_chinh_id] UNIQUEIDENTIFIER NULL,
    [vai_tro_chinh] VARCHAR(50) NOT NULL DEFAULT 'giang_vien',
    [trang_thai_lam_viec] NVARCHAR(50) NOT NULL DEFAULT N'dang_lam_viec',
    [kich_hoat] BIT NOT NULL DEFAULT 1,
    [phien_ban_token] INT NOT NULL DEFAULT 1,
    [doi_mat_khau_luc] DATETIME2 NULL,
    [lan_dang_nhap_cuoi] DATETIME2 NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_nguoi_dung] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_nguoi_dung_email] UNIQUE ([email]),
    CONSTRAINT [FK_nguoi_dung_don_vi] FOREIGN KEY ([don_vi_chinh_id]) REFERENCES [phong_ban] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_nguoi_dung_trang_thai] CHECK ([trang_thai_lam_viec] IN (N'dang_lam_viec', N'tam_nghi', N'da_nghi_viec'))
);
-- Filtered Unique Index: cho phép nhiều NULL (UNIQUE constraint thường chỉ cho phép 1 NULL trong SQL Server)
CREATE UNIQUE NONCLUSTERED INDEX [UX_nguoi_dung_ma_can_bo] ON [nguoi_dung] ([ma_can_bo]) WHERE [ma_can_bo] IS NOT NULL;
CREATE NONCLUSTERED INDEX [IX_nguoi_dung_don_vi] ON [nguoi_dung] ([don_vi_chinh_id]);
CREATE NONCLUSTERED INDEX [IX_nguoi_dung_trang_thai] ON [nguoi_dung] ([trang_thai_lam_viec]);
GO

-- Khóa ngoại trưởng đơn vị tham chiếu người dùng
ALTER TABLE [phong_ban]
ADD CONSTRAINT [FK_phong_ban_truong] FOREIGN KEY ([truong_don_vi_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION;
GO

-- 6. Hồ sơ cán bộ / Giảng viên (3NF - Quan hệ 1:1) (Staff Profile)
CREATE TABLE [ho_so_can_bo] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [gioi_tinh] NVARCHAR(20) NOT NULL DEFAULT N'nam',
    [ngay_sinh] DATE NULL,
    [dia_chi] NVARCHAR(255) NOT NULL DEFAULT N'',
    [chuc_vu] NVARCHAR(100) NOT NULL DEFAULT N'',
    [loai_nhan_su] NVARCHAR(50) NOT NULL DEFAULT N'giang_vien',
    [loai_hop_dong] NVARCHAR(50) NOT NULL DEFAULT N'toan_thoi_gian',
    [ngay_vao_lam] DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    [ngay_het_han_hop_dong] DATE NULL,
    [hoc_ham] NVARCHAR(50) NOT NULL DEFAULT N'khong',
    [hoc_vi] NVARCHAR(50) NOT NULL DEFAULT N'cu_nhan',
    [ngach_luong] VARCHAR(50) NOT NULL DEFAULT 'V.07.01.03',
    [he_so_luong] DECIMAL(5, 2) NOT NULL DEFAULT 2.34,
    [ngay_bat_dau_giang_day] DATE NULL,
    [so_nguoi_phu_thuoc] INT NOT NULL DEFAULT 0,
    [so_cccd] VARCHAR(50) NULL,
    [ma_so_thue] VARCHAR(50) NULL,
    [so_tai_khoan_ngan_hang] VARCHAR(50) NULL,
    [ten_ngan_hang] NVARCHAR(100) NULL,
    [chi_nhanh_ngan_hang] NVARCHAR(150) NULL,
    [han_muc_phep_nam] INT NOT NULL DEFAULT 12,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ho_so_can_bo] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_ho_so_can_bo_user] UNIQUE ([nguoi_dung_id]),
    CONSTRAINT [FK_ho_so_can_bo_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_ho_so_gioi_tinh] CHECK ([gioi_tinh] IN (N'nam', N'nu', N'khac')),
    CONSTRAINT [CK_ho_so_loai_nhan_su] CHECK ([loai_nhan_su] IN (N'giang_vien', N'can_bo_quan_ly', N'chuyen_vien', N'nhan_vien')),
    CONSTRAINT [CK_ho_so_loai_hop_dong] CHECK ([loai_hop_dong] IN (N'toan_thoi_gian', N'ban_thoi_gian', N'thinh_giang', N'hop_dong_vu_viec')),
    CONSTRAINT [CK_ho_so_he_so_luong] CHECK ([he_so_luong] >= 0),
    CONSTRAINT [CK_ho_so_phu_thuoc] CHECK ([so_nguoi_phu_thuoc] >= 0),
    CONSTRAINT [CK_ho_so_phep_nam] CHECK ([han_muc_phep_nam] >= 0),
    CONSTRAINT [CK_ho_so_han_hop_dong] CHECK ([ngay_het_han_hop_dong] IS NULL OR [ngay_het_han_hop_dong] >= [ngay_vao_lam])
);
GO

-- 7. Vai trò người dùng (3NF - RBAC đa vai trò với Filtered Unique Indexes) (User Roles)
CREATE TABLE [vai_tro_nguoi_dung] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [ma_vai_tro] VARCHAR(50) NOT NULL,
    [pham_vi] VARCHAR(50) NOT NULL DEFAULT 'toan_truong',
    [don_vi_id] UNIQUEIDENTIFIER NULL,
    [duoc_uy_quyen] BIT NOT NULL DEFAULT 0,
    [tu_ngay] DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    [den_ngay] DATE NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_vai_tro_nguoi_dung] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_vai_tro_nguoi_dung] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_vai_tro_don_vi] FOREIGN KEY ([don_vi_id]) REFERENCES [phong_ban] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_vai_tro_thoi_gian] CHECK ([den_ngay] IS NULL OR [den_ngay] >= [tu_ngay])
);
CREATE UNIQUE NONCLUSTERED INDEX [UX_vai_tro_toan_truong]
ON [vai_tro_nguoi_dung] ([nguoi_dung_id], [ma_vai_tro])
WHERE [don_vi_id] IS NULL;

CREATE UNIQUE NONCLUSTERED INDEX [UX_vai_tro_theo_don_vi]
ON [vai_tro_nguoi_dung] ([nguoi_dung_id], [ma_vai_tro], [don_vi_id])
WHERE [don_vi_id] IS NOT NULL;
GO

-- 8. Mã OTP xác thực tạm thời (3NF) (OTP Verification)
CREATE TABLE [xac_thuc_otp] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [loai_otp] VARCHAR(50) NOT NULL,
    [ma_otp] VARCHAR(64) NOT NULL,
    [het_han_luc] DATETIME2 NOT NULL,
    [so_lan_thu] INT NOT NULL DEFAULT 0,
    [da_su_dung] BIT NOT NULL DEFAULT 0,
    [gui_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_xac_thuc_otp] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_xac_thuc_otp_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_xac_thuc_otp_so_lan] CHECK ([so_lan_thu] >= 0)
);
CREATE NONCLUSTERED INDEX [IX_xac_thuc_otp_user_loai] ON [xac_thuc_otp] ([nguoi_dung_id], [loai_otp], [da_su_dung]);
GO

-- =============================================================================
-- NHÓM 3: SINH TRẮC HỌC KHUÔN MẶT (FACE AI BIOMETRICS)
-- =============================================================================

-- 9. Mẫu khuôn mặt sinh trắc học (512D Vector Embedding + Filtered Unique Index chống Race Condition)
CREATE TABLE [mau_khuon_mat] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [vector_dac_trung] NVARCHAR(MAX) NOT NULL,
    [vector_trung_binh] NVARCHAR(MAX) NULL,
    [so_chieu_vector] INT NOT NULL DEFAULT 512,
    [mo_hinh_ai] VARCHAR(50) NOT NULL DEFAULT 'buffalo_s',
    [anh_dai_dien] NVARCHAR(500) NULL,
    [so_luong_mau] INT NOT NULL DEFAULT 1,
    [mac_dinh] BIT NOT NULL DEFAULT 1,
    [trang_thai] NVARCHAR(50) NOT NULL DEFAULT N'da_kich_hoat',
    [ngay_dang_ky] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_mau_khuon_mat] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_mau_khuon_mat_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_mau_khuon_mat_so_chieu] CHECK ([so_chieu_vector] = 512),
    CONSTRAINT [CK_mau_khuon_mat_so_luong] CHECK ([so_luong_mau] >= 1)
);
CREATE NONCLUSTERED INDEX [IX_mau_khuon_mat_user] ON [mau_khuon_mat] ([nguoi_dung_id], [mac_dinh]);
CREATE UNIQUE NONCLUSTERED INDEX [UX_mau_khuon_mat_mac_dinh]
ON [mau_khuon_mat] ([nguoi_dung_id])
WHERE [mac_dinh] = 1;
GO

-- =============================================================================
-- NHÓM 4: ĐÀO TẠO & THỜI KHÓA BIỂU GIẢNG DẠY
-- =============================================================================

-- 10. Môn học & Học phần (Subject)
CREATE TABLE [mon_hoc] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ma_mon] VARCHAR(50) NOT NULL,
    [ten_mon] NVARCHAR(150) NOT NULL,
    [so_tin_chi] INT NOT NULL DEFAULT 3,
    [phong_ban_id] UNIQUEIDENTIFIER NULL,
    [mo_ta] NVARCHAR(500) NULL DEFAULT N'',
    [kich_hoat] BIT NOT NULL DEFAULT 1,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_mon_hoc] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_mon_hoc_ma] UNIQUE ([ma_mon]),
    CONSTRAINT [FK_mon_hoc_phong_ban] FOREIGN KEY ([phong_ban_id]) REFERENCES [phong_ban] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_mon_hoc_tin_chi] CHECK ([so_tin_chi] > 0)
);
CREATE NONCLUSTERED INDEX [IX_mon_hoc_phong_ban] ON [mon_hoc] ([phong_ban_id]);
GO

-- 11. Thời khóa biểu & Lịch trình giảng dạy (Schedule)
CREATE TABLE [lich_trinh] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [ca_id] UNIQUEIDENTIFIER NULL,
    [mon_hoc_id] UNIQUEIDENTIFIER NULL,
    [phong_hoc] NVARCHAR(100) NOT NULL DEFAULT N'',
    [co_so] NVARCHAR(100) NOT NULL DEFAULT N'',
    [la_truc_tuyen] BIT NOT NULL DEFAULT 0,
    [vi_do] DECIMAL(10, 8) NULL,
    [kinh_do] DECIMAL(11, 8) NULL,
    [ban_kinh_met] INT NOT NULL DEFAULT 100,
    [thu_trong_tuan] INT NOT NULL,
    [gio_bat_dau] TIME NOT NULL,
    [gio_ket_thuc] TIME NOT NULL,
    [ngay_bat_dau] DATE NOT NULL,
    [ngay_ket_thuc] DATE NOT NULL,
    [tiet_bat_dau] INT NOT NULL DEFAULT 1,
    [so_tiet] INT NOT NULL DEFAULT 3,
    [lap_lai_hang_tuan] BIT NOT NULL DEFAULT 1,
    [loai_lich] NVARCHAR(50) NOT NULL DEFAULT N'chinh_khoa',
    [nam_hoc] VARCHAR(50) NOT NULL DEFAULT '2025-2026',
    [hoc_ky] INT NOT NULL DEFAULT 1,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_lich_trinh] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_lich_trinh_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_lich_trinh_ca] FOREIGN KEY ([ca_id]) REFERENCES [ca_lam_viec] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_lich_trinh_mon] FOREIGN KEY ([mon_hoc_id]) REFERENCES [mon_hoc] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_lich_trinh_ban_kinh] CHECK ([ban_kinh_met] >= 1),
    CONSTRAINT [CK_lich_trinh_thu] CHECK ([thu_trong_tuan] BETWEEN 0 AND 6),
    CONSTRAINT [CK_lich_trinh_tiet] CHECK ([tiet_bat_dau] >= 1 AND [so_tiet] >= 1),
    CONSTRAINT [CK_lich_trinh_thoi_gian] CHECK ([ngay_ket_thuc] >= [ngay_bat_dau]),
    CONSTRAINT [CK_lich_trinh_gio] CHECK ([gio_ket_thuc] > [gio_bat_dau]),
    CONSTRAINT [CK_lich_trinh_loai] CHECK ([loai_lich] IN (N'chinh_khoa', N'day_bu')),
    CONSTRAINT [CK_lich_trinh_hoc_ky] CHECK ([hoc_ky] BETWEEN 1 AND 3)
);
CREATE NONCLUSTERED INDEX [IX_lich_trinh_user_thu] ON [lich_trinh] ([nguoi_dung_id], [thu_trong_tuan]);
CREATE NONCLUSTERED INDEX [IX_lich_trinh_ngay] ON [lich_trinh] ([ngay_bat_dau], [ngay_ket_thuc]);
GO

-- 12. Ngoại lệ lịch trình (3NF - Tách ngoại lệ) (Schedule Exceptions)
CREATE TABLE [ngoai_le_lich_trinh] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [lich_trinh_id] UNIQUEIDENTIFIER NOT NULL,
    [ngay] DATE NOT NULL,
    [ly_do] NVARCHAR(255) NULL,
    [trang_thai] NVARCHAR(50) NOT NULL DEFAULT N'nghi',
    [ngay_day_bu] DATE NULL,
    [giang_vien_day_thay_id] UNIQUEIDENTIFIER NULL,
    [ca_thay_the_id] UNIQUEIDENTIFIER NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ngoai_le_lich_trinh] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_ngoai_le_lich_trinh_ngay] UNIQUE ([lich_trinh_id], [ngay]),
    CONSTRAINT [FK_ngoai_le_lich_trinh] FOREIGN KEY ([lich_trinh_id]) REFERENCES [lich_trinh] ([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ngoai_le_gv_day_thay] FOREIGN KEY ([giang_vien_day_thay_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ngoai_le_ca_thay_the] FOREIGN KEY ([ca_thay_the_id]) REFERENCES [ca_lam_viec] ([id]) ON DELETE NO ACTION
);
CREATE NONCLUSTERED INDEX [IX_ngoai_le_lich_trinh_ngay] ON [ngoai_le_lich_trinh] ([lich_trinh_id], [ngay]);
GO

-- =============================================================================
-- NHÓM 5: CHẤM CÔNG & QUÉT SINH TRẮC HỌC (ATTENDANCE & PUNCH LOG)
-- =============================================================================

-- 14. Nhật ký chấm công tổng hợp ngày (Attendance Log)
CREATE TABLE [nhat_ky_cham_cong] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [ca_id] UNIQUEIDENTIFIER NOT NULL,
    [lich_trinh_id] UNIQUEIDENTIFIER NULL,
    [ds_lich_trinh_id] NVARCHAR(MAX) NULL,
    [ngay_cong] DATE NOT NULL,
    [thoi_gian_vao] DATETIME2 NULL,
    [thoi_gian_ra] DATETIME2 NULL,
    [thoi_luong_lam_viec_phut] INT NOT NULL DEFAULT 0,
    [di_muon_phut] INT NOT NULL DEFAULT 0,
    [ve_som_phut] INT NOT NULL DEFAULT 0,
    [so_tiet_thuc_day] INT NOT NULL DEFAULT 0,
    [trang_thai] NVARCHAR(50) NOT NULL DEFAULT N'on_time',
    [don_tu_id] UNIQUEIDENTIFIER NULL,
    [co_gian_lan] BIT NOT NULL DEFAULT 0,
    [da_chot] BIT NOT NULL DEFAULT 0,
    [nguoi_ghi_de_id] UNIQUEIDENTIFIER NULL,
    [ly_do_ghi_de] NVARCHAR(500) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_nhat_ky_cham_cong] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_nhat_ky_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_nhat_ky_ca] FOREIGN KEY ([ca_id]) REFERENCES [ca_lam_viec] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_nhat_ky_lich] FOREIGN KEY ([lich_trinh_id]) REFERENCES [lich_trinh] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_nhat_ky_ghi_de] FOREIGN KEY ([nguoi_ghi_de_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_nhat_ky_thoi_luong] CHECK ([thoi_luong_lam_viec_phut] >= 0),
    CONSTRAINT [CK_nhat_ky_di_muon] CHECK ([di_muon_phut] >= 0),
    CONSTRAINT [CK_nhat_ky_ve_som] CHECK ([ve_som_phut] >= 0),
    CONSTRAINT [CK_nhat_ky_so_tiet] CHECK ([so_tiet_thuc_day] >= 0),
    CONSTRAINT [CK_nhat_ky_trang_thai] CHECK ([trang_thai] IN (N'on_time', N'late', N'early_leave', N'absent', N'excused_absence', N'thieu_check_out')),
    CONSTRAINT [CK_nhat_ky_thoi_gian] CHECK ([thoi_gian_vao] IS NULL OR [thoi_gian_ra] IS NULL OR [thoi_gian_ra] >= [thoi_gian_vao])
);
CREATE UNIQUE NONCLUSTERED INDEX [UQ_nhat_ky_cham_cong_lich] ON [nhat_ky_cham_cong] ([nguoi_dung_id], [ngay_cong], [lich_trinh_id]) WHERE [lich_trinh_id] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [UQ_nhat_ky_cham_cong_ca_hc] ON [nhat_ky_cham_cong] ([nguoi_dung_id], [ngay_cong], [ca_id]) WHERE [lich_trinh_id] IS NULL;
CREATE NONCLUSTERED INDEX [IX_nhat_ky_user_ngay] ON [nhat_ky_cham_cong] ([nguoi_dung_id], [ngay_cong]);
CREATE NONCLUSTERED INDEX [IX_nhat_ky_trang_thai] ON [nhat_ky_cham_cong] ([trang_thai]);
GO

-- 15. Lượt quét nhận diện khuôn mặt & GPS (Punch Log)
CREATE TABLE [luot_quet_cham_cong] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [cham_cong_id] UNIQUEIDENTIFIER NULL,
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [loai_quet] VARCHAR(20) NOT NULL,
    [thoi_gian_quet] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [phuong_thuc] VARCHAR(50) NOT NULL DEFAULT 'face_ai',
    [do_tin_cay_ai] FLOAT NULL,
    [diem_mat_that] FLOAT NULL,
    [goc_mat_nhan_dien] VARCHAR(50) NULL,
    [anh_minh_chung] NVARCHAR(500) NULL,
    [vi_do] DECIMAL(10, 8) NULL,
    [kinh_do] DECIMAL(11, 8) NULL,
    [do_chinh_xac_gps] FLOAT NULL,
    [vi_tri_gia_lap] BIT NOT NULL DEFAULT 0,
    [khoang_cach_met] FLOAT NULL,
    [hop_le] BIT NOT NULL DEFAULT 1,
    [ly_do_khong_hop_le] NVARCHAR(255) NULL,
    [ma_thiet_bi] NVARCHAR(100) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_luot_quet_cham_cong] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_luot_quet_cham_cong] FOREIGN KEY ([cham_cong_id]) REFERENCES [nhat_ky_cham_cong] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_luot_quet_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_luot_quet_loai] CHECK ([loai_quet] IN ('check_in', 'check_out', 'unknown')),
    CONSTRAINT [CK_luot_quet_do_tin_cay] CHECK ([do_tin_cay_ai] IS NULL OR ([do_tin_cay_ai] >= 0 AND [do_tin_cay_ai] <= 1)),
    CONSTRAINT [CK_luot_quet_mat_that] CHECK ([diem_mat_that] IS NULL OR ([diem_mat_that] >= 0 AND [diem_mat_that] <= 1)),
    CONSTRAINT [CK_luot_quet_khoang_cach] CHECK ([khoang_cach_met] IS NULL OR [khoang_cach_met] >= 0)
);
CREATE NONCLUSTERED INDEX [IX_luot_quet_user_thoi_gian] ON [luot_quet_cham_cong] ([nguoi_dung_id], [thoi_gian_quet]);
CREATE NONCLUSTERED INDEX [IX_luot_quet_cham_cong_id] ON [luot_quet_cham_cong] ([cham_cong_id]);
GO

-- =============================================================================
-- NHÓM 6: ĐƠN TỪ HÀNH CHÍNH & PHÊ DUYỆT ĐA CẤP
-- =============================================================================

-- 16. Đơn từ nghỉ phép / Dạy bù / Đổi ca (Leave Request)
CREATE TABLE [don_nghi_phep] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [loai_don] NVARCHAR(50) NOT NULL,
    [ly_do] NVARCHAR(500) NOT NULL,
    [ngay_bat_dau] DATE NOT NULL,
    [ngay_ket_thuc] DATE NOT NULL,
    [so_ngay] DECIMAL(4, 1) NOT NULL DEFAULT 1.0,
    [so_tiet_nghi] INT NOT NULL DEFAULT 0,
    [lich_trinh_id] UNIQUEIDENTIFIER NULL,
    [nhat_ky_id] UNIQUEIDENTIFIER NULL,
    [so_tiet_xac_nhan] INT NULL,
    [ca_thay_the_id] UNIQUEIDENTIFIER NULL,
    [giang_vien_day_thay_id] UNIQUEIDENTIFIER NULL,
    [ngay_day_bu] DATE NULL,
    [tep_dinh_kem] NVARCHAR(500) NULL,
    [trang_thai] NVARCHAR(50) NOT NULL DEFAULT N'pending',
    [nguoi_duyet_id] UNIQUEIDENTIFIER NULL,
    [thoi_gian_duyet] DATETIME2 NULL,
    [ly_do_tu_choi] NVARCHAR(500) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_don_nghi_phep] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_don_nghi_phep_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_don_nghi_phep_lich] FOREIGN KEY ([lich_trinh_id]) REFERENCES [lich_trinh] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_don_nghi_phep_nhat_ky] FOREIGN KEY ([nhat_ky_id]) REFERENCES [nhat_ky_cham_cong] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_don_nghi_phep_ca_thay] FOREIGN KEY ([ca_thay_the_id]) REFERENCES [ca_lam_viec] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_don_nghi_phep_day_thay] FOREIGN KEY ([giang_vien_day_thay_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_don_nghi_phep_duyet] FOREIGN KEY ([nguoi_duyet_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_don_nghi_phep_loai_don] CHECK ([loai_don] IN (N'nghi_phep', N'day_bu', N'doi_ca', N'nghi_om', N'viec_rieng', N'giai_trinh_cong', N'giai_trinh_thieu_check_out')),
    CONSTRAINT [CK_don_nghi_phep_thoi_gian] CHECK ([ngay_ket_thuc] >= [ngay_bat_dau]),
    CONSTRAINT [CK_don_nghi_phep_so_ngay] CHECK ([so_ngay] >= 0),
    CONSTRAINT [CK_don_nghi_phep_so_tiet] CHECK ([so_tiet_nghi] >= 0),
    CONSTRAINT [CK_don_nghi_phep_so_tiet_xac_nhan] CHECK ([so_tiet_xac_nhan] IS NULL OR [so_tiet_xac_nhan] >= 0),
    CONSTRAINT [CK_don_nghi_phep_trang_thai] CHECK ([trang_thai] IN (N'pending', N'pending_dean', N'pending_bgh', N'approved', N'rejected', N'cancelled'))
);
CREATE NONCLUSTERED INDEX [IX_don_nghi_phep_user_trang_thai] ON [don_nghi_phep] ([nguoi_dung_id], [trang_thai]);
CREATE NONCLUSTERED INDEX [IX_don_nghi_phep_nhat_ky] ON [don_nghi_phep] ([nhat_ky_id]) WHERE [nhat_ky_id] IS NOT NULL;
GO

-- Khóa ngoại giữa nhat_ky_cham_cong và don_nghi_phep
ALTER TABLE [nhat_ky_cham_cong]
ADD CONSTRAINT [FK_nhat_ky_don_tu] FOREIGN KEY ([don_tu_id]) REFERENCES [don_nghi_phep] ([id]) ON DELETE NO ACTION;
GO

-- 17. Lịch sử duyệt đơn đa cấp (3NF) (Approval History)
CREATE TABLE [lich_su_duyet_don] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [don_nghi_phep_id] UNIQUEIDENTIFIER NOT NULL,
    [nguoi_duyet_id] UNIQUEIDENTIFIER NOT NULL,
    [cap_duyet] NVARCHAR(50) NOT NULL,
    [hanh_dong] NVARCHAR(50) NOT NULL,
    [y_kien] NVARCHAR(500) NULL,
    [thoi_diem] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_lich_su_duyet_don] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_lich_su_don] FOREIGN KEY ([don_nghi_phep_id]) REFERENCES [don_nghi_phep] ([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_lich_su_nguoi_duyet] FOREIGN KEY ([nguoi_duyet_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION
);
CREATE NONCLUSTERED INDEX [IX_lich_su_duyet_don_id] ON [lich_su_duyet_don] ([don_nghi_phep_id]);
GO

-- =============================================================================
-- NHÓM 7: TIỀN LƯƠNG & CHẾ ĐỘ ĐÃI NGỘ (PAYROLL)
-- =============================================================================

-- 18. Phiếu lương cán bộ (Payroll Summary - Snapshot chốt lương bất biến)
CREATE TABLE [phieu_luong] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [thang] INT NOT NULL,
    [nam] INT NOT NULL,
    [nguoi_lap_id] UNIQUEIDENTIFIER NOT NULL,
    [nguoi_duyet_id] UNIQUEIDENTIFIER NULL,
    [thoi_gian_duyet] DATETIME2 NULL,
    [luong_co_ban] BIGINT NOT NULL DEFAULT 0,
    [he_so_luong] DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    [so_cong_chuan] DECIMAL(5, 2) NOT NULL DEFAULT 22,
    [so_cong_thuc_te] DECIMAL(5, 2) NOT NULL DEFAULT 0,
    [so_tiet_nghia_vu] INT NOT NULL DEFAULT 0,
    [so_tiet_thuc_day] INT NOT NULL DEFAULT 0,
    [so_tiet_vuot_gio] INT NOT NULL DEFAULT 0,
    [don_gia_tiet_vuot] BIGINT NOT NULL DEFAULT 0,
    [tien_vuot_gio] BIGINT NOT NULL DEFAULT 0,
    [tong_phu_cap] BIGINT NOT NULL DEFAULT 0,
    [tong_giam_tru] BIGINT NOT NULL DEFAULT 0,
    [dong_bao_hiem] BIGINT NOT NULL DEFAULT 0,
    [thue_thu_nhap_ca_nhan] BIGINT NOT NULL DEFAULT 0,
    [thuc_linh] BIGINT NOT NULL DEFAULT 0,
    [trang_thai] NVARCHAR(50) NOT NULL DEFAULT N'nhap',
    [ghi_chu] NVARCHAR(500) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_phieu_luong] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_phieu_luong_user_ky] UNIQUE ([nguoi_dung_id], [thang], [nam]),
    CONSTRAINT [FK_phieu_luong_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_phieu_luong_lap] FOREIGN KEY ([nguoi_lap_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_phieu_luong_duyet] FOREIGN KEY ([nguoi_duyet_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_phieu_luong_thang] CHECK ([thang] BETWEEN 1 AND 12),
    CONSTRAINT [CK_phieu_luong_nam] CHECK ([nam] >= 2000),
    CONSTRAINT [CK_phieu_luong_luong_co_ban] CHECK ([luong_co_ban] >= 0),
    CONSTRAINT [CK_phieu_luong_he_so] CHECK ([he_so_luong] >= 0),
    CONSTRAINT [CK_phieu_luong_cong_chuan] CHECK ([so_cong_chuan] >= 0),
    CONSTRAINT [CK_phieu_luong_cong_thuc_te] CHECK ([so_cong_thuc_te] >= 0),
    CONSTRAINT [CK_phieu_luong_tiet_nghia_vu] CHECK ([so_tiet_nghia_vu] >= 0),
    CONSTRAINT [CK_phieu_luong_tiet_thuc_day] CHECK ([so_tiet_thuc_day] >= 0),
    CONSTRAINT [CK_phieu_luong_tiet_vuot] CHECK ([so_tiet_vuot_gio] >= 0),
    CONSTRAINT [CK_phieu_luong_don_gia_vuot] CHECK ([don_gia_tiet_vuot] >= 0),
    CONSTRAINT [CK_phieu_luong_tien_vuot] CHECK ([tien_vuot_gio] >= 0),
    CONSTRAINT [CK_phieu_luong_phu_cap] CHECK ([tong_phu_cap] >= 0),
    CONSTRAINT [CK_phieu_luong_giam_tru] CHECK ([tong_giam_tru] >= 0),
    CONSTRAINT [CK_phieu_luong_bao_hiem] CHECK ([dong_bao_hiem] >= 0),
    CONSTRAINT [CK_phieu_luong_thue] CHECK ([thue_thu_nhap_ca_nhan] >= 0),
    CONSTRAINT [CK_phieu_luong_thuc_linh] CHECK ([thuc_linh] >= 0)
);
GO

-- 19. Phụ cấp lương chi tiết (3NF) (Salary Allowances)
CREATE TABLE [phu_cap_luong] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [phieu_luong_id] UNIQUEIDENTIFIER NOT NULL,
    [loai_phu_cap] NVARCHAR(100) NOT NULL,
    [he_so_hoac_ty_le] DECIMAL(5, 2) NOT NULL DEFAULT 0,
    [so_tien] BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT [PK_phu_cap_luong] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_phu_cap_phieu_luong] FOREIGN KEY ([phieu_luong_id]) REFERENCES [phieu_luong] ([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_phu_cap_so_tien] CHECK ([so_tien] >= 0)
);
CREATE NONCLUSTERED INDEX [IX_phu_cap_phieu_luong_id] ON [phu_cap_luong] ([phieu_luong_id]);
GO

-- 20. Các khoản giảm trừ lương chi tiết (3NF) (Salary Deductions)
CREATE TABLE [giam_tru_luong] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [phieu_luong_id] UNIQUEIDENTIFIER NOT NULL,
    [ly_do] NVARCHAR(200) NOT NULL,
    [so_tien] BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT [PK_giam_tru_luong] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_giam_tru_phieu_luong] FOREIGN KEY ([phieu_luong_id]) REFERENCES [phieu_luong] ([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_giam_tru_so_tien] CHECK ([so_tien] >= 0)
);
CREATE NONCLUSTERED INDEX [IX_giam_tru_phieu_luong_id] ON [giam_tru_luong] ([phieu_luong_id]);
GO

-- =============================================================================
-- NHÓM 8: BẢO MẬT PHIÊN LÀM VIỆC & KIỂM TOÁN AN NINH (SECURITY & AUDIT)
-- =============================================================================

-- 21. Quản lý Refresh Token phiên làm việc & Rotation (Refresh Token)
CREATE TABLE [ma_lam_moi] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [chuoi_token] VARCHAR(500) NOT NULL,
    [ma_nhom_token] VARCHAR(100) NULL,
    [da_su_dung] BIT NOT NULL DEFAULT 0,
    [thoi_diem_su_dung] DATETIME2 NULL,
    [thiet_bi] NVARCHAR(255) NULL,
    [dia_chi_ip] VARCHAR(50) NULL,
    [nguoi_dung_id] UNIQUEIDENTIFIER NOT NULL,
    [het_han_luc] DATETIME2 NOT NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ma_lam_moi] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_ma_lam_moi_token] UNIQUE ([chuoi_token]),
    CONSTRAINT [FK_ma_lam_moi_user] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE CASCADE
);
CREATE NONCLUSTERED INDEX [IX_ma_lam_moi_user] ON [ma_lam_moi] ([nguoi_dung_id]);
CREATE NONCLUSTERED INDEX [IX_ma_lam_moi_het_han] ON [ma_lam_moi] ([het_han_luc]);
GO

-- 22. Nhật ký kiểm toán an ninh với chuỗi băm Blockchain-style Hash Chain (Audit Log)
CREATE TABLE [nhat_ky_kiem_toan] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [nguoi_thuc_hien_id] UNIQUEIDENTIFIER NULL,
    [loai_chu_the] VARCHAR(50) NOT NULL DEFAULT 'user',
    [hanh_dong] NVARCHAR(150) NOT NULL,
    [loai_doi_tuong] NVARCHAR(100) NOT NULL DEFAULT N'',
    [doi_tuong_id] VARCHAR(100) NULL,
    [chi_tiet] NVARCHAR(MAX) NULL,
    [ket_qua] VARCHAR(50) NOT NULL DEFAULT 'success',
    [ly_do_that_bai] NVARCHAR(500) NULL,
    [ma_bam_truoc] VARCHAR(64) NULL,
    [ma_bam_hien_tai] VARCHAR(64) NULL,
    [dia_chi_ip] VARCHAR(50) NULL,
    [user_agent] NVARCHAR(500) NULL,
    [thoi_diem] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_nhat_ky_kiem_toan] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_nhat_ky_kiem_toan_user] FOREIGN KEY ([nguoi_thuc_hien_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION
);
CREATE NONCLUSTERED INDEX [IX_nhat_ky_kiem_toan_thoi_diem] ON [nhat_ky_kiem_toan] ([thoi_diem]);
CREATE NONCLUSTERED INDEX [IX_nhat_ky_kiem_toan_user] ON [nhat_ky_kiem_toan] ([nguoi_thuc_hien_id]);
GO

-- =============================================================================
-- NHÓM 9: TRÍ TUỆ NHÂN TẠO TRỢ LÝ TÀI LIỆU (AI RAG ASSISTANT)
-- =============================================================================

-- 23. Tài liệu văn bản RAG (AI Document)
CREATE TABLE [tai_lieu_rag] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [tieu_de] NVARCHAR(200) NOT NULL,
    [ten_tep_goc] NVARCHAR(255) NOT NULL,
    [loai_tep] VARCHAR(20) NOT NULL,
    [mime_type] VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    [kich_thuoc_byte] INT NOT NULL DEFAULT 0,
    [ma_bam_sha256] VARCHAR(64) NULL,
    [nguoi_tai_id] UNIQUEIDENTIFIER NOT NULL,
    [pham_vi] NVARCHAR(50) NOT NULL DEFAULT N'ca_nhan',
    [tom_tat] NVARCHAR(MAX) NULL,
    [trang_thai] NVARCHAR(50) NOT NULL DEFAULT N'san_sang',
    [thong_bao_loi] NVARCHAR(MAX) NULL,
    [duong_dan] NVARCHAR(500) NULL,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [cap_nhat_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_tai_lieu_rag] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FK_tai_lieu_rag_user] FOREIGN KEY ([nguoi_tai_id]) REFERENCES [nguoi_dung] ([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_tai_lieu_rag_kich_thuoc] CHECK ([kich_thuoc_byte] >= 0),
    CONSTRAINT [CK_tai_lieu_rag_loai_tep] CHECK ([loai_tep] IN ('pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'pptx'))
);
CREATE NONCLUSTERED INDEX [IX_tai_lieu_rag_user] ON [tai_lieu_rag] ([nguoi_tai_id]);
GO

-- 24. Phân đoạn tài liệu & Vector nhúng ngữ nghĩa (AI Document Chunks)
CREATE TABLE [phan_doan_tai_lieu] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [tai_lieu_id] UNIQUEIDENTIFIER NOT NULL,
    [thu_tu] INT NOT NULL,
    [noi_dung_chunk] NVARCHAR(MAX) NOT NULL,
    [vector_embedding] NVARCHAR(MAX) NULL,
    [so_tu] INT NOT NULL DEFAULT 0,
    [tao_luc] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_phan_doan_tai_lieu] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ_phan_doan_thu_tu] UNIQUE ([tai_lieu_id], [thu_tu]),
    CONSTRAINT [FK_phan_doan_tai_lieu] FOREIGN KEY ([tai_lieu_id]) REFERENCES [tai_lieu_rag] ([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_phan_doan_thu_tu] CHECK ([thu_tu] >= 0),
    CONSTRAINT [CK_phan_doan_so_tu] CHECK ([so_tu] >= 0)
);
CREATE NONCLUSTERED INDEX [IX_phan_doan_tai_lieu_id] ON [phan_doan_tai_lieu] ([tai_lieu_id]);
GO