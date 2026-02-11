import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FirebaseService, Channel, Category } from './services/firebase.service';
import { ToastService } from './services/toast.service';
import { VideoPlayerComponent } from './components/video-player.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, VideoPlayerComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private fb = inject(FirebaseService);
  private toast = inject(ToastService);
  private formBuilder = inject(FormBuilder);

  // State
  searchQuery = signal('');
  showOnlyFavorites = signal(false);
  
  // Modals
  showLoginModal = signal(false);
  showChannelModal = signal(false);
  showCategoryModal = signal(false);
  
  // Player
  activeChannel = signal<Channel | null>(null);
  
  // Forms
  loginForm: FormGroup;
  channelForm: FormGroup;
  categoryForm: FormGroup;
  
  // Edit State
  editingChannelId = signal<string | null>(null);

  // Computed Data
  filteredChannels = computed(() => {
    let list = this.fb.channels();
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(c => c.name.toLowerCase().includes(query));
    }
    if (this.showOnlyFavorites()) {
      list = list.filter(c => c.isFavorite);
    }
    return list;
  });

  sections = computed(() => {
    const sections: { id: string; title: string; channels: Channel[] }[] = [];
    const channels = this.filteredChannels();
    const categories = this.fb.categories();
    const isAdmin = this.fb.isAdmin();

    // Favorites Section if not filtering only by favs but favs exist
    if (!this.showOnlyFavorites() && !this.searchQuery()) {
      const favs = this.fb.channels().filter(c => c.isFavorite);
      if (favs.length > 0) {
        sections.push({ id: 'favorites', title: '❤️ دڵخوازەکان', channels: favs });
      }
    }

    if (this.showOnlyFavorites()) {
      // Just one big section
      sections.push({ id: 'all-favs', title: '❤️ هەموو دڵخوازەکان', channels: channels });
      return sections;
    }

    // Normal Categories
    categories.forEach(cat => {
      const catChannels = channels.filter(c => c.category === cat.id);
      if (catChannels.length > 0 || isAdmin) {
        sections.push({ id: cat.id, title: cat.title, channels: catChannels });
      }
    });

    return sections;
  });

  // Access signals for template
  isAdmin = this.fb.isAdmin;
  categories = this.fb.categories;
  toasts = this.toast.toasts;

  constructor() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    this.channelForm = this.formBuilder.group({
      name: ['', Validators.required],
      url: ['', Validators.required],
      category: ['', Validators.required],
      image: ['']
    });

    this.categoryForm = this.formBuilder.group({
      title: ['', Validators.required],
      id: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+$/)]],
      order: [1, Validators.required]
    });
  }

  // --- Actions ---
  
  handleSearch(e: Event) {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  toggleFavFilter() {
    this.showOnlyFavorites.update(v => !v);
    this.toast.show(
      this.showOnlyFavorites() ? "پیشاندانی تەنها دڵخوازەکان" : "پیشاندانی هەموو کەناڵەکان",
      "info"
    );
  }

  // --- Auth ---
  
  openLogin() { this.showLoginModal.set(true); }
  closeLogin() { this.showLoginModal.set(false); this.loginForm.reset(); }
  
  async onLogin() {
    if (this.loginForm.invalid) return;
    const { email, password } = this.loginForm.value;
    try {
      await this.fb.login(email, password);
      this.closeLogin();
      this.toast.show("بەخێربێیت ئەدمین", "success");
    } catch (e) {
      this.toast.show("هەڵە هەیە! ئیمەیڵ یان پاسۆرد هەڵەیە", "error");
    }
  }

  async logout() {
    await this.fb.logout();
    this.toast.show("بە سەرکەوتوویی دەرچوویت", "info");
  }

  // --- Category Mgmt ---

  openAddCategory() { this.categoryForm.reset({order: 1}); this.showCategoryModal.set(true); }
  closeCategory() { this.showCategoryModal.set(false); }

  async onAddCategory() {
    if (this.categoryForm.invalid) {
      this.toast.show("تکایە داتاکان بە دروستی پڕبکەوە", "error");
      return;
    }
    const { id, title, order } = this.categoryForm.value;
    try {
      await this.fb.addCategory(id, { title, order });
      this.toast.show("بەشەکە زیادکرا", "success");
      this.closeCategory();
    } catch (e) {
      this.toast.show("کێشەیەک هەیە", "error");
    }
  }

  // --- Channel Mgmt ---

  openAddChannel() {
    if (this.categories().length === 0) {
      this.toast.show("سەرەتا دەبێت بەش زیاد بکەیت!", "error");
      return;
    }
    this.editingChannelId.set(null);
    this.channelForm.reset({category: ''});
    this.showChannelModal.set(true);
  }

  openEditChannel(ch: Channel, e: Event) {
    e.stopPropagation();
    this.editingChannelId.set(ch.id);
    this.channelForm.patchValue(ch);
    this.showChannelModal.set(true);
  }

  async onDeleteChannel(id: string, e: Event) {
    e.stopPropagation();
    if (!confirm("دڵنیای دەسڕێتەوە؟")) return;
    try {
      await this.fb.deleteChannel(id);
      this.toast.show("کەناڵەکە سڕایەوە", "info");
    } catch(e) { console.error(e); }
  }

  closeChannelModal() { this.showChannelModal.set(false); }

  async onSaveChannel() {
    if (this.channelForm.invalid) {
       this.toast.show("تکایە هەموو خانەکان پڕبکەوە", "error");
       return;
    }
    const formVal = this.channelForm.value;
    const finalImage = formVal.image?.trim() || "https://placehold.co/200?text=TV";
    
    const data = { 
      name: formVal.name, 
      url: formVal.url, 
      category: formVal.category, 
      image: finalImage 
    };

    try {
      if (this.editingChannelId()) {
        await this.fb.updateChannel(this.editingChannelId()!, data);
        this.toast.show("کەناڵەکە نوێکرایەوە", "success");
      } else {
        await this.fb.addChannel({ ...data, isFavorite: false });
        this.toast.show("کەناڵی نوێ زیادکرا", "success");
      }
      this.closeChannelModal();
    } catch (e) {
      this.toast.show("کێشەیەک ڕوویدا", "error");
    }
  }

  async toggleFavorite(ch: Channel, e: Event) {
    e.stopPropagation();
    await this.fb.toggleFavorite(ch.id, ch.isFavorite);
  }

  // --- Player ---
  
  playChannel(ch: Channel) {
    this.activeChannel.set(ch);
  }

  closePlayer() {
    this.activeChannel.set(null);
  }
}