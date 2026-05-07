import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { migrateLocalData } from '../lib/migration';
import { useToast } from './ToastContext';

// Define the shape of our auth context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailAndPassword: (email: string, pass: string) => Promise<void>;
  createUserWithEmailAndPassword: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  // 1. Handle redirect result
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // Log successful redirect login if needed
          console.log("Logged in via Google redirect:", result.user.email);
          // Note: we don't strictly need to setUser here because onAuthStateChanged 
          // will also trigger and handle setting the user state.
        }
      } catch (error: any) {
        // Handle redirect errors (e.g. account exists with different credential)
        console.error('Redirect auth error:', error);
        showToast("Lỗi đăng nhập: " + error.message, "error");
      }
    };
    
    checkRedirectResult();
  }, [showToast]);

  // 2. Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Attempt migration when user logs in (if applicable)
      if (currentUser) {
        migrateLocalData(currentUser).catch(err => {
          console.error("Migration error:", err);
        });
      }
      
      // Mark loading as false once we have the initial auth state
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // 3. Auth functions
  const signInWithGoogle = async () => {
    const googleProvider = new GoogleAuthProvider();
    await signInWithRedirect(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmailAndPassword: loginWithEmail,
    createUserWithEmailAndPassword: registerWithEmail,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
