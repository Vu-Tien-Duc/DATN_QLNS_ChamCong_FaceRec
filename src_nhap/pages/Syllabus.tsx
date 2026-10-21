import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Save, Trash2, BookOpen, ArrowLeft,
  Columns, Loader2, ChevronRight, LayoutList,
  PlusSquare, Target, Clock, Zap, GripVertical,
  X, MoveHorizontal, Image as ImageIcon, Upload, Eye,
  Sparkles, Layers, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Syllabus() {
  const { user, hasRole, can } = useAuth();
  const isAdmin = hasRole('admin') || can('syllabus.manage');

  // --- States ---
  const [courses, setCourses] = useState<any[]>([]);
  const [syllabusesList, setSyllabusesList] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [currentSyllabus, setCurrentSyllabus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Cover Image & Extra Details State
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // --- CỘT ĐỘNG (Resizable Dynamic Columns) ---
  const [columnDefs, setColumnDefs] = useState<any[]>([
    { key: 'title', header: 'NỘI DUNG CHƯƠNG TRÌNH DẠY', type: 'text', width: 350 },
    { key: 'outcome', header: 'KẾT QUẢ ĐẠT ĐƯỢC (OUTCOME)', type: 'text', width: 250 },
    { key: 'hours', header: 'SỐ GIỜ', type: 'number', width: 100 },
    { key: 'type', header: 'LOẠI BÀI HỌC', type: 'text', width: 140 },
    { key: 'materials', header: 'TÀI LIỆU / LINK', type: 'text', width: 220 }
  ]);

  // Danh sách Hàng động (Rows)
  const [rows, setRows] = useState<any[]>([]);

  // Ref để xử lý resize
  const resizingColumn = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // 1. Tải danh sách khóa học & danh sách Syllabus
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resCourses, resSyllabuses] = await Promise.all([
        apiClient.get('/courses'),
        apiClient.get('/syllabuses').catch(() => ({ data: { data: [] } }))
      ]);

      if (resCourses.data.success) setCourses(resCourses.data.data);
      if (resSyllabuses.data?.data) setSyllabusesList(resSyllabuses.data.data);
    } catch (error) {
      toast.error("Lỗi tải danh sách chương trình đào tạo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. Tải Syllabus khi chọn Khóa học
  const handleSelectCourse = async (course: any) => {
    setLoading(true);
    setSelectedCourse(course);
    try {
      const res = await apiClient.get(`/syllabuses/course/${course._id}`); 
      if (res.data.success && res.data.data) {
        const data = res.data.data;
        setCurrentSyllabus(data);
        setCoverImage(data.coverImage || '');
        setDescription(data.description || '');
        setColumnDefs(data.columnDefs?.length ? data.columnDefs : columnDefs);
        const rowsWithId = (data.rows || []).map((r: any, idx: number) => ({
          ...r,
          dndId: r._id || `temp-${idx}-${Date.now()}`
        }));
        setRows(rowsWithId);
      } else {
        setCurrentSyllabus(null);
        setCoverImage('');
        setDescription('');
        setRows([
          { dndId: 'initial-row-1', level: 'module', cells: { title: 'MODULE 1: NỀN TẢNG CƠ BẢN' }, order: 1 },
          { dndId: 'initial-row-2', level: 'lesson', cells: { title: 'Buổi 1: Giới thiệu tổng quan và lộ trình', hours: 2, type: 'Lý thuyết' }, order: 2 }
        ]);
      }
    } catch (error) {
      toast.error("Lỗi khi tải nội dung Syllabus");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC KÉO GIÃN CỘT (COLUMN RESIZING) ---
  const startResizing = (e: React.MouseEvent, key: string, currentWidth: number) => {
    if (!isAdmin) return;
    e.preventDefault();
    resizingColumn.current = { key, startX: e.pageX, startWidth: currentWidth };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const { key, startX, startWidth } = resizingColumn.current;
    const deltaX = e.pageX - startX;
    const newWidth = Math.max(80, startWidth + deltaX);
    setColumnDefs((prev) => prev.map((col) => (col.key === key ? { ...col, width: newWidth } : col)));
  }, []);

  const stopResizing = useCallback(() => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  // --- LOGIC KÉO THẢ HÀNG (DRAG & DROP) ---
  const onDragEnd = (result: DropResult) => {
    if (!isAdmin || !result.destination) return;
    const items = Array.from(rows);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updatedItems = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    setRows(updatedItems);
  };

  // --- QUẢN LÝ CỘT & HÀNG ---
  const addColumn = () => {
    if (!isAdmin) return;
    const headerName = prompt("Nhập tiêu đề cột mới:");
    if (headerName) {
      const newKey = `col_${Date.now()}`;
      setColumnDefs([...columnDefs, { key: newKey, header: headerName.toUpperCase(), type: 'text', width: 200 }]);
    }
  };

  const deleteColumn = (key: string) => {
    if (!isAdmin) return;
    if (key === 'title') return toast.error("Cột tiêu đề là bắt buộc");
    if (window.confirm("Xóa cột này?")) {
      setColumnDefs(columnDefs.filter(c => c.key !== key));
    }
  };

  const addRow = (level: 'module' | 'lesson' | 'topic') => {
    if (!isAdmin) return;
    setRows([...rows, { dndId: `row-${Date.now()}`, level, cells: {}, order: rows.length + 1 }]);
  };

  const deleteRow = (index: number) => {
    if (!isAdmin) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const insertRow = (index: number, level: 'module' | 'lesson' | 'topic') => {
    if (!isAdmin) return;
    const newRows = [...rows];
    newRows.splice(index + 1, 0, { dndId: `row-${Date.now()}`, level, cells: {}, order: index + 2 });
    const updatedRows = newRows.map((r, i) => ({ ...r, order: i + 1 }));
    setRows(updatedRows);
    toast.success(`Đã chèn thêm ${level === 'module' ? 'Module' : level === 'lesson' ? 'Buổi học' : 'Nội dung'}`);
  };

  const updateCell = (rowIndex: number, key: string, value: any) => {
    if (!isAdmin) return;
    const updatedRows = [...rows];
    updatedRows[rowIndex].cells = { ...updatedRows[rowIndex].cells, [key]: value };
    setRows(updatedRows);
  };

  const updateRowImage = (rowIndex: number, imgUrl: string) => {
    if (!isAdmin) return;
    const updatedRows = [...rows];
    updatedRows[rowIndex].image = imgUrl;
    setRows(updatedRows);
  };

  const handleFileUpload = async (file: File, callback: (url: string) => void) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success && res.data.imageUrl) {
        toast.success("Đã tải ảnh lên hệ thống!");
        callback(res.data.imageUrl);
      }
    } catch (err) {
      toast.error("Không thể tải tệp ảnh lên");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin || !selectedCourse) return;
    setSaving(true);
    try {
      await apiClient.post('/syllabuses', {
        course: selectedCourse._id,
        coverImage,
        description,
        columnDefs,
        rows
      });
      toast.success("Đã lưu khung chương trình đào tạo thành công!");
      fetchData();
    } catch (error) {
      toast.error("Lỗi khi lưu dữ liệu Syllabus");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSyllabus = async () => {
    if (!isAdmin || !window.confirm("Xóa toàn bộ thiết kế Syllabus này?")) return;
    try {
      const res = await apiClient.delete(`/syllabuses/course/${selectedCourse._id}`);
      if (res.data.success) {
        toast.success("Đã xóa dữ liệu Syllabus");
        setSelectedCourse(null);
        fetchData();
      }
    } catch (e) { toast.error("Lỗi khi xóa"); }
  };

  // --- TRANG CHỌN KHÓA HỌC (VISUAL CARDS VIEW) ---
  if (!selectedCourse) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto pb-16 font-sans">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-widest mb-1">
              <Sparkles className="w-4 h-4" /> Thiết kế Chương trình Đào tạo (Syllabus Architecture)
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Khung Chương Trình Đào Tạo</h1>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Chọn khóa học để biên soạn lộ trình, thiết kế module bài giảng và đính kèm tài liệu minh họa.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => {
              const matchedSyllabus = syllabusesList.find(s => (s.course?._id || s.course) === course._id);
              const cardImage = matchedSyllabus?.coverImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60';

              return (
                <div
                  key={course._id}
                  onClick={() => handleSelectCourse(course)}
                  className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-400 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Cover Image Container */}
                    <div className="h-44 w-full relative overflow-hidden bg-slate-950">
                      <img
                        src={cardImage}
                        alt={course.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase px-3 py-1 rounded-full border border-white/20">
                        {course.courseCode || 'COURSE'}
                      </div>
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs font-bold">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-400" /> {course.totalSessions || 0} buổi học</span>
                        <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                          {matchedSyllabus ? 'Đã có Syllabus' : 'Chưa thiết kế'}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 space-y-2">
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                        {course.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium line-clamp-2">
                        {matchedSyllabus?.description || course.description || 'Chương trình đào tạo chuyên sâu tích hợp kỹ năng thực chiến.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 border-t border-slate-50 mt-4 flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      {isAdmin ? "Biên soạn Syllabus" : "Xem lộ trình"}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- TRANG BIÊN SOẠN BẢNG SYLLABUS ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Top Header Banner with Cover Image Upload */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-4">
        <div className="relative h-56 bg-slate-900 overflow-hidden">
          <img
            src={coverImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80'}
            alt="Syllabus Cover"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          {/* Action buttons on top of banner */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedCourse(null)}
              className="bg-slate-900/80 hover:bg-slate-900 text-white font-black px-4 py-2 rounded-2xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 text-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
            </button>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImageModalOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-4 py-2 rounded-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs shadow-lg"
                >
                  <Upload className="w-4 h-4" /> Đổi Ảnh Bìa Syllabus
                </button>

                {currentSyllabus && (
                  <button
                    onClick={handleDeleteSyllabus}
                    className="bg-rose-500/80 hover:bg-rose-600 text-white font-bold p-2 rounded-2xl backdrop-blur-md transition-all"
                    title="Xóa Syllabus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Banner Title & Info */}
          <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full">
                {selectedCourse.courseCode}
              </span>
              <span className="text-slate-300 text-xs font-bold">
                {selectedCourse.totalSessions || 0} buổi học thực tế
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">{selectedCourse.name}</h2>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-6 pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <>
                <button
                  onClick={() => addRow('module')}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-indigo-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm Module (Chương)
                </button>
                <button
                  onClick={() => addRow('lesson')}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm Buổi Học
                </button>
                <button
                  onClick={() => addRow('topic')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm Chủ Đề
                </button>
                <button
                  onClick={addColumn}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-amber-200"
                >
                  <Columns className="w-3.5 h-3.5" /> Thêm Cột Tùy Chỉnh
                </button>
              </>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu Khung Chương Trình
            </button>
          )}
        </div>
      </div>

      {/* DYNAMIC RESIZABLE & DRAGGABLE SYLLABUS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider select-none">
                {isAdmin && <th className="w-10 px-3 py-4 text-center">#</th>}
                {columnDefs.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: `${col.width}px` }}
                    className="relative px-4 py-4 border-r border-slate-800 group"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        disabled={!isAdmin}
                        type="text"
                        value={col.header}
                        onChange={(e) => updateColumnHeader(col.key, e.target.value)}
                        className="bg-transparent font-black text-white text-xs outline-none uppercase w-full cursor-pointer focus:bg-slate-800 px-1 py-0.5 rounded"
                      />
                      {isAdmin && col.key !== 'title' && (
                        <button
                          onClick={() => deleteColumn(col.key)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Column Resizer Handle */}
                    {isAdmin && (
                      <div
                        onMouseDown={(e) => startResizing(e, col.key, col.width)}
                        className="absolute right-0 top-0 bottom-0 w-2 hover:bg-indigo-500 cursor-col-resize z-10 transition-colors"
                      />
                    )}
                  </th>
                ))}
                {isAdmin && <th className="w-24 px-4 py-4 text-center">Thao tác</th>}
              </tr>
            </thead>

            <Droppable droppableId="syllabus-rows">
              {(provided) => (
                <tbody {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-100 text-xs">
                  {rows.map((row, index) => {
                    const isModule = row.level === 'module';
                    const isLesson = row.level === 'lesson';

                    return (
                      <Draggable key={row.dndId} draggableId={row.dndId} index={index} isDragDisabled={!isAdmin}>
                        {(providedDraggable) => (
                          <tr
                            ref={providedDraggable.innerRef}
                            {...providedDraggable.draggableProps}
                            className={`transition-colors ${
                              isModule
                                ? 'bg-gradient-to-r from-indigo-900 to-slate-900 text-white font-black'
                                : isLesson
                                ? 'bg-indigo-50/60 font-bold text-slate-900'
                                : 'hover:bg-slate-50/70 font-medium text-slate-700'
                            }`}
                          >
                            {isAdmin && (
                              <td className="px-3 py-3 text-center" {...providedDraggable.dragHandleProps}>
                                <GripVertical className="w-4 h-4 text-slate-400 mx-auto cursor-grab" />
                              </td>
                            )}

                            {columnDefs.map((col) => (
                              <td key={col.key} style={{ width: `${col.width}px` }} className="px-4 py-3 border-r border-slate-100">
                                {col.key === 'title' ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      disabled={!isAdmin}
                                      type="text"
                                      placeholder={isModule ? "MODULE 1: TÊN CHƯƠNG..." : isLesson ? "Buổi 1: Tiêu đề bài học..." : "Nhập chủ đề..."}
                                      value={row.cells?.title || ''}
                                      onChange={(e) => updateCell(index, 'title', e.target.value)}
                                      className={`w-full bg-transparent outline-none ${
                                        isModule ? 'font-black text-white text-sm' : isLesson ? 'font-extrabold text-slate-900' : 'text-slate-800'
                                      }`}
                                    />
                                  </div>
                                ) : (
                                  <input
                                    disabled={!isAdmin}
                                    type={col.type === 'number' ? 'number' : 'text'}
                                    placeholder="..."
                                    value={row.cells?.[col.key] || ''}
                                    onChange={(e) => updateCell(index, col.key, e.target.value)}
                                    className={`w-full bg-transparent outline-none ${isModule ? 'text-slate-200' : 'text-slate-700'}`}
                                  />
                                )}
                              </td>
                            ))}

                            {isAdmin && (
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => insertRow(index, 'lesson')}
                                    className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg"
                                    title="Chèn bài học mới"
                                  >
                                    <PlusSquare className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteRow(index)}
                                    className="p-1 text-rose-500 hover:bg-rose-100 rounded-lg"
                                    title="Xóa hàng"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>
        </DragDropContext>
      </div>

      {/* COVER IMAGE UPLOAD MODAL FOR ADMIN */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" /> Cập Nhật Ảnh Bìa Syllabus
              </h3>
              <button onClick={() => setIsImageModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Upload Option */}
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-2">Cách 1: Tải tệp ảnh từ máy tính</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0], (url) => {
                        setCoverImage(url);
                        setIsImageModalOpen(false);
                      });
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs outline-none"
                />
              </div>

              <div className="text-center text-xs font-bold text-slate-400 uppercase">Hoặc</div>

              {/* Direct URL Option */}
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-2">Cách 2: Nhập Link / URL Ảnh Minh Họa</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={imageUrlInput}
                  onChange={e => setImageUrlInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                />
              </div>

              {/* Preview */}
              {imageUrlInput && (
                <div className="h-36 rounded-2xl overflow-hidden border border-slate-200">
                  <img src={imageUrlInput} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 font-bold text-slate-600 rounded-2xl hover:bg-slate-200 text-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (imageUrlInput.trim()) {
                      setCoverImage(imageUrlInput.trim());
                      setIsImageModalOpen(false);
                      toast.success("Đã áp dụng link ảnh bìa mới!");
                    }
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-md text-xs uppercase"
                >
                  Xác nhận Ảnh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}