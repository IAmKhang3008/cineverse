import { useState, useEffect } from "react";
import { User, Shield, Moon, Bell, Save, ChevronRight, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/contexts/ToastContext";
import { useTheme } from "@/contexts/ThemeContext";

const DEFAULT_SETTINGS = {
  email: "user@example.com",
  name: "Người dùng",
  theme: "dark",
  emailNotifications: true,
  pushNotifications: false,
  twoFactor: false
};

// =============================================
// VALIDATION
// =============================================

// Chỉ cho phép chữ cái (kể cả tiếng Việt), số, khoảng trắng, _ và :
const VALID_NAME_REGEX = /^[a-zA-Z0-9 _:àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ]+$/;

// Danh sách từ nhạy cảm (normalized về lowercase để so sánh)
const BANNED_PATTERNS = [
  // Tiếng Anh
  /f+u+c+k+/i, /s+h+i+t+/i, /b+i+t+c+h+/i, /a+s+s+h+o+l+e+/i,
  /c+u+n+t+/i, /d+i+c+k+/i, /c+o+c+k+/i, /p+u+s+s+y+/i,
  /n+i+g+g+/i, /f+a+g+/i, /w+h+o+r+e+/i, /s+l+u+t+/i,
  /b+a+s+t+a+r+d+/i, /m+o+t+h+e+r+f+/i, /r+e+t+a+r+d+/i,
  // Tiếng Việt phổ biến (dạng regex để bắt cả biến thể)
  /đ+ụ+/i, /đ+m+/i, /đ+é+o+/i, /đ+ê+o+/i, /c+ặ+c+/i,
  /l+ồ+n+/i, /l+o+n+/i, /v+ã+i+/i, /c+h+ó+/i, /c+h+o+/i,
  /m+ẹ+/i, /b+ố+/i, /đ+i+ê+n+/i, /n+g+u+/i, /ó+c+\s*c+h+ó+/i,
  /b+ú+/i, /c+ú+t+/i, /đ+ầ+u+\s*b+ú+/i, /k+h+ố+n+/i,
  /c+h+ế+t+/i, /m+a+y+\s*d+â+m+/i, /d+i+\s*m+ẹ+/i,
  /d+ú+/i, /b+ò+n+/i, /t+h+ằ+n+g+/i, /đ+ĩ+/i,
];

function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) return "Tên hiển thị không được để trống.";
  if (trimmed.length < 2) return "Tên hiển thị phải có ít nhất 2 ký tự.";
  if (trimmed.length > 32) return "Tên hiển thị không được vượt quá 32 ký tự.";

  if (!VALID_NAME_REGEX.test(trimmed))
    return "Tên chỉ được chứa chữ cái, số, dấu cách, dấu gạch dưới (_) và dấu hai chấm (:).";

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(trimmed))
      return "Tên hiển thị chứa từ ngữ không phù hợp. Vui lòng chọn tên khác.";
  }

  return null;
}

function validateEmail(email: string): string | null {
  const trimmed = email.trim();

  if (!trimmed) return "Email không được để trống.";

  // Kiểm tra có @ không
  if (!trimmed.includes("@"))
    return "Email thiếu ký tự @. Ví dụ: ten@gmail.com";

  const [local, domain] = trimmed.split("@");

  // Phần trước @ không được rỗng
  if (!local || local.length === 0)
    return "Email thiếu tên người dùng trước @. Ví dụ: ten@gmail.com";

  // Phần domain phải có dấu chấm
  if (!domain || !domain.includes("."))
    return "Email thiếu tên miền. Ví dụ: ten@gmail.com";

  const domainParts = domain.split(".");
  // Phần sau dấu chấm cuối phải có ít nhất 2 ký tự
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2)
    return "Phần đuôi email không hợp lệ. Ví dụ: .com, .vn, .net";

  // Regex tổng thể
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!EMAIL_REGEX.test(trimmed))
    return "Địa chỉ email không hợp lệ. Ví dụ: ten@gmail.com";

  return null;
}

