import React, { useState, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Portal } from '../chung/CongDichChuyen';
import { Button } from '../chung/NutBam';
import { userApi } from '../../api/nguoiDung.api';
import {
  AcademicRankType,
  ContractType,
  CreateUserPayload,
  DegreeType,
  DepartmentItem,
  GenderType,
  ImportUsersExcelRowError,
  StaffType,
  UserProfile,
} from '../../types/index';

interface ModalNhapExcelNhanSuProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentItem[];
  existingUsers: UserProfile[];
  currentUserRole: string;
  onSuccess: () => Promise<void> | void;
}

interface ParsedExcelRow {
  rowNumber: number;
  excelRowNumber: number;
  deptDisplay: string;
  isAutoCode: boolean;
  previewStaffCode: string;
  payload: CreateUserPayload;
  errors: string[];
}

const VALID_ROLE_CODES = [
  'bgh',
  'admin',
  'tccb',
  'dao_tao',
  'ke_toan',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
  'truong_phong',
  'pho_phong',
  'giang_vien',
  'nhan_vien',
] as const;

const ROLE_TEXT_TO_CODE: Record<string, string> = {
  bgh: 'bgh',
  'ban giam hieu': 'bgh',
  'ban giam hieu (bgh)': 'bgh',
  admin: 'admin',
  'quan tri vien': 'admin',
  'quan tri he thong': 'admin',
  tccb: 'tccb',
  'to chuc can bo': 'tccb',
  dao_tao: 'dao_tao',
  'dao tao': 'dao_tao',
  'chuyen vien dao tao': 'dao_tao',
  ke_toan: 'ke_toan',
  'ke toan': 'ke_toan',
  truong_khoa: 'truong_khoa',
  'truong khoa': 'truong_khoa',
  pho_khoa: 'pho_khoa',
  'pho khoa': 'pho_khoa',
  'pho truong khoa': 'pho_khoa',
  truong_bo_mon: 'truong_bo_mon',
  'truong bo mon': 'truong_bo_mon',
  pho_bo_mon: 'pho_bo_mon',
  'pho bo mon': 'pho_bo_mon',
  'pho truong bo mon': 'pho_bo_mon',
  truong_phong: 'truong_phong',
  'truong phong': 'truong_phong',
  pho_phong: 'pho_phong',
  'pho phong': 'pho_phong',
  'pho truong phong': 'pho_phong',
  giang_vien: 'giang_vien',
  'giang vien': 'giang_vien',
  nhan_vien: 'nhan_vien',
  'nhan vien': 'nhan_vien',
  'chuyen vien / nhan vien': 'nhan_vien',
};

const ACADEMIC_RANK_TEXT_TO_CODE: Record<string, AcademicRankType> = {
  khong: 'khong',
  'khong co': 'khong',
  'khong co hoc ham': 'khong',
  pho_giao_su: 'pho_giao_su',
  'pho giao su': 'pho_giao_su',
  pgs: 'pho_giao_su',
  giao_su: 'giao_su',
  'giao su': 'giao_su',
  gs: 'giao_su',
};

const DEGREE_TEXT_TO_CODE: Record<string, DegreeType> = {
  cu_nhan: 'cu_nhan',
  'cu nhan': 'cu_nhan',
  cn: 'cu_nhan',
  ky_su: 'ky_su',
  'ky su': 'ky_su',
  ks: 'ky_su',
  thac_si: 'thac_si',
  'thac si': 'thac_si',
  ths: 'thac_si',
  tien_si: 'tien_si',
  'tien si': 'tien_si',
  ts: 'tien_si',
  khac: 'khac',
};

const STAFF_TYPE_TEXT_TO_CODE: Record<string, StaffType> = {
  giang_vien: 'giang_vien',
  'giang vien': 'giang_vien',
  'ngach giang vien': 'giang_vien',
  can_bo_quan_ly: 'can_bo_quan_ly',
  'can bo quan ly': 'can_bo_quan_ly',
  chuyen_vien: 'chuyen_vien',
  'chuyen vien': 'chuyen_vien',
  nhan_vien: 'nhan_vien',
  'nhan vien': 'nhan_vien',
};

const CONTRACT_TEXT_TO_CODE: Record<string, ContractType> = {
  toan_thoi_gian: 'toan_thoi_gian',
  'toan thoi gian': 'toan_thoi_gian',
  'co huu toan thoi gian': 'toan_thoi_gian',
  ban_thoi_gian: 'ban_thoi_gian',
  'ban thoi gian': 'ban_thoi_gian',
  thinh_giang: 'thinh_giang',
  'thinh giang': 'thinh_giang',
  'giang vien thinh giang': 'thinh_giang',
  hop_dong_vu_viec: 'hop_dong_vu_viec',
  'hop dong vu viec': 'hop_dong_vu_viec',
};

