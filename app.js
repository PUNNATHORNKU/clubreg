// =============================================================
// app.js - Logic ทั้งหมด (แปลงจาก Google Apps Script → Supabase)
// =============================================================

let currentUser = null;

// ─── Loader ──────────────────────────────────────────────────
function showLoader(text = 'กำลังประมวลผล...') {
  document.getElementById('loader-text').innerText = text;
  document.getElementById('global-loader').classList.remove('hidden');
}
function hideLoader() {
  document.getElementById('global-loader').classList.add('hidden');
}

// ─── Page Navigation ─────────────────────────────────────────
function switchPage(pageId) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

// ─── Dark Mode ───────────────────────────────────────────────
function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  document.getElementById('theme-icon').innerText = html.classList.contains('dark') ? 'light_mode' : 'dark_mode';
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
}
function initTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-icon').innerText = 'light_mode';
  }
}

// ─── Change Password Modal ────────────────────────────────────
function showChangePasswordModal() {
  document.getElementById('change-password-modal').classList.remove('hidden');
}
function hideChangePasswordModal() {
  document.getElementById('change-password-modal').classList.add('hidden');
  document.getElementById('change-password-form').reset();
}
async function submitChangePassword(e) {
  e.preventDefault();
  const username   = document.getElementById('cp-username').value.trim();
  const oldPass    = document.getElementById('cp-old').value;
  const newPass    = document.getElementById('cp-new').value;
  const confirmPass = document.getElementById('cp-confirm').value;

  if (newPass !== confirmPass) {
    Swal.fire('แจ้งเตือน', 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน', 'warning');
    return;
  }
  showLoader('กำลังเปลี่ยนรหัสผ่าน...');
  try {
    const { data: users, error } = await db
      .from('users')
      .select('id, password')
      .eq('username', username)
      .single();

    if (error || !users) throw new Error('ไม่พบชื่อผู้ใช้งานนี้ในระบบ');
    if (users.password !== oldPass) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');

    const { error: updateErr } = await db
      .from('users')
      .update({ password: newPass })
      .eq('id', users.id);

    if (updateErr) throw updateErr;
    hideLoader();
    Swal.fire('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่', 'success')
      .then(() => hideChangePasswordModal());
  } catch (err) {
    hideLoader();
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

// ─── Login / Logout ──────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  showLoader('กำลังตรวจสอบข้อมูล...');
  try {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    hideLoader();
    if (error || !data) {
      Swal.fire('แจ้งเตือน', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      return;
    }
    currentUser = data;
    document.getElementById('btn-logout').classList.remove('hidden');
    document.getElementById('login-form').reset();
    routeUser(currentUser.role);
  } catch (err) {
    hideLoader();
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

function logout() {
  currentUser = null;
  document.getElementById('btn-logout').classList.add('hidden');
  switchPage('login-section');
}

function routeUser(role) {
  if (role === 'student') {
    loadStudentClubs();
    switchPage('student-section');
  } else if (role === 'admin') {
    showAdminTab('manage-clubs');
    switchPage('admin-section');
  } else if (role === 'teacher') {
    loadTeacherDashboard();
    switchPage('dashboard-section');
  }
}

// ─── Student ─────────────────────────────────────────────────
async function loadStudentClubs() {
  document.getElementById('student-name-display').innerText  = currentUser.name;
  document.getElementById('student-id-display').innerText   = currentUser.username;
  document.getElementById('student-grade-display').innerText = currentUser.grade;

  showLoader('กำลังดึงข้อมูลชุมนุม...');
  try {
    // ตรวจว่าลงทะเบียนแล้วหรือยัง
    const { data: reg } = await db
      .from('registrations')
      .select('club_id')
      .eq('student_id', currentUser.id)
      .maybeSingle();

    const enrolledDiv  = document.getElementById('enrolled-status');
    const availableDiv = document.getElementById('available-clubs-container');
    const container    = document.getElementById('club-list');

    if (reg) {
      // ดึงข้อมูลชุมนุมที่ลงทะเบียนไว้
      const { data: club } = await db
        .from('clubs')
        .select('name, users!clubs_teacher_id_fkey(name)')
        .eq('id', reg.club_id)
        .single();

      availableDiv.classList.add('hidden');
      enrolledDiv.classList.remove('hidden');
      document.getElementById('enrolled-club-name').innerText    = club?.name || '-';
      document.getElementById('enrolled-club-teacher').innerText = club?.users?.name || 'ไม่ระบุ';
    } else {
      enrolledDiv.classList.add('hidden');
      availableDiv.classList.remove('hidden');

      // ดึงชุมนุมทั้งหมดพร้อมจำนวนที่ลงทะเบียน
      const { data: clubs } = await db
        .from('clubs')
        .select('*, users!clubs_teacher_id_fkey(name), registrations(count)');

      const grade = currentUser.grade;
      const filtered = (clubs || []).filter(c =>
        c.target_grade.split(',').map(g => g.trim()).includes(grade)
      );

      container.innerHTML = filtered.length === 0
        ? '<p class="col-span-full text-center text-gray-500">ไม่พบชุมนุมสำหรับชั้นของคุณ</p>'
        : '';

      for (const club of filtered) {
        const enrolled = club.registrations?.[0]?.count || 0;
        const isFull   = enrolled >= club.max_seats;
        container.innerHTML += `
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border-t-4 ${isFull ? 'border-red-500 opacity-75' : 'border-school-yellow'}">
            <h3 class="text-xl font-bold mb-1">${club.name}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center">
              <span class="material-icons mr-1 text-[16px] text-gray-400">person</span> ครูผู้สอน: ${club.users?.name || 'ไม่ระบุ'}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 flex items-center">
              <span class="material-icons mr-1 text-[16px] text-gray-400">group</span> รับ ${enrolled} / ${club.max_seats} คน
            </p>
            <button onclick="enrollClub('${club.id}')" class="w-full py-2 rounded font-medium shadow-sm flex justify-center items-center ${isFull ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-school-yellow hover:bg-school-yellowDark text-school-black'}" ${isFull ? 'disabled' : ''}>
              ${isFull ? '<span class="material-icons mr-1">block</span> เต็มแล้ว' : '<span class="material-icons mr-1">edit_document</span> ลงทะเบียน'}
            </button>
          </div>`;
      }
    }
    hideLoader();
  } catch (err) {
    hideLoader();
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function enrollClub(clubId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลงทะเบียน?',
    text: 'คุณสามารถเลือกได้เพียง 1 ชุมนุมเท่านั้น',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#D97706',
    cancelButtonColor: '#6B7280',
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });
  if (!result.isConfirmed) return;

  showLoader('กำลังลงทะเบียน...');
  try {
    // ตรวจสอบ seat ก่อน
    const { count } = await db
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    const { data: club } = await db.from('clubs').select('max_seats').eq('id', clubId).single();
    if (count >= club.max_seats) {
      hideLoader();
      Swal.fire('แจ้งเตือน', 'ชุมนุมนี้เต็มแล้ว', 'warning');
      return;
    }

    const newId = 'R' + Date.now();
    const { error } = await db.from('registrations').insert({
      id: newId, student_id: currentUser.id, club_id: clubId
    });

    hideLoader();
    if (error) throw error;
    Swal.fire('สำเร็จ', 'ลงทะเบียนชุมนุมสำเร็จ!', 'success').then(() => loadStudentClubs());
  } catch (err) {
    hideLoader();
    Swal.fire('ข้อผิดพลาด', err.message === 'duplicate key value violates unique constraint "registrations_student_id_key"'
      ? 'คุณได้ลงทะเบียนชุมนุมไปแล้ว' : err.message, 'error');
  }
}

// ─── Teacher ─────────────────────────────────────────────────
async function loadTeacherDashboard() {
  showLoader('กำลังโหลดข้อมูล...');
  try {
    const { data: club } = await db
      .from('clubs')
      .select('id, name')
      .eq('teacher_id', currentUser.id)
      .maybeSingle();

    let infoHtml = `<b>ครูผู้สอน:</b> ${currentUser.name} &nbsp;|&nbsp; <b>ชุมนุม:</b> ${club ? club.name : 'ยังไม่ได้ระบุชุมนุมที่รับผิดชอบ'}`;
    if (!club) {
      infoHtml += ` <button onclick="showCreateClubDialog()" class="ml-3 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow text-sm transition">
        <span class="material-icons text-[16px] align-middle">add_circle</span> สร้างชุมนุมของคุณ
      </button>`;
    }
    document.getElementById('teacher-info-display').innerHTML = infoHtml;
    document.getElementById('pdf-teacher-name').innerText = currentUser.name;
    document.getElementById('pdf-club-name').innerText    = club ? club.name : '-';

    const tbody  = document.getElementById('table-teacher-students-body');
    const noData = document.getElementById('teacher-no-data');
    const table  = document.getElementById('teacher-students-table');
    tbody.innerHTML = '';

    if (!club) {
      table.style.display = 'none';
      noData.style.display = 'block';
      noData.classList.remove('hidden');
      hideLoader();
      return;
    }

    const { data: regs } = await db
      .from('registrations')
      .select('student_id, users!registrations_student_id_fkey(id, username, name, grade)')
      .eq('club_id', club.id);

    const students = (regs || []).map(r => r.users);

    if (students.length === 0) {
      table.style.display = 'none';
      noData.style.display = 'block';
      noData.classList.remove('hidden');
    } else {
      table.style.display = 'table';
      noData.style.display = 'none';
      tbody.innerHTML = students.map((s, i) => `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
          <td class="py-2 px-4 text-center">${i + 1}</td>
          <td class="py-2 px-4">${s.username}</td>
          <td class="py-2 px-4">${s.name}</td>
          <td class="py-2 px-4">${s.grade}</td>
          <td class="py-2 px-4 text-center action-col">
            <button onclick="confirmRemoveStudentByTeacher('${s.id}', '${s.name}')" class="text-red-400 hover:text-red-600 transition" title="ลบออกจากชุมนุม">
              <span class="material-icons text-[18px]">person_remove</span>
            </button>
          </td>
        </tr>
      `).join('');
    }
    hideLoader();
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function confirmRemoveStudentByTeacher(studentId, studentName) {
  const result = await Swal.fire({
    title: 'ลบรายชื่อนักเรียน?',
    text: `ต้องการลบ ${studentName} ออกเพื่อให้ลงทะเบียนใหม่ใช่หรือไม่?`,
    icon: 'question', showCancelButton: true,
    confirmButtonColor: '#d33', cancelButtonColor: '#6B7280',
    confirmButtonText: 'ยืนยันการลบ', cancelButtonText: 'ยกเลิก'
  });
  if (!result.isConfirmed) return;
  showLoader('กำลังดำเนินการ...');
  try {
    const { error } = await db.from('registrations').delete().eq('student_id', studentId);
    if (error) throw error;
    hideLoader();
    Swal.fire('เรียบร้อย', 'ลบข้อมูลสำเร็จ นักเรียนสามารถลงทะเบียนใหม่ได้แล้ว', 'success');
    loadTeacherDashboard();
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function showCreateClubDialog() {
  const result = await Swal.fire({
    title: 'สร้างชุมนุมใหม่',
    html: `
      <div class="text-left">
        <label class="block text-sm font-medium mt-2 text-gray-700">ชื่อชุมนุม</label>
        <input id="swal-club-name" class="w-full border border-gray-300 rounded p-2 mt-1 focus:outline-none focus:border-blue-500" placeholder="เช่น ชุมนุมดนตรีสากล">
        <label class="block text-sm font-medium mt-4 mb-1 text-gray-700">ระดับชั้นที่เปิดรับ</label>
        <div class="grid grid-cols-3 gap-2 p-2 border rounded border-gray-300 bg-gray-50 text-sm">
          ${['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'].map(g => `<label><input type="checkbox" name="swal-grades" value="${g}"> ${g}</label>`).join('')}
        </div>
        <label class="block text-sm font-medium mt-4 text-gray-700">จำนวนนักเรียนที่รับ (คน)</label>
        <input id="swal-club-max" type="number" class="w-full border border-gray-300 rounded p-2 mt-1 focus:outline-none focus:border-blue-500" value="30">
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'บันทึกชุมนุม', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#3B82F6',
    preConfirm: () => {
      const name   = document.getElementById('swal-club-name').value.trim();
      const max    = document.getElementById('swal-club-max').value.trim();
      const grades = Array.from(document.querySelectorAll('input[name="swal-grades"]:checked')).map(el => el.value);
      if (!name || grades.length === 0 || !max) {
        Swal.showValidationMessage('กรุณากรอกข้อมูลและเลือกระดับชั้นให้ครบถ้วน');
        return false;
      }
      return { name, grade: grades.join(','), max: parseInt(max) };
    }
  });

  if (!result.isConfirmed) return;
  showLoader('กำลังสร้างชุมนุม...');
  try {
    const newId = 'C' + Date.now();
    const { error } = await db.from('clubs').insert({
      id: newId,
      name: result.value.name,
      teacher_id: currentUser.id,
      target_grade: result.value.grade,
      max_seats: result.value.max
    });
    if (error) throw error;
    hideLoader();
    Swal.fire('สำเร็จ', `สร้างชุมนุม ${result.value.name} สำเร็จ!`, 'success');
    loadTeacherDashboard();
  } catch (err) {
    hideLoader();
    Swal.fire('ไม่สามารถสร้างได้', err.message, 'warning');
  }
}

function exportTeacherExcel() {
  document.querySelectorAll('.action-col').forEach(el => el.style.display = 'none');
  const table    = document.getElementById('teacher-students-table');
  const clubName = document.getElementById('pdf-club-name').innerText;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'รายชื่อนักเรียน' });
  XLSX.writeFile(wb, `รายชื่อนักเรียน_ชุมนุม_${clubName}.xlsx`);
  document.querySelectorAll('.action-col').forEach(el => el.style.display = '');
}

function exportTeacherPDF() {
  document.querySelectorAll('.action-col').forEach(el => el.style.display = 'none');
  const element  = document.getElementById('teacher-print-area');
  const header   = document.getElementById('pdf-header');
  const clubName = document.getElementById('pdf-club-name').innerText;
  const origClass = element.className;
  element.className = 'bg-white text-black p-8';
  header.classList.remove('hidden');

  showLoader('กำลังสร้างไฟล์ PDF...');
  html2pdf().set({
    margin: 0.5, filename: `รายชื่อนักเรียน_ชุมนุม_${clubName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'A4', orientation: 'portrait' }
  }).from(element).save().then(() => {
    hideLoader();
    header.classList.add('hidden');
    element.className = origClass;
    document.querySelectorAll('.action-col').forEach(el => el.style.display = '');
  });
}

// ─── Admin ────────────────────────────────────────────────────
function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    if (!btn.id.includes('reset')) {
      btn.classList.remove('bg-school-yellow', 'text-school-black');
      btn.classList.add('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');
    }
  });

  const activeBtn = document.getElementById('btn-tab-' + tab);
  if (activeBtn && !tab.includes('reset')) {
    activeBtn.classList.add('bg-school-yellow', 'text-school-black');
    activeBtn.classList.remove('bg-gray-200', 'text-gray-700', 'dark:bg-gray-700', 'dark:text-gray-300');
  }

  if (tab === 'manage-clubs') loadAdminClubData();
  if (tab === 'manage-users') loadAdminUserData();
  if (tab === 'summary')      loadAdminSummary();
}

function toggleGradeSelect() {
  document.getElementById('grade-select-wrapper').style.display =
    document.getElementById('user-role').value === 'student' ? 'block' : 'none';
}

async function loadAdminClubData() {
  try {
    const { data: teachers } = await db.from('users').select('id, name').eq('role', 'teacher');
    document.getElementById('club-teacher').innerHTML =
      (teachers || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    const { data: clubs } = await db.from('clubs').select('*');
    document.getElementById('table-clubs-body').innerHTML = (clubs || []).map(c => `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
        <td class="py-2 px-4">${c.name}</td>
        <td class="py-2 px-4">${c.target_grade}</td>
        <td class="py-2 px-4 text-center">${c.max_seats}</td>
        <td class="py-2 px-4 text-center whitespace-nowrap">
          <button onclick="showEditClubDialog('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.target_grade}','${c.max_seats}')" class="text-orange-400 hover:text-orange-600 transition mr-2" title="แก้ไข">
            <span class="material-icons text-[20px] align-middle">edit</span>
          </button>
          <button onclick="confirmDeleteClub('${c.id}','${c.name.replace(/'/g,"\\'")}') " class="text-red-500 hover:text-red-700 p-1 transition" title="ลบชุมนุมนี้">
            <span class="material-icons text-[20px] align-middle">delete_forever</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function showEditClubDialog(id, name, currentGrades, max) {
  const selectedGrades = currentGrades.split(',').map(g => g.trim());
  const result = await Swal.fire({
    title: 'แก้ไขรายละเอียดชุมนุม',
    html: `
      <div class="text-left text-sm">
        <p class="mb-2 text-gray-500 font-bold">รหัสชุมนุม: ${id}</p>
        <label class="block font-medium text-gray-700">ชื่อชุมนุม</label>
        <input id="edit-club-name" class="w-full border border-gray-300 rounded p-2 mb-3 mt-1 focus:outline-none" value="${name}">
        <label class="block font-medium text-gray-700 mb-1">ระดับชั้นที่เปิดรับ</label>
        <div class="grid grid-cols-3 gap-2 p-2 border border-gray-300 rounded bg-gray-50 mb-3">
          ${['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'].map(g => `
            <label class="flex items-center"><input type="checkbox" name="edit-grades" value="${g}" ${selectedGrades.includes(g) ? 'checked' : ''}> <span class="ml-1">${g}</span></label>`).join('')}
        </div>
        <label class="block font-medium text-gray-700">จำนวนนักเรียนที่รับ (คน)</label>
        <input id="edit-club-max" type="number" class="w-full border border-gray-300 rounded p-2 mt-1" value="${max}">
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'บันทึกการแก้ไข', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#D97706',
    preConfirm: () => {
      const newName   = document.getElementById('edit-club-name').value.trim();
      const newMax    = document.getElementById('edit-club-max').value;
      const newGrades = Array.from(document.querySelectorAll('input[name="edit-grades"]:checked')).map(el => el.value);
      if (!newName || newGrades.length === 0 || !newMax) {
        Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
        return false;
      }
      return { name: newName, grades: newGrades.join(','), max: parseInt(newMax) };
    }
  });

  if (!result.isConfirmed) return;
  showLoader('กำลังบันทึก...');
  try {
    const { error } = await db.from('clubs').update({
      name: result.value.name, target_grade: result.value.grades, max_seats: result.value.max
    }).eq('id', id);
    if (error) throw error;
    hideLoader();
    Swal.fire('สำเร็จ', 'อัปเดตข้อมูลชุมนุมเรียบร้อยแล้ว', 'success');
    loadAdminClubData();
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function confirmDeleteClub(clubId, clubName) {
  const result = await Swal.fire({
    title: `ลบชุมนุม "${clubName}"?`,
    text: 'นักเรียนที่ลงทะเบียนไว้จะถูกปลดออกทั้งหมดและลงใหม่ได้',
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#d33', cancelButtonColor: '#6B7280',
    confirmButtonText: 'ยืนยันการลบ', cancelButtonText: 'ยกเลิก'
  });
  if (!result.isConfirmed) return;
  showLoader('กำลังลบชุมนุม...');
  try {
    await db.from('registrations').delete().eq('club_id', clubId);
    const { error } = await db.from('clubs').delete().eq('id', clubId);
    if (error) throw error;
    hideLoader();
    Swal.fire('สำเร็จ', 'ลบชุมนุมเรียบร้อยแล้ว', 'success');
    loadAdminClubData();
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function loadAdminUserData() {
  try {
    const { data: users } = await db.from('users').select('*').order('role').order('name');
    document.getElementById('table-users-body').innerHTML = (users || []).map(u => `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm">
        <td class="py-2 px-2">${u.name}</td>
        <td class="py-2 px-2">${u.role}</td>
        <td class="py-2 px-2">${u.username}</td>
        <td class="py-2 px-2">${u.grade}</td>
        <td class="py-2 px-2 text-center">
          <button onclick="confirmDeleteUser('${u.id}','${u.name.replace(/'/g,"\\'")}') " class="text-red-500 hover:text-red-700 p-1 transition" title="ลบผู้ใช้นี้">
            <span class="material-icons text-[18px]">delete_forever</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function confirmDeleteUser(userId, userName) {
  if (userId === 'U001') {
    Swal.fire('ปฏิเสธ', 'ไม่สามารถลบผู้ดูแลระบบหลักได้', 'warning');
    return;
  }
  const result = await Swal.fire({
    title: 'ยืนยันการลบผู้ใช้?',
    text: `ต้องการลบ "${userName}" ออกจากระบบใช่หรือไม่? ข้อมูลจะถูกลบถาวร`,
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#d33', cancelButtonColor: '#6B7280',
    confirmButtonText: 'ยืนยันการลบ', cancelButtonText: 'ยกเลิก'
  });
  if (!result.isConfirmed) return;
  showLoader('กำลังลบผู้ใช้งาน...');
  try {
    await db.from('registrations').delete().eq('student_id', userId);
    const { error } = await db.from('users').delete().eq('id', userId);
    if (error) throw error;
    hideLoader();
    Swal.fire('สำเร็จ', 'ลบผู้ใช้งานเรียบร้อยแล้ว', 'success');
    loadAdminUserData();
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

async function saveClub(e) {
  e.preventDefault();
  const name      = document.getElementById('club-name').value.trim();
  const teacherId = document.getElementById('club-teacher').value;
  const maxSeats  = parseInt(document.getElementById('club-max').value);
  const grades    = Array.from(document.querySelectorAll('input[name="grades"]:checked')).map(el => el.value);

  if (grades.length === 0) {
    Swal.fire('แจ้งเตือน', 'กรุณาเลือกระดับชั้นอย่างน้อย 1 ระดับ', 'warning');
    return;
  }
  showLoader('กำลังบันทึกชุมนุม...');
  try {
    const { error } = await db.from('clubs').insert({
      id: 'C' + Date.now(), name, teacher_id: teacherId, target_grade: grades.join(','), max_seats: maxSeats
    });
    if (error) throw error;
    hideLoader();
    Swal.fire('สำเร็จ', 'เพิ่มชุมนุมสำเร็จ', 'success').then(() => {
      document.getElementById('form-add-club').reset();
      loadAdminClubData();
    });
  } catch (err) {
    hideLoader();
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

async function saveUser(e) {
  e.preventDefault();
  const role     = document.getElementById('user-role').value;
  const name     = document.getElementById('user-fullname').value.trim();
  const grade    = role === 'student' ? document.getElementById('user-grade').value : '-';
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;

  showLoader('กำลังบันทึกผู้ใช้...');
  try {
    const { error } = await db.from('users').insert({
      id: 'U' + Date.now(), username, password, role, name, grade
    });
    if (error) throw error;
    hideLoader();
    Swal.fire('สำเร็จ', 'เพิ่มผู้ใช้งานสำเร็จ', 'success').then(() => {
      document.getElementById('form-add-user').reset();
      loadAdminUserData();
    });
  } catch (err) {
    hideLoader();
    Swal.fire('ข้อผิดพลาด', err.message === 'duplicate key value violates unique constraint "users_username_key"'
      ? 'Username นี้ถูกใช้งานแล้ว' : err.message, 'error');
  }
}

async function handleFileUpload() {
  const f = document.getElementById('file-upload-users').files[0];
  if (!f) {
    Swal.fire('แจ้งเตือน', 'กรุณาเลือกไฟล์ Excel/CSV ก่อนนำเข้า', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const rows = json.map((u, i) => ({
        id:       'U' + (Date.now() + i),
        username: String(u.username || u.Username || '').trim(),
        password: String(u.password || u.Password || '').trim(),
        role:     (u.role || u.Role || 'student').toString().toLowerCase().trim(),
        name:     String(u.name || u.Name || '').trim(),
        grade:    String(u.grade || u.Grade || '-').trim()
      })).filter(u => u.username && u.password && u.name);

      if (rows.length === 0) {
        Swal.fire('แจ้งเตือน', 'ไม่พบข้อมูลที่ถูกต้องในไฟล์', 'warning');
        return;
      }
      showLoader(`กำลังบันทึกข้อมูล ${rows.length} รายการ...`);
      const { error } = await db.from('users').upsert(rows, { onConflict: 'username' });
      if (error) throw error;
      hideLoader();
      Swal.fire('สำเร็จ', `นำเข้าผู้ใช้งาน ${rows.length} รายการเรียบร้อยแล้ว`, 'success')
        .then(() => loadAdminUserData());
    } catch (err) {
      hideLoader();
      Swal.fire('ข้อผิดพลาด', 'ไฟล์มีปัญหา: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(f);
}

// ─── Admin Summary ────────────────────────────────────────────
let lastSummaryData = null;

async function loadAdminSummary() {
  showLoader('กำลังโหลดข้อมูลสรุป...');
  try {
    const [{ data: clubs }, { data: users }, { data: regs }] = await Promise.all([
      db.from('clubs').select('*'),
      db.from('users').select('*'),
      db.from('registrations').select('*')
    ]);

    // สร้าง summary per club
    const clubSummary = (clubs || []).map(c => {
      const teacher   = (users || []).find(u => u.id === c.teacher_id);
      const clubRegs  = (regs  || []).filter(r => r.club_id === c.id);
      const students  = clubRegs.map(r => {
        const s = (users || []).find(u => u.id === r.student_id);
        return { systemId: r.student_id, id: s?.username || r.student_id, name: s?.name || 'ไม่พบชื่อ', grade: s?.grade || '-' };
      });
      return {
        name: c.name, teacher: teacher?.name || 'ไม่พบข้อมูลครู',
        grade: c.target_grade, enrolled: students.length, max: c.max_seats,
        remaining: c.max_seats - students.length,
        status: students.length >= c.max_seats ? 'เต็ม' : 'ว่าง ' + (c.max_seats - students.length),
        students
      };
    });

    const registeredIds = (regs || []).map(r => r.student_id);
    const unregistered  = (users || [])
      .filter(u => u.role === 'student' && !registeredIds.includes(u.id))
      .map(u => ({ id: u.username, name: u.name, grade: u.grade }));

    const assignedTeacherIds = (clubs || []).map(c => c.teacher_id).filter(Boolean);
    const unassignedTeachers = (users || [])
      .filter(u => u.role === 'teacher' && !assignedTeacherIds.includes(u.id))
      .map(u => ({ id: u.id, name: u.name }));

    lastSummaryData = { clubSummary, unregistered, unassignedTeachers };

    // Render clubs
    const clubsContainer = document.getElementById('summary-clubs-container');
    clubsContainer.innerHTML = clubSummary.map((c, index) => {
      const studentRows = c.students.length > 0
        ? c.students.map((s, i) => `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">
              <td class="py-1 px-3 text-center">${i+1}</td>
              <td class="py-1 px-3">${s.id}</td>
              <td class="py-1 px-3">${s.name}</td>
              <td class="py-1 px-3 text-center">${s.grade}</td>
              <td class="py-1 px-3 text-center action-col">
                <button onclick="confirmRemoveStudentByAdmin('${s.systemId}','${s.name.replace(/'/g,"\\'")}') " class="text-red-400 hover:text-red-600 transition">
                  <span class="material-icons text-[18px]">person_remove</span>
                </button>
              </td>
            </tr>`).join('')
        : `<tr><td colspan="5" class="py-3 px-3 text-center text-gray-500 text-sm">ยังไม่มีนักเรียนลงทะเบียน</td></tr>`;

      return `
        <div class="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
          <div class="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h4 class="font-bold text-lg text-school-yellowDark dark:text-school-yellow inline-block mr-2">${index+1}. ${c.name}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">ครูผู้สอน: ${c.teacher} &nbsp;|&nbsp; ระดับชั้นที่รับ: ${c.grade}</p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <span class="px-3 py-1.5 rounded-full font-medium text-xs border ${c.remaining <= 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}">
                ลงทะเบียน: ${c.enrolled} / ${c.max}
              </span>
              <button onclick="toggleClubStudents(${index})" class="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 rounded text-sm flex items-center transition border border-gray-300 dark:border-gray-600">
                <span class="material-icons text-[18px] mr-1" id="icon-toggle-club-${index}">visibility</span> ซ่อน/แสดง
              </button>
            </div>
          </div>
          <div id="club-students-container-${index}" class="hidden border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50 club-table-container">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
                    <th class="py-2 px-3 w-16 text-center font-medium">ลำดับ</th>
                    <th class="py-2 px-3 w-32 font-medium">รหัสนักเรียน</th>
                    <th class="py-2 px-3 font-medium">ชื่อ-นามสกุล</th>
                    <th class="py-2 px-3 w-24 text-center font-medium">ชั้น</th>
                    <th class="py-2 px-3 w-20 text-center font-medium action-col">จัดการ</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800">${studentRows}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }).join('');

    // Render unregistered students
    document.getElementById('unreg-count').innerText = unregistered.length;
    document.getElementById('unregistered-body').innerHTML = unregistered.map(u => `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">
        <td class="py-2 px-3">${u.id}</td>
        <td class="py-2 px-3">${u.name}</td>
        <td class="py-2 px-3 text-center">${u.grade}</td>
      </tr>`).join('');

    // Render unassigned teachers
    document.getElementById('unassigned-count').innerText = unassignedTeachers.length;
    document.getElementById('unassigned-body').innerHTML = unassignedTeachers.length > 0
      ? unassignedTeachers.map((t, i) => `
          <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">
            <td class="py-2 px-3 text-center">${i+1}</td>
            <td class="py-2 px-3">${t.name}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" class="py-3 px-3 text-center text-gray-500 text-sm">ไม่มีครูตกค้าง (ครูทุกคนมีชุมนุมหมดแล้ว)</td></tr>`;

    hideLoader();
  } catch (err) {
    hideLoader();
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

async function confirmRemoveStudentByAdmin(studentId, studentName) {
  const result = await Swal.fire({
    title: 'ลบรายชื่อนักเรียน?',
    text: `ต้องการลบ ${studentName} ออกเพื่อให้ลงทะเบียนใหม่ใช่หรือไม่?`,
    icon: 'question', showCancelButton: true,
    confirmButtonColor: '#d33', cancelButtonColor: '#6B7280',
    confirmButtonText: 'ยืนยันการลบ', cancelButtonText: 'ยกเลิก'
  });
  if (!result.isConfirmed) return;
  showLoader('กำลังดำเนินการ...');
  try {
    const { error } = await db.from('registrations').delete().eq('student_id', studentId);
    if (error) throw error;
    hideLoader();
    Swal.fire('เรียบร้อย', 'ลบข้อมูลสำเร็จ', 'success');
    loadAdminSummary();
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

// ─── Reset System ─────────────────────────────────────────────
async function confirmReset(type) {
  const map = {
    registrations: { title: 'ล้างข้อมูลการลงทะเบียน?', text: 'สถานะทุกคนจะถูกรีเซ็ตเป็นยังไม่ลงทะเบียน' },
    students:      { title: 'ล้างข้อมูลบัญชีนักเรียน?', text: 'รายชื่อนักเรียนจะถูกลบออกจากระบบทั้งหมด ไม่สามารถกู้คืนได้!' },
    clubs:         { title: 'ล้างข้อมูลชุมนุม?', text: 'รายวิชาชุมนุมทั้งหมดจะถูกลบออกจากระบบ!' }
  };
  const result = await Swal.fire({
    title: map[type].title, text: map[type].text, icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#d33', cancelButtonColor: '#6B7280',
    confirmButtonText: 'ยืนยันการลบ', cancelButtonText: 'ยกเลิก'
  });
  if (!result.isConfirmed) return;

  showLoader('กำลังลบข้อมูล...');
  try {
    if (type === 'registrations') {
      await db.from('registrations').delete().neq('id', '___none___');
    } else if (type === 'students') {
      const { data: students } = await db.from('users').select('id').eq('role', 'student');
      if (students?.length) {
        await db.from('registrations').delete().in('student_id', students.map(s => s.id));
        await db.from('users').delete().eq('role', 'student');
      }
    } else if (type === 'clubs') {
      await db.from('registrations').delete().neq('id', '___none___');
      await db.from('clubs').delete().neq('id', '___none___');
    }
    hideLoader();
    Swal.fire('สำเร็จ', 'ล้างข้อมูลเรียบร้อยแล้ว', 'success');
  } catch (err) {
    hideLoader();
    Swal.fire('ผิดพลาด', err.message, 'error');
  }
}

// ─── Toggle Visibility ────────────────────────────────────────
function toggleClubStudents(index) {
  const container = document.getElementById(`club-students-container-${index}`);
  const icon      = document.getElementById(`icon-toggle-club-${index}`);
  if (!container) return;
  const hidden = container.classList.toggle('hidden');
  icon.innerText = hidden ? 'visibility' : 'visibility_off';
}
function toggleUnregStudents() {
  const container = document.getElementById('unreg-students-container');
  const icon      = document.getElementById('icon-toggle-unreg');
  const hidden    = container.classList.toggle('hidden');
  icon.innerText  = hidden ? 'visibility' : 'visibility_off';
}
function toggleUnassignedTeachers() {
  const container = document.getElementById('unassigned-container');
  const icon      = document.getElementById('icon-toggle-unassigned');
  const hidden    = container.classList.toggle('hidden');
  icon.innerText  = hidden ? 'visibility' : 'visibility_off';
}

// ─── Export ───────────────────────────────────────────────────
function exportToExcel() {
  if (!lastSummaryData) {
    Swal.fire('ไม่พบข้อมูล', 'กรุณารอให้ข้อมูลโหลดเสร็จก่อน', 'error');
    return;
  }
  const wb = XLSX.utils.book_new();

  lastSummaryData.clubSummary.forEach(club => {
    const sheetData = [
      ['ชื่อชุมนุม', club.name], ['ครูที่ปรึกษา', club.teacher],
      ['จำนวนที่รับ', club.max, 'ลงทะเบียนแล้ว', club.students.length], [],
      ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น'],
      ...club.students.map((s, i) => [i+1, s.id, s.name, s.grade])
    ];
    const safeName = club.name.replace(/[:\\\?\*\/\[\]]/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), safeName);
  });

  const unregData = [['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น'],
    ...(lastSummaryData.unregistered.length > 0
      ? lastSummaryData.unregistered.map(u => [u.id, u.name, u.grade])
      : [['-', 'ไม่มีนักเรียนตกค้าง', '-']])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unregData), 'นักเรียนที่ยังไม่ลงทะเบียน');

  const unassignedData = [['ลำดับ', 'ชื่อ-นามสกุลครูผู้สอน'],
    ...(lastSummaryData.unassignedTeachers.length > 0
      ? lastSummaryData.unassignedTeachers.map((t, i) => [i+1, t.name])
      : [['-', 'ไม่มีครูตกค้าง']])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unassignedData), 'ครูที่ยังไม่มีชุมนุม');

  XLSX.writeFile(wb, `รายงานชุมนุม_แยกชีต_${new Date().toLocaleDateString('th-TH')}.xlsx`);
}

function exportToPDF() {
  const element = document.getElementById('tab-summary');
  const actionButtons    = element.querySelectorAll('button');
  const actionCols       = element.querySelectorAll('.action-col');
  const scrollContainers = element.querySelectorAll('.overflow-x-auto');

  const unassignedContainer  = document.getElementById('unassigned-container');
  const unregisteredContainer = document.getElementById('unreg-students-container');
  const isUnassignedHidden   = unassignedContainer?.classList.contains('hidden');
  const isUnregisteredHidden = unregisteredContainer?.classList.contains('hidden');

  if (isUnassignedHidden)   unassignedContainer.classList.remove('hidden');
  if (isUnregisteredHidden) unregisteredContainer.classList.remove('hidden');

  const clubContainers      = element.querySelectorAll('.club-table-container');
  const hiddenClubContainers = [];
  clubContainers.forEach(c => { if (c.classList.contains('hidden')) { hiddenClubContainers.push(c); c.classList.remove('hidden'); } });

  actionButtons.forEach(b => b.style.display = 'none');
  actionCols.forEach(c => c.style.display = 'none');
  scrollContainers.forEach(c => { c.style.maxHeight = 'none'; c.style.overflow = 'visible'; });

  html2pdf().set({
    margin: 10, filename: `สรุปการลงทะเบียน_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  }).from(element).save().then(() => {
    actionButtons.forEach(b => b.style.display = '');
    actionCols.forEach(c => c.style.display = '');
    scrollContainers.forEach(c => { c.style.maxHeight = ''; c.style.overflow = ''; });
    if (isUnassignedHidden   && unassignedContainer)   unassignedContainer.classList.add('hidden');
    if (isUnregisteredHidden && unregisteredContainer) unregisteredContainer.classList.add('hidden');
    hiddenClubContainers.forEach(c => c.classList.add('hidden'));
  });
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});