export default function Settings() {
  useDocumentTitle("Cài đặt | Cineverse");
  
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'appearance' | 'notifications'>('account');
  const [isSaving, setIsSaving] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  // 1. Khởi tạo state từ LocalStorage để dữ liệu không bị mất khi F5
  const [settings, setSettings] = useState(() => {
    const savedData = localStorage.getItem("cineverse_settings");
    return savedData ? JSON.parse(savedData) : DEFAULT_SETTINGS;
  });

  // 2. Hàm lưu dữ liệu "thật"
  const handleSave = () => {
    // Validate tên
    const nameErr = validateDisplayName(settings.name);
    if (nameErr) {
      setNameError(nameErr);
      showToast("⚠️ " + nameErr, "error");
      setActiveTab("account"); // Chuyển về tab tài khoản
      return;
    }
    setNameError(null);

    // Validate email
    const emailErr = validateEmail(settings.email);
    if (emailErr) {
      setEmailError(emailErr);
      showToast("⚠️ " + emailErr, "error");
      setActiveTab("account");
      return;
    }
    setEmailError(null);

    // Lưu bình thường
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem("cineverse_settings", JSON.stringify(settings));
      document.documentElement.setAttribute("data-theme", settings.theme);
      setIsSaving(false);
      window.dispatchEvent(new Event("local-storage-update"));
      showToast("✅ Cài đặt đã được lưu!", "success");
    }, 1000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("cineverse_settings");
    if (theme !== 'dark') toggleTheme();
    setShowResetDialog(false);
    showToast("🔄 Đã khôi phục cài đặt mặc định!", "success");
  };

  return (
    <div className="max-w-[1024px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16 text-white">
      {/* Tiêu đề với vạch trang trí chuẩn UI mô tả */}
      <h1 className="text-2xl md:text-3xl font-bold tracking-wider mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
        <span className="w-1.5 h-6 md:h-8 bg-[#3B82F6] rounded-full inline-block"></span>
        Cài Đặt
      </h1>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-2 md:p-4 flex flex-row md:flex-col gap-2 shadow-2xl overflow-x-auto no-scrollbar">
            {[
              { id: 'account', label: 'Tài Khoản', icon: User },
              { id: 'security', label: 'Bảo Mật', icon: Shield },
              { id: 'appearance', label: 'Giao Diện', icon: Moon },
              { id: 'notifications', label: 'Thông Báo', icon: Bell },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-medium transition-all duration-300 whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-[#E50914] text-white shadow-lg' 
                  : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="text-sm md:text-base">{tab.label}</span>
                </div>
                {activeTab === tab.id && <ChevronRight className="w-4 h-4 hidden md:block" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow bg-[#121212] rounded-3xl border border-white/5 p-6 md:p-8 shadow-2xl relative overflow-hidden min-h-[400px] md:min-h-[500px]">
          <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-[#E50914]/5 rounded-full blur-[60px] md:blur-[80px] pointer-events-none"></div>

          <div className="relative z-10 transition-opacity duration-300">
            {/* Tab: Tài khoản */}
            {activeTab === 'account' && (
              <div className="space-y-6 md:space-y-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">Thông tin tài khoản</h2>
                  <p className="text-sm md:text-base text-[#A0A0A0]">Cập nhật danh tính của bạn trong vũ trụ Cineverse.</p>
                </div>
                <div className="space-y-4 md:space-y-5">
                  {/* Input Tên */}
                  <div className="group">
                    <label className="block text-xs md:text-sm font-medium text-secondary-text mb-1.5 md:mb-2 group-focus-within:text-[#E50914] transition-colors">
                      Tên hiển thị
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) => {
                        setSettings({ ...settings, name: e.target.value });
                        setNameError(null); // Xóa lỗi khi user đang gõ
                      }}
                      className={`w-full bg-input-bg border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-foreground outline-none transition-all ${
                        nameError
                          ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-card-border focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                      }`}
                    />
                    {nameError && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">!</span>
                        {nameError}
                      </p>
                    )}
                  </div>

                  {/* Input Email */}
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-secondary-text mb-1.5 md:mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => {
                        setSettings({ ...settings, email: e.target.value });
                        setEmailError(null);
                      }}
                      className={`w-full bg-input-bg border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-foreground outline-none transition-all ${
                        emailError
                          ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-card-border focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]"
                      }`}
                    />
                    {emailError && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                        <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">!</span>
                        {emailError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Bảo mật */}
            {activeTab === 'security' && (
              <div className="space-y-6 md:space-y-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">Bảo mật</h2>
                  <p className="text-sm md:text-base text-[#A0A0A0]">Giữ cho hành trình điện ảnh của bạn an toàn.</p>
                </div>
                <div className="space-y-4 md:space-y-6">
                  <div className="bg-[#0A0A0A] p-4 md:p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm md:text-base">Xác thực 2 yếu tố (2FA)</h3>
                      <p className="text-xs md:text-sm text-[#A0A0A0]">Thêm một lớp bảo mật khi đăng nhập.</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, twoFactor: !settings.twoFactor})}
                      className={`w-10 md:w-12 h-5 md:h-6 rounded-full transition-colors relative flex-shrink-0 ${settings.twoFactor ? 'bg-[#10B981]' : 'bg-[#2A2A2A]'}`}
                    >
                      <div className={`absolute top-0.5 md:top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.twoFactor ? 'left-[22px] md:left-7' : 'left-0.5 md:left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Chế độ tối/sáng */}
            {activeTab === 'appearance' && (
              <div className="space-y-4 md:space-y-6">
                <h2 className="text-xl md:text-2xl font-bold">Giao diện</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                   <button 
                    onClick={() => setSettings({...settings, theme: 'dark'})}
                    className={`p-4 md:p-6 rounded-2xl border-2 text-left transition-all ${settings.theme === 'dark' ? 'border-[#E50914] bg-[#E50914]/5' : 'border-white/5 bg-[#0A0A0A]'}`}
                  >
                    <Moon className="mb-3 md:mb-4 w-5 h-5 md:w-6 md:h-6" />
                    <p className="font-bold text-sm md:text-base">Dark Mode</p>
                  </button>
                  {/* Light mode: Disabled như bản gốc */}
                  <div className="p-4 md:p-6 rounded-2xl border-2 border-white/5 bg-[#0A0A0A] opacity-30 cursor-not-allowed">
                    <Moon className="mb-3 md:mb-4 w-5 h-5 md:w-6 md:h-6" />
                    <p className="font-bold text-sm md:text-base">Light Mode (Soon)</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Tab: Thông báo */}
            {activeTab === 'notifications' && (
                <div className="space-y-4 md:space-y-6">
                    <h2 className="text-xl md:text-2xl font-bold">Thông báo</h2>
                    <div className="space-y-3 md:space-y-4">
                        {[
                            { id: 'emailNotifications', label: 'Thông báo Email', desc: 'Nhận tin tức phim qua mail.' },
                            { id: 'pushNotifications', label: 'Thông báo Đẩy', desc: 'Nhận thông báo trực tiếp trên trình duyệt.' },
                        ].map((item) => (
                            <div key={item.id} className="bg-[#0A0A0A] p-4 md:p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-sm md:text-base">{item.label}</h3>
                                    <p className="text-xs md:text-sm text-[#A0A0A0]">{item.desc}</p>
                                </div>
                                <button 
                                    onClick={() => setSettings({...settings, [item.id]: !settings[item.id as keyof typeof settings]})}
                                    className={`w-10 md:w-12 h-5 md:h-6 rounded-full transition-colors relative flex-shrink-0 ${settings[item.id as keyof typeof settings] ? 'bg-[#E50914]' : 'bg-[#2A2A2A]'}`}
                                >
                                    <div className={`absolute top-0.5 md:top-1 w-4 h-4 bg-white rounded-full transition-all ${settings[item.id as keyof typeof settings] ? 'left-[22px] md:left-7' : 'left-0.5 md:left-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* Nút Save cố định ở dưới */}
          <div className="mt-8 md:mt-12 pt-4 md:pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={() => setShowResetDialog(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm text-secondary-text hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-input-bg"
            >
              <RotateCcw className="w-4 h-4" />
              Khôi phục mặc định
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto bg-[#E50914] hover:bg-[#b80710] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 md:px-8 py-2.5 md:py-3 rounded-xl font-bold transition-all shadow-[0_4px_14px_rgba(229,9,20,0.4)] flex items-center justify-center gap-2 text-sm md:text-base"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 md:w-5 md:h-5" />
                  Lưu Thay Đổi
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-foreground">Khôi phục cài đặt mặc định?</p>
                <p className="text-xs text-secondary-text mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <div className="bg-background border-l-2 border-red-500 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-secondary-text leading-relaxed">
                Tất cả thay đổi sẽ bị xóa, bao gồm: tên hiển thị, email, giao diện, thông báo và bảo mật.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetDialog(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-card-border text-secondary-text hover:text-foreground hover:bg-input-bg transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#E50914] hover:bg-[#b80710] text-white transition-all shadow-[0_4px_14px_rgba(229,9,20,0.3)]"
              >
                Xác nhận reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
