const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const evidenceDir = path.join(os.tmpdir(), `attendance-evidence-test-${crypto.randomUUID()}`);
process.env.ATTENDANCE_EVIDENCE_DIR = evidenceDir;

const {
  storeAttendanceEvidence,
  readAttendanceEvidence,
  removeAttendanceEvidence,
} = require('../utils/attendanceEvidence');

const run = async () => {
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const dataUrl = `data:image/jpeg;base64,${jpegBytes.toString('base64')}`;
  const reference = await storeAttendanceEvidence(dataUrl);
  assert.match(reference, /^attendance-[0-9a-f-]{36}\.jpg$/i);

  const stored = await readAttendanceEvidence(reference);
  assert.equal(stored.contentType, 'image/jpeg');
  assert.deepEqual(stored.buffer, jpegBytes);

  await assert.rejects(
    storeAttendanceEvidence(`data:image/png;base64,${jpegBytes.toString('base64')}`),
    { statusCode: 400 }
  );
  await assert.rejects(storeAttendanceEvidence('https://example.com/image.jpg'), { statusCode: 400 });
  const oversizedDataUrl = `data:image/jpeg;base64,${Buffer.concat([
    jpegBytes,
    Buffer.alloc(2 * 1024 * 1024),
  ]).toString('base64')}`;
  await assert.rejects(storeAttendanceEvidence(oversizedDataUrl), { statusCode: 413 });
  await assert.rejects(readAttendanceEvidence('../private-file.jpg'));

  await removeAttendanceEvidence(reference);
  await assert.rejects(readAttendanceEvidence(reference), { code: 'ENOENT' });
};

run()
  .then(async () => {
    await fs.rm(evidenceDir, { recursive: true, force: true });
    console.log('Attendance evidence tests passed.');
  })
  .catch(async (error) => {
    await fs.rm(evidenceDir, { recursive: true, force: true });
    console.error(error);
    process.exitCode = 1;
  });
