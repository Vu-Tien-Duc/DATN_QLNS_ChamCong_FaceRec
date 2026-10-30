/**
 * Script Chuyển đổi toàn bộ enum trong CSDL sang chữ thường (lowercase snake_case)
 * Đề tài: Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
 * Sinh viên thực hiện: Vũ Tiến Đức - MSV: 2310900023
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/DATN_QLNS_ChamCong_FaceRec';

async function migrate() {
  console.log('================================================================');
  console.log('   BẮT ĐẦU CHUYỂN ĐỔI ENUM CSDL SANG CHỮ THƯỜNG (LOWERCASE)     ');
  console.log('================================================================\n');

  try {
    console.log(`Kết nối tới MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    console.log('✔ Kết nối MongoDB thành công.\n');

    // 1. User (nguoi_dung)
    console.log('[1/8] Chuyển đổi User (nguoi_dung)...');
    const userRes = await db.collection('nguoi_dung').updateMany(
      {},
      [
        {
          $set: {
            gioi_tinh: { $toLower: { $ifNull: ['$gioi_tinh', 'nam'] } },
            loai_can_bo: { $toLower: { $ifNull: ['$loai_can_bo', 'giang_vien'] } },
            loai_hop_dong: { $toLower: { $ifNull: ['$loai_hop_dong', 'toan_thoi_gian'] } },
            trang_thai_lam_viec: { $toLower: { $ifNull: ['$trang_thai_lam_viec', 'dang_lam_viec'] } },
            hoc_ham: { $toLower: { $ifNull: ['$hoc_ham', 'khong'] } },
            hoc_vi: { $toLower: { $ifNull: ['$hoc_vi', 'dai_hoc'] } },
            loai_otp: {
              $cond: [
                { $gt: ['$loai_otp', null] },
                { $toLower: '$loai_otp' },
                '$loai_otp',
              ],
            },
            vai_tro: {
              $map: {
                input: { $ifNull: ['$vai_tro', []] },
                as: 'r',
                in: {
                  $mergeObjects: [
                    '$$r',
                    {
                      vai_tro: { $toLower: '$$r.vai_tro' },
                      pham_vi: { $toLower: { $ifNull: ['$$r.pham_vi', 'toan_truong'] } },
                    },
                  ],
                },
              },
            },
          },
        },
      ]
    );
    console.log(`  ✔ User matched/modified: ${userRes.matchedCount} / ${userRes.modifiedCount}`);

    // 2. LeaveRequest (don_nghi_phep)
    console.log('[2/8] Chuyển đổi LeaveRequest (don_nghi_phep)...');
    const leaveRes = await db.collection('don_nghi_phep').updateMany(
      {},
      [
        {
          $set: {
            trang_thai: { $toLower: { $ifNull: ['$trang_thai', 'pending'] } },
            lich_su_duyet: {
              $map: {
                input: { $ifNull: ['$lich_su_duyet', []] },
                as: 'h',
                in: {
                  $mergeObjects: [
                    '$$h',
                    {
                      hanh_dong: { $toLower: '$$h.hanh_dong' },
                    },
                  ],
                },
              },
            },
          },
        },
      ]
    );
    console.log(`  ✔ LeaveRequest matched/modified: ${leaveRes.matchedCount} / ${leaveRes.modifiedCount}`);

    // 3. AttendanceLog (nhat_ky_cham_cong)
    console.log('[3/8] Chuyển đổi AttendanceLog (nhat_ky_cham_cong)...');
    const attRes = await db.collection('nhat_ky_cham_cong').updateMany(
      {},
      [
        {
          $set: {
            trang_thai: { $toLower: { $ifNull: ['$trang_thai', 'on_time'] } },
            phuong_thuc: { $toLower: { $ifNull: ['$phuong_thuc', 'face_ai'] } },
          },
        },
      ]
    );
    console.log(`  ✔ AttendanceLog matched/modified: ${attRes.matchedCount} / ${attRes.modifiedCount}`);

    // 4. PunchLog (luot_quet_cham_cong)
    console.log('[4/8] Chuyển đổi PunchLog (luot_quet_cham_cong)...');
    const punchRes = await db.collection('luot_quet_cham_cong').updateMany(
      {},
      [
        {
          $set: {
            loai_quet: { $toLower: { $ifNull: ['$loai_quet', 'check_in'] } },
            phuong_thuc: { $toLower: { $ifNull: ['$phuong_thuc', 'face_ai'] } },
            trang_thai: { $toLower: { $ifNull: ['$trang_thai', 'thanh_cong'] } },
          },
        },
      ]
    );
    console.log(`  ✔ PunchLog matched/modified: ${punchRes.matchedCount} / ${punchRes.modifiedCount}`);

    // 5. Payroll (phieu_luong)
    console.log('[5/8] Chuyển đổi Payroll (phieu_luong)...');
    const payRes = await db.collection('phieu_luong').updateMany(
      {},
      [
        {
          $set: {
            trang_thai: { $toLower: { $ifNull: ['$trang_thai', 'du_thao'] } },
          },
        },
      ]
    );
    console.log(`  ✔ Payroll matched/modified: ${payRes.matchedCount} / ${payRes.modifiedCount}`);

    // 6. Schedule (lich_trinh)
    console.log('[6/8] Chuyển đổi Schedule (lich_trinh)...');
    const schedRes = await db.collection('lich_trinh').updateMany(
      {},
      [
        {
          $set: {
            loai_lich: { $toLower: { $ifNull: ['$loai_lich', 'chinh_khoa'] } },
            ngoai_le: {
              $map: {
                input: { $ifNull: ['$ngoai_le', []] },
                as: 'ex',
                in: {
                  $mergeObjects: [
                    '$$ex',
                    {
                      trang_thai: { $toLower: { $ifNull: ['$$ex.trang_thai', 'nghi'] } },
                    },
                  ],
                },
              },
            },
          },
        },
      ]
    );
    console.log(`  ✔ Schedule matched/modified: ${schedRes.matchedCount} / ${schedRes.modifiedCount}`);

    // 7. AuditLog (nhat_ky_kiem_toan)
    console.log('[7/8] Chuyển đổi AuditLog (nhat_ky_kiem_toan)...');
    const auditRes = await db.collection('nhat_ky_kiem_toan').updateMany(
      {},
      [
        {
          $set: {
            loai_chu_the: { $toLower: { $ifNull: ['$loai_chu_the', 'user'] } },
            ket_qua: { $toLower: { $ifNull: ['$ket_qua', 'success'] } },
          },
        },
      ]
    );
    console.log(`  ✔ AuditLog matched/modified: ${auditRes.matchedCount} / ${auditRes.modifiedCount}`);

    // 8. FaceTemplate (mau_khuon_mat)
    console.log('[8/8] Chuyển đổi FaceTemplate (mau_khuon_mat)...');
    const faceRes = await db.collection('mau_khuon_mat').updateMany(
      {},
      [
        {
          $set: {
            trang_thai_ma_hoa: { $toLower: { $ifNull: ['$trang_thai_ma_hoa', 'aes_256_gcm'] } },
          },
        },
      ]
    );
    console.log(`  ✔ FaceTemplate matched/modified: ${faceRes.matchedCount} / ${faceRes.modifiedCount}`);

    console.log('\n================================================================');
    console.log('   HOÀN TẤT CHUYỂN ĐỔI TOÀN BỘ ENUM CSDL SANG CHỮ THƯỜNG!      ');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Lỗi khi chuyển đổi enum CSDL:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✔ Đã ngắt kết nối CSDL MongoDB.');
  }
}

migrate();
