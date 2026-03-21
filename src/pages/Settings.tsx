import { useState, useEffect } from "react";
import { User, Shield, Moon, Bell, Save, ChevronRight, Loader2 } from "lucide-react";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'appearance' | 'notifications'>('account');
  const [isSaving, setIsSaving] = useState(false);

  // 1. Khởi tạo state từ LocalStorage để dữ liệu không bị mất khi F5
  const [settings, setSettings] = useState(() => {
    const savedData = localStorage.getItem("cineverse_settings");
    return savedData ? JSON.parse(savedData) : {
      email: "user@example.com",
      name: "Người dùng",
      theme: "dark",
      emailNotifications: true,
      pushNotifications: false,
      twoFactor: false
    };
  });

  // 2. Hàm lưu dữ liệu "thật"
  const handleSave = () => {
    setIsSaving(true);
    
    // Giả lập thời gian chờ server 1s cho chuyên nghiệp
    setTimeout(() => {
      localStorage.setItem("cineverse_settings", JSON.stringify(settings));
      setIsSaving(false);
      
      // Bắn sự kiện để Header và các trang khác cập nhật ngay lập tức
      window.dispatchEvent(new Event("local-storage-update"));

      // Thay alert bằng thông báo tinh tế hơn (nếu có thư viện Toast)
      alert("✨ Cineverse: Cài đặt của bạn đã được cập nhật!");
    }, 1000);
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
                  <div className="group">
                    <label className="block text-xs md:text-sm font-medium text-[#A0A0A0] mb-1.5 md:mb-2 group-focus-within:text-[#E50914] transition-colors">Tên hiển thị</label>
                    <input 
                      type="text" 
                      value={settings.name}
                      onChange={(e) => setSettings({...settings, name: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-[#A0A0A0] mb-1.5 md:mb-2">Email</label>
                    <input 
                      type="email" 
                      value={settings.email}
                      onChange={(e) => setSettings({...settings, email: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] outline-none transition-all"
                    />
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
          <div className="mt-8 md:mt-12 pt-4 md:pt-6 border-t border-white/10 flex justify-end">
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
    </div>
  );
}