const GENDER_TEXT_TO_CODE: Record<string, GenderType> = {
  nam: 'nam',
  nu: 'nu',
  khac: 'khac',
};

const stripVietnamese = (val: unknown): string =>
  String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\(\*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getTodayVietnamIso = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const sanitizeExcelCell = (val: unknown): string | number => {
  if (typeof val === 'number') return val;
  const s = String(val ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

// Chuyển đổi ngày từ Excel serial number, YYYY-MM-DD hoặc DD/MM/YYYY sang YYYY-MM-DD
const parseFlexibleDate = (raw: unknown): { iso: string; valid: boolean } => {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { iso: '', valid: true };
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 1000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = String(parsed.y).padStart(4, '0');
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return { iso: `${y}-${m}-${d}`, valid: true };
    }
  }
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return { iso: str, valid: true };
  }
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return { iso: `${y}-${m}-${d}`, valid: true };
  }
  return { iso: str, valid: false };
};

const ROLE_STAFF_CODE_PREFIX: Record<string, string> = {
  bgh: 'BGH',
  admin: 'ADMIN',
  tccb: 'TCCB',
  dao_tao: 'DAOTAO',
  ke_toan: 'KT',
  truong_khoa: 'TK',
  pho_khoa: 'PK',
  truong_bo_mon: 'TBM',
  pho_bo_mon: 'PBM',
  truong_phong: 'TP',
  pho_phong: 'PP',
  giang_vien: 'GV',
  nhan_vien: 'NV',
};

const POSITION_STAFF_CODE_RULES: Array<[string, string]> = [
  ['hieu truong', 'BGH'],
  ['ban giam hieu', 'BGH'],
  ['quan tri', 'ADMIN'],
  ['to chuc can bo', 'TCCB'],
  ['tccb', 'TCCB'],
  ['dao tao', 'DAOTAO'],
  ['ke toan', 'KT'],
  ['pho truong khoa', 'PK'],
  ['pho khoa', 'PK'],
  ['truong khoa', 'TK'],
  ['pho truong bo mon', 'PBM'],
  ['pho bo mon', 'PBM'],
  ['truong bo mon', 'TBM'],
  ['pho truong phong', 'PP'],
  ['pho phong', 'PP'],
  ['truong phong', 'TP'],
  ['chuyen vien', 'CV'],
  ['giang vien', 'GV'],
  ['nhan vien', 'NV'],
];

const resolveStaffCodePrefix = (role: string, position?: string): string => {
  const normPos = stripVietnamese(position || '');
  if (normPos) {
    for (const [keyword, prefix] of POSITION_STAFF_CODE_RULES) {
      if (normPos.includes(keyword)) return prefix;
    }
  }
  return ROLE_STAFF_CODE_PREFIX[role] || 'CB';
};

const HEADER_ALIASES: Record<string, string> = {
  'ma can bo': 'ma_can_bo',
  'ma can bo (tu sinh neu trong)': 'ma_can_bo',
  'ma can bo tu sinh neu trong': 'ma_can_bo',
  ma_can_bo: 'ma_can_bo',
  'ma cb': 'ma_can_bo',
  'ho va ten': 'ho_ten',
  'ho ten': 'ho_ten',
  ho_ten: 'ho_ten',
  'email cong vu': 'email',
  email: 'email',
  'vai tro': 'vai_tro_chinh',
  vai_tro_chinh: 'vai_tro_chinh',
  vai_tro: 'vai_tro_chinh',
  'don vi truc thuoc': 'don_vi',
  'khoa / phong ban': 'don_vi',
  'khoa phong ban': 'don_vi',
  'don vi': 'don_vi',
  don_vi_chinh_id: 'don_vi',
  don_vi: 'don_vi',
  'so dien thoai': 'so_dien_thoai',
  so_dien_thoai: 'so_dien_thoai',
  sdt: 'so_dien_thoai',
  'chuc vu': 'chuc_vu',
  chuc_vu: 'chuc_vu',
  'hoc ham': 'hoc_ham',
  hoc_ham: 'hoc_ham',
  'hoc vi': 'hoc_vi',
  hoc_vi: 'hoc_vi',
  'loai nhan su': 'loai_nhan_su',
  loai_nhan_su: 'loai_nhan_su',
  'loai hop dong': 'loai_hop_dong',
  loai_hop_dong: 'loai_hop_dong',
  'gioi tinh': 'gioi_tinh',
  gioi_tinh: 'gioi_tinh',
  'ngay sinh': 'ngay_sinh',
  'ngay sinh yyyy-mm-dd': 'ngay_sinh',
  'ngay sinh (yyyy-mm-dd)': 'ngay_sinh',
  ngay_sinh: 'ngay_sinh',
  'ngay vao lam': 'ngay_vao_lam',
  'ngay vao lam (yyyy-mm-dd)': 'ngay_vao_lam',
  ngay_vao_lam: 'ngay_vao_lam',
  'so cccd': 'so_cccd',
  so_cccd: 'so_cccd',
  cccd: 'so_cccd',
  'dia chi': 'dia_chi',
  dia_chi: 'dia_chi',
  'ngach luong': 'ngach_luong',
  ngach_luong: 'ngach_luong',
  'he so luong': 'he_so_luong',
  he_so_luong: 'he_so_luong',
  'han muc phep nam': 'han_muc_phep_nam',
  'phep nam': 'han_muc_phep_nam',
  han_muc_phep_nam: 'han_muc_phep_nam',
  'mat khau': 'mat_khau',
  'mat khau (tuy chon)': 'mat_khau',
  mat_khau: 'mat_khau',
};

