import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Building2,
  GraduationCap,
  BookOpen,
  Crown,
  ChevronDown,
  Search,
  Check,
  X,
  Building,
  Layers,
} from 'lucide-react';

export interface DepartmentItem {
  _id: string;
  name: string;
  code?: string;
  type?: string;
  loai_don_vi?: string;
  parentId?: string | { _id: string; name: string } | null;
  [key: string]: any;
}

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

export const getDeptCategory = (d?: DepartmentItem | any): 'bgh' | 'khoa' | 'bomon' | 'phongban' => {
  if (!d) return 'khoa';
  const name = String(d.name || d.ten_phong_ban || '').toLowerCase().trim();
  const rawType = String(d.type || d.loai_don_vi || '').toLowerCase().trim();

  // 1. Ban Giám Hiệu
  if (rawType === 'bgh' || name.includes('giám hiệu') || name.includes('hội đồng trường')) {
    return 'bgh';
  }

  // 2. Ưu tiên loại đơn vị chuẩn từ CSDL
  if (rawType === 'khoa') return 'khoa';
  if (rawType === 'bomon') return 'bomon';
  if (rawType === 'phongban') return 'phongban';

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
    return 'phongban';
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
    return 'bomon';
  }

  // 5. Nhận diện Khoa (phải bắt đầu bằng "khoa " hoặc "khoa:", không dùng name.includes('khoa') tránh dính "khoa học công nghệ")
  if (name.startsWith('khoa ') || name.startsWith('khoa:')) {
    return 'khoa';
  }

  return 'phongban';
};

