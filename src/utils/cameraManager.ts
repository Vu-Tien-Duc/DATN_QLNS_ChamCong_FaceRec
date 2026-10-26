/**
 * Global Camera Manager
 * Quản lý tập trung toàn bộ các MediaStream, MediaStreamTrack và HTMLVideoElement trong ứng dụng SPA.
 * Tự động chặn và theo dõi mọi MediaStream được mở bởi navigator.mediaDevices.getUserMedia,
 * đảm bảo dập tắt 100% đèn webcam phần cứng ngay khi người dùng chuyển trang hoặc đóng modal.
 */

class CameraManager {
  private activeStreams: Set<MediaStream> = new Set();
  private activeTracks: Set<MediaStreamTrack> = new Set();
  private registeredVideos: Set<HTMLVideoElement> = new Set();
  private isInterceptionSetup = false;

  constructor() {
    this.setupInterception();
    this.setupGlobalWatchdog();
  }

  /**
   * Đăng ký thẻ video để theo dõi và giải phóng DirectShow / MediaFoundation pipeline khi tắt
   */
  registerVideoElement(video: HTMLVideoElement | null): void {
    if (!video) return;
    this.registeredVideos.add(video);
  }

  /**
   * Tự động can thiệp (monkey-patch) navigator.mediaDevices.getUserMedia
   * ở cả cấp độ Prototype và Instance để bắt trọn 100% các MediaStream và MediaStreamTrack
   */
  private setupInterception(): void {
    if (typeof window === 'undefined') return;
    if (this.isInterceptionSetup) return;
    this.isInterceptionSetup = true;

    const manager = this;

    const handleStreamAcquired = (stream: MediaStream): MediaStream => {
      manager.registerStream(stream);

      // Nếu hiện tại người dùng đang ở trang khác ngoài /face-attendance và không có modal camera mở
      if (typeof window !== 'undefined' && window.location.pathname !== '/face-attendance') {
        const hasCameraModal = !!document.querySelector('[data-camera-modal="true"]');
        if (!hasCameraModal) {
          manager.stopStream(stream);
        }
      }
      return stream;
    };

    // 1. Can thiệp MediaDevices.prototype nếu trình duyệt hỗ trợ
    if (typeof MediaDevices !== 'undefined' && MediaDevices.prototype?.getUserMedia) {
      const origProtoGetUserMedia = MediaDevices.prototype.getUserMedia;
      MediaDevices.prototype.getUserMedia = async function (constraints) {
        const stream = await origProtoGetUserMedia.call(this, constraints);
        return handleStreamAcquired(stream);
      };
    }

    // 2. Can thiệp trực tiếp instance navigator.mediaDevices nếu có
    if (navigator.mediaDevices?.getUserMedia) {
      const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      try {
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          const stream = await origGetUserMedia(constraints);
          return handleStreamAcquired(stream);
        };
      } catch (_) {
        // Một số trình duyệt khoá thuộc tính instance, prototype patch ở trên đã bảo vệ
      }
    }
  }

  /**
   * Đăng ký một MediaStream đang hoạt động
   */
  registerStream(stream: MediaStream): void {
    if (!stream) return;
    this.activeStreams.add(stream);

    // Ghi nhận và theo dõi từng track riêng lẻ
    try {
      stream.getTracks().forEach((track) => {
        this.activeTracks.add(track);
        track.addEventListener('ended', () => {
          this.activeTracks.delete(track);
          if (!stream.active) {
            this.activeStreams.delete(stream);
          }
        });
      });
    } catch (_) {}
  }

  /**
   * Hủy đăng ký stream thủ công
   */
  unregisterStream(stream: MediaStream | null): void {
    if (!stream) return;
    this.stopStream(stream);
  }

  /**
   * Dập tắt một stream cụ thể
   */
  stopStream(stream: MediaStream | null): void {
    if (!stream) return;
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
          this.activeTracks.delete(track);
        } catch (_) {}
      });
    } catch (_) {}
    this.activeStreams.delete(stream);
  }

  /**
   * Dập tắt (Stop) toàn bộ camera stream & hardware decoder trên toàn hệ thống
   * Giải phóng hoàn toàn phần cứng DirectShow/MediaFoundation trên Windows
   */
  stopAllStreams(): void {
    // 1. Giải phóng tất cả video element đã đăng ký (kể cả đã bị React unmount khỏi DOM)
    this.registeredVideos.forEach((video) => {
      try {
        video.pause();
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          if (stream?.getTracks) {
            stream.getTracks().forEach((t) => {
              try {
                t.enabled = false;
                t.stop();
              } catch (_) {}
            });
          }
          video.srcObject = null;
        }
        video.removeAttribute('src');
        video.load();
      } catch (_) {}
    });
    this.registeredVideos.clear();

    // 2. Quét toàn bộ thẻ <video> còn sót lại trong DOM
    if (typeof document !== 'undefined') {
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        try {
          video.pause();
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream;
            if (stream?.getTracks) {
              stream.getTracks().forEach((track) => {
                try {
                  track.enabled = false;
                  track.stop();
                } catch (_) {}
              });
            }
            video.srcObject = null;
          }
          video.removeAttribute('src');
          video.load();
        } catch (_) {}
      });
    }

    // 3. Dập tắt toàn bộ các MediaStreamTrack đơn lẻ
    this.activeTracks.forEach((track) => {
      try {
        track.enabled = false;
        track.stop();
      } catch (_) {}
    });
    this.activeTracks.clear();

    // 4. Dập tắt tất cả các MediaStream được lưu trữ trong Set
    this.activeStreams.forEach((stream) => {
      try {
        if (stream?.getTracks) {
          stream.getTracks().forEach((track) => {
            try {
              track.enabled = false;
              track.stop();
            } catch (_) {}
          });
        }
      } catch (_) {}
    });
    this.activeStreams.clear();
  }

  /**
   * Watchdog định kỳ: Tự động phát hiện và dập tắt camera nếu người dùng không ở /face-attendance
   * và không có modal camera nào đang mở
   */
  private setupGlobalWatchdog(): void {
    if (typeof window === 'undefined') return;

    // Lắng nghe sự kiện rời trang, đóng tab, lùi trang
    window.addEventListener('beforeunload', () => this.stopAllStreams());
    window.addEventListener('pagehide', () => this.stopAllStreams());
    window.addEventListener('popstate', () => this.stopAllStreams());

    // Watchdog kiểm tra định kỳ mỗi 350ms
    setInterval(() => {
      if (typeof window === 'undefined') return;
      if (window.location.pathname !== '/face-attendance') {
        const hasCameraModal = !!document.querySelector('[data-camera-modal="true"]');
        if (!hasCameraModal && (this.activeStreams.size > 0 || this.activeTracks.size > 0)) {
          this.stopAllStreams();
        }
      }
    }, 350);
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  getActiveTrackCount(): number {
    return this.activeTracks.size;
  }
}

export const cameraManager = new CameraManager();

// Can thiệp click toàn cục để tắt camera ngay khi nhấp chuột vào liên kết điều hướng
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('a, [role="button"], button');
    if (target) {
      const href = target.getAttribute('href');
      // Nếu liên kết điều hướng sang trang khác ngoài /face-attendance
      if (href && href !== '/face-attendance' && !href.startsWith('#')) {
        cameraManager.stopAllStreams();
      }
    }
  });
}
