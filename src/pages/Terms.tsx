import React, { useState } from "react";

export default function Terms() {
  const [activeSection, setActiveSection] = useState('terms');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12 mt-16">
      <h1 className="text-2xl md:text-3xl font-heading font-bold text-white tracking-wider mb-8 md:mb-12 flex items-center gap-2 md:gap-3">
        <span className="w-1.5 h-6 md:h-8 bg-[#E50914] rounded-full inline-block"></span>
        Pháp Lý & Điều Khoản
      </h1>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-20 md:top-24 bg-[#121212] rounded-2xl border border-white/5 p-2 md:p-4 flex flex-row md:flex-col gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.2)] overflow-x-auto no-scrollbar">
            <button 
              onClick={() => scrollToSection('terms')}
              className={`text-left px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-medium transition-all whitespace-nowrap text-sm md:text-base ${activeSection === 'terms' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              Điều khoản sử dụng
            </button>
            <button 
              onClick={() => scrollToSection('privacy')}
              className={`text-left px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-medium transition-all whitespace-nowrap text-sm md:text-base ${activeSection === 'privacy' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              Chính sách bảo mật
            </button>
            <button 
              onClick={() => scrollToSection('dmca')}
              className={`text-left px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-medium transition-all whitespace-nowrap text-sm md:text-base ${activeSection === 'dmca' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              Khiếu nại bản quyền (DMCA)
            </button>
            <button 
              onClick={() => scrollToSection('contact')}
              className={`text-left px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-medium transition-all whitespace-nowrap text-sm md:text-base ${activeSection === 'contact' ? 'bg-[#E50914] text-white shadow-[0_4px_14px_rgba(229,9,20,0.3)]' : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white'}`}
            >
              Liên hệ hỗ trợ
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow bg-[#121212] rounded-3xl border border-white/5 p-6 md:p-8 lg:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-[#A0A0A0] leading-relaxed text-sm md:text-base">
          <div className="space-y-12 md:space-y-16">
            {/* ĐIỀU KHOẢN SỬ DỤNG */}
            <section id="terms" className="scroll-mt-24">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white mb-3 md:mb-4">ĐIỀU KHOẢN SỬ DỤNG</h2>
              <p className="mb-4 md:mb-6 italic text-[#A0A0A0]/70 text-xs md:text-sm">Cập nhật lần cuối: 23/02/2026</p>
              
              <p className="mb-4 md:mb-6">
                Chào mừng bạn đến với Cineverse. Bằng việc truy cập hoặc sử dụng trang web Cineverse (sau đây gọi là "Trang web") và các dịch vụ do chúng tôi cung cấp, bạn đồng ý tuân thủ và chịu sự ràng buộc bởi các Điều khoản Sử dụng này. Nếu bạn không đồng ý với bất kỳ phần nào của điều khoản, vui lòng ngừng sử dụng dịch vụ của chúng tôi.
              </p>

              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">1. Tài khoản người dùng</h3>
                  <p className="mb-2">Để sử dụng một số tính năng của Cineverse, bạn có thể cần đăng ký tài khoản.</p>
                  <ul className="list-disc pl-5 md:pl-6 space-y-1">
                    <li>Bạn có trách nhiệm bảo mật thông tin đăng nhập.</li>
                    <li>Bạn cam kết cung cấp thông tin chính xác, trung thực.</li>
                    <li>Bạn phải chịu trách nhiệm cho mọi hoạt động diễn ra trong tài khoản của mình.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">2. Quyền sở hữu trí tuệ</h3>
                  <p className="mb-2">
                    Toàn bộ nội dung trên Trang web, bao gồm nhưng không giới hạn ở phim, ảnh, logo, âm thanh, mã nguồn và giao diện (gọi chung là "Nội dung"), đều thuộc sở hữu của Cineverse hoặc các đối tác cấp phép và được bảo vệ bởi luật bản quyền và sở hữu trí tuệ.
                  </p>
                  <p>
                    Người dùng chỉ được xem Nội dung bằng tính năng phát trực tiếp (streaming) được tích hợp trên Trang web. Nghiêm cấm mọi hành vi sao chép, tải xuống, phân phối lại hoặc chỉnh sửa Nội dung khi chưa có sự cho phép bằng văn bản từ chúng tôi.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">3. Hành vi bị cấm</h3>
                  <p className="mb-2">Khi sử dụng Cineverse, bạn đồng ý không:</p>
                  <ul className="list-disc pl-5 md:pl-6 space-y-1">
                    <li>Xâm phạm quyền sở hữu trí tuệ của Cineverse hoặc bên thứ ba.</li>
                    <li>Sử dụng bất kỳ công cụ tự động nào (robot, spider) để trích xuất dữ liệu.</li>
                    <li>Gửi mã độc, can thiệp vào hệ thống máy chủ.</li>
                    <li>Mạo danh cá nhân hoặc tổ chức khác.</li>
                    <li>Đăng tải nội dung vi phạm pháp luật, thuần phong mỹ tục lên các khu vực bình luận hoặc diễn đàn của Trang web.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">4. Giới hạn trách nhiệm pháp lý</h3>
                  <p className="mb-2">Cineverse nỗ lực cung cấp dịch vụ ổn định nhất có thể, tuy nhiên chúng tôi không chịu trách nhiệm cho bất kỳ tổn thất nào phát sinh từ:</p>
                  <ul className="list-disc pl-5 md:pl-6 space-y-1">
                    <li>Việc gián đoạn dịch vụ do bảo trì, nâng cấp hoặc sự cố kỹ thuật ngoài ý muốn.</li>
                    <li>Đường truyền internet hoặc thiết bị của người dùng.</li>
                    <li>Các hành vi truy cập trái phép vào dữ liệu của bạn do lỗi chủ quan từ phía bạn.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">5. Thay đổi và chấm dứt dịch vụ</h3>
                  <p>
                    Cineverse có quyền sửa đổi, tạm ngừng hoặc ngừng cung cấp bất kỳ phần nào của dịch vụ mà không cần thông báo trước. Chúng tôi cũng có quyền chấm dứt tài khoản của bạn nếu phát hiện vi phạm các điều khoản này.
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-white/10" />

            {/* CHÍNH SÁCH BẢO MẬT */}
            <section id="privacy" className="scroll-mt-24">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white mb-4 md:mb-6">CHÍNH SÁCH BẢO MẬT</h2>
              <p className="mb-4 md:mb-6">
                Cineverse coi trọng quyền riêng tư của bạn. Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn khi bạn truy cập Trang web.
              </p>

              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">1. Thông tin chúng tôi thu thập</h3>
                  <ul className="list-disc pl-5 md:pl-6 space-y-2">
                    <li><strong>Thông tin bạn cung cấp trực tiếp:</strong> Khi bạn đăng ký tài khoản, chúng tôi có thể thu thập tên, địa chỉ email, ngày sinh và thông tin thanh toán (nếu có).</li>
                    <li><strong>Thông tin thu thập tự động:</strong> Khi bạn truy cập, chúng tôi tự động thu thập địa chỉ IP, loại trình duyệt, hành vi xem phim, thời gian truy cập và dữ liệu cookie.</li>
                    <li><strong>Thông tin từ bên thứ ba:</strong> Nếu bạn đăng nhập qua các nền tảng như Google hay Facebook, chúng tôi sẽ nhận được một số thông tin công khai từ các nền tảng đó theo cài đặt bảo mật của bạn.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">2. Mục đích sử dụng thông tin</h3>
                  <p className="mb-2">Chúng tôi sử dụng thông tin của bạn để:</p>
                  <ul className="list-disc pl-5 md:pl-6 space-y-1">
                    <li>Cung cấp và cá nhân hóa trải nghiệm xem phim (gợi ý phim dựa trên lịch sử xem).</li>
                    <li>Xử lý giao dịch và quản lý tài khoản.</li>
                    <li>Gửi thông báo về cập nhật, khuyến mãi hoặc nội dung mới (bạn có thể hủy nhận bất kỳ lúc nào).</li>
                    <li>Phân tích dữ liệu để cải thiện chất lượng dịch vụ và bảo mật hệ thống.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">3. Chia sẻ thông tin</h3>
                  <p className="mb-2">Cineverse cam kết không bán, trao đổi thông tin cá nhân của bạn cho bên thứ ba vì mục đích thương mại, ngoại trừ:</p>
                  <ul className="list-disc pl-5 md:pl-6 space-y-1">
                    <li>Các đơn vị cung cấp dịch vụ hỗ trợ vận hành Trang web (thanh toán, email marketing) và bị ràng buộc bảo mật thông tin.</li>
                    <li>Tuân thủ theo yêu cầu pháp lý từ cơ quan nhà nước có thẩm quyền.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">4. Cookie</h3>
                  <p>
                    Chúng tôi sử dụng cookie để ghi nhớ phiên đăng nhập, lưu lịch sử xem và thu thập dữ liệu thống kê. Bạn có thể tùy chỉnh cài đặt cookie trong trình duyệt của mình, tuy nhiên việc này có thể ảnh hưởng đến một số chức năng của Trang web.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">5. Bảo mật dữ liệu</h3>
                  <p>
                    Chúng tôi áp dụng các biện pháp bảo mật (mã hóa SSL, tường lửa) để bảo vệ dữ liệu của bạn khỏi truy cập trái phép. Tuy nhiên, không có phương thức truyền tải dữ liệu nào qua internet là an toàn tuyệt đối.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">6. Quyền của người dùng</h3>
                  <p>
                    Bạn có quyền truy cập, chỉnh sửa hoặc yêu cầu xóa thông tin cá nhân của mình bằng cách truy cập vào mục "Cài đặt tài khoản" hoặc liên hệ với chúng tôi qua email.
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-white/10" />

            {/* KHIẾU NẠI BẢN QUYỀN (DMCA) */}
            <section id="dmca" className="scroll-mt-24">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white mb-4 md:mb-6">KHIẾU NẠI BẢN QUYỀN (DMCA)</h2>
              <p className="mb-4 md:mb-6">
                Cineverse tôn trọng quyền sở hữu trí tuệ của người khác và mong muốn các đối tác, người dùng của mình cũng làm như vậy. Nếu bạn tin rằng tác phẩm của bạn đã bị sao chép trên Trang web theo cách thức cấu thành hành vi vi phạm bản quyền, vui lòng gửi thông báo cho Chúng tôi theo quy trình dưới đây.
              </p>

              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">1. Cách thức gửi khiếu nại</h3>
                  <p className="mb-2">
                    Để khiếu nại có hiệu lực, vui lòng cung cấp đầy đủ các thông tin sau (theo Điều 512, DMCA) qua email: <strong className="text-white break-all">copyright@cineverse.com</strong> hoặc thư bảo đảm về địa chỉ văn phòng của chúng tôi.
                  </p>
                  <p className="mb-2">Nội dung thông báo phải bao gồm:</p>
                  <ul className="list-disc pl-5 md:pl-6 space-y-1">
                    <li>Chữ ký điện tử hoặc vật lý của bạn với tư cách là chủ sở hữu bản quyền hoặc người được ủy quyền.</li>
                    <li>Mô tả tác phẩm có bản quyền bị vi phạm.</li>
                    <li>Mô tả vị trí nội dung vi phạm trên Trang web của chúng tôi (URL cụ thể của trang có nội dung đó).</li>
                    <li>Thông tin liên hệ của bạn: địa chỉ, số điện thoại, email.</li>
                    <li>Tuyên bố của bạn về việc bạn có niềm tin rằng việc sử dụng nội dung đó là không được phép bởi chủ sở hữu bản quyền.</li>
                    <li>Tuyên bố rằng các thông tin trong thông báo là chính xác và bạn có thẩm quyền thay mặt chủ sở hữu bản quyền, nếu không bạn sẽ phải chịu trách nhiệm về tội khai man.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">2. Xử lý khiếu nại</h3>
                  <p>
                    Khi nhận được thông báo hợp lệ, Cineverse sẽ nhanh chóng gỡ bỏ hoặc vô hiệu hóa quyền truy cập vào nội dung bị cáo buộc vi phạm. Chúng tôi cũng sẽ thông báo cho người dùng đã đăng tải nội dung đó về việc gỡ bỏ.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg md:text-xl font-heading font-semibold text-white mb-2">3. Phản hồi từ người dùng (Phản đối)</h3>
                  <p>
                    Nếu bạn là người dùng và cho rằng nội dung của mình bị gỡ nhầm do xác định sai hoặc do bạn có quyền sử dụng, bạn có thể gửi Thông báo phản đối. Nội dung phản đối cần bao gồm các thông tin tương tự (chữ ký, nhận dạng nội dung đã bị gỡ, tuyên bố chịu trách nhiệm trước tòa) và gửi về cùng địa chỉ trên.
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-white/10" />

            {/* Liên hệ hỗ trợ */}
            <section id="contact" className="bg-[#1A1A1A] p-6 md:p-8 rounded-2xl border border-white/5 scroll-mt-24">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-white mb-3 md:mb-4">Liên hệ hỗ trợ</h2>
              <p className="mb-4 md:mb-6">Mọi thắc mắc về Điều khoản, Chính sách Bảo mật hoặc Khiếu nại Bản quyền, vui lòng liên hệ:</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#E50914]/10 flex items-center justify-center text-[#E50914] flex-shrink-0">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs md:text-sm text-[#A0A0A0]">Email</p>
                    <strong className="text-white text-sm md:text-base break-all">support@cineverse.com</strong>
                  </div>
                </li>
                <li className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6] flex-shrink-0">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-[#A0A0A0]">Địa chỉ</p>
                    <strong className="text-white text-sm md:text-base">Tòa nhà Cineverse, Quận 1, TP. Hồ Chí Minh, Việt Nam</strong>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
