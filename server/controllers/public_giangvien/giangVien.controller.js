// Tra cứu danh bạ, hồ sơ tóm tắt và thống kê giảng viên cho cổng thông tin công khai
const giangVienCongKhaiService = require('../../services/nhanSu/giangVienCongKhai.service');

exports.getPublicFacultyList = async (req, res) => {
  try {
    const result = await giangVienCongKhaiService.getPublicFacultyList({
      search: req.query?.tim_kiem,
      phong_ban_id: req.query?.phong_ban_id || req.query?.don_vi_id,
      hoc_ham: req.query?.hoc_ham,
      hoc_vi: req.query?.hoc_vi,
      page: req.query?.trang,
      limit: req.query?.gioi_han,
    });
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Lỗi lấy danh bạ giảng viên public:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Không thể tải danh bạ giảng viên. Vui lòng thử lại sau.',
    });
  }
};

exports.getPublicFacultyById = async (req, res) => {
  try {
    const data = await giangVienCongKhaiService.getPublicFacultyById(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy chi tiết giảng viên public:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Không thể tải hồ sơ giảng viên.',
    });
  }
};

exports.getPublicFacultyStats = async (req, res) => {
  try {
    const data = await giangVienCongKhaiService.getPublicFacultyStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thống kê giảng viên public:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Không thể tải số liệu thống kê.',
    });
  }
};
