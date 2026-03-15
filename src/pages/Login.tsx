import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const navigate = useNavigate();

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      alert("Mật khẩu nhập lại không chính xác!");
      triggerShake();
      return;
    }

    setIsSubmitting(true);

    if (isLogin) {
      // Giả lập gọi API mất 1.5 giây
      setTimeout(() => {
        setIsSubmitting(false);
        alert("Chào mừng bạn trở lại với Cineverse!");
        navigate('/');
      }, 1500);
    } else {
      // Giả lập quá trình tạo tài khoản
      setTimeout(() => {
        setIsSubmitting(false);
        alert(`Chúc mừng ${username || email}, bạn đã gia nhập vũ trụ Cineverse!`);
        // Tự động chuyển về box đăng nhập sau khi đăng ký thành công
        setIsLogin(true);
        setPassword("");
        setConfirmPassword("");
      }, 2000);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 relative py-12">
      {/* Blurred Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/seed/cinema/1920/1080?blur=4" 
          alt="Background" 
          className="w-full h-full object-cover opacity-20"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
      </div>

      <div className={cn(
        "w-full max-w-md bg-[#121212]/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10 transition-all duration-300",
        shake ? "error-shake" : ""
      )}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">
            {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          <p className="text-[#A0A0A0]">
            {isLogin ? "Đăng nhập để tiếp tục hành trình điện ảnh" : "Tham gia Cineverse để trải nghiệm phim đỉnh cao"}
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-[#A0A0A0]" />
              </div>
              <input 
                type="text" 
                placeholder="Tên hiển thị" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
                className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
              />
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-[#A0A0A0]" />
            </div>
            <input 
              type="email" 
              placeholder="Email của bạn" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-[#A0A0A0]" />
            </div>
            <input 
              type="password" 
              placeholder="Mật khẩu" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
            />
          </div>

          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-[#A0A0A0]" />
              </div>
              <input 
                type="password" 
                placeholder="Nhập lại mật khẩu" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!isLogin}
                className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
              />
            </div>
          )}

          {isLogin && (
            <div className="flex justify-end">
              <a href="#" className="text-sm text-[#A0A0A0] hover:text-white transition-colors">Quên mật khẩu?</a>
            </div>
          )}

          <button 
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full bg-[#E50914] hover:bg-[#b80710] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(229,9,20,0.4)] hover:shadow-[0_6px_20px_rgba(229,9,20,0.6)] btn-primary",
              isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-0.5"
            )}
          >
            {isSubmitting ? "ĐANG XỬ LÝ..." : (
              <>
                {isLogin ? "Đăng Nhập" : "Đăng Ký"}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

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
            <button className="flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white py-3 rounded-full transition-colors border border-white/5">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 bg-[#2A2A2A] hover:bg-[#333] text-white py-3 rounded-full transition-colors border border-white/5">
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
    </div>
  );
}