const getParentId = (d: DepartmentItem): string => {
  if (!d.parentId) return '';
  if (typeof d.parentId === 'object' && '_id' in d.parentId) {
    return String(d.parentId._id);
  }
  return String(d.parentId);
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Trạng thái mở rộng danh sách bộ môn của từng Khoa (Accordion)
  const [expandedKhoas, setExpandedKhoas] = useState<Record<string, boolean>>({});

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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
    return departments.find((d) => String(d._id) === String(value)) || null;
  }, [departments, value]);

  // Tự động mở rộng Khoa cha nếu đơn vị đang chọn là một Bộ môn con
  useEffect(() => {
    if (selectedDept && getDeptCategory(selectedDept) === 'bomon') {
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
    const r = (role || '').trim().toLowerCase();

    const allKhoa = departments.filter((d) => getDeptCategory(d) === 'khoa');
    const allBomon = departments.filter((d) => getDeptCategory(d) === 'bomon');
    const allPhong = departments.filter((d) => getDeptCategory(d) === 'phongban');
    const allBgh = departments.filter((d) => getDeptCategory(d) === 'bgh');

    const isNhanVien = r === 'nhanvien';
    const isGiangVien = r === 'giangvien';
    const isTruongKhoa = r === 'truongkhoa' || r === 'phokhoa';
    const isTruongBoMon = r === 'truongbomon';
    const isBGH = r === 'bgh';
    const isAdmin = r === 'admin';

    // 1. Nhóm Ban Giám Hiệu:
    // Hiển thị cho BGH, Admin (Quản trị viên toàn trường NTU) hoặc chưa chọn role
    const allowBgh = isBGH || isAdmin || r === '';
    const bghList = allowBgh
      ? allBgh.filter((d) => {
          if (q && !d.name.toLowerCase().includes(q)) return false;
          return true;
        })
      : [];

    // 2. Nhóm Các Khoa & Bộ Môn:
    // CHỈ hiển thị khi role là Giảng viên, Trưởng khoa, Phó khoa, Trưởng bộ môn hoặc chưa chọn role.
    // TUYỆT ĐỐI ẨN HOÀN TOÀN khi role là 'nhanvien' (Chuyên viên hành chính), 'bgh', 'admin'!
    const allowKhoaAndBomon = isGiangVien || isTruongKhoa || isTruongBoMon || r === '';

    const khoaGroups: Array<{
      khoa: DepartmentItem;
      canSelectKhoa: boolean;
      bomons: DepartmentItem[];
    }> = [];

    if (allowKhoaAndBomon) {
      allKhoa.forEach((khoa) => {
        const childBomons = allBomon.filter((bm) => getParentId(bm) === String(khoa._id));
        // Trưởng khoa / Phó khoa hoặc ở bộ lọc ngoài (r === '') được chọn Khoa.
        // Giảng viên & Trưởng bộ môn bắt buộc phải chọn Bộ môn trực thuộc Khoa (trừ khi Khoa chưa có bộ môn con).
        const canSelectKhoa = isTruongKhoa || r === '' || childBomons.length === 0;

        // Lọc theo tìm kiếm
        const khoaMatches = q ? khoa.name.toLowerCase().includes(q) : true;
        const matchingBomons = childBomons.filter((bm) => {
          // Trưởng khoa / Phó khoa không cần hiển thị bộ môn con
          if (isTruongKhoa) return false;
          if (q) {
            return bm.name.toLowerCase().includes(q) || khoa.name.toLowerCase().includes(q);
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
        allBomon.filter((bm) => getParentId(bm) === String(khoa._id)).map((bm) => String(bm._id))
      )
    );
    const unassignedBomons = (isGiangVien || isTruongBoMon || r === '')
      ? allBomon.filter((bm) => {
          if (assignedBomonIds.has(String(bm._id))) return false;
          if (q && !bm.name.toLowerCase().includes(q)) return false;
          return true;
        })
      : [];

    // 4. Nhóm Phòng Ban Chức Năng:
    // CHỈ hiển thị khi role là Chuyên viên hành chính ('nhanvien'), Admin ('admin') hoặc chưa chọn role.
    // TUYỆT ĐỐI ẨN khi role là Giảng viên, Trưởng khoa, Trưởng bộ môn, BGH!
    const allowPhong = isNhanVien || isAdmin || r === '';
    const phongList = allowPhong
      ? allPhong.filter((d) => {
          if (q && !d.name.toLowerCase().includes(q)) return false;
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
        onClick={() => setIsOpen(!isOpen)}
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
              <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} shrink-0`}>
                {selectedCategory === 'bgh' && '⭐'}
                {selectedCategory === 'khoa' && '🏛️'}
                {selectedCategory === 'bomon' && '📚'}
                {selectedCategory === 'phongban' && '🏢'}
              </span>
              <span className={`font-medium text-slate-900 dark:text-white truncate ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                {selectedDept.name}
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

      {/* Popover Dropdown Tree Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-80 min-w-full top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100">
          {/* Thanh tìm kiếm nhỏ gọn */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm Khoa, Bộ môn hoặc Phòng ban..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Danh sách phân cấp cuộn - Thoáng đãng, không bị cắt text */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
            {filteredTree.totalCount === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <Layers className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                Không tìm thấy đơn vị nào phù hợp
              </div>
            ) : (
              <>
                {/* 0. TÙY CHỌN: TẤT CẢ KHOA / ĐƠN VỊ */}
                {allowAll && (
                  <div className="pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                    <div
                      onClick={() => handleSelect('ALL')}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isAllSelected
                          ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 font-bold'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <Building2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                        <span className="leading-snug truncate font-semibold">
                          {allLabel || `Tất cả Khoa / Đơn vị (${departments.length})`}
                        </span>
                      </div>
                      {isAllSelected && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
                    </div>
                  </div>
                )}

                {/* 1. KHỐI BAN GIÁM HIỆU */}
                {filteredTree.bghList.length > 0 && (
                  <div className="space-y-1 pt-1 first:pt-0">
                    <div className="px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Crown className="w-3 h-3" />
                      Ban Giám Hiệu
                    </div>
                    {filteredTree.bghList.map((dept) => {
                      const isSelected = String(dept._id) === String(value);
                      return (
                        <div
                          key={dept._id}
                          onClick={() => handleSelect(dept._id)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                            <span className="text-sm shrink-0">⭐</span>
                            <span className="leading-snug">{dept.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. CÁC KHỐI KHOA ĐÀO TẠO & BỘ MÔN TRỰC THUỘC */}
                {filteredTree.khoaGroups.length > 0 && (
                  <div className="space-y-2 pt-1.5 first:pt-0">
                    <div className="px-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Khối Khoa & Bộ Môn
                    </div>

                    {filteredTree.khoaGroups.map(({ khoa, canSelectKhoa, bomons }) => {
                      const isKhoaSelected = String(khoa._id) === String(value);
                      const hasBomons = bomons.length > 0;
                      // Tự động mở nếu đang tìm kiếm hoặc nếu người dùng đã click mở
                      const isExpanded = searchQuery.trim().length > 0 || Boolean(expandedKhoas[khoa._id]);

                      return (
                        <div
                          key={khoa._id}
                          className="rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 p-1 space-y-0.5"
                        >
                          {/* Header Khoa - Chọn Khoa hoặc Mở rộng bộ môn */}
                          <div
                            className={`px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                              isKhoaSelected
                                ? 'bg-blue-100/80 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 font-bold'
                                : 'text-slate-900 dark:text-white font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40'
                            }`}
                          >
                            <div
                              onClick={() => {
                                if (canSelectKhoa) {
                                  handleSelect(khoa._id);
                                } else if (hasBomons) {
                                  setExpandedKhoas((prev) => ({ ...prev, [khoa._id]: !prev[khoa._id] }));
                                }
                              }}
                              className="flex items-center gap-2 min-w-0 flex-1 pr-2 cursor-pointer select-none"
                              title={canSelectKhoa ? `Chọn ${khoa.name}` : `Bấm để mở danh sách bộ môn trực thuộc`}
                            >
                              <span className="text-sm shrink-0">🏛️</span>
                              <span className="leading-snug truncate">{khoa.name}</span>
                              {hasBomons && (
                                <span className={`text-[10px] font-normal shrink-0 ${canSelectKhoa ? 'text-slate-400' : 'text-blue-500 font-medium'}`}>
                                  {canSelectKhoa ? `(${bomons.length})` : `(${bomons.length} bộ môn)`}
                                </span>
                              )}
                              {isKhoaSelected && (
                                <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              )}
                            </div>

                            {hasBomons && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedKhoas((prev) => ({ ...prev, [khoa._id]: !prev[khoa._id] }));
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors shrink-0 cursor-pointer"
                                title={isExpanded ? 'Thu gọn danh sách bộ môn' : 'Xem các bộ môn trực thuộc'}
                              >
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Danh sách Bộ Môn con khi Khoa được mở ra */}
                          {hasBomons && isExpanded && (
                            <div className="pl-3 pr-1 space-y-0.5 border-l-2 border-blue-300 dark:border-blue-700 ml-3.5 my-1">
                              {bomons.map((bm, idx) => {
                                const isBmSelected = String(bm._id) === String(value);
                                const isLast = idx === bomons.length - 1;
                                return (
                                  <div
                                    key={bm._id}
                                    onClick={() => handleSelect(bm._id)}
                                    className={`px-2 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                      isBmSelected
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-bold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                      <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] shrink-0 select-none">
                                        {isLast ? '└──' : '├──'}
                                      </span>
                                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      <span className="leading-snug">{bm.name}</span>
                                    </div>
                                    {isBmSelected && (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
                  <div className="space-y-0.5 pt-1.5 first:pt-0">
                    <div className="px-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Bộ Môn Khác
                    </div>
                    {filteredTree.unassignedBomons.map((bm) => {
                      const isSelected = String(bm._id) === String(value);
                      return (
                        <div
                          key={bm._id}
                          onClick={() => handleSelect(bm._id)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="leading-snug">{bm.name}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. KHỐI PHÒNG BAN CHỨC NĂNG */}
                {filteredTree.phongList.length > 0 && (
                  <div className="space-y-0.5 pt-1.5 first:pt-0">
                    <div className="px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3 h-3" />
                      Khối Ban Chức Năng NTU
                    </div>
                    {filteredTree.phongList.map((dept) => {
                      const isSelected = String(dept._id) === String(value);
                      return (
                        <div
                          key={dept._id}
                          onClick={() => handleSelect(dept._id)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                            <span className="text-sm shrink-0">🏢</span>
                            <span className="leading-snug">{dept.name}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
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
      )}
    </div>
  );
};
