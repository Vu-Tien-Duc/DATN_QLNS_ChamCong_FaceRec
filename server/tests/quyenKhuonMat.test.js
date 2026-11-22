// Kiểm thử quyền đăng ký và xóa khuôn mặt: chỉ cấp trên được thao tác, không ai được tự thao tác trên khuôn mặt của mình.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { assertCanManageFace } = require('../services/khuonMat/mauKhuonMat.service');

describe('assertCanManageFace', () => {
  it('chặn người dùng tự đăng ký khuôn mặt của chính mình, kể cả admin', async () => {
    await assert.rejects(
      assertCanManageFace({ id: 'u1', vai_tro_chinh: 'admin' }, { id: 'u1' }, 'đăng ký'),
      (err) => err.statusCode === 403 && err.errorCode === 'FACE_SELF_MANAGE_FORBIDDEN'
    );
  });

  it('chặn giảng viên đăng ký hoặc xóa khuôn mặt của người khác', async () => {
    await assert.rejects(
      assertCanManageFace({ id: 'u1', vai_tro_chinh: 'giang_vien' }, { id: 'u2' }, 'xóa'),
      (err) => err.statusCode === 403 && err.errorCode === 'FACE_MANAGE_FORBIDDEN'
    );
  });

  it('cho phép BGH, TCCB và admin thao tác trên nhân sự thường', async () => {
    for (const role of ['admin', 'bgh', 'tccb']) {
      await assert.doesNotReject(
        assertCanManageFace({ id: 'u1', vai_tro_chinh: role }, { id: 'u2', vai_tro_chinh: 'giang_vien' }, 'đăng ký')
      );
    }
  });

  it('miễn đăng ký và xóa khuôn mặt cho tài khoản quản trị hệ thống (admin)', async () => {
    for (const role of ['admin', 'bgh', 'tccb']) {
      await assert.rejects(
        assertCanManageFace({ id: 'u1', vai_tro_chinh: role }, { id: 'u2', vai_tro_chinh: 'admin' }, 'đăng ký'),
        (err) => err.statusCode === 403 && err.errorCode === 'FACE_ADMIN_EXEMPT'
      );
    }
  });
});