const isBghDept = (dept?: DepartmentItem) =>
  Boolean(dept && (dept.ten_phong_ban || '').toLowerCase().includes('giám hiệu'));

export const ModalNhapExcelNhanSu: React.FC<ModalNhapExcelNhanSuProps> = ({
  isOpen,
  onClose,
  departments,
  existingUsers,
  currentUserRole,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [defaultPassword, setDefaultPassword] = useState('123456');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedExcelRow[]>([]);
  const [serverErrors, setServerErrors] = useState<ImportUsersExcelRowError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const deptLookup = useMemo(() => {
    const byId = new Map<string, DepartmentItem>();
    const byNormName = new Map<string, DepartmentItem>();
    const byNormCode = new Map<string, DepartmentItem>();

    departments.forEach((d) => {
      byId.set(String(d.id).toLowerCase(), d);
      if (d.ten_phong_ban) byNormName.set(stripVietnamese(d.ten_phong_ban), d);
      if (d.ma_phong_ban) byNormCode.set(stripVietnamese(d.ma_phong_ban), d);
    });
    return { byId, byNormName, byNormCode };
  }, [departments]);

  const existingEmailSet = useMemo(
    () => new Set(existingUsers.map((u) => String(u.email || '').trim().toLowerCase())),
    [existingUsers]
  );

  const existingCodeSet = useMemo(
    () => new Set(existingUsers.map((u) => String(u.ma_can_bo || '').trim().toUpperCase())),
    [existingUsers]
  );

  if (!isOpen) return null;

  const resolveDepartment = (rawDept: string): DepartmentItem | null => {
    const trimmed = String(rawDept || '').trim();
    if (!trimmed) return null;
    const norm = stripVietnamese(trimmed);
    return (
      deptLookup.byId.get(trimmed.toLowerCase()) ||
      deptLookup.byNormCode.get(norm) ||
      deptLookup.byNormName.get(norm) ||
      null
    );
  };

  const validateDepartmentAndRole = (
    role: string,
    dept: DepartmentItem | null,
    errors: string[]
  ) => {
    if (!dept) {
      errors.push('Không tìm thấy đơn vị trực thuộc hợp lệ trong hệ thống');
      return;
    }
    const deptType = String(dept.loai_don_vi || '');
    if (role === 'bgh' && !isBghDept(dept)) {
      errors.push('Vai trò bgh phải thuộc đơn vị Ban Giám Hiệu');
    } else if (['truong_khoa', 'pho_khoa'].includes(role) && deptType !== 'khoa') {
      errors.push('Trưởng/Phó khoa phải thuộc đơn vị cấp Khoa');
    } else if (['truong_bo_mon', 'pho_bo_mon'].includes(role) && deptType !== 'bo_mon') {
      errors.push('Trưởng/Phó bộ môn phải thuộc đơn vị cấp Bộ Môn');
    } else if (
      ['truong_phong', 'pho_phong', 'tccb', 'dao_tao', 'ke_toan'].includes(role) &&
      deptType !== 'phong_ban'
    ) {
      errors.push('Vai trò khối phòng ban phải thuộc đơn vị cấp Phòng ban');
    } else if (role === 'giang_vien' && !['khoa', 'bo_mon'].includes(deptType)) {
      errors.push('Giảng viên phải thuộc đơn vị cấp Khoa hoặc Bộ Môn');
    } else if (role === 'admin' && ['khoa', 'bo_mon'].includes(deptType)) {
      errors.push('Admin không thuộc Khoa/Bộ Môn đào tạo');
    } else if (isBghDept(dept) && !['bgh', 'admin'].includes(role)) {
      errors.push('Đơn vị Ban Giám Hiệu chỉ dành cho vai trò bgh hoặc admin');
    }
  };

  const revalidateAllRows = (draftRows: ParsedExcelRow[], fallbackPwd: string): ParsedExcelRow[] => {
    const todayIso = getTodayVietnamIso();
    const seenEmails = new Map<string, number>();
    const seenCodes = new Map<string, number>();
    const reservedCodes = new Set<string>(existingCodeSet);
    draftRows.forEach((item) => {
      const explicit = (item.payload.ma_can_bo || '').trim().toUpperCase();
      if (!item.isAutoCode && explicit) {
        reservedCodes.add(explicit);
      }
    });

    const nextPreviewAutoCode = (role: string, position?: string): string => {
      const prefix = resolveStaffCodePrefix(role, position);
      let seq = 1;
      while (true) {
        const candidate = `${prefix}${String(seq).padStart(3, '0')}`;
        if (!reservedCodes.has(candidate)) {
          reservedCodes.add(candidate);
          return candidate;
        }
        seq += 1;
      }
    };

    return draftRows.map((item, idx) => {
      const rowNumber = idx + 1;
      const errors: string[] = [];
      const payload = { ...item.payload };
      const effectivePwd = (payload.mat_khau || '').trim() || fallbackPwd.trim();
      payload.mat_khau = effectivePwd;

      const name = (payload.ho_ten || '').trim();
      const email = (payload.email || '').trim().toLowerCase();
      const explicitCode = (payload.ma_can_bo || '').trim().toUpperCase();
      const role = String(payload.vai_tro_chinh || '');
      const previewStaffCode = item.isAutoCode
        ? nextPreviewAutoCode(role, payload.chuc_vu)
        : explicitCode;

      if (!name || name.length < 2) errors.push('Thiếu họ và tên (tối thiểu 2 ký tự)');
      if (!email) {
        errors.push('Thiếu email công vụ');
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        errors.push('Email không đúng định dạng');
      }
      if (!effectivePwd || effectivePwd.length < 6) {
        errors.push('Mật khẩu khởi tạo phải tối thiểu 6 ký tự');
      }
      if (!role || !(VALID_ROLE_CODES as readonly string[]).includes(role)) {
        errors.push('Vai trò không hợp lệ');
      } else {
        if (role === 'bgh' && currentUserRole !== 'bgh') {
          errors.push('Chỉ BGH mới có quyền tạo vai trò bgh');
        }
        if (role === 'admin' && !['admin', 'bgh'].includes(currentUserRole)) {
          errors.push('Chỉ Admin/BGH mới có quyền tạo vai trò admin');
        }
      }

      const matchedDept = payload.don_vi_chinh_id
        ? departments.find((d) => String(d.id) === String(payload.don_vi_chinh_id)) || null
        : null;
      validateDepartmentAndRole(role, matchedDept, errors);

      if (payload.so_dien_thoai && !/^(0|\+84)\d{9,10}$/.test(payload.so_dien_thoai)) {
        errors.push('SĐT phải gồm 10–11 số bắt đầu bằng 0 hoặc +84');
      }
      if (payload.so_cccd && !/^\d{9}$|^\d{12}$/.test(payload.so_cccd)) {
        errors.push('CCCD phải gồm đúng 9 hoặc 12 chữ số');
      }
      if (payload.ngay_sinh && payload.ngay_sinh > todayIso) {
        errors.push('Ngày sinh không được lớn hơn hôm nay');
      }
      if (
        payload.ngay_het_han_hop_dong &&
        payload.ngay_vao_lam &&
        payload.ngay_het_han_hop_dong < payload.ngay_vao_lam
      ) {
        errors.push('Ngày hết hạn hợp đồng phải sau ngày vào làm');
      }

      const isVisiting = ['thinh_giang', 'hop_dong_vu_viec'].includes(payload.loai_hop_dong || '');
      const coeff = Number(payload.he_so_luong ?? 2.34);
      if (!Number.isFinite(coeff) || coeff > 30 || (isVisiting ? coeff < 0 : coeff <= 0)) {
        errors.push('Hệ số lương không hợp lệ');
      }

      const leaveQuota = Number(payload.han_muc_phep_nam ?? 12);
      if (!Number.isInteger(leaveQuota) || leaveQuota < 0 || leaveQuota > 365) {
        errors.push('Hạn mức phép năm phải là số nguyên 0–365');
      }

      if (email) {
        if (seenEmails.has(email)) {
          errors.push(`Trùng email với dòng #${seenEmails.get(email)} trong file`);
        } else {
          seenEmails.set(email, rowNumber);
          if (existingEmailSet.has(email)) {
            errors.push('Email đã tồn tại trên hệ thống');
          }
        }
      }

      if (!item.isAutoCode && explicitCode) {
        if (seenCodes.has(explicitCode)) {
          errors.push(`Trùng mã cán bộ với dòng #${seenCodes.get(explicitCode)} trong file`);
        } else {
          seenCodes.set(explicitCode, rowNumber);
          if (existingCodeSet.has(explicitCode)) {
            errors.push('Mã cán bộ đã tồn tại trên hệ thống');
          }
        }
      }

      return { ...item, rowNumber, previewStaffCode, payload, errors };
    });
  };

  const handleDownloadTemplate = () => {
    try {
      const sampleFaculty =
        departments.find((d) => d.loai_don_vi === 'bo_mon') ||
        departments.find((d) => d.loai_don_vi === 'khoa');
      const sampleOffice = departments.find(
        (d) => d.loai_don_vi === 'phong_ban' && !isBghDept(d)
      );

      const templateRows = [
        {
          'Mã cán bộ (tự sinh nếu trống)': '',
          'Họ và tên (*)': 'Nguyễn Văn A',
          'Email công vụ (*)': 'nguyenvana@ntu.edu.vn',
          'Vai trò (*)': 'giang_vien',
          'Đơn vị trực thuộc (*)': sanitizeExcelCell(
            sampleFaculty?.ten_phong_ban || 'Bộ môn Công nghệ Phần mềm'
          ),
          'Số điện thoại': '0912345678',
          'Chức vụ': 'Giảng viên',
          'Học hàm': 'khong',
          'Học vị': 'thac_si',
          'Loại nhân sự': 'giang_vien',
          'Loại hợp đồng': 'toan_thoi_gian',
          'Giới tính': 'nam',
          'Ngày sinh (YYYY-MM-DD)': '1992-05-15',
          'Ngày vào làm (YYYY-MM-DD)': getTodayVietnamIso(),
          'Số CCCD': '001092000111',
          'Địa chỉ': 'Hà Nội',
          'Ngạch lương': 'V.07.01.03',
          'Hệ số lương': 2.34,
          'Hạn mức phép năm': 12,
          'Mật khẩu (tùy chọn)': '',
        },
        {
          'Mã cán bộ (tự sinh nếu trống)': '',
          'Họ và tên (*)': 'Trần Thị B',
          'Email công vụ (*)': 'tranthib@ntu.edu.vn',
          'Vai trò (*)': 'nhan_vien',
          'Đơn vị trực thuộc (*)': sanitizeExcelCell(
            sampleOffice?.ten_phong_ban || 'Phòng Tổ chức Cán bộ'
          ),
          'Số điện thoại': '0987654321',
          'Chức vụ': 'Chuyên viên',
          'Học hàm': 'khong',
          'Học vị': 'cu_nhan',
          'Loại nhân sự': 'chuyen_vien',
          'Loại hợp đồng': 'toan_thoi_gian',
          'Giới tính': 'nu',
          'Ngày sinh (YYYY-MM-DD)': '1995-08-20',
          'Ngày vào làm (YYYY-MM-DD)': getTodayVietnamIso(),
          'Số CCCD': '001195000222',
          'Địa chỉ': 'Hà Nội',
          'Ngạch lương': '01.003',
          'Hệ số lương': 2.34,
          'Hạn mức phép năm': 12,
          'Mật khẩu (tùy chọn)': '',
        },
      ];

      const wsData = XLSX.utils.json_to_sheet(templateRows);
      wsData['!cols'] = [
        { wch: 15 },
        { wch: 24 },
        { wch: 26 },
        { wch: 16 },
        { wch: 30 },
        { wch: 15 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 18 },
        { wch: 10 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 22 },
        { wch: 14 },
        { wch: 13 },
        { wch: 18 },
        { wch: 20 },
      ];

      const guideRows: Array<Array<string>> = [
        ['HƯỚNG DẪN GIÁ TRỊ HỢP LỆ KHI NHẬP NHÂN SỰ TỪ EXCEL'],
        ['Lưu ý: Các cột đánh dấu (*) là bắt buộc. Nếu để trống Mã cán bộ, hệ thống tự sinh theo chức vụ/vai trò (GV001, CV001, NV001, TK001...). Nếu để trống Mật khẩu, mặc định là 123456.'],
        [],
        ['1. DANH SÁCH ĐƠN VỊ HIỆN CÓ TRONG HỆ THỐNG (Điền Tên đơn vị hoặc Mã đơn vị)'],
        ['Mã đơn vị', 'Tên đơn vị trực thuộc', 'Loại đơn vị'],
        ...departments.map((d) => [
          String(sanitizeExcelCell(d.ma_phong_ban || '')),
          String(sanitizeExcelCell(d.ten_phong_ban)),
          String(sanitizeExcelCell(d.loai_don_vi)),
        ]),
        [],
        ['2. BẢNG MÃ CHUẨN CÁC TRƯỜNG DANH MỤC (snake_case)'],
        ['Vai trò (*)', 'giang_vien, nhan_vien, truong_khoa, pho_khoa, truong_bo_mon, pho_bo_mon, truong_phong, pho_phong, tccb, dao_tao, ke_toan, admin, bgh'],
        ['Học hàm', 'khong, pho_giao_su, giao_su'],
        ['Học vị', 'cu_nhan, ky_su, thac_si, tien_si, khac'],
        ['Loại nhân sự', 'giang_vien, can_bo_quan_ly, chuyen_vien, nhan_vien'],
        ['Loại hợp đồng', 'toan_thoi_gian, ban_thoi_gian, thinh_giang, hop_dong_vu_viec'],
        ['Giới tính', 'nam, nu, khac'],
      ];

      const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
      wsGuide['!cols'] = [{ wch: 22 }, { wch: 42 }, { wch: 80 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsData, 'Danh_Sach_Nhan_Su');
      XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_Dan_Gia_Tri');
      XLSX.writeFile(wb, 'Mau_Nhap_Nhan_Su_NTU.xlsx');
      toast.success('Đã tải xuống file Excel mẫu.');
    } catch (error) {
      console.error('Lỗi tạo file Excel mẫu:', error);
      toast.error('Không thể tạo file Excel mẫu.');
    }
  };

  const handleFileSelected = async (file: File | undefined | null) => {
    if (!file) return;
    setServerErrors([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        toast.error('File Excel không có sheet dữ liệu nào.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (rawObjects.length === 0) {
        toast.error('Sheet đầu tiên chưa có dòng dữ liệu nhân sự nào.');
        return;
      }
      if (rawObjects.length > 200) {
        toast.error('Mỗi lần nhập Excel chỉ hỗ trợ tối đa 200 dòng nhân sự.');
        return;
      }

      const todayIso = getTodayVietnamIso();
      const draftRows: ParsedExcelRow[] = [];

      rawObjects.forEach((rawRow, idx) => {
        const mapped: Record<string, unknown> = {};
        Object.entries(rawRow).forEach(([header, cellValue]) => {
          const canonicalKey = HEADER_ALIASES[stripVietnamese(header)];
          if (canonicalKey) {
            mapped[canonicalKey] = cellValue;
          }
        });

        // Bỏ qua dòng hoàn toàn trống
        const hasAnyValue = Object.values(mapped).some((v) => String(v ?? '').trim() !== '');
        if (!hasAnyValue) return;

        const extraFormatErrors: string[] = [];

        const rawRole = String(mapped.vai_tro_chinh ?? 'giang_vien').trim();
        const roleNorm = ROLE_TEXT_TO_CODE[stripVietnamese(rawRole)] || rawRole.toLowerCase();

        const rawDept = String(mapped.don_vi ?? '').trim();
        const resolvedDept = resolveDepartment(rawDept);

        const rawAcademicRank = String(mapped.hoc_ham ?? '').trim();
        const hoc_ham = rawAcademicRank
          ? ACADEMIC_RANK_TEXT_TO_CODE[stripVietnamese(rawAcademicRank)] ||
            (rawAcademicRank.toLowerCase() as AcademicRankType)
          : 'khong';
        if (rawAcademicRank && !['khong', 'pho_giao_su', 'giao_su'].includes(hoc_ham)) {
          extraFormatErrors.push(`Học hàm "${rawAcademicRank}" không hợp lệ`);
        }

        const rawDegree = String(mapped.hoc_vi ?? '').trim();
        const hoc_vi = rawDegree
          ? DEGREE_TEXT_TO_CODE[stripVietnamese(rawDegree)] || (rawDegree.toLowerCase() as DegreeType)
          : 'cu_nhan';
        if (rawDegree && !['cu_nhan', 'ky_su', 'thac_si', 'tien_si', 'khac'].includes(hoc_vi)) {
          extraFormatErrors.push(`Học vị "${rawDegree}" không hợp lệ`);
        }

        const rawStaffType = String(mapped.loai_nhan_su ?? '').trim();
        const defaultStaffType: StaffType = roleNorm === 'giang_vien' ? 'giang_vien' : 'nhan_vien';
        const loai_nhan_su = rawStaffType
          ? STAFF_TYPE_TEXT_TO_CODE[stripVietnamese(rawStaffType)] ||
            (rawStaffType.toLowerCase() as StaffType)
          : defaultStaffType;
        if (
          rawStaffType &&
          !['giang_vien', 'can_bo_quan_ly', 'chuyen_vien', 'nhan_vien'].includes(loai_nhan_su)
        ) {
          extraFormatErrors.push(`Loại nhân sự "${rawStaffType}" không hợp lệ`);
        }

        const rawContract = String(mapped.loai_hop_dong ?? '').trim();
        const loai_hop_dong = rawContract
          ? CONTRACT_TEXT_TO_CODE[stripVietnamese(rawContract)] ||
            (rawContract.toLowerCase() as ContractType)
          : 'toan_thoi_gian';
        if (
          rawContract &&
          !['toan_thoi_gian', 'ban_thoi_gian', 'thinh_giang', 'hop_dong_vu_viec'].includes(
            loai_hop_dong
          )
        ) {
          extraFormatErrors.push(`Loại hợp đồng "${rawContract}" không hợp lệ`);
        }

        const rawGender = String(mapped.gioi_tinh ?? '').trim();
        const gioi_tinh = rawGender
          ? GENDER_TEXT_TO_CODE[stripVietnamese(rawGender)] ||
            (rawGender.toLowerCase() as GenderType)
          : 'nam';
        if (rawGender && !['nam', 'nu', 'khac'].includes(gioi_tinh)) {
          extraFormatErrors.push(`Giới tính "${rawGender}" không hợp lệ (nam/nu/khac)`);
        }

        const parsedDob = parseFlexibleDate(mapped.ngay_sinh);
        if (!parsedDob.valid) {
          extraFormatErrors.push('Ngày sinh phải theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY');
        }
        const parsedJoinDate = parseFlexibleDate(mapped.ngay_vao_lam);
        if (!parsedJoinDate.valid) {
          extraFormatErrors.push('Ngày vào làm phải theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY');
        }

        const rawCoeff = String(mapped.he_so_luong ?? '').trim();
        const isVisiting = ['thinh_giang', 'hop_dong_vu_viec'].includes(loai_hop_dong);
        const he_so_luong =
          rawCoeff !== '' ? Number(rawCoeff.replace(',', '.')) : isVisiting ? 0 : 2.34;

        const rawLeaveQuota = String(mapped.han_muc_phep_nam ?? '').trim();
        const han_muc_phep_nam = rawLeaveQuota !== '' ? Number(rawLeaveQuota) : 12;

        const cleanPhone = String(mapped.so_dien_thoai ?? '')
          .replace(/[\s.-]/g, '')
          .trim();

        const explicitStaffCode = String(mapped.ma_can_bo ?? '').trim().toUpperCase();
        const payload: CreateUserPayload = {
          ma_can_bo: explicitStaffCode,
          ho_ten: String(mapped.ho_ten ?? '').trim(),
          email: String(mapped.email ?? '').trim().toLowerCase(),
          vai_tro_chinh: roleNorm,
          don_vi_chinh_id: resolvedDept?.id || null,
          so_dien_thoai: cleanPhone || undefined,
          chuc_vu: String(mapped.chuc_vu ?? '').trim() || (roleNorm === 'giang_vien' ? 'Giảng viên' : ''),
          hoc_ham,
          hoc_vi,
          loai_nhan_su,
          loai_hop_dong,
          gioi_tinh,
          ngay_sinh: parsedDob.iso || undefined,
          ngay_vao_lam: parsedJoinDate.iso || todayIso,
          so_cccd: String(mapped.so_cccd ?? '').trim() || undefined,
          dia_chi: String(mapped.dia_chi ?? '').trim() || '',
          ngach_luong: String(mapped.ngach_luong ?? '').trim() || 'V.07.01.03',
          he_so_luong,
          han_muc_phep_nam,
          mat_khau: String(mapped.mat_khau ?? '').trim(),
        };

        draftRows.push({
          rowNumber: draftRows.length + 1,
          excelRowNumber: idx + 2,
          deptDisplay: resolvedDept?.ten_phong_ban || rawDept || 'Chưa xác định',
          isAutoCode: explicitStaffCode === '',
          previewStaffCode: explicitStaffCode,
          payload,
          errors: extraFormatErrors,
        });
      });

      if (draftRows.length === 0) {
        toast.error('Không tìm thấy dòng dữ liệu hợp lệ nào trong file.');
        return;
      }

      const validated = revalidateAllRows(draftRows, defaultPassword).map((row, i) => ({
        ...row,
        errors: [...draftRows[i].errors, ...row.errors],
      }));

      setSelectedFileName(file.name);
      setParsedRows(validated);
      toast.success(`Đã đọc ${validated.length} dòng từ file ${file.name}.`);
    } catch (error) {
      console.error('Lỗi đọc file Excel:', error);
      toast.error('Không thể đọc file Excel. Vui lòng kiểm tra đúng định dạng .xlsx/.xls/.csv.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDefaultPasswordChange = (nextPwd: string) => {
    setDefaultPassword(nextPwd);
    if (parsedRows.length > 0) {
      setParsedRows((prev) => revalidateAllRows(prev, nextPwd));
    }
  };

  const handleRemoveRow = (rowNumber: number) => {
    setServerErrors([]);
    setParsedRows((prev) =>
      revalidateAllRows(
        prev.filter((r) => r.rowNumber !== rowNumber),
        defaultPassword
      )
    );
  };

  const handleResetModal = () => {
    setSelectedFileName('');
    setParsedRows([]);
    setServerErrors([]);
  };

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const invalidCount = parsedRows.length - validCount;
  const canSubmit = parsedRows.length > 0 && invalidCount === 0 && !submitting;

  const handleImportSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerErrors([]);
    try {
      const payloads = parsedRows.map((r) => ({
        ...r.payload,
        mat_khau: (r.payload.mat_khau || '').trim() || defaultPassword.trim(),
      }));
      const res = await userApi.importUsersExcel(payloads);
      const createdCount = res.data?.totalCreated ?? payloads.length;
      toast.success(`Đã thêm nhanh ${createdCount} nhân sự từ Excel thành công!`);
      handleResetModal();
      await onSuccess();
      onClose();
    } catch (error: any) {
      const rawErrors = error?.response?.data?.errors;
      const errList: ImportUsersExcelRowError[] = Array.isArray(rawErrors) ? rawErrors : [];
      if (errList.length > 0) {
        setServerErrors(errList);
      }
      toast.error(error?.response?.data?.message || 'Nhập danh sách nhân sự từ Excel thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Thêm Nhanh Nhân Sự Từ Excel
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tải file mẫu chuẩn (.xlsx), kiểm tra trước từng dòng và nhập đồng loạt vào hệ thống.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
            {/* Bước 1 & Bước 2: Tải mẫu + Mật khẩu mặc định + Chọn file */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Bước 1 • File mẫu chuẩn
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    File mẫu đi kèm sẵn sheet hướng dẫn và toàn bộ tên đơn vị hiện có trên hệ thống.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
                >
                  Tải file mẫu (.xlsx)
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                    Bước 2 • Mật khẩu khởi tạo
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Áp dụng cho các dòng để trống cột mật khẩu (tối thiểu 6 ký tự).
                  </p>
                </div>
                <input
                  type="text"
                  value={defaultPassword}
                  onChange={(e) => handleDefaultPasswordChange(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="p-4 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Bước 3 • Tải lên danh sách
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 truncate">
                    {selectedFileName ? `Đã chọn: ${selectedFileName}` : 'Hỗ trợ .xlsx, .xls, .csv (tối đa 200 dòng)'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    leftIcon={<Upload className="w-4 h-4" />}
                  >
                    {parsedRows.length > 0 ? 'Chọn file khác' : 'Chọn file Excel'}
                  </Button>
                  {parsedRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetModal}
                      title="Xóa danh sách xem trước"
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lỗi trả về từ Backend (nếu có) */}
            {serverErrors.length > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Hệ thống từ chối nhập do phát hiện dữ liệu chưa hợp lệ:</span>
                </div>
                <ul className="list-disc pl-5 text-xs text-rose-700 dark:text-rose-300 space-y-0.5 max-h-28 overflow-y-auto">
                  {serverErrors.map((err, i) => (
                    <li key={i}>
                      Dòng #{err.rowNumber} ({err.ma_can_bo || err.email || 'N/A'}): {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Thanh tóm tắt kết quả đọc file */}
            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                      Tổng: {parsedRows.length} dòng
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Hợp lệ: {validCount}
                    </span>
                    {invalidCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Cần sửa / xóa: {invalidCount}
                      </span>
                    )}
                  </div>
                  {invalidCount > 0 && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      Vui lòng sửa file Excel hoặc bấm biểu tượng thùng rác để bỏ các dòng lỗi trước khi lưu.
                    </p>
                  )}
                </div>

                {/* Bảng xem trước */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Mã CB</th>
                          <th className="py-2.5 px-3">Họ và tên</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Vai trò</th>
                          <th className="py-2.5 px-3">Đơn vị</th>
                          <th className="py-2.5 px-3">Trạng thái kiểm tra</th>
                          <th className="py-2.5 px-2 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedRows.map((row) => {
                          const hasErr = row.errors.length > 0;
                          return (
                            <tr
                              key={`${row.rowNumber}-${row.excelRowNumber}`}
                              className={
                                hasErr
                                  ? 'bg-rose-50/50 dark:bg-rose-950/15'
                                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }
                            >
                              <td className="py-2.5 px-3 font-mono text-slate-500">
                                {row.rowNumber}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span>{row.previewStaffCode || '--'}</span>
                                  {row.isAutoCode && (
                                    <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 text-[10px] font-medium">
                                      Tự sinh
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-100">
                                {row.payload.ho_ten || '--'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {row.payload.email || '--'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                {row.payload.vai_tro_chinh || '--'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {row.deptDisplay}
                              </td>
                              <td className="py-2.5 px-3">
                                {hasErr ? (
                                  <div className="text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
                                    {row.errors.map((errMsg, idx) => (
                                      <div key={idx}>• {errMsg}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Hợp lệ
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(row.rowNumber)}
                                  title="Loại bỏ dòng này khỏi danh sách nhập"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cơ chế giao dịch toàn vẹn: chỉ ghi vào CSDL khi tất cả dòng đều hợp lệ.
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                Đóng
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleImportSubmit}
                disabled={!canSubmit}
                isLoading={submitting}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                {submitting
                  ? 'Đang nhập dữ liệu...'
                  : `Xác nhận nhập ${validCount > 0 ? `${validCount} ` : ''}nhân sự`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
