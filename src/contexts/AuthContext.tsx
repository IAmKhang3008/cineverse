import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut,
  // Đổi tên khi import để tránh collision với method name trong context
  signInWithEmailAndPassword  as firebaseSignIn,
  createUserWithEmailAndPassword as firebaseRegister,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { migrateLocalData } from '../lib/migration';
import { useToast } from './ToastContext';

// ============================================================
// INTERFACE — tên method rõ ràng, không trùng với firebase import
// ============================================================
interface AuthContextType {
  user:         User | null;
  loading:      boolean;
  signInWithGoogle:   () => Promise<void>;
  loginWithEmail:     (email: string, pass: string) => Promise<boolean>;
  registerWithEmail:  (email: string, pass: string) => Promise<boolean>;
  logout:       () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast }         = useToast();

  // 1. Xử lý kết quả redirect từ Google (chạy sau khi redirect về)
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.info('[Auth] Đăng nhập Google redirect thành công:', result.user.email);
          // onAuthStateChanged bên dưới sẽ tự setUser, không cần làm gì thêm
        }
      } catch (error: any) {
        console.error('[Auth] Redirect error:', error);
        showToast('Lỗi đăng nhập Google: ' + (error?.message || 'Không xác định'), 'error');
      }
    };
    checkRedirectResult();
  }, [showToast]);

  // 2. Lắng nghe thay đổi trạng thái auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Migrate localStorage → Firestore khi user vừa đăng nhập
      if (currentUser) {
        migrateLocalData(currentUser).catch((err) => {
          console.warn('[Auth] Migration error (non-fatal):', err);
        });
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Đăng nhập Google qua redirect (mobile-safe hơn popup)
  const signInWithGoogle = async (): Promise<void> => {
    const googleProvider = new GoogleAuthProvider();
    await signInWithRedirect(auth, googleProvider);
  };

  // 4. Đăng nhập bằng email/password
  const loginWithEmail = async (email: string, pass: string): Promise<boolean> => {
    if (!email || !pass) {
      showToast('Vui lòng nhập đầy đủ thông tin.', 'error');
      return false;
    }
    try {
      await firebaseSignIn(auth, email, pass);
      return true;
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      const msg = getFriendlyAuthError(error.code);
      showToast(msg, 'error');
      return false;
    }
  };

  // 5. Đăng ký tài khoản mới
  const registerWithEmail = async (email: string, pass: string): Promise<boolean> => {
    if (!email || !pass) {
      showToast('Vui lòng nhập đầy đủ thông tin.', 'error');
      return false;
    }
    try {
      await firebaseRegister(auth, email, pass);
      return true;
    } catch (error: any) {
      console.error('[Auth] Register error:', error);
      const msg = getFriendlyAuthError(error.code);
      showToast(msg, 'error');
      return false;
    }
  };

  // 6. Đăng xuất
  const logout = async (): Promise<void> => {
    await signOut(auth);
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
  };

  // Không render children cho đến khi biết trạng thái auth
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth phải được dùng trong AuthProvider');
  }
  return context;
};

// ============================================================
// HELPER — map Firebase error code → thông báo tiếng Việt
// ============================================================
function getFriendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use':
      return 'Email này đã được sử dụng.';
    case 'auth/weak-password':
      return 'Mật khẩu phải có ít nhất 6 ký tự.';
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    case 'auth/too-many-requests':
      return 'Quá nhiều lần thử. Vui lòng thử lại sau.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng. Kiểm tra internet và thử lại.';
    default:
      return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }
}