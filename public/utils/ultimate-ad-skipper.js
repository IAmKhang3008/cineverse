// ultimate-ad-skipper.js

class UltimateAdSkipper {
  constructor() {
    this.video = null;
    this.adPatterns = [];
    this.pendingSkips = [];
    this.skipping = false;
    this.loadPatterns();
    this.init();
  }

  async loadPatterns() {
    // Load patterns từ server
    try {
      const response = await fetch('/api/ad-patterns');
      const data = await response.json();
      this.adPatterns = data.patterns || [];
    } catch (error) {
      // Default patterns nếu không load được
      this.adPatterns = this.getDefaultPatterns();
    }
  }

  getDefaultPatterns() {
    return [
      // Phim chiếu rạp - ad ở đầu mỗi 15 phút
      { start: 900, end: 930 },   // 15:00 - 15:30
      { start: 1800, end: 1830 }, // 30:00 - 30:30
      { start: 2700, end: 2730 }, // 45:00 - 45:30
      { start: 3600, end: 3630 }, // 60:00 - 60:30
      
      // Phim bộ - ad ở đầu và giữa
      { start: 0, end: 30 },       // 00:00 - 00:30
      { start: 1200, end: 1230 }, // 20:00 - 20:30
      { start: 2400, end: 2430 }, // 40:00 - 40:30
    ];
  }

  init() {
    this.waitForVideo();
  }

  waitForVideo() {
    const checkVideo = setInterval(() => {
      // Try to find video in iframe first
      let video = null;
      const iframe = document.querySelector('iframe[src*="phimapi"], iframe[src*="kkphimplayer"]');
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            video = iframeDoc.querySelector('video');
          }
        } catch (e) {
          // CORS error - ignore
        }
      }
      
      if (!video) {
        video = document.querySelector('video');
      }

      if (video) {
        this.video = video;
        clearInterval(checkVideo);
        this.setupVideoListeners();
        this.startAdDetection();
      }
    }, 500);
  }

  setupVideoListeners() {
    this.video.addEventListener('timeupdate', () => {
      this.checkCurrentTime();
    });

    this.video.addEventListener('play', () => {
      this.scheduleNextSkips();
    });
  }

  startAdDetection() {
    // Quét mỗi 100ms
    setInterval(() => {
      if (this.video && !this.video.paused) {
        this.detectAdByPattern();
        this.detectAdByBehavior();
      }
    }, 100);
  }

  checkCurrentTime() {
    if (this.skipping) return;
    
    const currentTime = this.video.currentTime;
    
    // Kiểm tra các pattern đã biết
    for (const pattern of this.adPatterns) {
      if (currentTime >= pattern.start && currentTime < pattern.end) {
        this.skipTo(pattern.end);
        break;
      }
    }
  }

  detectAdByPattern() {
    // Phát hiện ad dựa trên pattern thời gian
    const currentTime = this.video.currentTime;
    const second = Math.floor(currentTime);
    
    // Ad thường xuất hiện ở các giây đẹp
    if (second % 900 === 0 && second > 0) { // Mỗi 15 phút
      this.scheduleSkip(second, second + 30);
    }
  }

  detectAdByBehavior() {
    // Phát hiện ad dựa trên hành vi của video
    if (!this.video) return;
    
    // Kiểm tra nếu video tự động pause
    if (this.video.paused && !this.video.ended && !this.userPaused) {
      const currentTime = this.video.currentTime;
      // Nếu pause ở thời điểm khả nghi, có thể là ad
      if (this.isAdTime(currentTime)) {
        this.resumeAfterAd(currentTime);
      }
    }
  }

  scheduleSkip(start, end) {
    if (!this.pendingSkips.some(s => s.start === start)) {
      this.pendingSkips.push({ start, end });
      console.log(`⏰ Scheduled skip: ${this.formatTime(start)} -> ${this.formatTime(end)}`);
    }
  }

  scheduleNextSkips() {
    // Lên lịch cho các ad sắp tới
    const currentTime = this.video.currentTime;
    
    this.adPatterns.forEach(pattern => {
      if (pattern.start > currentTime && pattern.start < currentTime + 1800) {
        // Trong vòng 30 phút tới
        this.scheduleSkip(pattern.start, pattern.end);
      }
    });
  }

  skipTo(targetTime) {
    if (this.skipping) return;
    
    this.skipping = true;
    const skipDuration = targetTime - this.video.currentTime;
    
    // Hiển thị thông báo
    this.showNotification(`⏭️ Đang skip quảng cáo (${Math.round(skipDuration)}s)`);
    
    // Tạm dừng và skip
    this.video.pause();
    this.video.currentTime = targetTime;
    
    // Play lại
    setTimeout(() => {
      this.video.play().catch(() => {});
      this.skipping = false;
      
      // Xóa khỏi pending skips
      this.pendingSkips = this.pendingSkips.filter(s => 
        Math.abs(s.end - targetTime) > 1
      );
    }, 200);
  }

  resumeAfterAd(pauseTime) {
    // Nếu bị pause ở thời điểm ad, tự tự động resume sau 30s
    setTimeout(() => {
      if (this.video.paused && !this.video.ended) {
        const newTime = pauseTime + 30;
        this.video.currentTime = newTime;
        this.video.play().catch(() => {});
        this.showNotification(`⏭️ Đã bỏ qua quảng cáo`);
      }
    }, 2000);
  }

  isAdTime(time) {
    const minute = Math.floor(time / 60);
    const second = Math.floor(time % 60);
    
    // Ad thường ở các mốc: 15:00, 30:00, 45:00
    return (minute % 15 === 0 && second < 30) || 
           (minute % 15 === 14 && second > 30);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'ad-skip-notification';
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(229, 9, 20, 0.9);
      color: white;
      padding: 10px 20px;
      border-radius: 30px;
      z-index: 9999;
      font-size: 14px;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 3000);
  }
}

window.UltimateAdSkipper = UltimateAdSkipper;

// Khởi tạo
if (window.location.pathname.includes('/watch/')) {
  window.adSkipper = new UltimateAdSkipper();
}
