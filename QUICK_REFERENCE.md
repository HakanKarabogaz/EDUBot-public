# 🚀 EDUBot Public Repo - Hızlı Başvuru Rehberi

> **Tarih:** 3 Kasım 2025  
> **Amaç:** Gelecekteki commit'lerde hızlı karar verme

---

## ✅ **Public Repo'ya Aktarılabilir Dosyalar**

```
✅ src/renderer/components/*.jsx    # UI bileşenleri
✅ src/renderer/styles/*.css        # CSS stilleri  
✅ src/preload.js                   # IPC pattern (sadece kanal isimleri)
✅ database/academic-schema.sql     # Tablo yapısı (sorgu yok)
✅ vite.config.js                   # Standart config
✅ README.md, LICENSE, SECURITY.md  # Dokümantasyon
✅ docs/screenshots/                # UI görselleri
```

---

## ❌ **Asla Public'e Aktarılmamalı**

```
❌ src/main/workflow-executor.js    # CORE ENGINE
❌ src/main/smart-selector.js       # ALGORITMALAR
❌ src/main/browser-controller.js   # OTOMASYON
❌ src/main/database.js              # İŞ MANTIĞI
❌ src/main/ipc-handlers.js          # BACKEND API
❌ src/main/data-mapper.js           # VERİ İŞLEME
❌ test/*.csv                        # GERÇEK VERİ
❌ .env, *.db, logs/                 # HASSAS VERİLER
```

---

## 📝 **Commit Workflow (3 Adım)**

### **1. Private Repo'da Geliştirme**
```powershell
cd C:\Users\User\OneDrive\Belgeler\PROJELER\EDUBot

# Normal geliştirme
git add .
git commit -m "feat: Yeni özellik"
git push origin main
```

### **2. Public'e Aktarılabilir mi? (Kontrol)**
```powershell
# SORU: Bu dosya rakiplere değer verir mi?
# EVET → Durma, public'e aktarma!
# HAYIR → Adım 3'e geç
```

### **3. Public Repo'ya Sync (Sadece Güvenli Dosyalar)**
```powershell
cd C:\Users\User\OneDrive\Belgeler\PROJELER\EDUBot-public

# Sadece UI dosyalarını kopyala
Copy-Item -Path ..\EDUBot\src\renderer\components\Dashboard.jsx -Destination .\src\renderer\components\ -Force
Copy-Item -Path ..\EDUBot\src\renderer\styles\global.css -Destination .\src\renderer\styles\ -Force

git add .
git commit -m "feat(ui): Dashboard improvements"
git push origin main
```

---

## ⚡ **Hızlı Karar Tablosu**

| Değişiklik Tipi | Private? | Public? | Aksiyon |
|-----------------|----------|---------|---------|
| UI/UX (React) | ✅ | ✅ | Her ikisine de commit |
| CSS Styling | ✅ | ✅ | Her ikisine de commit |
| Backend Logic | ✅ | ❌ | Sadece private'a |
| Database Queries | ✅ | ❌ | Sadece private'a |
| Test Data | ✅ | ❌ | Sadece private'a |
| Documentation | ✅ | ⚠️ | Genel olanı public'e |
| Config Files | ✅ | ⚠️ | Hassas değilse public |

---

## 🔍 **Push Öncesi Kontrol (30 saniye)**

```powershell
cd EDUBot-public

# 1. Hangi dosyalar değişti?
git status --short

# 2. UI/CSS mi yoksa Backend mi?
# UI/CSS → ✅ Güvenli
# Backend → ❌ Push etme!

# 3. Diff kontrol et
git diff HEAD

# 4. Business logic var mı kontrol et
# Yoksa → Push
git push origin main
```

---

## 📁 **Klasör Yapısı ve Durumu**

### Private Repo (EDUBot)
```
EDUBot/
├── src/
│   ├── main/               ❌ PUBLIC'E AKTARILMAZ
│   │   ├── workflow-executor.js
│   │   ├── database.js
│   │   └── ...
│   ├── renderer/           ✅ UI PUBLIC'E GİDEBİLİR
│   │   ├── components/
│   │   └── styles/
│   └── preload.js          ✅ PATTERN PUBLIC'E GİDEBİLİR
├── database/
│   ├── edubot.db           ❌ PUBLIC'E AKTARILMAZ
│   └── academic-schema.sql ✅ ŞEMA PUBLIC'E GİDEBİLİR
├── test/                   ❌ PUBLIC'E AKTARILMAZ
└── docs/                   ✅ SADECE GENEL DÖKÜMANLAR
```

### Public Repo (EDUBot-public)
```
EDUBot-public/
├── src/
│   ├── main/
│   │   ├── workflow-executor-demo.js  ✅ Placeholder
│   │   └── database-demo.js           ✅ Placeholder
│   ├── renderer/           ✅ Full UI
│   │   ├── components/
│   │   └── styles/
│   └── preload.js          ✅ IPC Pattern
├── database/
│   └── academic-schema.sql ✅ Sadece schema
├── docs/                   🔒 .gitignore ile gizli
│   ├── COMMIT_STRATEGY.md  🔒 Local only
│   └── DEVELOPMENT_LOG*.md 🔒 Local only
├── README.md               ✅ Public showcase
├── LICENSE                 ✅ AGPL-3.0
└── SECURITY.md             ✅ Policy
```

---

## 🎯 **Altın Kurallar**

1. **"1 hafta kuralı"**  
   > Eğer bu kod rakibe 1 haftadan fazla zaman kazandırırsa → Private!

2. **"Business logic kuralı"**  
   > İş mantığı, algoritma, optimizasyon → Private!

3. **"Showcase kuralı"**  
   > UI/UX, genel mimari, dokümantasyon → Public olabilir

4. **"Şüphe kuralı"**  
   > Emin değilsen → Private'da kal!

---

## 📞 **Acil Durum**

### Yanlışlıkla Hassas Kod Push Ettiyseniz

```powershell
cd EDUBot-public

# 1. Hemen geri al
git revert HEAD
git push origin main

# 2. Veya daha agresif (son commit'i sil)
git reset --hard HEAD~1
git push -f origin main

# 3. GitHub support'a yazın (gerekirse)
# https://support.github.com/
```

---

## 📊 **Aylık Checklist**

- [ ] Public repo'da hassas dosya var mı?
- [ ] docs/ klasörü .gitignore'da mı?
- [ ] README güncel mi?
- [ ] LICENSE aktif mi?
- [ ] UI showcase çalışıyor mu?
- [ ] Yeni commit'ler güvenli mi?

---

## 📖 **Detaylı Dokümantasyon**

- `docs/COMMIT_STRATEGY.md` - Detaylı git stratejisi (🔒 Local)
- `docs/DEVELOPMENT_LOG_*.md` - Günlük loglar (🔒 Local)
- `README.md` - Public showcase (✅ Public)
- `SECURITY.md` - Güvenlik policy (✅ Public)

---

## 🔗 **Linkler**

- **Private Repo:** https://github.com/HakanKarabogaz/EDUBot
- **Public Repo:** https://github.com/HakanKarabogaz/EDUBot-public
- **Contact:** hakankarabogaz@tarsus.edu.tr

---

**Son Güncelleme:** 3 Kasım 2025  
**Versiyon:** 1.0  
**Durum:** ✅ Aktif
