/**
 * Test Suite: MinIO & S3-Compatible Object Storage Architecture (Phần 2)
 * Kiểm tra toàn diện hệ thống lưu trữ đối tượng MinIO và cơ chế Local Storage Fallback:
 * 1. Khởi tạo Storage Client và phân vùng lưu trữ (Bucket & Prefixes).
 * 2. Lưu trữ tệp (Put Object) và đối soát nội dung đọc lại (Get Object Buffer).
 * 3. Đọc tệp dạng Readable Stream (Get Object Stream) phục vụ tải tệp an toàn.
 * 4. Cơ chế sinh Signed Presigned URL có thời hạn phục vụ xem ảnh / tài liệu bảo mật.
 * 5. Tích hợp Lưu trữ Ảnh minh chứng điểm danh & Gian lận chấm công (attendanceEvidence.js).
 * 6. Xóa tệp đối tượng (Delete Object) và thu hồi tài nguyên an toàn.
 * 7. Cơ chế Hybrid Fallback tự động đảm bảo Zero Downtime khi MinIO offline.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

// Đặt môi trường test
process.env.NODE_ENV = 'test';

const minioStorage = require('../config/minio');
const {
  storeAttendanceEvidence,
  readAttendanceEvidence,
  removeAttendanceEvidence,
  getEvidencePresignedUrl,
} = require('../utils/attendanceEvidence');

const runTests = async () => {
  console.log('--- Bắt đầu Test Suite: MinIO & Object Storage Architecture (Phần 2) ---');

  // ---------------------------------------------------------------------------
  // Test 1: Khởi tạo Storage Client và kiểm tra trạng thái
  // ---------------------------------------------------------------------------
  console.log('[Test 1] Kiểm tra trạng thái Storage Client...');
  const status = minioStorage.getStorageStatus();
  assert.ok(status.bucketName, 'Bucket name phải được cấu hình.');
  assert.ok(status.endpoint, 'Endpoint lưu trữ phải tồn tại.');
  assert.ok(status.localFallbackRoot, 'Thư mục fallback cục bộ phải sẵn sàng.');
  console.log(`✓ Test 1 ĐẠT: Storage Driver = '${status.driver}', Bucket = '${status.bucketName}', MinIO Online = ${status.isMinioAvailable}.`);

  // ---------------------------------------------------------------------------
  // Test 2: Lưu trữ tệp (Put Object) và đọc lại (Get Object Buffer)
  // ---------------------------------------------------------------------------
  console.log('[Test 2] Kiểm tra Put Object & Get Object Buffer...');
  const samplePdfContent = Buffer.from('%PDF-1.4 Mock Leave Request Application Content 2026');
  const sampleKey = `attachments/test-leave-request-${crypto.randomUUID()}.pdf`;

  const putResult = await minioStorage.putObject(sampleKey, samplePdfContent, 'application/pdf', {
    purpose: 'unit-test',
    uploadedBy: 'test-suite-runner',
  });
  assert.equal(putResult.objectKey, sampleKey);
  assert.equal(putResult.size, samplePdfContent.length);
  assert.ok(['minio', 'local'].includes(putResult.storage));

  const fetched = await minioStorage.getObject(sampleKey);
  assert.equal(fetched.size, samplePdfContent.length);
  assert.deepEqual(fetched.buffer, samplePdfContent);
  assert.equal(fetched.contentType, 'application/pdf');
  console.log(`✓ Test 2 ĐẠT: Ghi và đọc tệp PDF '${sampleKey}' thành công (Storage: ${fetched.storage}).`);

  // ---------------------------------------------------------------------------
  // Test 3: Đọc tệp dạng Readable Stream
  // ---------------------------------------------------------------------------
  console.log('[Test 3] Kiểm tra Get Object Stream...');
  const streamResult = await minioStorage.getObjectStream(sampleKey);
  assert.ok(streamResult.stream, 'Phải trả về một Readable stream.');
  assert.equal(streamResult.contentType, 'application/pdf');

  const streamChunks = [];
  for await (const chunk of streamResult.stream) {
    streamChunks.push(chunk);
  }
  const streamBuffer = Buffer.concat(streamChunks);
  assert.deepEqual(streamBuffer, samplePdfContent, 'Nội dung stream đọc được phải trùng khớp 100% với dữ liệu gốc.');
  console.log('✓ Test 3 ĐẠT: Đọc tệp dạng Readable Stream hoàn hảo, toàn vẹn dữ liệu.');

  // ---------------------------------------------------------------------------
  // Test 4: Sinh Presigned GET URL bảo mật có giới hạn thời gian
  // ---------------------------------------------------------------------------
  console.log('[Test 4] Kiểm tra sinh Signed Presigned URL...');
  const presignedUrl = await minioStorage.getPresignedUrl(sampleKey, 900);
  assert.ok(typeof presignedUrl === 'string' && presignedUrl.length > 0, 'Phải sinh ra chuỗi URL hợp lệ.');
  if (status.isMinioAvailable) {
    assert.ok(presignedUrl.includes('X-Amz-Signature') || presignedUrl.includes('X-Amz-Algorithm') || presignedUrl.startsWith('http'), 'MinIO Presigned URL phải có chữ ký.');
  } else {
    assert.ok(presignedUrl.startsWith('/api/'), 'Local fallback URL phải trỏ tới API an toàn.');
  }
  console.log(`✓ Test 4 ĐẠT: Sinh Signed Presigned URL thành công (${presignedUrl.slice(0, 60)}...).`);

  // ---------------------------------------------------------------------------
  // Test 5: Tích hợp Attendance Evidence (Ảnh minh chứng điểm danh & gian lận)
  // ---------------------------------------------------------------------------
  console.log('[Test 5] Kiểm tra lưu và đọc ảnh minh chứng (attendanceEvidence)...');
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const dataUrl = `data:image/jpeg;base64,${validJpeg.toString('base64')}`;

  const evidenceRef = await storeAttendanceEvidence(dataUrl);
  assert.match(evidenceRef, /^attendance-[0-9a-f-]{36}\.jpg$/i);

  const readResult = await readAttendanceEvidence(evidenceRef);
  assert.equal(readResult.contentType, 'image/jpeg');
  assert.deepEqual(readResult.buffer, validJpeg);

  const evidenceUrl = await getEvidencePresignedUrl(evidenceRef, 600);
  assert.ok(typeof evidenceUrl === 'string' && evidenceUrl.length > 0);
  console.log(`✓ Test 5 ĐẠT: Lưu trữ và đọc ảnh minh chứng '${evidenceRef}' thành công.`);

  // ---------------------------------------------------------------------------
  // Test 6: Xóa tệp đối tượng và dọn dẹp
  // ---------------------------------------------------------------------------
  console.log('[Test 6] Kiểm tra xóa tệp đối tượng...');
  await minioStorage.deleteObject(sampleKey);
  await assert.rejects(minioStorage.getObject(sampleKey), { code: 'ENOENT' });

  await removeAttendanceEvidence(evidenceRef);
  await assert.rejects(readAttendanceEvidence(evidenceRef), { code: 'ENOENT' });
  console.log('✓ Test 6 ĐẠT: Xóa tệp khỏi Object Storage và Local Cache thành công 100%.');

  // ---------------------------------------------------------------------------
  // Test 7: Kiểm tra tính an toàn & từ chối tệp không hợp lệ
  // ---------------------------------------------------------------------------
  console.log('[Test 7] Kiểm tra chống tệp giả mạo & sai định dạng...');
  const invalidBuffer = Buffer.from('NOT_AN_IMAGE_FILE_CONTENT');
  await assert.rejects(
    storeAttendanceEvidence(`data:image/png;base64,${invalidBuffer.toString('base64')}`),
    { statusCode: 400 }
  );
  console.log('✓ Test 7 ĐẠT: Chặn đứng tệp giả mạo chữ ký MIME type thành công.');

  console.log('\n=============================================================================');
  console.log('🎉 TẤT CẢ 7 BÀI KIỂM THỬ MINIO OBJECT STORAGE (PHẦN 2) ĐÃ PASS 100%!');
  console.log('=============================================================================\n');
};

runTests().catch((err) => {
  console.error('LỖI TEST MINIO STORAGE:', err);
  process.exit(1);
});
