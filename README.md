# ระบบลงทะเบียนชุมนุม — เขวาไร่ศึกษา
> ย้ายจาก Google Apps Script + Sheets → **Supabase + GitHub Pages**

---

## 📁 โครงสร้างไฟล์

```
club-register/
├── index.html           ← หน้าเว็บหลัก (UI ทั้งหมด)
├── supabase.js          ← config Supabase (แก้ URL และ KEY ตรงนี้)
├── app.js               ← logic ทั้งหมด (login, CRUD, export)
├── supabase_setup.sql   ← SQL สำหรับสร้างตาราง + RLS ใน Supabase
└── README.md
```

---

## 🚀 วิธี Deploy (ทำครั้งเดียว ~15 นาที)

### ขั้นตอนที่ 1 — สร้าง Supabase Project

1. ไปที่ [https://supabase.com](https://supabase.com) → **Start your project**
2. สร้าง Organization และ Project ใหม่ (เลือก Region: **Southeast Asia**)
3. รอ Project พร้อม (~1-2 นาที)
4. ไปที่ **SQL Editor** → วางเนื้อหาทั้งหมดจากไฟล์ `supabase_setup.sql` → กด **Run**

### ขั้นตอนที่ 2 — คัดลอก API Keys

1. ใน Supabase ไปที่ **Project Settings → API**
2. คัดลอก:
   - **Project URL** (เช่น `https://abcxyz.supabase.co`)
   - **anon / public key** (key ยาวๆ)
3. เปิดไฟล์ `supabase.js` แล้วแก้ค่า:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';  // ← วางตรงนี้
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';                  // ← วางตรงนี้
```

### ขั้นตอนที่ 3 — อัปโหลดขึ้น GitHub

```bash
# วิธีที่ 1: ผ่าน Terminal
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/YOUR_USERNAME/club-register.git
git push -u origin main
```

หรือ **วิธีที่ 2:** ลาก folder ทิ้งใน github.com → New repository

### ขั้นตอนที่ 4 — เปิด GitHub Pages

1. ใน repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / folder: **/ (root)**
4. กด Save → รอ ~1 นาที
5. URL ของคุณจะเป็น: `https://YOUR_USERNAME.github.io/club-register/`

---

## 🔑 บัญชีตัวอย่าง (จาก setup SQL)

| Username  | Password | Role    |
|-----------|----------|---------|
| admin     | 1234     | admin   |
| teacher1  | 1234     | teacher |
| student1  | 1234     | student |

> ⚠️ **เปลี่ยนรหัสผ่านทันที** หลังจากทดสอบระบบเรียบร้อยแล้ว

---

## ⚡ ฟีเจอร์ทั้งหมด

| ฟีเจอร์ | รายละเอียด |
|---|---|
| **Login** | Username/Password (3 role: admin, teacher, student) |
| **นักเรียน** | เลือกชุมนุม, ดูสถานะ, กรองตามชั้น |
| **ครู** | สร้างชุมนุมของตัวเอง, ดูรายชื่อนักเรียน, export Excel/PDF |
| **Admin** | จัดการชุมนุม/ผู้ใช้, นำเข้า Excel batch, สรุปผล, reset ระบบ |
| **Export** | Excel (แยกชีตต่อชุมนุม) + PDF |
| **Dark Mode** | จำค่าใน localStorage |

---

## ❓ แก้ปัญหาเบื้องต้น

**ล็อกอินไม่ได้ / ข้อมูลไม่แสดง**
→ เช็ค `supabase.js` ว่า URL และ KEY ถูกต้อง
→ เปิด DevTools (F12) → Console ดู error message

**CORS Error**
→ Supabase อนุญาต CORS ทุก origin โดย default สำหรับ anon key — ไม่ต้องตั้งค่าเพิ่ม

**ข้อมูลไม่บันทึก**
→ ตรวจสอบว่ารัน `supabase_setup.sql` ครบแล้ว (โดยเฉพาะส่วน RLS Policy)

---

พัฒนาโดย ครูปัณณธร กุลาศรี | โรงเรียนเขวาไร่ศึกษา สพม.มหาสารคาม
