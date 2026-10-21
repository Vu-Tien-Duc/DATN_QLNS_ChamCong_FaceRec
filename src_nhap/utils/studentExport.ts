import * as XLSX from 'xlsx';

export interface StudentExportItem {
  _id: string;
  studentCode?: string;
  fullName: string;
  gender?: string;
  birthday?: string | Date;
  idCard?: string;
  address?: string;
  phone: string;
  email?: string;
  parentAccountId?: any;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentRelationship?: string;
  school?: string;
  major?: string;
  studyYear?: string;
  lead?: any;
  entranceTestScore?: number;
  currentLevel?: string;
  assignedStaff?: any;
  enrollmentDate?: string | Date;
  status?: string;
  note?: string;
  referrer?: string;
  courses?: Array<{
    _id?: string;
    name?: string;
    courseCode?: string;
    className?: string;
    status?: string;
  }>;
  createdAt?: string | Date;
}

const GENDER_MAP: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

const STATUS_MAP: Record<string, string> = {
  studying: 'Đang học',
  trial: 'Học thử',
  pause: 'Bảo lưu',
  graduated: 'Đã tốt nghiệp',
  withdrawn: 'Đã thôi học',
};

const RELATIONSHIP_MAP: Record<string, string> = {
  Father: 'Cha / Bố',
  Mother: 'Mẹ',
  Guardian: 'Người giám hộ',
  Other: 'Khác',
};

const formatDate = (val?: string | Date | null): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

const formatDateTime = (val?: string | Date | null): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '';
  }
};

// Chuẩn hóa dữ liệu dòng cho cả Excel và CSV
export const prepareStudentRows = (students: StudentExportItem[]) => {
  return students.map((s, idx) => {
    // Thông tin phụ huynh (ưu tiên thông tin trực tiếp, fallback sang tài khoản portal liên kết)
    const pName = s.parentName?.trim() || s.parentAccountId?.fullName || '';
    const pPhone = s.parentPhone?.trim() || s.parentAccountId?.phone || '';
    const pEmail = s.parentEmail?.trim() || s.parentAccountId?.email || '';
    const pRelation = RELATIONSHIP_MAP[s.parentRelationship || ''] || s.parentRelationship || '';
    const pPortalStatus = s.parentAccountId
      ? `Đã liên kết (${s.parentAccountId.email || s.parentAccountId.fullName || 'User'})`
      : 'Chưa liên kết';

    // Danh sách khóa học
    const courseNames = (s.courses || [])
      .map(c => {
        let title = c.name || 'Khóa học';
        if (c.className) title += ` [Lớp: ${c.className}]`;
        if (c.courseCode) title += ` (${c.courseCode})`;
        return title;
      })
      .join('; ');

    // Thông tin Lead / Nhân viên phụ trách
    const leadName = typeof s.lead === 'object' && s.lead ? s.lead.name || '' : '';
    const leadPhone = typeof s.lead === 'object' && s.lead ? s.lead.phone || '' : '';
    const staffName = typeof s.assignedStaff === 'object' && s.assignedStaff ? s.assignedStaff.fullName || '' : '';

    return {
      stt: idx + 1,
      studentCode: s.studentCode || '',
      fullName: s.fullName || '',
      gender: GENDER_MAP[s.gender || ''] || s.gender || '',
      birthday: formatDate(s.birthday),
      phone: s.phone ? String(s.phone).trim() : '',
      email: s.email || '',
      idCard: s.idCard ? String(s.idCard).trim() : '',
      address: s.address || '',
      status: STATUS_MAP[s.status || ''] || s.status || '',
      enrollmentDate: formatDate(s.enrollmentDate),
      courses: courseNames,
      courseCount: (s.courses || []).length,
      school: s.school || '',
      major: s.major || '',
      studyYear: s.studyYear || '',
      entranceTestScore: s.entranceTestScore !== undefined && s.entranceTestScore !== null ? s.entranceTestScore : '',
      currentLevel: s.currentLevel || '',
      parentName: pName,
      parentRelationship: pRelation,
      parentPhone: pPhone,
      parentEmail: pEmail,
      parentPortalStatus: pPortalStatus,
      leadName,
      leadPhone,
      assignedStaff: staffName,
      referrer: s.referrer || '',
      note: s.note || '',
      createdAt: formatDateTime(s.createdAt)
    };
  });
};

const HEADERS = [
  'STT',
  'Mã học viên',
  'Họ và tên học viên',
  'Giới tính',
  'Ngày sinh',
  'Số điện thoại HV',
  'Email học viên',
  'Số CCCD/CMND',
  'Địa chỉ',
  'Trạng thái học tập',
  'Ngày nhập học',
  'Khóa học tham gia',
  'Số lượng khóa',
  'Trường học',
  'Chuyên ngành',
  'Năm/Khối lớp',
  'Điểm test đầu vào',
  'Trình độ hiện tại',
  'Họ tên phụ huynh',
  'Mối quan hệ',
  'SĐT phụ huynh',
  'Email phụ huynh',
  'Tài khoản Portal Phụ huynh',
  'Lead nguồn',
  'SĐT Lead',
  'Nhân viên phụ trách (Sale/CSKH)',
  'Người giới thiệu',
  'Ghi chú',
  'Ngày tạo hồ sơ'
];

/**
 * Xuất file Excel (.xlsx) với định dạng chuẩn, căn chỉnh và bảo toàn số 0 điện thoại
 */
