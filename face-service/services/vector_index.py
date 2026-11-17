"""
Bộ nhớ vector trong RAM siêu nhẹ (In-Memory Pure NumPy Vector Index)
Tìm kiếm Cosine Similarity trên hàng nghìn nhân sự với tốc độ < 1ms
"""
from typing import Any, Dict, List, Optional
import threading
import numpy as np


class MemoryVectorIndex:
    """
    Quản lý tập vector đặc trưng 512D ArcFace trong RAM bằng Pure NumPy.
    Tìm kiếm Cosine Similarity trên hàng nghìn nhân sự với tốc độ < 1ms,
    không cần nạp thư viện C++ FAISS nặng nề.
    """

    def __init__(self, dimension: int = 512):
        self.dimension = dimension
        self._lock = threading.RLock()
        self.reset()

    def reset(self):
        self.vectors_matrix: Optional[np.ndarray] = None  # Shape (N, 512) L2-normalized
        self.profiles: List[Dict[str, Any]] = []          # Metadata { userId, employee_id, full_name }
        self.user_to_indices: Dict[str, List[int]] = {}

    def size(self) -> int:
        with self._lock:
            return len(self.profiles)

    def users_count(self) -> int:
        with self._lock:
            return len(self.user_to_indices)

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "engine": "NumPy-Vectorized-RAM",
                "total_vectors": len(self.profiles),
                "total_users": len(self.user_to_indices),
                "dimension": self.dimension,
                "metric": "Cosine Similarity (Inner Product on L2-normalized)",
                "initialized": True,
            }

    def sync_templates(self, templates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Tái tạo toàn bộ chỉ mục vector từ danh sách template CSDL (Thread-safe)."""
        vectors = []
        profiles = []
        user_to_idx: Dict[str, List[int]] = {}

        if templates:
            for item in templates:
                u_id = str(item.get("userId") or item.get("employee_id") or item.get("employeeId") or "").strip()
                full_name = item.get("fullName") or item.get("full_name") or u_id
                emp_id = item.get("employeeId") or item.get("employee_id") or u_id
                emb = item.get("embedding")
                if not u_id or emb is None:
                    continue

                # Hỗ trợ cả 1 vector hoặc danh sách nhiều vector các góc
                items = emb if (isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], list)) else [emb]

                for sub_emb in items:
                    arr = np.asarray(sub_emb, dtype=np.float32)
                    if arr.ndim == 1 and arr.size == self.dimension and np.isfinite(arr).all():
                        norm = np.linalg.norm(arr)
                        if norm <= 1e-8:
                            continue
                        arr = arr / norm
                        idx = len(vectors)
                        vectors.append(arr)
                        profiles.append({
                            "userId": u_id,
                            "employee_id": emp_id,
                            "full_name": full_name,
                        })
                        if u_id not in user_to_idx:
                            user_to_idx[u_id] = []
                        user_to_idx[u_id].append(idx)

        new_matrix = np.vstack(vectors).astype(np.float32) if vectors else None

        with self._lock:
            self.vectors_matrix = new_matrix
            self.profiles = profiles
            self.user_to_indices = user_to_idx
            return self.stats()

    def add_user_template(
        self,
        user_id: str,
        embedding: Any,
        full_name: Optional[str] = None,
        employee_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Thêm hoặc cập nhật vector của một nhân viên vào RAM (Thread-safe)."""
        u_id = str(user_id).strip()
        if not u_id:
            raise ValueError("userId không được để trống.")

        items = embedding if (isinstance(embedding, list) and len(embedding) > 0 and isinstance(embedding[0], list)) else [embedding]
        new_vecs = []
        for item in items:
            arr = np.asarray(item, dtype=np.float32)
            if arr.ndim == 1 and arr.size == self.dimension and np.isfinite(arr).all():
                norm = np.linalg.norm(arr)
                if norm <= 1e-8:
                    continue
                arr = arr / norm
                new_vecs.append(arr)

        if not new_vecs:
            return self.stats()

        with self._lock:
            if u_id in self.user_to_indices:
                self.remove_user(u_id)

            if u_id not in self.user_to_indices:
                self.user_to_indices[u_id] = []

            for vec in new_vecs:
                idx = len(self.profiles)
                self.profiles.append({
                    "userId": u_id,
                    "employee_id": employee_id or u_id,
                    "full_name": full_name or u_id,
                })
                self.user_to_indices[u_id].append(idx)

            new_block = np.vstack([v.reshape(1, -1) for v in new_vecs]).astype(np.float32)
            if self.vectors_matrix is None or len(self.vectors_matrix) == 0:
                self.vectors_matrix = new_block
            else:
                self.vectors_matrix = np.vstack([self.vectors_matrix, new_block])

            return self.stats()

    def remove_user(self, user_id: str) -> Dict[str, Any]:
        """Gỡ bỏ vector của một nhân viên khỏi RAM (Thread-safe)."""
        u_id = str(user_id).strip()
        with self._lock:
            if u_id not in self.user_to_indices or self.vectors_matrix is None:
                return self.stats()

            keep_indices = [i for i, prof in enumerate(self.profiles) if prof["userId"] != u_id]
            if not keep_indices:
                self.reset()
                return self.stats()

            self.vectors_matrix = self.vectors_matrix[keep_indices]
            self.profiles = [self.profiles[i] for i in keep_indices]
            self.user_to_indices = {}
            for idx, prof in enumerate(self.profiles):
                uid = prof["userId"]
                if uid not in self.user_to_indices:
                    self.user_to_indices[uid] = []
                self.user_to_indices[uid].append(idx)

            return self.stats()

    def search(self, query_vec: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Tìm kiếm K ứng viên (người dùng duy nhất) tương đồng nhất trong RAM bằng Cosine Similarity.
        Lọc trùng userId trước khi cắt top_k để đảm bảo Margin Top 1 - Top 2 luôn có đủ >= 2 người khác nhau.
        """
        with self._lock:
            if self.vectors_matrix is None or len(self.profiles) == 0:
                return []

            q = np.asarray(query_vec, dtype=np.float32).flatten()
            norm = np.linalg.norm(q)
            if norm > 0:
                q = q / norm

            # Ma trận chấm vector: (N, 512) x (512,) -> (N,)
            scores = np.dot(self.vectors_matrix, q)
            sorted_indices = np.argsort(scores)[::-1]

            candidates = []
            seen_users = set()
            for idx in sorted_indices:
                score = float(scores[idx])
                prof = self.profiles[idx]
                uid = prof["userId"]
                if uid in seen_users:
                    continue
                seen_users.add(uid)
                candidates.append({
                    "userId": uid,
                    "employee_id": prof["employee_id"],
                    "full_name": prof["full_name"],
                    "similarity": round(score, 4),
                })
                if len(candidates) >= top_k:
                    break

            return candidates

    def verify_user(self, target_id: str, query_vec: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Đối chiếu 1:1 trực tiếp với toàn bộ vector mẫu của một nhân viên (khớp userId hoặc employee_id).
        Tránh bỏ sót khi ứng viên nằm ngoài top-K tìm kiếm toàn cục.
        """
        target = str(target_id or "").strip()
        if not target:
            return None

        with self._lock:
            if self.vectors_matrix is None or len(self.profiles) == 0:
                return None

            matching_indices = [
                i
                for i, prof in enumerate(self.profiles)
                if prof.get("userId") == target or prof.get("employee_id") == target
            ]
            if not matching_indices:
                return None

            q = np.asarray(query_vec, dtype=np.float32).flatten()
            norm = np.linalg.norm(q)
            if norm <= 1e-8 or q.size != self.dimension:
                return None
            q = q / norm

            sub_matrix = self.vectors_matrix[matching_indices]
            scores = np.dot(sub_matrix, q)
            best_pos = int(np.argmax(scores))
            best_idx = matching_indices[best_pos]
            prof = self.profiles[best_idx]
            return {
                "userId": prof["userId"],
                "employee_id": prof["employee_id"],
                "full_name": prof["full_name"],
                "similarity": round(float(scores[best_pos]), 4),
            }


# Singleton vector store trong RAM
vector_index = MemoryVectorIndex(dimension=512)
