import React, { useMemo } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderTree,
  GraduationCap,
  Briefcase,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { DepartmentItem } from '../../../../types';
import { DepartmentAggregateStats } from './phongBan.helpers';

interface CayCoCauToChucProps {
  faculties: DepartmentItem[];
  functionalDepts: DepartmentItem[];
  childrenByFacultyId: Record<string, DepartmentItem[]>;
  selectedNodeId: string;
  totalCampusStaff: number;
  treeSearch: string;
  expandedFacultyIds: Record<string, boolean>;
  isFacultiesFolderOpen: boolean;
  isFunctionalFolderOpen: boolean;
  loading: boolean;
  getAggregateStats: (dept: DepartmentItem) => DepartmentAggregateStats;
  onSelectNode: (nodeId: string) => void;
  onTreeSearchChange: (value: string) => void;
  onToggleFaculty: (facultyId: string) => void;
  onToggleFacultiesFolder: () => void;
  onToggleFunctionalFolder: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const CayCoCauToChuc: React.FC<CayCoCauToChucProps> = ({
  faculties,
  functionalDepts,
  childrenByFacultyId,
  selectedNodeId,
  totalCampusStaff,
  treeSearch,
  expandedFacultyIds,
  isFacultiesFolderOpen,
  isFunctionalFolderOpen,
  loading,
  getAggregateStats,
  onSelectNode,
  onTreeSearchChange,
  onToggleFaculty,
  onToggleFacultiesFolder,
  onToggleFunctionalFolder,
  onExpandAll,
  onCollapseAll,
}) => {
  const kw = treeSearch.toLowerCase().trim();

  const filteredFaculties = useMemo(() => {
    if (!kw) return faculties;
    return faculties.filter((f) => {
      if (f.ten_phong_ban.toLowerCase().includes(kw)) return true;
      return (childrenByFacultyId[f.id] || []).some((c) => c.ten_phong_ban.toLowerCase().includes(kw));
    });
  }, [faculties, childrenByFacultyId, kw]);

  const filteredFunctionalDepts = useMemo(() => {
    if (!kw) return functionalDepts;
    return functionalDepts.filter((pb) => pb.ten_phong_ban.toLowerCase().includes(kw));
  }, [functionalDepts, kw]);

  return (
    <div className="lg:col-span-4 lg:sticky lg:top-4 self-start">
      <div className="overflow-hidden">
        {/* Header cây */}
        <div className="px-4 py-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <FolderTree className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
              Cơ Cấu Tổ Chức
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] shrink-0">
            <button
              type="button"
              onClick={onExpandAll}
              className="px-2 py-1 rounded-md text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 font-semibold transition-colors cursor-pointer"
            >
              Mở hết
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={onCollapseAll}
              className="px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors cursor-pointer"
            >
              Thu gọn
            </button>
          </div>
        </div>

        {/* Ô tìm kiếm đơn vị */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={treeSearch}
              onChange={(e) => onTreeSearchChange(e.target.value)}
              placeholder="Tìm Khoa, Bộ môn, Phòng ban..."
              className="w-full pl-8 pr-7 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
            {treeSearch && (
              <button
                type="button"
                onClick={() => onTreeSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Nội dung cây */}
        <div className="p-2.5 space-y-1.5 max-h-[calc(100vh-270px)] overflow-y-auto">
          {/* Nút gốc Ban Giám Hiệu */}
          <button
            type="button"
            onClick={() => onSelectNode('ROOT_BGH')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
              selectedNodeId === 'ROOT_BGH'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Building2
                className={`w-4 h-4 shrink-0 ${
                  selectedNodeId === 'ROOT_BGH' ? 'text-white' : 'text-brand-600 dark:text-brand-400'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">Trường ĐH Nguyễn Trãi</div>
                <div
                  className={`text-[10px] truncate ${
                    selectedNodeId === 'ROOT_BGH' ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Tổng quan toàn trường
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                selectedNodeId === 'ROOT_BGH'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {totalCampusStaff} NS
            </span>
          </button>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">Đang tải cơ cấu tổ chức...</div>
          ) : (
            <>
              {/* Nhóm 1: Khối Khoa Đào Tạo */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onToggleFacultiesFolder}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    {isFacultiesFolderOpen || Boolean(kw) ? (
                      <FolderOpen className="w-3.5 h-3.5 text-brand-500" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-brand-500" />
                    )}
                    Khối Khoa Đào Tạo ({filteredFaculties.length})
                  </span>
                  {isFacultiesFolderOpen || Boolean(kw) ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {(isFacultiesFolderOpen || Boolean(kw)) && (
                  <div className="mt-1 space-y-1 pl-1">
                    {filteredFaculties.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-slate-400 italic">Không có Khoa phù hợp.</p>
                    ) : (
                      filteredFaculties.map((faculty) => {
                        const allChildren = childrenByFacultyId[faculty.id] || [];
                        const visibleChildren = kw
                          ? faculty.ten_phong_ban.toLowerCase().includes(kw)
                            ? allChildren
                            : allChildren.filter((c) => c.ten_phong_ban.toLowerCase().includes(kw))
                          : allChildren;
                        const isExpanded = Boolean(kw) || Boolean(expandedFacultyIds[faculty.id]);
                        const agg = getAggregateStats(faculty);
                        const isSelected = selectedNodeId === faculty.id;

                        return (
                          <div key={faculty.id} className="space-y-0.5">
                            <div
                              className={`flex items-center gap-1 px-1.5 py-1.5 rounded-xl transition-all ${
                                isSelected
                                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-800'
                                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => onToggleFaculty(faculty.id)}
                                disabled={allChildren.length === 0}
                                className="p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700/60 disabled:opacity-30 cursor-pointer shrink-0"
                                title={isExpanded ? 'Thu gọn bộ môn' : 'Mở rộng bộ môn'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectNode(faculty.id)}
                                className="flex-1 flex items-center justify-between gap-2 min-w-0 text-left py-0.5 pr-1 cursor-pointer"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <GraduationCap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                                  <span className="text-xs font-semibold truncate">{faculty.ten_phong_ban}</span>
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                  {agg.totalMembers}
                                </span>
                              </button>
                            </div>

                            {isExpanded && visibleChildren.length > 0 && (
                              <div className="ml-5 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                                {visibleChildren.map((bm) => {
                                  const bmSelected = selectedNodeId === bm.id;
                                  return (
                                    <button
                                      key={bm.id}
                                      type="button"
                                      onClick={() => onSelectNode(bm.id)}
                                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                                        bmSelected
                                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800'
                                          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5 min-w-0">
                                        <Layers className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="text-xs truncate">{bm.ten_phong_ban}</span>
                                      </span>
                                      <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0">
                                        {bm.so_luong_thanh_vien ?? 0}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Nhóm 2: Khối Phòng Ban Chức Năng */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onToggleFunctionalFolder}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    {isFunctionalFolderOpen || Boolean(kw) ? (
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    Khối Phòng Ban ({filteredFunctionalDepts.length})
                  </span>
                  {isFunctionalFolderOpen || Boolean(kw) ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {(isFunctionalFolderOpen || Boolean(kw)) && (
                  <div className="mt-1 space-y-1 pl-1">
                    {filteredFunctionalDepts.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-slate-400 italic">Không có Phòng ban phù hợp.</p>
                    ) : (
                      filteredFunctionalDepts.map((pb) => {
                        const isSelected = selectedNodeId === pb.id;
                        return (
                          <button
                            key={pb.id}
                            type="button"
                            onClick={() => onSelectNode(pb.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800'
                                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-xs font-semibold truncate">{pb.ten_phong_ban}</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                              {pb.so_luong_thanh_vien ?? 0}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
