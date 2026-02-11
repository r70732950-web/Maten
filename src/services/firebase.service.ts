import { Injectable, signal } from '@angular/core';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsdBBTuCA0cQL8QtJkSPYy8N_Dmr3K_bI",
  authDomain: "maten-tv.firebaseapp.com",
  projectId: "maten-tv",
  storageBucket: "maten-tv.firebasestorage.app",
  messagingSenderId: "196479152493",
  appId: "1:196479152493:web:82860b7f878a47b731ea64",
  measurementId: "G-0BB5EY6TNW"
};

export interface Channel {
  id: string;
  name: string;
  url: string;
  category: string;
  image: string;
  isFavorite: boolean;
}

export interface Category {
  id: string;
  title: string;
  order: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app = initializeApp(firebaseConfig);
  private db = getFirestore(this.app);
  private auth = getAuth(this.app);

  channels = signal<Channel[]>([]);
  categories = signal<Category[]>([]);
  currentUser = signal<any>(null);
  isAdmin = signal<boolean>(false);

  constructor() {
    this.initAuthListener();
    this.initDataListeners();
  }

  private initAuthListener() {
    onAuthStateChanged(this.auth, (user: any) => {
      if (user) {
        this.currentUser.set(user);
        this.isAdmin.set(true);
      } else {
        this.currentUser.set(null);
        this.isAdmin.set(false);
      }
    });
  }

  private initDataListeners() {
    const channelsCollection = collection(this.db, "channels");
    const categoriesCollection = collection(this.db, "categories");

    onSnapshot(channelsCollection, (snapshot: any) => {
      const data: Channel[] = [];
      snapshot.docs.forEach((doc: any) => { 
        data.push({ ...doc.data(), id: doc.id }); 
      });
      data.sort((a, b) => (a.name > b.name) ? 1 : -1);
      this.channels.set(data);
    });

    onSnapshot(categoriesCollection, (snapshot: any) => {
      const data: Category[] = [];
      snapshot.docs.forEach((doc: any) => { 
        data.push({ id: doc.id, ...doc.data() }); 
      });
      data.sort((a, b) => a.order - b.order);
      this.categories.set(data);
    });
  }

  async login(email: string, pass: string) {
    return signInWithEmailAndPassword(this.auth, email, pass);
  }

  async logout() {
    return signOut(this.auth);
  }

  async addChannel(data: Omit<Channel, 'id'>) {
    return addDoc(collection(this.db, "channels"), data);
  }

  async updateChannel(id: string, data: Partial<Channel>) {
    return updateDoc(doc(this.db, "channels", id), data);
  }

  async deleteChannel(id: string) {
    return deleteDoc(doc(this.db, "channels", id));
  }

  async addCategory(id: string, data: Omit<Category, 'id'>) {
    return setDoc(doc(this.db, "categories", id), data);
  }

  async toggleFavorite(id: string, currentStatus: boolean) {
    return updateDoc(doc(this.db, "channels", id), { isFavorite: !currentStatus });
  }
}