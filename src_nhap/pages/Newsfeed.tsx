import React, { useState, useEffect, useCallback } from 'react';
import {
  Newspaper, Pin, Heart, MessageSquare, Send, Plus, Search, Filter,
  Share2, Shield, Building2, Users, User, Check, X, Paperclip,
  Megaphone, Award, FileText, Calendar, Sparkles, AlertCircle,
  ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  announcement: { label: 'Thông báo chung', icon: Megaphone, color: 'text-amber-500 bg-amber-50 border-amber-200', badge: 'bg-amber-500' },
  event: { label: 'Sự kiện nội bộ', icon: Calendar, color: 'text-indigo-500 bg-indigo-50 border-indigo-200', badge: 'bg-indigo-500' },
  policy: { label: 'Chính sách doanh nghiệp', icon: FileText, color: 'text-emerald-500 bg-emerald-50 border-emerald-200', badge: 'bg-emerald-500' },
  recognition: { label: 'Tuyên dương & Khen thưởng', icon: Award, color: 'text-rose-500 bg-rose-50 border-rose-200', badge: 'bg-rose-500' },
  general: { label: 'Tin tức khác', icon: Newspaper, color: 'text-blue-500 bg-blue-50 border-blue-200', badge: 'bg-blue-500' }
};

const DEPARTMENTS = [
  { id: 'sales', label: 'Kinh doanh' },
  { id: 'training', label: 'Đào tạo (Academic)' },
  { id: 'accounting', label: 'Kế toán / Tài chính' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operation', label: 'Vận hành / IT' }
];

export default function Newsfeed() {
  const { user, can } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1 thời điểm chỉ cho phép mở rộng 1 bản tin duy nhất để đọc
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'announcement',
    isPinned: false,
    targetType: 'all',
    targetDepartments: [] as string[],
    targetRoles: [] as string[],
    targetUsers: [] as string[],
    attachmentUrl: ''
  });

  // Comment Inputs state for each post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resPosts, resRoles, resUsers] = await Promise.all([
        apiClient.get(`/posts?category=${activeCategory}&search=${searchTerm}`),
        apiClient.get('/roles').catch(() => ({ data: { data: [] } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } }))
      ]);

      if (resPosts.data.success) {
        setPosts(resPosts.data.data);
      }
      if (resRoles.data?.data) {
        setRoles(resRoles.data.data);
      }
      if (resUsers.data?.data) {
        setUsersList(resUsers.data.data);
      }
    } catch (error) {
      console.error('Error fetching newsfeed:', error);
      toast.error("Lỗi khi tải bản tin doanh nghiệp");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) {
      return toast.error("Vui lòng nhập đầy đủ tiêu đề và nội dung tin tức");
    }

    try {
      setSubmitting(true);
      const payload = {
        ...newPost,
        attachments: newPost.attachmentUrl ? [newPost.attachmentUrl] : []
      };

      const res = await apiClient.post('/posts', payload);
      if (res.data.success) {
        toast.success("Đăng bản tin doanh nghiệp thành công!");
        setIsCreateModalOpen(false);
        setNewPost({
          title: '',
          content: '',
          category: 'announcement',
          isPinned: false,
          targetType: 'all',
          targetDepartments: [],
          targetRoles: [],
          targetUsers: [],
          attachmentUrl: ''
        });
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể đăng bản tin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await apiClient.post(`/posts/${postId}/like`);
      if (res.data.success) {
        setPosts(prev => prev.map(p => {
          if (p._id === postId) {
            const userId = user?._id || user?.id;
            const currentLikes = p.likes || [];
            const hasLiked = currentLikes.some((u: any) => (u._id || u).toString() === userId?.toString());
            const newLikes = hasLiked
              ? currentLikes.filter((u: any) => (u._id || u).toString() !== userId?.toString())
              : [...currentLikes, userId];
            return { ...p, likes: newLikes };
          }
          return p;
        }));
      }
    } catch (err) {
      toast.error("Lỗi tương tác bài viết");
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    try {
      const res = await apiClient.post(`/posts/${postId}/comments`, { content: text });
      if (res.data.success) {
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: res.data.data } : p));
        toast.success("Đã đăng bình luận");
      }
    } catch (err) {
      toast.error("Không thể đăng bình luận");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Xác nhận xóa bản tin này?")) return;
    try {
      const res = await apiClient.delete(`/posts/${postId}`);
      if (res.data.success) {
        toast.success("Đã xóa bản tin");
        if (expandedPostId === postId) setExpandedPostId(null);
        fetchData();
      }
    } catch (err) {
      toast.error("Không thể xóa bản tin");
    }
  };

  const toggleExpandPost = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null); // Thu gọn lại
    } else {
      setExpandedPostId(postId); // Mở rộng đúng 1 tin này, đóng tin cũ
    }
  };

  const pinnedPosts = posts.filter(p => p.isPinned);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4 animate-pulse" /> Truyền thông Nội bộ & Tin tức
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Bản Tin Doanh Nghiệp</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Cập nhật những hoạt động, thông báo chính thức và định hướng chiến lược của công ty.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="relative z-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2.5 shrink-0 hover:scale-105"
        >
          <Plus className="w-5 h-5 stroke-[3]" /> Đăng Bản Tin Mới
        </button>
      </header>

      {/* PINNED ANNOUNCEMENT BANNER */}
      {pinnedPosts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest px-1">
            <Pin className="w-4 h-4 fill-amber-500 text-amber-600" /> Thông báo Ghim Nổi Bật ({pinnedPosts.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedPosts.map(post => (
              <div key={post._id} className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="bg-amber-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider flex items-center gap-1">
                      <Pin className="w-3 h-3 fill-white" /> TIN NỔI BẬT
                    </span>
                    <span className="text-xs text-amber-700 font-bold">
                      {new Date(post.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2 leading-snug">{post.title}</h3>
                  <p className="text-slate-700 text-sm line-clamp-2 leading-relaxed whitespace-pre-line font-medium">{post.content}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-amber-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs">
                      {post.author?.fullName?.charAt(0) || 'A'}
                    </div>
                    <span className="text-xs font-extrabold text-slate-800">{post.author?.fullName}</span>
                  </div>
                  <button
                    onClick={() => {
                      setExpandedPostId(post._id);
                      setTimeout(() => {
                        const el = document.getElementById(`post-${post._id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="text-xs font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 bg-amber-500/20 px-3 py-1.5 rounded-xl transition-all"
                  >
                    Đọc bản tin này <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTER TABS & SEARCH */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
              activeCategory === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Tất cả bài viết ({posts.length})
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, item]) => {
            const Icon = item.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeCategory === key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm bản tin..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* POSTS LIST (ACCORDION SINGLE EXPANDED) */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3">
          <Newspaper className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-extrabold text-slate-800">Chưa có bản tin nào</h3>
          <p className="text-xs text-slate-400">Hãy là người đầu tiên tạo tin tức hoạt động cho doanh nghiệp!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => {
            const cat = CATEGORY_MAP[post.category] || CATEGORY_MAP.general;
            const CategoryIcon = cat.icon;
            const userId = user?._id || user?.id;
            const isLiked = (post.likes || []).some((u: any) => (u._id || u).toString() === userId?.toString());
            const commentsList = post.comments || [];
            const isExpanded = expandedPostId === post._id;

            return (
              <article
                id={`post-${post._id}`}
                key={post._id}
                className={`bg-white rounded-3xl shadow-sm border transition-all duration-300 ${
                  isExpanded ? 'border-indigo-400 shadow-xl ring-2 ring-indigo-500/10' : 'border-slate-200/80 hover:border-indigo-200'
                }`}
              >
                {/* Author Header */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black flex items-center justify-center text-base shadow-md shrink-0">
                      {post.author?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-sm leading-tight">{post.author?.fullName || 'Thành viên'}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${cat.color} flex items-center gap-1`}>
                          <CategoryIcon className="w-3 h-3" />
                          {cat.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {post.author?.email} · {new Date(post.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Target Audience Badge */}
                    <span className="hidden sm:flex text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 items-center gap-1">
                      {post.targetType === 'all' && <><Users className="w-3 h-3 text-emerald-500" /> Tất cả nhân sự</>}
                      {post.targetType === 'department' && <><Building2 className="w-3 h-3 text-indigo-500" /> Theo phòng ban ({post.targetDepartments?.length})</>}
                      {post.targetType === 'roles' && <><Shield className="w-3 h-3 text-amber-500" /> Theo vai trò ({post.targetRoles?.length})</>}
                      {post.targetType === 'users' && <><User className="w-3 h-3 text-purple-500" /> Chỉ định ({post.targetUsers?.length} người)</>}
                    </span>

                    {post.isPinned && (
                      <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Pin className="w-3 h-3 fill-white" /> Ghim
                      </span>
                    )}

                    {((user?._id || user?.id) === (post.author?._id || post.author) || can('admin')) && (
                      <button
                        onClick={() => handleDeletePost(post._id)}
                        className="text-slate-400 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-all"
                        title="Xóa bài"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* POST CONTENT BODY (COLLAPSED PREVIEW VS EXPANDED) */}
                <div className="px-6 pb-4 space-y-3">
                  <h3
                    onClick={() => toggleExpandPost(post._id)}
                    className="text-lg font-black text-slate-900 leading-snug cursor-pointer hover:text-indigo-600 transition-colors"
                  >
                    {post.title}
                  </h3>

                  {isExpanded ? (
                    /* EXPANDED CONTENT FULL */
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        {post.content}
                      </div>

                      {/* Attachments */}
                      {post.attachments && post.attachments.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-2">
                          {post.attachments.map((url: string, idx: number) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm"
                            >
                              <Paperclip className="w-4 h-4 text-indigo-600" /> Tệp đính kèm #{idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* COLLAPSED COMPACT PREVIEW (2 LINES MAX) */
                    <div
                      onClick={() => toggleExpandPost(post._id)}
                      className="text-slate-600 text-xs leading-relaxed font-medium line-clamp-2 cursor-pointer hover:text-slate-900"
                    >
                      {post.content}
                    </div>
                  )}
                </div>

                {/* BOTTOM FOOTER WITH SINGLE EXPAND/COLLAPSE ACTION */}
                <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleToggleLike(post._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        isLiked
                          ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{post.likes?.length || 0} Yêu thích</span>
                    </button>

                    <button
                      onClick={() => toggleExpandPost(post._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-100 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{commentsList.length} Bình luận</span>
                    </button>
                  </div>

                  {/* BUTTON XEM THÊM (READ MORE / COLLAPSE) */}
                  <button
                    onClick={() => toggleExpandPost(post._id)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm ${
                      isExpanded
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                    }`}
                  >
                    {isExpanded ? (
                      <>Thu gọn <ChevronUp className="w-4 h-4 stroke-[3]" /></>
                    ) : (
                      <>Xem thêm <ChevronDown className="w-4 h-4 stroke-[3]" /></>
                    )}
                  </button>
                </div>

                {/* COMMENTS THREAD (ONLY RENDERED WHEN EXPANDED) */}
                {isExpanded && (
                  <div className="bg-slate-50/80 p-6 border-t border-slate-200 space-y-4 animate-in fade-in duration-300">
                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600" /> Các bình luận ({commentsList.length})
                    </h4>

                    {/* Add Comment */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                        {user?.fullName?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          placeholder="Viết bình luận của bạn..."
                          value={commentInputs[post._id] || ''}
                          onChange={e => setCommentInputs({ ...commentInputs, [post._id]: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post._id); }}
                          className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                        />
                        <button
                          onClick={() => handleAddComment(post._id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-2xl transition-all shadow-md shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Comments Thread */}
                    <div className="space-y-3">
                      {commentsList.map((c: any, idx: number) => (
                        <div key={idx} className="flex gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {c.user?.fullName?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">{c.user?.fullName || 'Thành viên'}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                      ))}
                      {commentsList.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-2">Chưa có bình luận nào. Hãy gửi ý kiến của bạn!</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE POST MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-emerald-500" /> Tạo Bản Tin Doanh Nghiệp Mới
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1.5">Tiêu đề bản tin</label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Thông báo lịch nghỉ lễ Quốc Khánh..."
                  value={newPost.title}
                  onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1.5">Chuyên mục</label>
                  <select
                    value={newPost.category}
                    onChange={e => setNewPost({ ...newPost, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                  >
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newPost.isPinned}
                      onChange={e => setNewPost({ ...newPost, isPinned: e.target.checked })}
                      className="w-5 h-5 rounded-lg text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                      <Pin className="w-4 h-4 fill-amber-500" /> Ghim bài viết lên đầu trang
                    </span>
                  </label>
                </div>
              </div>

              {/* TARGET AUDIENCE SELECTION */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-black text-slate-700 uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> Đánh mục tiêu Đối tượng nhận tin (Audience Targeting)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: 'Tất cả nhân sự', icon: Users },
                    { id: 'department', label: 'Theo Phòng ban', icon: Building2 },
                    { id: 'roles', label: 'Theo Vai trò', icon: Shield },
                    { id: 'users', label: 'Cá nhân cụ thể', icon: User }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setNewPost({ ...newPost, targetType: item.id })}
                      className={`p-2.5 rounded-xl text-[11px] font-black transition-all border flex items-center justify-center gap-1.5 ${
                        newPost.targetType === item.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Sub-selectors */}
                {newPost.targetType === 'department' && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500">Chọn phòng ban nhận tin:</p>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENTS.map(dept => {
                        const isSelected = newPost.targetDepartments.includes(dept.id);
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? newPost.targetDepartments.filter(d => d !== dept.id)
                                : [...newPost.targetDepartments, dept.id];
                              setNewPost({ ...newPost, targetDepartments: updated });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isSelected ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {dept.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {newPost.targetType === 'roles' && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500">Chọn vai trò nhận tin:</p>
                    <div className="flex flex-wrap gap-2">
                      {roles.map(role => {
                        const isSelected = newPost.targetRoles.includes(role.name);
                        return (
                          <button
                            key={role._id}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? newPost.targetRoles.filter(r => r !== role.name)
                                : [...newPost.targetRoles, role.name];
                              setNewPost({ ...newPost, targetRoles: updated });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isSelected ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {role.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {newPost.targetType === 'users' && (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500">Chọn nhân sự chỉ định:</p>
                    <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-2 bg-white p-2 rounded-xl border border-slate-200">
                      {usersList.map(u => {
                        const isSelected = newPost.targetUsers.includes(u._id);
                        return (
                          <div
                            key={u._id}
                            onClick={() => {
                              const updated = isSelected
                                ? newPost.targetUsers.filter(id => id !== u._id)
                                : [...newPost.targetUsers, u._id];
                              setNewPost({ ...newPost, targetUsers: updated });
                            }}
                            className={`p-2 rounded-lg cursor-pointer text-xs font-bold flex items-center justify-between border ${
                              isSelected ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{u.fullName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1.5">Nội dung chi tiết</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Nhập nội dung chi tiết bài viết..."
                  value={newPost.content}
                  onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1.5">Link đính kèm / Tài liệu (nếu có)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={newPost.attachmentUrl}
                  onChange={e => setNewPost({ ...newPost, attachmentUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 font-bold text-slate-600 rounded-2xl hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-3.5 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {submitting ? "Đang xuất bản..." : "Xuất Bản Bản Tin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
