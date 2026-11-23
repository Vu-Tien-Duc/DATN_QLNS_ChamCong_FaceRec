import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  GraduationCap,
  Crown,
  ChevronDown,
  Search,
  Check,
  X,
  Building,
  Layers,
} from 'lucide-react';
import { normalizeRoleKey } from '../../utils/phanQuyen';
import { DepartmentItem } from '../../types/phongBan.types';
import { Portal } from './CongDichChuyen';

export type { DepartmentItem };

export interface DepartmentSelectProps {
  departments: DepartmentItem[];
  value: string | null | undefined;
  onChange: (deptId: string) => void;
  role?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  allowAll?: boolean;
  allLabel?: string;
}

export const getDeptCategory = (d?: DepartmentItem | any): 'bgh' | 'khoa' | 'bo_mon' | 'phong_ban' => {
  if (!d) return 'khoa';
  const name = String(d.ten_phong_ban || '').toLowerCase().trim();
  const rawType = String(d.loai_don_vi || '').toLowerCase().trim();

  // 1. Ban Giám Hiệu
  if (rawType === 'bgh' || name.includes('giám hiệu') || name.includes('hội đồng trường')) {
    return 'bgh';
  }

  // 2. Ưu tiên loại đơn vị chuẩn từ CSDL
  if (rawType === 'khoa') return 'khoa';
  if (rawType === 'bo_mon') return 'bo_mon';
  if (rawType === 'phong_ban') return 'phong_ban';

  // 3. Nhận diện các đơn vị khối phòng ban, ban chức năng (tránh nhầm lẫn "Khoa học công nghệ")
  if (
    name.startsWith('ban ') ||
    name.startsWith('phòng ') ||
    name.startsWith('phong ') ||
    name.startsWith('trung tâm ') ||
    name.startsWith('trung tam ') ||
    name.startsWith('viện ') ||
    name.startsWith('vien ')
  ) {
    return 'phong_ban';
  }

  // 4. Nhận diện Bộ môn
  if (
    rawType.includes('môn') ||
    rawType.includes('mon') ||
    name.startsWith('bộ môn') ||
    name.startsWith('bo mon') ||
    name.includes('bộ môn ') ||
    name.includes('bo mon ')
  ) {
    return 'bo_mon';
  }

  // 5. Nhận diện Khoa (phải bắt đầu bằng "khoa " hoặc "khoa:", không dùng name.includes('khoa') tránh dính "khoa học công nghệ")
  if (name.startsWith('khoa ') || name.startsWith('khoa:')) {
    return 'khoa';
  }

  return 'phong_ban';
};

const getParentId = (d: DepartmentItem): string => {
  if (!d.don_vi_cha_id) return '';
  if (typeof d.don_vi_cha_id === 'object' && 'id' in d.don_vi_cha_id) {
    return String(d.don_vi_cha_id.id);
  }
  return String(d.don_vi_cha_id);
};

