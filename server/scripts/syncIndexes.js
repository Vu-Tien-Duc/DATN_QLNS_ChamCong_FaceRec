/**
 * Script Đồng bộ Chỉ mục CSDL (MongoDB Indexes Synchronization)
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
 * Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023
 *
 * Tự động tạo, sửa đổi và dọn dẹp các Index trên toàn bộ 14 Collections Mongoose.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../models');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/DATN_QLNS_ChamCong_FaceRec';

async function syncAllIndexes() {
  console.log('================================================================');
  console.log('   BẮT ĐẦU ĐỒNG BỘ CHỈ MỤC CSDL (14 COLLECTIONS MONGOOSE)       ');
  console.log('================================================================\n');

  try {
    console.log(`[1/3] Đang kết nối tới MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    console.log('  ✔ Kết nối MongoDB thành công.\n');

    const collectionsList = [
      { name: 'User', model: models.User, col: 'nguoi_dung' },
      { name: 'FaceTemplate', model: models.FaceTemplate, col: 'du_lieu_khuon_mat' },
      { name: 'Department', model: models.Department, col: 'don_vi' },
      { name: 'ShiftConfig', model: models.ShiftConfig, col: 'ca_lam_viec' },
      { name: 'Subject', model: models.Subject, col: 'mon_hoc' },
      { name: 'Schedule', model: models.Schedule, col: 'lich_giang_day' },
      { name: 'Holiday', model: models.Holiday, col: 'ngay_nghi_le' },
      { name: 'PunchLog', model: models.PunchLog, col: 'luot_quet_cham_cong' },
      { name: 'AttendanceLog', model: models.AttendanceLog, col: 'cong_tong_hop' },
      { name: 'LeaveRequest', model: models.LeaveRequest, col: 'don_tu' },
      { name: 'Payroll', model: models.Payroll, col: 'phieu_luong' },
      { name: 'RefreshToken', model: models.RefreshToken, col: 'ma_lam_moi' },
      { name: 'SystemConfig', model: models.SystemConfig, col: 'cau_hinh_he_thong' },
      { name: 'AuditLog', model: models.AuditLog, col: 'nhat_ky_kiem_toan' },
    ];

    console.log('[2/3] Bắt đầu đồng bộ chỉ mục (syncIndexes)...');
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const item of collectionsList) {
      process.stdout.write(`  -> [${item.col}] (${item.name})... `);
      try {
        const result = await item.model.syncIndexes();
        console.log('✔ THÀNH CÔNG');
        totalSuccess++;
      } catch (err) {
        console.log(`✖ LỖI: ${err.message}`);
        totalFailed++;
      }
    }

    console.log('\n[3/3] Thống kê kết quả:');
    console.log(`  - Thành công: ${totalSuccess}/${collectionsList.length} collections`);
    console.log(`  - Thất bại:   ${totalFailed}/${collectionsList.length} collections`);

    console.log('\n================================================================');
    console.log('        HOÀN TẤT ĐỒNG BỘ CHỈ MỤC CSDL 14 COLLECTIONS            ');
    console.log('================================================================\n');
  } catch (error) {
    console.error('Lỗi nghiêm trọng trong quá trình đồng bộ Index:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Đã đóng kết nối MongoDB.');
  }
}

if (require.main === module) {
  syncAllIndexes();
}

module.exports = { syncAllIndexes };
