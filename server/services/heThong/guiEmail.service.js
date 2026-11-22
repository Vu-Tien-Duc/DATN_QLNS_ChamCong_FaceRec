// Tạo và gửi email thông báo nghỉ phép, chấm công và báo cáo tổng kết cuối ngày.
const { transporter } = require('../../config/mailer');

const ATTENDANCE_METHOD_LABELS = {
  face_ai: 'Sinh trắc học Face ID (Máy chấm công)',
  qr_code: 'Quét mã QR Code Động (Điện thoại)',
  thu_cong_admin: 'Cổng thông tin Web / Thủ công',
  gps_mobile: 'Định vị GPS di động',
  system_auto: 'Tự động hệ thống',
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Định dạng ngày theo DD/MM/YYYY (cố định múi giờ Asia/Ho_Chi_Minh)
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Định dạng giờ HH:mm:ss theo múi giờ Việt Nam
const formatVietnamTime = (dateValue) =>
  new Date(dateValue).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const formatDurationMinutes = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours} giờ ${mins} phút` : `${total} phút`;
};

const formatAttendanceMethodText = (method) => {
  const normalized = String(method || '').trim().toLowerCase();
  return ATTENDANCE_METHOD_LABELS[normalized] || method || 'Không xác định';
};

// Render khung email thống nhất dùng chung cho mọi loại thông báo
const renderEmailLayout = ({
  title,
  subtitle = '',
  badge = '',
  headerBg = '#1e3a8a',
  maxWidth = 600,
  signature = 'Phòng Đào tạo & Quản trị Nhân sự',
  footerText = 'Email tự động được gửi từ Hệ thống Quản lý Chấm công Trường Đại học.',
  bodyHtml,
}) => `
  <div style="font-family: Arial, sans-serif; max-width: ${maxWidth}px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b; background-color: #ffffff;">
    <div style="background: ${headerBg}; color: #ffffff; padding: 20px 24px; text-align: center;">
      ${badge ? `<div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">${badge}</div>` : ''}
      <h2 style="margin: 0; font-size: 20px; font-weight: bold;">${title}</h2>
      ${subtitle ? `<p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">${subtitle}</p>` : ''}
    </div>
    <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
      ${bodyHtml}
      <p style="margin-top: 20px;">Trân trọng,<br><strong>${signature}</strong></p>
    </div>
    <div style="background-color: #f1f5f9; color: #64748b; padding: 12px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
      ${footerText}
    </div>
  </div>
`;

const renderInfoBox = (rows, accentColor) => `
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid ${accentColor}; padding: 14px 18px; margin: 16px 0; border-radius: 8px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      ${rows
        .filter(Boolean)
        .map(
          ([label, valueHtml]) => `
        <tr>
          <td style="padding: 5px 12px 5px 0; color: #64748b; width: 145px;">${label}:</td>
          <td style="padding: 5px 0; color: #0f172a;">${valueHtml}</td>
        </tr>`
        )
        .join('')}
    </table>
  </div>
`;

const renderBadge = (text, bg, color) =>
  `<span style="display: inline-block; background-color: ${bg}; color: ${color}; font-weight: bold; padding: 2px 10px; border-radius: 6px; font-size: 12px;">${text}</span>`;

const renderSummarySectionTable = ({ title, titleColor, borderBottom, headBg, headColor, cellBorder, headers, rowsHtml, emptyText }) => `
  <h3 style="font-size: 15px; color: ${titleColor}; border-bottom: 2px solid ${borderBottom}; padding-bottom: 6px; margin: 20px 0 10px 0;">${title}</h3>
  ${rowsHtml
    ? `<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
        <thead><tr style="background-color: ${headBg}; color: ${headColor}; text-align: left;">
          ${headers.map((h) => `<th style="padding: 8px; border: 1px solid ${cellBorder};">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
    : `<p style="font-size: 13px; color: #059669; background-color: #ecfdf5; padding: 10px; border-radius: 6px; margin-bottom: 18px;">${emptyText}</p>`}