export const exportStudentsToExcel = (students: StudentExportItem[], filename = 'Danh_Sach_Hoc_Vien_DeepCode') => {
  const rows = prepareStudentRows(students);

  // Tạo mảng dữ liệu với hàng đầu là Tiêu đề
  const data = [
    HEADERS,
    ...rows.map(r => [
      r.stt,
      r.studentCode,
      r.fullName,
      r.gender,
      r.birthday,
      r.phone,
      r.email,
      r.idCard,
      r.address,
      r.status,
      r.enrollmentDate,
      r.courses,
      r.courseCount,
      r.school,
      r.major,
      r.studyYear,
      r.entranceTestScore,
      r.currentLevel,
      r.parentName,
      r.parentRelationship,
      r.parentPhone,
      r.parentEmail,
      r.parentPortalStatus,
      r.leadName,
      r.leadPhone,
      r.assignedStaff,
      r.referrer,
      r.note,
      r.createdAt
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Thiết lập độ rộng cột tối ưu cho từng cột
  const colWidths = [
    { wch: 6 },   // STT
    { wch: 14 },  // Mã HV
    { wch: 24 },  // Họ tên HV
    { wch: 10 },  // Giới tính
    { wch: 13 },  // Ngày sinh
    { wch: 15 },  // SĐT HV
    { wch: 25 },  // Email HV
    { wch: 16 },  // CCCD
    { wch: 30 },  // Địa chỉ
    { wch: 15 },  // Trạng thái
    { wch: 14 },  // Ngày nhập học
    { wch: 35 },  // Khóa học
    { wch: 14 },  // Số lượng khóa
    { wch: 24 },  // Trường học
    { wch: 20 },  // Chuyên ngành
    { wch: 15 },  // Năm/Khối lớp
    { wch: 16 },  // Điểm test
    { wch: 18 },  // Trình độ
    { wch: 24 },  // Tên phụ huynh
    { wch: 14 },  // Quan hệ
    { wch: 16 },  // SĐT phụ huynh
    { wch: 26 },  // Email phụ huynh
    { wch: 26 },  // Portal phụ huynh
    { wch: 20 },  // Lead nguồn
    { wch: 15 },  // SĐT Lead
    { wch: 24 },  // Nhân viên phụ trách
    { wch: 20 },  // Người giới thiệu
    { wch: 30 },  // Ghi chú
    { wch: 18 }   // Ngày tạo
  ];
  ws['!cols'] = colWidths;

  // Đảm bảo số điện thoại và CCCD được lưu dưới dạng chuỗi (Text) để không mất số 0 đầu
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:AC1');
  for (let R = 1; R <= range.e.r; ++R) {
    // SĐT HV ở cột F (col index 5)
    const phoneCell = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
    if (phoneCell && phoneCell.v) {
      phoneCell.t = 's';
      phoneCell.v = String(phoneCell.v);
    }
    // CCCD ở cột H (col index 7)
    const idCardCell = ws[XLSX.utils.encode_cell({ r: R, c: 7 })];
    if (idCardCell && idCardCell.v) {
      idCardCell.t = 's';
      idCardCell.v = String(idCardCell.v);
    }
    // SĐT phụ huynh ở cột U (col index 20)
    const pPhoneCell = ws[XLSX.utils.encode_cell({ r: R, c: 20 })];
    if (pPhoneCell && pPhoneCell.v) {
      pPhoneCell.t = 's';
      pPhoneCell.v = String(pPhoneCell.v);
    }
    // SĐT Lead ở cột Y (col index 24)
    const leadPhoneCell = ws[XLSX.utils.encode_cell({ r: R, c: 24 })];
    if (leadPhoneCell && leadPhoneCell.v) {
      leadPhoneCell.t = 's';
      leadPhoneCell.v = String(leadPhoneCell.v);
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoc_Vien_Sale');

  const cleanDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `${filename}_${cleanDateStr}.xlsx`);
};

/**
 * Xuất file CSV với UTF-8 BOM, tương thích tiếng Việt có dấu trong Excel & Google Sheets
 */
export const exportStudentsToCSV = (students: StudentExportItem[], filename = 'Danh_Sach_Hoc_Vien_DeepCode') => {
  const rows = prepareStudentRows(students);

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Với số điện thoại trong CSV, thêm tiền tố ="09xxx" để Excel hiểu là dạng Text và giữ nguyên số 0 đầu
  const escapePhoneCSV = (val: any) => {
    if (!val) return '""';
    const str = String(val).trim();
    return `="""${str}"""`;
  };

  const csvRows = rows.map(r => [
    r.stt,
    escapeCSV(r.studentCode),
    escapeCSV(r.fullName),
    escapeCSV(r.gender),
    escapeCSV(r.birthday),
    escapePhoneCSV(r.phone),
    escapeCSV(r.email),
    escapePhoneCSV(r.idCard),
    escapeCSV(r.address),
    escapeCSV(r.status),
    escapeCSV(r.enrollmentDate),
    escapeCSV(r.courses),
    r.courseCount,
    escapeCSV(r.school),
    escapeCSV(r.major),
    escapeCSV(r.studyYear),
    r.entranceTestScore !== '' ? r.entranceTestScore : '',
    escapeCSV(r.currentLevel),
    escapeCSV(r.parentName),
    escapeCSV(r.parentRelationship),
    escapePhoneCSV(r.parentPhone),
    escapeCSV(r.parentEmail),
    escapeCSV(r.parentPortalStatus),
    escapeCSV(r.leadName),
    escapePhoneCSV(r.leadPhone),
    escapeCSV(r.assignedStaff),
    escapeCSV(r.referrer),
    escapeCSV(r.note),
    escapeCSV(r.createdAt)
  ].join(','));

  const csvContent = '\uFEFF' + [HEADERS.map(escapeCSV).join(','), ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${cleanDateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
