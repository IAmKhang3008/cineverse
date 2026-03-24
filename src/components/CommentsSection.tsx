import React, { useState, useEffect } from "react";
import { MessageSquare, Send, Lock, Trash2, Heart, Reply, Edit2, X } from "lucide-react";
import { cn, DEFAULT_USER_AVATAR } from "@/lib/utils";
import { Link } from "react-router-dom";
// Import các hàm từ Firebase
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";

interface Comment {
  id: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: any;
  userId: string;
  likes: string[]; // Lưu danh sách ID những người đã like
}

export default function CommentsSection({ movieId }: { movieId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // 1. LẤY THÔNG TIN USER ĐÃ ĐĂNG NHẬP
  useEffect(() => {
    const savedUser = localStorage.getItem("cineverse_settings");
    if (savedUser) setUserData(JSON.parse(savedUser));
  }, []);

  // 2. LẮNG NGHE BÌNH LUẬN REALTIME TỪ FIRESTORE
  useEffect(() => {
    if (!movieId) return;

    // Truy vấn: Lấy bình luận của phim này, sắp xếp mới nhất lên đầu
    const q = query(
      collection(db, "comments"),
      where("movieId", "==", movieId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData: Comment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "comments");
    });

    return () => unsubscribe();
  }, [movieId]);

  // 3. GỬI BÌNH LUẬN MỚI LÊN FIREBASE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userData || isSubmitting) return;

    const currentUserId = auth.currentUser?.uid || userData.id || userData.uid;
    if (!currentUserId) {
      alert("Vui lòng đăng nhập lại để bình luận!");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "comments"), {
        movieId,
        userId: currentUserId,
        userName: userData.name || "Thành viên",
        userAvatar: userData.avatar || DEFAULT_USER_AVATAR,
        content: newComment,
        likes: [],
        createdAt: serverTimestamp()
      });
      setNewComment("");
    } catch (error) {
      console.error("Lỗi khi đăng bình luận:", error);
      handleFirestoreError(error, OperationType.CREATE, "comments");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. XỬ LÝ LIKE / UNLIKE
  const handleLike = async (commentId: string, likes: string[]) => {
    const currentUserId = auth.currentUser?.uid || userData?.id || userData?.uid;
    if (!currentUserId) return alert("Vui lòng đăng nhập để thích bình luận!");
    
    const commentRef = doc(db, "comments", commentId);
    const isLiked = likes?.includes(currentUserId);

    try {
      await updateDoc(commentRef, {
        likes: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId)
      });
    } catch (error) {
      console.error("Lỗi khi like:", error);
      handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    }
  };

  // 5. XỬ LÝ XÓA BÌNH LUẬN
  const confirmDelete = async () => {
    if (!deletingCommentId) return;
    try {
      await deleteDoc(doc(db, "comments", deletingCommentId));
      setDeletingCommentId(null);
    } catch (error) {
      console.error("Lỗi khi xóa:", error);
      handleFirestoreError(error, OperationType.DELETE, `comments/${deletingCommentId}`);
    }
  };

  // 6. XỬ LÝ SỬA BÌNH LUẬN
  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const saveEdit = async () => {
    if (!editingCommentId || !editContent.trim()) return;
    try {
      await updateDoc(doc(db, "comments", editingCommentId), {
        content: editContent
      });
      setEditingCommentId(null);
      setEditContent("");
    } catch (error) {
      console.error("Lỗi khi sửa:", error);
      handleFirestoreError(error, OperationType.UPDATE, `comments/${editingCommentId}`);
    }
  };

  // Hàm format thời gian từ Firebase Timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Đang gửi...";
    const date = timestamp.toDate();
    return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="mt-12 mb-16 border-t border-white/10 pt-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-[#E50914]/10 rounded-xl text-[#E50914]">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Bình luận <span className="text-gray-500 font-normal text-lg ml-1">({comments.length})</span>
        </h2>
      </div>

      {/* FORM NHẬP BÌNH LUẬN - CHỈ HIỆN KHI ĐÃ ĐĂNG NHẬP */}
      <div className="bg-[#121212] rounded-2xl p-4 sm:p-6 border border-white/5 mb-10">
        {userData ? (
          <form onSubmit={handleSubmit} className="flex gap-4">
            <img src={userData.avatar || DEFAULT_USER_AVATAR} className="w-10 h-10 rounded-full shrink-0 border border-white/10 object-cover" />
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Chia sẻ cảm nghĩ của bạn..."
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 text-white text-[16px] outline-none focus:border-[#E50914]/50 min-h-[100px] resize-none transition-all"
              />
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="bg-[#E50914] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#b80710] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? "Đang gửi..." : <><Send className="w-4 h-4" /> Đăng</>}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="py-6 text-center">
            <p className="text-gray-400 text-sm mb-4">Đăng nhập để tham gia thảo luận cùng cộng đồng.</p>
            <Link to="/login" className="inline-block bg-white text-black px-8 py-2.5 rounded-full font-bold hover:bg-[#E50914] hover:text-white transition-all text-sm">
              Đăng nhập ngay
            </Link>
          </div>
        )}
      </div>

      {/* DANH SÁCH BÌNH LUẬN - AI CŨNG XEM ĐƯỢC */}
      <div className="space-y-6">
        {comments.length > 0 ? (
          comments.map((comment) => {
            const currentUserId = auth.currentUser?.uid || userData?.id || userData?.uid;
            const isLiked = comment.likes?.includes(currentUserId);
            const isOwner = currentUserId && (currentUserId === comment.userId);

            return (
              <div key={comment.id} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                <img src={comment.userAvatar} className="w-10 h-10 rounded-full shrink-0 object-cover" />
                <div className="flex-1 bg-[#1A1A1A]/50 rounded-2xl px-4 py-3 border border-transparent hover:border-white/5 transition-all relative">
                  
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{comment.userName}</span>
                    <span className="text-[10px] text-gray-500 uppercase">{formatTime(comment.createdAt)}</span>
                  </div>

                  {editingCommentId === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-[#121212] border border-white/20 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500 min-h-[80px] resize-none transition-all"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button 
                          onClick={() => setEditingCommentId(null)}
                          className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                        >
                          HỦY
                        </button>
                        <button 
                          onClick={saveEdit}
                          disabled={!editContent.trim() || editContent === comment.content}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          LƯU
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 leading-relaxed pr-6">{comment.content}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={() => handleLike(comment.id, comment.likes)}
                        className={cn(
                          "flex items-center gap-1.5 text-[11px] font-bold transition-colors",
                          isLiked ? "text-[#E50914]" : "text-gray-500 hover:text-white"
                        )}
                      >
                        <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-current")} />
                        {comment.likes?.length || 0} THÍCH
                      </button>
                      <button 
                        onClick={() => {
                          setNewComment(`@${comment.userName} `);
                          window.scrollTo({ top: document.querySelector('textarea')?.offsetTop ? document.querySelector('textarea')!.offsetTop - 200 : 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-white transition-colors"
                      >
                        <Reply className="w-3.5 h-3.5" /> PHẢN HỒI
                      </button>
                    </div>

                    {isOwner && editingCommentId !== comment.id && (
                      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(comment)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-blue-500 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> SỬA
                        </button>
                        <button 
                          onClick={() => setDeletingCommentId(comment.id)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> XÓA
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-gray-600 text-sm italic">Chưa có bình luận nào. Hãy chia sẻ cảm nghĩ của bạn!</p>
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN XÓA */}
      {deletingCommentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Xóa bình luận?</h3>
            <p className="text-gray-400 text-sm mb-6">Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setDeletingCommentId(null)}
                className="px-4 py-2 rounded-lg font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-[#E50914] hover:bg-[#b80710] text-white rounded-lg font-semibold transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
