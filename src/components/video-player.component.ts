import { Component, ElementRef, ViewChild, input, output, effect, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../services/firebase.service';

declare const Hls: any;

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div class="fixed inset-0 z-[2500] transition-all duration-200" 
           [class.pointer-events-none]="isPipMode()"
           [class.bg-black/60]="!isPipMode()"
           [class.backdrop-blur-sm]="!isPipMode()">
        
        <div #videoContainer 
             class="bg-black relative overflow-hidden flex items-center justify-center transition-all duration-200 shadow-2xl"
             [class.fixed]="isPipMode()"
             [class.w-full]="!isPipMode()" 
             [class.h-full]="!isPipMode()"
             [class.w-[280px]]="isPipMode()"
             [class.h-[160px]]="isPipMode()"
             [class.rounded-2xl]="isPipMode()"
             [class.border-2]="isPipMode()"
             [class.border-white/10]="isPipMode()"
             [class.bottom-20]="isPipMode()"
             [class.left-5]="isPipMode()"
             [class.z-[9999]]="isPipMode()"
             [class.pointer-events-auto]="isPipMode()"
             [class.cursor-move]="isPipMode()"
             (mousedown)="dragStart($event)"
             (touchstart)="dragStart($event)"
             (mousemove)="drag($event)"
             (touchmove)="drag($event)"
             (mouseup)="dragEnd()"
             (touchend)="dragEnd()">

          <!-- Overlay/Controls -->
          <div class="absolute inset-0 z-[201]" (click)="triggerOverlay()"></div>

          <!-- Buttons -->
          <div class="absolute top-6 left-0 w-full px-6 flex justify-between z-[220] transition-opacity duration-200"
               [class.opacity-0]="!uiVisible"
               [class.opacity-100]="uiVisible"
               [class.hidden]="isPipMode()">
             
             <div class="flex gap-4">
               <button (click)="toggleFullScreen()" class="w-[45px] h-[45px] rounded-full bg-black/60 border-2 border-white/20 text-white flex items-center justify-center backdrop-blur active:bg-accent active:scale-95 transition-all">
                 <i class="fas fa-expand"></i>
               </button>
               
               <button (click)="togglePip()" class="w-[45px] h-[45px] rounded-full bg-black/60 border-2 border-white/20 text-white flex items-center justify-center backdrop-blur active:bg-accent active:scale-95 transition-all">
                 <i class="fas fa-compress-arrows-alt"></i>
               </button>
             </div>

             <button (click)="closePlayer()" class="w-[45px] h-[45px] rounded-full bg-red-600/85 border-2 border-white/20 text-white flex items-center justify-center backdrop-blur active:scale-95 transition-all">
               <i class="fas fa-times"></i>
             </button>
          </div>

          <!-- Restore from PiP Button (Only in PiP) -->
          @if (isPipMode()) {
            <button (click)="togglePip()" class="absolute top-2 right-2 z-[225] text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center pointer-events-auto">
               <i class="fas fa-expand-alt text-xs"></i>
            </button>
          }

          <video #videoPlayer autoplay playsinline class="w-full h-full object-contain pointer-events-none"></video>

          <!-- Related Channels -->
          <div class="absolute bottom-0 left-0 w-full h-[110px] bg-gradient-to-t from-black/90 to-transparent z-[210] flex items-center gap-3 px-5 pb-5 overflow-x-auto no-scrollbar transition-transform duration-300"
               [class.translate-y-full]="!uiVisible"
               [class.translate-y-0]="uiVisible"
               [class.hidden]="isPipMode()">
             
             @for (rel of relatedChannels(); track rel.id) {
               <div (click)="changeChannel(rel)" 
                    class="min-w-[70px] h-[70px] rounded-xl bg-white/10 border border-white/20 p-1 cursor-pointer overflow-hidden transition-all active:scale-95"
                    [class.border-accent]="currentChannel()?.id === rel.id">
                 <img [src]="rel.image" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/200?text=TV'">
               </div>
             }
          </div>

        </div>
      </div>
    }
  `
})
export class VideoPlayerComponent implements OnDestroy {
  channel = input<Channel | null>(null);
  relatedChannels = input<Channel[]>([]);
  onClose = output<void>();
  onChannelChange = output<Channel>();

  isVisible = signal(false);
  isPipMode = signal(false);
  currentChannel = signal<Channel | null>(null);
  
  uiVisible = false;
  private overlayTimer: any;
  private hls: any;
  
  @ViewChild('videoPlayer') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoContainer') containerElement!: ElementRef<HTMLDivElement>;

  // Dragging state
  private isDragging = false;
  private currentX = 0;
  private currentY = 0;
  private initialX = 0;
  private initialY = 0;
  private xOffset = 0;
  private yOffset = 0;

  constructor() {
    effect(() => {
      const ch = this.channel();
      if (ch) {
        this.open(ch);
      } else {
        this.closePlayer();
      }
    });
  }

  ngOnDestroy() {
    if (this.hls) this.hls.destroy();
  }

  open(ch: Channel) {
    this.isVisible.set(true);
    this.currentChannel.set(ch);
    // Reset Pip if full open
    if (this.isPipMode()) {
       this.isPipMode.set(false);
       this.resetDrag();
    }
    this.playVideo(ch.url);
    this.triggerOverlay();
  }

  playVideo(url: string) {
    setTimeout(() => {
      const video = this.videoElement?.nativeElement;
      if (!video) return;

      if (Hls.isSupported()) {
        if (this.hls) this.hls.destroy();
        this.hls = new Hls();
        this.hls.loadSource(url);
        this.hls.attachMedia(video);
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => {});
      }
    });
  }

  closePlayer() {
    if (document.fullscreenElement) document.exitFullscreen();
    this.isVisible.set(false);
    this.isPipMode.set(false);
    this.resetDrag();
    this.videoElement?.nativeElement?.pause();
    if (this.hls) this.hls.destroy();
    this.onClose.emit();
  }

  toggleFullScreen() {
    const elem = this.containerElement.nativeElement;
    if (!document.fullscreenElement) {
      (elem.requestFullscreen || (elem as any).webkitRequestFullscreen).call(elem);
    } else {
      document.exitFullscreen();
    }
  }

  togglePip() {
    if (document.fullscreenElement) document.exitFullscreen();
    this.isPipMode.update(v => !v);
    if (!this.isPipMode()) {
      this.resetDrag();
    }
  }

  triggerOverlay() {
    this.uiVisible = true;
    clearTimeout(this.overlayTimer);
    this.overlayTimer = setTimeout(() => {
      this.uiVisible = false;
    }, 4000);
  }

  changeChannel(ch: Channel) {
    this.onChannelChange.emit(ch);
  }

  // --- Drag Logic ---
  dragStart(e: MouseEvent | TouchEvent) {
    if (!this.isPipMode()) return;
    
    if (e.type === 'touchstart') {
      this.initialX = (e as TouchEvent).touches[0].clientX - this.xOffset;
      this.initialY = (e as TouchEvent).touches[0].clientY - this.yOffset;
    } else {
      this.initialX = (e as MouseEvent).clientX - this.xOffset;
      this.initialY = (e as MouseEvent).clientY - this.yOffset;
    }

    // Check if clicked on a button
    if ((e.target as HTMLElement).closest('button')) return;

    this.isDragging = true;
  }

  drag(e: MouseEvent | TouchEvent) {
    if (this.isDragging) {
      e.preventDefault();

      let clientX, clientY;
      if (e.type === 'touchmove') {
        clientX = (e as TouchEvent).touches[0].clientX;
        clientY = (e as TouchEvent).touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      this.currentX = clientX - this.initialX;
      this.currentY = clientY - this.initialY;

      this.xOffset = this.currentX;
      this.yOffset = this.currentY;

      this.setTranslate(this.currentX, this.currentY, this.containerElement.nativeElement);
    }
  }

  dragEnd() {
    this.initialX = this.currentX;
    this.initialY = this.currentY;
    this.isDragging = false;
  }

  setTranslate(xPos: number, yPos: number, el: HTMLElement) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  resetDrag() {
    this.xOffset = 0;
    this.yOffset = 0;
    this.currentX = 0;
    this.currentY = 0;
    if (this.containerElement) {
      this.containerElement.nativeElement.style.transform = "none";
    }
  }
}