`;

// Hàm gửi mail dùng chung (hỗ trợ requireRecipient cho luồng đơn từ)
const sendHtmlMail = async ({ to, subject, html, requireRecipient = false, logTag = null }) => {
  if (!to) {
    if (requireRecipient) throw new Error('Không có email người nhận');
    return null;
  }

  const fromEmail = process.env.EMAIL_USER || process.env.MAIL_USER || 'no-reply@university.edu.vn';
  const result = await transporter.sendMail({
    from: `"Hệ thống Quản lý Chấm công Đại học" <${fromEmail}>`,
    to,
    subject,
    html,
  });

  if (logTag) {
    console.log(`[EmailService] [${logTag}] Đã gửi email tới ${to} (Subject: "${subject}")`);
  }
  return result;
};

// 1. Gửi email thông báo đơn nghỉ được duyệt
const sendLeaveApprovedEmail = ({ to, fullName, fromDate, toDate, approvalNote = '' }) =>
  sendHtmlMail({
    to,
    requireRecipient: true,
    subject: 'Đơn xin nghỉ của bạn đã được duyệt',
    html: renderEmailLayout({
      title: 'THÔNG BÁO DUYỆT ĐƠN XIN NGHỈ',
      headerBg: '#16a34a',
      signature: 'Hệ thống quản lý chấm công',
      bodyHtml: `
        <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Đơn xin nghỉ của bạn đã được ${renderBadge('ĐÃ DUYỆT', '#dcfce7', '#15803d')}.</p>
        ${renderInfoBox(
          [
            ['Từ ngày', `<strong>${formatDate(fromDate)}</strong>`],
            ['Đến ngày', `<strong>${formatDate(toDate)}</strong>`],
            approvalNote ? ['Ghi chú', escapeHtml(approvalNote)] : null,
          ],
          '#16a34a'
        )}
        <p>Vui lòng kiểm tra hệ thống để xem thông tin chi tiết.</p>
      `,
    }),
  });

// 2. Gửi email thông báo đơn nghỉ bị từ chối
const sendLeaveRejectedEmail = ({ to, fullName, fromDate, toDate, rejectionReason }) =>
  sendHtmlMail({
    to,
    requireRecipient: true,
    subject: 'Đơn xin nghỉ của bạn đã bị từ chối',
    html: renderEmailLayout({
      title: 'THÔNG BÁO TỪ CHỐI ĐƠN XIN NGHỈ',
      headerBg: '#dc2626',
      signature: 'Hệ thống quản lý chấm công',
      bodyHtml: `
        <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Đơn xin nghỉ của bạn đã bị ${renderBadge('TỪ CHỐI', '#fee2e2', '#b91c1c')}.</p>
        ${renderInfoBox(
          [
            ['Từ ngày', `<strong>${formatDate(fromDate)}</strong>`],
            ['Đến ngày', `<strong>${formatDate(toDate)}</strong>`],
            ['Lý do từ chối', escapeHtml(rejectionReason)],
          ],
          '#dc2626'
        )}
        <p>Vui lòng đăng nhập hệ thống để xem thông tin chi tiết.</p>
      `,
    }),
  });

// 3. Gửi email cảnh báo vắng mặt không phép
const sendAbsentWarningEmail = ({ to, fullName, shiftName, date }) => {
  const dateStr = formatDate(date);
  return sendHtmlMail({
    to,
    subject: `[CẢNH BÁO] Ghi nhận vắng mặt ca dạy ngày ${dateStr} - Hệ Thống Chấm Công`,
    html: renderEmailLayout({
      title: 'CẢNH BÁO GHI NHẬN VẮNG MẶT',
      headerBg: '#d32f2f',
      footerText: 'Email tự động được gửi từ Hệ thống Quản lý Chấm công Trường Đại học. Vui lòng không trả lời trực tiếp email này.',
      bodyHtml: `
        <p>Kính gửi Thầy/Cô <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Hệ thống tự động ghi nhận Thầy/Cô đã <strong>VẮNG MẶT</strong> trong ca làm việc/giảng dạy:</p>
        ${renderInfoBox(
          [
            ['Ca / Tiết dạy', `<strong>${escapeHtml(shiftName || 'Không xác định')}</strong>`],
            ['Ngày ghi nhận', `<strong>${dateStr}</strong>`],
            ['Trạng thái', renderBadge('VẮNG MẶT (ABSENT)', '#fee2e2', '#d32f2f')],
          ],
          '#d32f2f'
        )}
        <p>Nếu có sự cố kỹ thuật hoặc lý do bất khả kháng, Thầy/Cô vui lòng tạo <strong>Đơn giải trình / Dạy bù</strong> trên cổng thông tin trong vòng 48 giờ.</p>
      `,
    }),
  });
};

// 4. Gửi email thông báo chấm công vào ca thành công
const sendCheckInNotificationEmail = ({
  to,
  fullName,
  shiftName,
  shiftHours,
  checkInTime,
  status,
  lateMinutes = 0,
  method = 'face_ai',
  subjectName,
  roomId,
}) => {
  const timeStr = formatVietnamTime(checkInTime);
  const dateStr = formatDate(checkInTime);
  const isLate = status === 'late' || lateMinutes > 0;
  const lateTimeFormatted = formatDurationMinutes(lateMinutes);
  const headerColor = isLate ? '#d97706' : '#16a34a';
  const subject = isLate
    ? `[CẢNH BÁO ĐI MUỘN] Check-in ca dạy ngày ${dateStr} (Đi muộn ${lateTimeFormatted}) - Hệ Thống Chấm Công`
    : `[XÁC NHẬN CHẤM CÔNG] Check-in Vào Ca Thành Công (${dateStr}) - Hệ Thống Chấm Công`;

  return sendHtmlMail({
    to,
    subject,
    logTag: 'CHECK-IN EMAIL',
    html: renderEmailLayout({
      title: 'XÁC NHẬN ĐIỂM DANH VÀO CA',
      subtitle: 'Hệ Thống Chấm Công Sinh Trắc Học & QR Code Đại Học',
      headerBg: headerColor,
      bodyHtml: `
        <p>Kính gửi Thầy/Cô <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Hệ thống đã ghi nhận lượt điểm danh <strong>Check-in (Vào ca)</strong> với thông tin:</p>
        ${renderInfoBox(
          [
            ['Ca làm việc', `<strong>${escapeHtml(shiftName || 'Không xác định')}</strong> ${shiftHours ? `(${escapeHtml(shiftHours)})` : ''}`],
            subjectName ? ['Môn học / Tiết dạy', `<strong>${escapeHtml(subjectName)}</strong> ${roomId ? `(Phòng ${escapeHtml(roomId)})` : ''}`] : null,
            ['Thời gian Check-in', `<strong>${timeStr} &bull; ${dateStr}</strong>`],
            ['Trạng thái', isLate ? renderBadge(`ĐI MUỘN (${lateTimeFormatted})`, '#fef3c7', '#b45309') : renderBadge('ĐÚNG GIỜ', '#dcfce7', '#15803d')],
            ['Phương thức', escapeHtml(formatAttendanceMethodText(method))],
          ],
          headerColor
        )}
        ${isLate
          ? `<div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #92400e;"><strong>Lưu ý:</strong> Thầy/Cô đã check-in muộn <strong>${lateTimeFormatted}</strong>. Nếu có lý do khách quan, vui lòng gửi Đơn giải trình trong vòng 48h.</div>`
          : `<p style="font-size: 13px; color: #15803d;">✓ Thầy/Cô đã có mặt đúng giờ theo quy định.</p>`}
      `,
    }),
  });
};

// 5. Gửi email thông báo tan ca thành công
const sendCheckOutNotificationEmail = ({
  to,
  fullName,
  shiftName,
  checkInTime,
  checkOutTime,
  durationFormatted,
  isEarlyLeave = false,
  earlyMinutes = 0,
  method = 'face_ai',
}) => {
  const checkInTimeStr = checkInTime ? formatVietnamTime(checkInTime) : '--:--:--';
  const checkOutTimeStr = formatVietnamTime(checkOutTime);
  const dateStr = formatDate(checkOutTime);
  const earlyTimeFormatted = formatDurationMinutes(earlyMinutes);
  const headerColor = isEarlyLeave ? '#f59e0b' : '#0284c7';
  const subject = isEarlyLeave
    ? `[CẢNH BÁO VỀ SỚM] Check-out ca dạy ngày ${dateStr} (Về sớm ${earlyTimeFormatted}) - Hệ Thống Chấm Công`
    : `[XÁC NHẬN CHẤM CÔNG] Check-out Hoàn Thành Ca Dạy (${dateStr}) - Hệ Thống Chấm Công`;

  return sendHtmlMail({
    to,
    subject,
    logTag: 'CHECK-OUT EMAIL',
    html: renderEmailLayout({
      title: 'XÁC NHẬN ĐIỂM DANH RA VỀ',
      subtitle: 'Hệ Thống Chấm Công Sinh Trắc Học & QR Code Đại Học',
      headerBg: headerColor,
      bodyHtml: `
        <p>Kính gửi Thầy/Cô <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Hệ thống đã ghi nhận lượt điểm danh <strong>Check-out (Ra về)</strong> với thông tin:</p>
        ${renderInfoBox(
          [
            ['Ca làm việc', `<strong>${escapeHtml(shiftName || 'Không xác định')}</strong>`],
            ['Thời gian Vào ca', checkInTimeStr],
            ['Thời gian Ra về', `<strong>${checkOutTimeStr} &bull; ${dateStr}</strong>`],
            ['Tổng thời gian', `<strong style="color: #0284c7;">${escapeHtml(durationFormatted || 'Chưa ghi nhận')}</strong>`],
            ['Trạng thái', isEarlyLeave ? renderBadge(`VỀ SỚM (${earlyTimeFormatted})`, '#fef3c7', '#b45309') : renderBadge('HOÀN THÀNH CA DẠY', '#e0f2fe', '#0369a1')],
            ['Phương thức', escapeHtml(formatAttendanceMethodText(method))],
          ],
          headerColor
        )}
        ${isEarlyLeave
          ? `<div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #92400e;"><strong>Lưu ý:</strong> Kết thúc sớm <strong>${earlyTimeFormatted}</strong> trước giờ tan ca quy định.</div>`
          : `<p style="font-size: 13px; color: #0284c7;">✓ Thầy/Cô đã hoàn thành trọn vẹn thời lượng ca làm việc.</p>`}
      `,
    }),
  });
};

// 6. Gửi email báo cáo tổng kết chấm công toàn trường cuối ngày cho quản trị viên
const sendDailyAttendanceSummaryEmail = ({
  to,
  dateStr,
  totalSchedules = 0,
  stats = { onTimeCount: 0, lateCount: 0, earlyCount: 0, excusedCount: 0, absentCount: 0 },
  absentList = [],
  lateList = [],
  earlyList = [],
  excusedList = [],
  presentList = [],
}) => {
  const totalAttended = (stats.onTimeCount || 0) + (stats.lateCount || 0) + (stats.earlyCount || 0);
  const attendanceRate = totalSchedules > 0
    ? Math.min(100, Math.round(((totalAttended + (stats.excusedCount || 0)) / totalSchedules) * 100))
    : 100;

  const statCards = [
    ['Tổng Ca Dạy', totalSchedules, '#f8fafc', '#e2e8f0', '#64748b', '#0f172a'],
    ['Đúng Giờ', stats.onTimeCount, '#ecfdf5', '#a7f3d0', '#047857', '#059669'],
    ['Đi Muộn', stats.lateCount, '#fffbeb', '#fde68a', '#b45309', '#d97706'],
    ['Về Sớm', stats.earlyCount, '#fff7ed', '#fed7aa', '#c2410c', '#ea580c'],
    ['Nghỉ Có Phép', stats.excusedCount, '#eff6ff', '#bfdbfe', '#1d4ed8', '#2563eb'],
    ['Vắng Không Phép', stats.absentCount, '#fef2f2', '#fecaca', '#b91c1c', '#dc2626'],
  ];

  const absentRows = absentList.map((i) => `<tr>
    <td style="padding: 8px; border: 1px solid #fecaca; font-weight: bold;">${escapeHtml(i.fullName)}</td>
    <td style="padding: 8px; border: 1px solid #fecaca;">${escapeHtml(i.shiftName)} ${i.roomId ? `(${escapeHtml(i.roomId)})` : ''}</td>
    <td style="padding: 8px; border: 1px solid #fecaca; color: #64748b;">${escapeHtml(i.departmentName || 'Khoa / Đơn vị')}</td>
    <td style="padding: 8px; border: 1px solid #fecaca; text-align: center; color: #dc2626; font-weight: bold;">${i.emailSent ? '✓ Đã gửi mail' : 'Chưa gửi'}</td>
  </tr>`).join('');

  const lateEarlyRows = [
    ...lateList.map((i) => `<tr>
      <td style="padding: 8px; border: 1px solid #fde68a; font-weight: bold;">${escapeHtml(i.fullName)}</td>
      <td style="padding: 8px; border: 1px solid #fde68a;">${escapeHtml(i.shiftName)}</td>
      <td style="padding: 8px; border: 1px solid #fde68a; color: #d97706; font-weight: bold;">Đi muộn ${escapeHtml(i.lateTimeFormatted || `${i.lateMinutes} phút`)} (Vào ${escapeHtml(i.checkInTimeStr)})</td>
      <td style="padding: 8px; border: 1px solid #fde68a; text-align: center;">${escapeHtml(i.method)}</td>
    </tr>`),
    ...earlyList.map((i) => `<tr>
      <td style="padding: 8px; border: 1px solid #fde68a; font-weight: bold;">${escapeHtml(i.fullName)}</td>
      <td style="padding: 8px; border: 1px solid #fde68a;">${escapeHtml(i.shiftName)}</td>
      <td style="padding: 8px; border: 1px solid #fde68a; color: #ea580c; font-weight: bold;">Về sớm ${escapeHtml(i.earlyTimeFormatted || `${i.earlyMinutes} phút`)} (Tan ${escapeHtml(i.checkOutTimeStr)})</td>
      <td style="padding: 8px; border: 1px solid #fde68a; text-align: center;">${escapeHtml(i.method)}</td>
    </tr>`),
  ].join('');

  const presentRows = presentList.map((i) => `<tr>
    <td style="padding: 8px; border: 1px solid #a7f3d0; font-weight: bold;">${escapeHtml(i.fullName)}</td>
    <td style="padding: 8px; border: 1px solid #a7f3d0;">${escapeHtml(i.shiftName)} ${i.roomId ? `(${escapeHtml(i.roomId)})` : ''}</td>
    <td style="padding: 8px; border: 1px solid #a7f3d0; text-align: center; color: #047857; font-weight: bold;">${escapeHtml(i.checkInTimeStr)}</td>
    <td style="padding: 8px; border: 1px solid #a7f3d0; text-align: center;">${escapeHtml(i.method)}</td>
  </tr>`).join('');

  const excusedRows = excusedList.map((i) => `<tr>
    <td style="padding: 8px; border: 1px solid #bfdbfe; font-weight: bold;">${escapeHtml(i.fullName)}</td>
    <td style="padding: 8px; border: 1px solid #bfdbfe;">${escapeHtml(i.shiftName)}</td>
    <td style="padding: 8px; border: 1px solid #bfdbfe; color: #2563eb;">Đơn nghỉ phép đã được phê duyệt</td>
  </tr>`).join('');

  return sendHtmlMail({
    to,
    subject: `[BÁO CÁO CUỐI NGÀY] Tổng Hợp Điểm Danh & Chuyên Cần Ngày ${dateStr} - Hệ Thống Chấm Công`,
    logTag: 'DAILY SUMMARY EMAIL',
    html: renderEmailLayout({
      title: 'TỔNG HỢP ĐIỂM DANH & CHUYÊN CẦN',
      badge: 'Báo Cáo Tự Động Cuối Ngày',
      subtitle: `Ngày: <strong>${escapeHtml(dateStr)}</strong> &bull; Tỷ lệ hợp lệ: <strong>${attendanceRate}%</strong>`,
      headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      maxWidth: 680,
      footerText: 'Báo cáo tự động tổng hợp lúc 23:59 hàng ngày từ Hệ thống Quản trị Chấm công Trường Đại học.',
      bodyHtml: `
        <p style="margin-top: 0;">Kính gửi <strong>Ban Giám Hiệu & Quản Trị Viên Hệ Thống</strong>,</p>
        <p>Thống kê điểm danh toàn trường ngày <strong>${escapeHtml(dateStr)}</strong>:</p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0;">
          ${statCards.map(([label, val, bg, bd, lc, vc]) => `
            <div style="background-color: ${bg}; border: 1px solid ${bd}; border-radius: 8px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: ${lc}; font-weight: bold; text-transform: uppercase;">${label}</div>
              <div style="font-size: 20px; font-weight: bold; color: ${vc}; margin-top: 2px;">${val}</div>
            </div>`).join('')}
        </div>
        ${renderSummarySectionTable({
          title: `1. Vắng Mặt Không Phép (${absentList.length})`,
          titleColor: '#b91c1c', borderBottom: '#fee2e2', headBg: '#fef2f2', headColor: '#991b1b', cellBorder: '#fecaca',
          headers: ['Nhân sự / Giảng viên', 'Ca dạy / Lịch', 'Khoa / Phòng', 'Cảnh Báo'],
          rowsHtml: absentRows,
          emptyText: '✓ Hôm nay không có nhân sự nào vắng mặt không phép!',
        })}
        ${renderSummarySectionTable({
          title: `2. Đi Muộn & Về Sớm (${lateList.length + earlyList.length})`,
          titleColor: '#d97706', borderBottom: '#fef3c7', headBg: '#fffbeb', headColor: '#92400e', cellBorder: '#fde68a',
          headers: ['Nhân sự', 'Ca làm việc', 'Chi tiết', 'Phương thức'],
          rowsHtml: lateEarlyRows,
          emptyText: '✓ Toàn bộ nhân sự có mặt đều check-in và check-out đúng giờ!',
        })}
        ${renderSummarySectionTable({
          title: `3. Đã Đến Làm Việc Đúng Giờ (${presentList.length})`,
          titleColor: '#059669', borderBottom: '#a7f3d0', headBg: '#ecfdf5', headColor: '#065f46', cellBorder: '#a7f3d0',
          headers: ['Nhân sự / Giảng viên', 'Ca làm việc', 'Giờ Check-in', 'Phương thức'],
          rowsHtml: presentRows,
          emptyText: 'Chưa có lượt check-in đúng giờ hôm nay.',
        })}
        ${excusedList.length > 0 ? renderSummarySectionTable({
          title: `4. Nghỉ Có Phép Hợp Lệ (${excusedList.length})`,
          titleColor: '#2563eb', borderBottom: '#dbeafe', headBg: '#eff6ff', headColor: '#1e40af', cellBorder: '#bfdbfe',
          headers: ['Nhân sự', 'Ca vắng', 'Trạng thái đơn'],
          rowsHtml: excusedRows,
          emptyText: '',
        }) : ''}
        <p style="font-size: 13px; color: #64748b;">Thầy/Cô có thể đăng nhập cổng quản trị để trích xuất báo cáo Excel tại phân hệ <strong>Báo Cáo & Thống Kê</strong>.</p>
      `,
    }),
  });
};

module.exports = {
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  sendAbsentWarningEmail,
  sendCheckInNotificationEmail,
  sendCheckOutNotificationEmail,
  sendDailyAttendanceSummaryEmail,
};
