import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, ShieldCheck, RefreshCw, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useToast } from "@/contexts/ToastContext";
import { loginWithSocial, googleProvider, facebookProvider } from "@/lib/firebase";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  useDocumentTitle(isLogin ? "Đăng nhập | Cineverse" : "Đăng ký | Cineverse");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  // Form States
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Security States
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // 1. Tạo CAPTCHA ngẫu nhiên
  const generateCaptcha = useCallback(() => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setCaptchaCode(code);
  }, []);

  useEffect(() => {
    generateCaptcha();
    // Kiểm tra "Remember me"
    const saved = localStorage.getItem("remembered_user");
    if (saved) {
      try {
        const { email: savedEmail, pass } = JSON.parse(saved);
        if (savedEmail) setEmail(savedEmail);
        if (pass) setPassword(pass);
        setRememberMe(true);
      } catch (e) {
        console.error("Lỗi parse remembered_user", e);
      }
    }
  }, [generateCaptcha]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handleSocialLogin = async (providerName: 'google' | 'facebook') => {
    try {
      const provider = providerName === 'google' ? googleProvider : facebookProvider;
      const userData = await loginWithSocial(provider);
      showToast(`Chào mừng ${userData.name} quay trở lại!`, "success");
      navigate("/");
    } catch (error: any) {
      console.error("Lỗi đăng nhập:", error);
      if (error.code === 'auth/popup-closed-by-user') {
         showToast("Bạn đã đóng cửa sổ đăng nhập", "error");
      } else {
         showToast("Đăng nhập thất bại, vui lòng thử lại", "error");
      }
    }
  };

  // 2. Kiểm tra tính hợp lệ
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast("Email không đúng định dạng!", "error");
      return false;
    }
    if (password.length < 6) {
      showToast("Mật khẩu phải từ 6 ký tự!", "error");
      return false;
    }
    if (captchaInput.toUpperCase() !== captchaCode) {
      showToast("Mã xác nhận (CAPTCHA) không đúng!", "error");
      generateCaptcha();
      return false;
    }
    if (!isLogin && password !== confirmPassword) {
      showToast("Mật khẩu xác nhận không khớp!", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!validateForm()) {
      triggerShake();
      return;
    }

    setIsSubmitting(true);

    // Giả lập "Cơ sở dữ liệu" người dùng trên LocalStorage
    const usersDB = JSON.parse(localStorage.getItem("cineverse_users") || "[]");

    if (isLogin) {
      // LOGIC ĐĂNG NHẬP
      setTimeout(() => {
        const user = usersDB.find((u: any) => u.email === email && u.password === password);

        if (user) {
          // Thành công
          if (rememberMe) {
            localStorage.setItem("remembered_user", JSON.stringify({ email, pass: password }));
          } else {
            localStorage.removeItem("remembered_user");
          }

          localStorage.setItem("cineverse_settings", JSON.stringify(user));
          window.dispatchEvent(new Event("local-storage-update"));
          showToast("Đăng nhập thành công!", "success");
          navigate('/');
        } else {
          // Thất bại
          const newAttempts = loginAttempts + 1;
          setLoginAttempts(newAttempts);
          triggerShake();
          showToast(`Sai email hoặc mật khẩu! (${newAttempts}/5)`, "error");
          
          if (newAttempts >= 5) {
            setIsLocked(true);
            showToast("Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 30 giây.", "error");
            setTimeout(() => {
              setIsLocked(false);
              setLoginAttempts(0);
            }, 30000);
          }
          setIsSubmitting(false);
          generateCaptcha();
        }
      }, 1000);
    } else {
      // LOGIC ĐĂNG KÝ
      setTimeout(() => {
        const userExists = usersDB.some((u: any) => u.email === email);
        if (userExists) {
          showToast("Email này đã được đăng ký!", "error");
          setIsSubmitting(false);
          triggerShake();
          return;
        }

        const newUser = {
          name: username,
          email: email,
          password: password, // Trong thực tế phải mã hóa hash
          avatar: `https://ui-avatars.com/api/?name=${username}`,
          theme: "dark"
        };

        usersDB.push(newUser);
        localStorage.setItem("cineverse_users", JSON.stringify(usersDB));
        localStorage.setItem("cineverse_settings", JSON.stringify(newUser));
        window.dispatchEvent(new Event("local-storage-update"));

        showToast("Đăng ký tài khoản thành công!", "success");
        navigate('/');
      }, 1500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: "backOut" }}
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 relative pt-28 pb-12"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src="https://wallpapercave.com/wp/wp10615910.jpg" alt="Background" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-[#0A0A0A]/80" />
      </div>

      <div className={cn(
        "w-full max-w-md bg-[#000000]/70 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl relative z-10 mt-4",
        shake ? "animate-shake" : ""
      )}>
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mb-2">
            {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          {isLocked && <p className="text-red-500 font-bold animate-pulse text-xs md:text-sm">HỆ THỐNG ĐANG TẠM KHÓA</p>}
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Input Username (Chỉ khi Đăng ký) */}
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center"><User className="h-5 w-5 text-[#A0A0A0]" /></div>
              <input type="text" placeholder="Tên hiển thị" value={username} onChange={(e) => setUsername(e.target.value)} required={!isLogin} className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:border-[#E50914] outline-none transition-all" />
            </div>
          )}

          {/* Input Email */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center"><Mail className="h-5 w-5 text-[#A0A0A0]" /></div>
            <input type="email" placeholder="Email của bạn" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:border-[#E50914] outline-none transition-all" />
          </div>

          {/* Input Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center"><Lock className="h-5 w-5 text-[#A0A0A0]" /></div>
            <input type="password" placeholder="Mật khẩu (mẫu: 123456)" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:border-[#E50914] outline-none transition-all" />
          </div>

          {/* Xác nhận mật khẩu (Cực kỳ quan trọng) */}
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center"><ShieldCheck className="h-5 w-5 text-[#A0A0A0]" /></div>
              <input type="password" placeholder="Xác nhận mật khẩu" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:border-[#E50914] outline-none transition-all" />
            </div>
          )}

          {/* CAPTCHA TỰ CHẾ (Yêu cầu mới) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <input type="text" placeholder="Mã xác nhận" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} required className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl px-4 py-4 focus:border-[#E50914] outline-none" />
            </div>
            <div className="bg-[#2A2A2A] rounded-xl flex items-center justify-between px-4 select-none">
              <span className="text-xl font-bold tracking-widest text-[#E50914] italic line-through decoration-white/30">{captchaCode}</span>
              <button type="button" onClick={generateCaptcha} className="text-[#A0A0A0] hover:text-white"><RefreshCw className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Remember Me & Forgot Pass */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setRememberMe(!rememberMe)}>
              {rememberMe ? <CheckSquare className="w-5 h-5 text-[#E50914]" /> : <Square className="w-5 h-5 text-[#A0A0A0] group-hover:text-white" />}
              <span className="text-sm text-[#A0A0A0] group-hover:text-white">Ghi nhớ tôi</span>
            </div>
            {isLogin && <a href="#" className="text-sm text-[#A0A0A0] hover:text-white transition-colors">Quên mật khẩu?</a>}
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || isLocked}
            className={cn(
              "w-full bg-[#E50914] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg",
              (isSubmitting || isLocked) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            {isLocked ? "Đã bị khóa" : isSubmitting ? "Đang xử lý..." : isLogin ? "Đăng Nhập" : "Đăng Ký"}
            {!isSubmitting && !isLocked && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        {/* Social Login & Switch Mode (Giữ nguyên giao diện) */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#121212] text-[#A0A0A0]">Hoặc tiếp tục với</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white py-3 rounded-full transition-colors border border-white/5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button 
              type="button"
              onClick={() => handleSocialLogin('facebook')}
              className="flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white py-3 rounded-full transition-colors border border-white/5"
            >
              <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>
        </div>

        <p className="text-center text-[#A0A0A0] mt-8">
          {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setUsername("");
              setPassword("");
              setConfirmPassword("");
            }}
            className="text-white font-semibold hover:text-[#E50914] transition-colors"
          >
            {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </p>
      </div>
    </motion.div>
  );
}

