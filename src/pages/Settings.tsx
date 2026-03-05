import { useState } from "react";
import { User, Shield, Moon, Bell, Save, ChevronRight } from "lucide-react";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'appearance' | 'notifications'>('account');

  // Mock settings state
  const [settings, setSettings] = useState({
    email: "nguyenvana@example.com",
    name: "Nguyễn Văn A",
    theme: "dark",
    emailNotifications: true,
    pushNotifications: false,
    twoFactor: false
  });

  const handleSave = () => {
    // Simulate save
    alert("Cài đặt đã được lưu!");
  };

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-12">
      <h1 className="text-3xl font-heading font-bold text-white tracking-wider mb-8 flex items-center gap-3">
        <span className="w-1.5 h-8 bg-[#3B82F6] rounded-full inline-block"></span>
        Cài Đặt
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-4 flex flex-col gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            <button 
              onClick={() => setActiveTab('account')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'account' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5" />
                Tài Khoản
              </div>
              {activeTab === 'account' && <ChevronRight className="w-4 h-4" />}
            </button>
            
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'security' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                Bảo Mật
              </div>
              {activeTab === 'security' && <ChevronRight className="w-4 h-4" />}
            </button>
            
            <button 
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'appearance' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5" />
                Giao Diện
              </div>
              {activeTab === 'appearance' && <ChevronRight className="w-4 h-4" />}
            </button>
            
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'notifications' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5" />
                Thông Báo
              </div>
              {activeTab === 'notifications' && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow bg-[#121212] rounded-3xl border border-white/5 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden">
          {/* Background Blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914]/5 rounded-full blur-[80px] pointer-events-none"></div>

          <div className="relative z-10">
            {activeTab === 'account' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-2xl font-heading font-bold text-white mb-2">Thông tin tài khoản</h2>
                  <p className="text-[#A0A0A0] mb-6">Cập nhật thông tin cá nhân của bạn.</p>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[#A0A0A0] mb-2">Tên hiển thị</label>
                    <input 
                      type="text" 
                      value={settings.name}
                      onChange={(e) => setSettings({...settings, name: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#A0A0A0] mb-2">Email</label>
                    <input 
                      type="email" 
                      value={settings.email}
                      onChange={(e) => setSettings({...settings, email: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-2xl font-heading font-bold text-white mb-2">Bảo mật & Đăng nhập</h2>
                  <p className="text-[#A0A0A0] mb-6">Quản lý mật khẩu và các phương thức bảo mật.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium mb-1">Mật khẩu</h3>
                      <p className="text-sm text-[#A0A0A0]">Cập nhật lần cuối: 3 tháng trước</p>
                    </div>
                    <button className="bg-[#2A2A2A] hover:bg-[#333] text-white px-4 py-2 rounded-lg font-medium transition-colors border border-white/5">
                      Đổi mật khẩu
                    </button>
                  </div>
                  
                  <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium mb-1">Xác thực 2 yếu tố (2FA)</h3>
                      <p className="text-sm text-[#A0A0A0]">Bảo vệ tài khoản bằng mã xác nhận qua điện thoại.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.twoFactor}
                        onChange={() => setSettings({...settings, twoFactor: !settings.twoFactor})}
                      />
                      <div className="w-11 h-6 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981]"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-2xl font-heading font-bold text-white mb-2">Giao diện</h2>
                  <p className="text-[#A0A0A0] mb-6">Tùy chỉnh giao diện hiển thị của Cineverse.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => setSettings({...settings, theme: 'dark'})}
                    className={`p-6 rounded-2xl border-2 text-left transition-all ${settings.theme === 'dark' ? 'border-[#E50914] bg-[#E50914]/5' : 'border-white/5 bg-[#0A0A0A] hover:border-white/20'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center mb-4 border border-white/10">
                      <Moon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-white font-bold mb-1">Chế độ tối</h3>
                    <p className="text-sm text-[#A0A0A0]">Giao diện mặc định, tối ưu cho việc xem phim.</p>
                  </button>
                  
                  <button 
                    onClick={() => setSettings({...settings, theme: 'light'})}
                    className={`p-6 rounded-2xl border-2 text-left transition-all opacity-50 cursor-not-allowed ${settings.theme === 'light' ? 'border-[#E50914] bg-[#E50914]/5' : 'border-white/5 bg-[#0A0A0A]'}`}
                    disabled
                  >
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-4 border border-gray-200">
                      <Moon className="w-6 h-6 text-black" />
                    </div>
                    <h3 className="text-white font-bold mb-1">Chế độ sáng</h3>
                    <p className="text-sm text-[#A0A0A0]">Sắp ra mắt trong phiên bản tới.</p>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-2xl font-heading font-bold text-white mb-2">Thông báo</h2>
                  <p className="text-[#A0A0A0] mb-6">Quản lý cách chúng tôi liên hệ với bạn.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium mb-1">Thông báo qua Email</h3>
                      <p className="text-sm text-[#A0A0A0]">Nhận email về phim mới, gợi ý và tin tức.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.emailNotifications}
                        onChange={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                      />
                      <div className="w-11 h-6 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E50914]"></div>
                    </label>
                  </div>
                  
                  <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium mb-1">Thông báo đẩy (Push)</h3>
                      <p className="text-sm text-[#A0A0A0]">Nhận thông báo trực tiếp trên trình duyệt.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.pushNotifications}
                        onChange={() => setSettings({...settings, pushNotifications: !settings.pushNotifications})}
                      />
                      <div className="w-11 h-6 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E50914]"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-10 pt-6 border-t border-white/10 flex justify-end">
              <button 
                onClick={handleSave}
                className="bg-[#E50914] hover:bg-[#b80710] text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_4px_14px_rgba(229,9,20,0.4)] hover:shadow-[0_6px_20px_rgba(229,9,20,0.6)] hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