export const DepartmentSelect: React.FC<DepartmentSelectProps> = ({
  departments,
  value,
  onChange,
  role = '',
  disabled = false,
  required = false,
  placeholder = '-- Chọn đơn vị trực thuộc --',
  className = '',
  size = 'md',
  allowAll = false,
  allLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 320,
    placeAbove: false,
  });

  // Trạng thái mở rộng danh sách bộ môn của từng Khoa (Accordion)
  const [expandedKhoas, setExpandedKhoas] = useState<Record<string, boolean>>({});

  // Tính vị trí nổi cố định theo nút bấm (tối thiểu 320px để không cắt tên khoa/bộ môn dài)
  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 360 && rect.top > spaceBelow;
    const menuWidth = Math.min(window.innerWidth - 16, Math.max(rect.width, 320));
    const alignedLeft =
      rect.left + menuWidth > window.innerWidth - 8
        ? Math.max(8, rect.right - menuWidth)
        : Math.max(8, rect.left);
    setMenuPos({
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      left: alignedLeft,
      width: menuWidth,
      placeAbove,
    });
  }, []);

  // Đóng dropdown khi click ngoài và cập nhật vị trí khi cuộn/resize
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inMenu = dropdownRef.current?.contains(target);
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      updateMenuPosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', updateMenuPosition);
      window.addEventListener('scroll', updateMenuPosition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  // Focus ô tìm kiếm khi mở dropdown
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Tìm đơn vị hiện đang được chọn
  const selectedDept = useMemo(() => {
    if (!value) return null;
    return departments.find((d) => String(d.id) === String(value)) || null;
  }, [departments, value]);

  // Tự động mở rộng Khoa cha nếu đơn vị đang chọn là một Bộ môn con
  useEffect(() => {
    if (selectedDept && getDeptCategory(selectedDept) === 'bo_mon') {
      const parentId = getParentId(selectedDept);
      if (parentId) {
        setExpandedKhoas((prev) => ({ ...prev, [parentId]: true }));
      }
    }
  }, [selectedDept]);

  // Danh mục phân loại của đơn vị đang chọn
  const selectedCategory = selectedDept ? getDeptCategory(selectedDept) : null;

  // Lọc danh sách theo vai trò RBAC và từ khóa tìm kiếm
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const r = normalizeRoleKey(role);

    const allKhoa = departments.filter((d) => getDeptCategory(d) === 'khoa');
    const allBomon = departments.filter((d) => getDeptCategory(d) === 'bo_mon');
    const allPhong = departments.filter((d) => getDeptCategory(d) === 'phong_ban');
    const allBgh = departments.filter((d) => getDeptCategory(d) === 'bgh');

    const isNhanVien = [
      'nhan_vien',
      'tccb',
      'ke_toan',
      'dao_tao',
      'truong_phong',
      'pho_phong',
    ].includes(r);
    const isGiangVien = r === 'giang_vien';
    const isTruongKhoa = r === 'truong_khoa' || r === 'pho_khoa';
    const isTruongBoMon = r === 'truong_bo_mon' || r === 'pho_bo_mon';
    const isBGH = r === 'bgh';
    const isAdmin = r === 'admin';

    // 1. Nhóm Ban Giám Hiệu:
    // Hiển thị cho BGH, Admin (Quản trị viên toàn trường NTU) hoặc chưa chọn role
    const allowBgh = isBGH || isAdmin || r === '';
    const bghList = allowBgh
      ? allBgh.filter((d) => {
          if (q && !d.ten_phong_ban.toLowerCase().includes(q)) return false;
          return true;
        })
      : [];

    // 2. Nhóm Các Khoa & Bộ Môn:
    // CHỈ hiển thị khi role là Giảng viên, Trưởng khoa, Phó khoa, Trưởng bộ môn hoặc chưa chọn role.
    // TUYỆT ĐỐI ẨN HOÀN TOÀN khi role là 'nhan_vien' (Chuyên viên hành chính), 'bgh', 'admin'!
    const allowKhoaAndBomon = isGiangVien || isTruongKhoa || isTruongBoMon || r === '';

    const khoaGroups: Array<{
      khoa: DepartmentItem;
      canSelectKhoa: boolean;
      bomons: DepartmentItem[];
    }> = [];

    if (allowKhoaAndBomon) {
      allKhoa.forEach((khoa) => {
        const childBomons = allBomon.filter((bm) => getParentId(bm) === String(khoa.id));
        // Trưởng khoa / Phó khoa hoặc ở bộ lọc ngoài (r === '') được chọn Khoa.
        // Giảng viên & Trưởng bộ môn bắt buộc phải chọn Bộ môn trực thuộc Khoa (trừ khi Khoa chưa có bộ môn con).
        const canSelectKhoa = isTruongKhoa || r === '' || childBomons.length === 0;

        // Lọc theo tìm kiếm
        const khoaMatches = q ? khoa.ten_phong_ban.toLowerCase().includes(q) : true;
        const matchingBomons = childBomons.filter((bm) => {
          // Trưởng khoa / Phó khoa không cần hiển thị bộ môn con
          if (isTruongKhoa) return false;
          if (q) {
            return bm.ten_phong_ban.toLowerCase().includes(q) || khoa.ten_phong_ban.toLowerCase().includes(q);
          }
          return true;
        });

        const showKhoa = canSelectKhoa || matchingBomons.length > 0;
        if (showKhoa && (khoaMatches || matchingBomons.length > 0)) {
          khoaGroups.push({
            khoa,
            canSelectKhoa,
            bomons: matchingBomons,
          });
        }
      });
    }

    // 3. Nhóm Bộ môn chưa phân Khoa (nếu có):
    // Chỉ hiển thị cho Giảng viên / Trưởng bộ môn hoặc khi chưa chọn role
    const assignedBomonIds = new Set(
      allKhoa.flatMap((khoa) =>
        allBomon.filter((bm) => getParentId(bm) === String(khoa.id)).map((bm) => String(bm.id))
      )
    );
    const unassignedBomons = (isGiangVien || isTruongBoMon || r === '')
      ? allBomon.filter((bm) => {
          if (assignedBomonIds.has(String(bm.id))) return false;
          if (q && !bm.ten_phong_ban.toLowerCase().includes(q)) return false;
          return true;
        })
      : [];

    // 4. Nhóm Phòng Ban Chức Năng:
    // CHỈ hiển thị khi role là Chuyên viên hành chính ('nhan_vien'), Admin ('admin') hoặc chưa chọn role.
    // TUYỆT ĐỐI ẨN khi role là Giảng viên, Trưởng khoa, Trưởng bộ môn, BGH!
    const allowPhong = isNhanVien || isAdmin || r === '';
    const phongList = allowPhong
      ? allPhong.filter((d) => {
          if (q && !d.ten_phong_ban.toLowerCase().includes(q)) return false;
          return true;
        })
      : [];

    return {
      bghList,
      khoaGroups,
      unassignedBomons,
      phongList,
      totalCount:
        bghList.length +
        khoaGroups.reduce((acc, g) => acc + (g.canSelectKhoa ? 1 : 0) + g.bomons.length, 0) +
        unassignedBomons.length +
        phongList.length,
    };
  }, [departments, searchQuery, role]);

  const handleSelect = (deptId: string) => {
    onChange(deptId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const isAllSelected = allowAll && (!value || value === 'ALL');
  const paddingClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Nút bấm Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          setIsOpen(!isOpen);
        }}
        className={`w-full text-left ${paddingClass} rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80 cursor-not-allowed'
            : isOpen
              ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-slate-800'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isAllSelected ? (
            <>
              <Building2 className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-brand-600 dark:text-brand-400 shrink-0`} />
              <span className={`font-semibold text-slate-800 dark:text-slate-200 truncate ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                {allLabel || `Tất cả Khoa / Đơn vị (${departments.length})`}
              </span>
            </>
          ) : selectedDept ? (
            <>
              <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} shrink-0 text-slate-400 flex items-center`}>
                {selectedCategory === 'bgh' && <Crown className="w-3.5 h-3.5 text-purple-500" />}
                {selectedCategory === 'khoa' && <GraduationCap className="w-3.5 h-3.5 text-blue-500" />}
                {selectedCategory === 'bo_mon' && <Layers className="w-3.5 h-3.5 text-emerald-500" />}
                {selectedCategory === 'phong_ban' && <Building2 className="w-3.5 h-3.5 text-amber-500" />}
              </span>
              <span className={`font-medium text-slate-900 dark:text-white truncate ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                {selectedDept.ten_phong_ban}
              </span>
            </>
          ) : (
            <div className={`flex items-center gap-2 text-slate-400 dark:text-slate-500 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
              <Building2 className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0`} />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {!disabled && selectedDept && !required && !allowAll && (
            <span
              onClick={handleClear}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Xóa lựa chọn"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-600' : ''}`}
          />
        </div>
      </button>

      {/* Popover Dropdown Tree Menu (render qua Portal để không phá vỡ khung modal/form cha) */}
      {isOpen && (
        <Portal lockScroll={false}>
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              ...(menuPos.placeAbove
                ? { bottom: window.innerHeight - menuPos.top }
                : { top: menuPos.top }),
            }}
            className="z-[150] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden animate-in fade-in duration-100"
          >
          {/* Thanh tìm kiếm gọn gàng */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm Khoa, Bộ môn hoặc Phòng ban..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Danh sách phân cấp phẳng, sạch, không lồng khung & không dùng emoji */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-3 custom-scrollbar">
            {filteredTree.totalCount === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Layers className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                Không tìm thấy đơn vị nào phù hợp
              </div>
            ) : (
              <>
                {/* 0. TÙY CHỌN: TẤT CẢ ĐƠN VỊ */}
                {allowAll && (
                  <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div
                      onClick={() => handleSelect('ALL')}
                      className={`w-full px-2.5 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isAllSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <Building2 className={`w-3.5 h-3.5 shrink-0 ${isAllSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                        <span className="leading-snug truncate">
                          {allLabel || `Tất cả đơn vị (${departments.length})`}
                        </span>
                      </div>
                      {isAllSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </div>
                  </div>
                )}

                {/* 1. KHỐI BAN GIÁM HIỆU */}
                {filteredTree.bghList.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Ban Giám Hiệu
                    </div>
                    {filteredTree.bghList.map((dept) => {
                      const isSelected = String(dept.id) === String(value);
                      return (
                        <div
                          key={dept.id}
                          onClick={() => handleSelect(dept.id)}
                          className={`w-full px-2.5 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                            <Crown className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-purple-500/80'}`} />
                            <span className="leading-snug truncate">{dept.ten_phong_ban}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. KHỐI KHOA & BỘ MÔN */}
                {filteredTree.khoaGroups.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Khoa & Bộ môn
                    </div>

                    {filteredTree.khoaGroups.map(({ khoa, canSelectKhoa, bomons }) => {
                      const isKhoaSelected = String(khoa.id) === String(value);
                      const hasBomons = bomons.length > 0;
                      const isExpanded = searchQuery.trim().length > 0 || Boolean(expandedKhoas[khoa.id]);

                      return (
                        <div key={khoa.id} className="space-y-0.5">
                          <div
                            className={`px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              isKhoaSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <div
                              onClick={() => {
                                if (canSelectKhoa) {
                                  handleSelect(khoa.id);
                                } else if (hasBomons) {
                                  setExpandedKhoas((prev) => ({ ...prev, [khoa.id]: !prev[khoa.id] }));
                                }
                              }}
                              className="flex items-center gap-2.5 min-w-0 flex-1 pr-2 cursor-pointer select-none"
                              title={canSelectKhoa ? `Chọn ${khoa.ten_phong_ban}` : 'Bấm để mở danh sách bộ môn trực thuộc'}
                            >
                              <GraduationCap
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isKhoaSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500/80'
                                }`}
                              />
                              <span className="leading-snug truncate">{khoa.ten_phong_ban}</span>
                              {hasBomons && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                                  {bomons.length}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isKhoaSelected && (
                                <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              )}
                              {hasBomons && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedKhoas((prev) => ({ ...prev, [khoa.id]: !prev[khoa.id] }));
                                  }}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                                  title={isExpanded ? 'Thu gọn bộ môn' : 'Xem bộ môn trực thuộc'}
                                >
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Danh sách Bộ Môn con thụt lề mảnh gọn gàng */}
                          {hasBomons && isExpanded && (
                            <div className="ml-4 pl-2.5 border-l border-slate-200 dark:border-slate-700 space-y-0.5 py-0.5">
                              {bomons.map((bm) => {
                                const isBmSelected = String(bm.id) === String(value);
                                return (
                                  <div
                                    key={bm.id}
                                    onClick={() => handleSelect(bm.id)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                      isBmSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                      <Layers className={`w-3 h-3 shrink-0 ${isBmSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                      <span className="leading-snug truncate">{bm.ten_phong_ban}</span>
                                    </div>
                                    {isBmSelected && (
                                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. KHỐI BỘ MÔN CHƯA GẮN KHOA */}
                {filteredTree.unassignedBomons.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Bộ môn khác
                    </div>
                    {filteredTree.unassignedBomons.map((bm) => {
                      const isSelected = String(bm.id) === String(value);
                      return (
                        <div
                          key={bm.id}
                          onClick={() => handleSelect(bm.id)}
                          className={`w-full px-2.5 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                            <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                            <span className="leading-snug truncate">{bm.ten_phong_ban}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. KHỐI PHÒNG BAN CHỨC NĂNG */}
                {filteredTree.phongList.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Phòng ban chức năng
                    </div>
                    {filteredTree.phongList.map((dept) => {
                      const isSelected = String(dept.id) === String(value);
                      return (
                        <div
                          key={dept.id}
                          onClick={() => handleSelect(dept.id)}
                          className={`w-full px-2.5 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                            <Building className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                            <span className="leading-snug truncate">{dept.ten_phong_ban}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
};
