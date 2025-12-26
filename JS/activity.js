// Access control - only admins can access this page
function checkAdminAccess() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) {
    alert("Please log in to access this page.");
    window.location.href = "/HTML/login.html";
    return false;
  }
  if (user.type !== "admin") {
    alert("This page is only accessible to administrators.");
    if (user.type === "student") {
      window.location.href = "/HTML/index.html";
    } else if (user.type === "teacher") {
      window.location.href = "/HTML/teacherIndex.html";
    } else {
      window.location.href = "/HTML/login.html";
    }
    return false;
  }
  return true;
}

// DOM Elements
const userTypeSelect = document.getElementById('userType');
const domainSelect = document.getElementById('domainSelect');
const courseSelect = document.getElementById('courseSelect');
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const logoutBtn = document.getElementById('logoutBtn');
const summaryCardsRow = document.getElementById('summaryCardsRow');
const activityLogTable = document.getElementById('activityLogTable')?.querySelector('tbody');
const assignmentStatusSelect = document.getElementById('assignmentStatus');
const quizStatusSelect = document.getElementById('quizStatus');
const scoreRange = document.getElementById('scoreRange');
const attendanceRange = document.getElementById('attendanceRange');
const scoreRangeValue = document.getElementById('scoreRangeValue');
const attendanceRangeValue = document.getElementById('attendanceRangeValue');
const liveSearchInput = document.getElementById('liveSearch');

let DATA = {};
let allDomains = new Set();
let allCourses = new Set();
let courseList = [];
let chartInstances = [];

// Fetch all relevant data from Node.js backend
async function fetchAllData() {
  summaryCardsRow.innerHTML = `<div class='text-center'><div class='spinner-border text-primary'></div></div>`;
  
  try {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    
    // Call Node.js backend API to get all activity data
    const response = await fetch('/admin/activity', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(user)
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch activity data');
    }
    
    if (result.success && result.data) {
      DATA = result.data;
    } else {
      throw new Error('Invalid response format');
    }
    
  } catch (error) {
    console.error('❌ Error fetching from backend:', error);
    
    // Fallback to json-server endpoints
    console.log('⚠️ Falling back to json-server...');
    const endpoints = [
      'students', 'teachers', 'courses', 'assignments', 'quizzes', 'assignmentSubmissions',
      'quizSubmissions', 'chats', 'notifications', 'applications', 'enrollments',
      'videoSessions', 'materials', 'issues', 'profiles'
    ];
    
    const fetches = endpoints.map(ep => 
      fetch(`/api/${ep}`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => [])
    );
    
    const results = await Promise.all(fetches);
    endpoints.forEach((ep, i) => { DATA[ep] = results[i]; });
  }
  
  courseList = DATA.courses || [];
  extractDomainsAndCourses();
  populateDomainFilter();
  populateCourseFilter();
  renderDashboard();
}

function extractDomainsAndCourses() {
  allDomains = new Set();
  (DATA.students || []).forEach(item => { if (item.domain) allDomains.add(item.domain); });
  (DATA.teachers || []).forEach(item => { if (item.domain) allDomains.add(item.domain); });
  (DATA.courses || []).forEach(course => { if (course.domain) allDomains.add(course.domain); });
  allCourses = new Set();
  (DATA.courses || []).forEach(course => { if (course.title) allCourses.add(course.title); });
}

function populateDomainFilter() {
  if (!domainSelect) return;
  domainSelect.innerHTML = '<option value="">All Domains</option>';
  Array.from(allDomains).sort().forEach(domain => {
    const opt = document.createElement('option');
    opt.value = domain;
    opt.textContent = domain;
    domainSelect.appendChild(opt);
  });
}

function populateCourseFilter() {
  if (!courseSelect) return;
  courseSelect.innerHTML = '<option value="">All Courses</option>';
  let filteredCourses = Array.from(allCourses);
  const selectedDomain = domainSelect?.value;
  if (selectedDomain) {
    filteredCourses = courseList.filter(course => course.domain === selectedDomain).map(course => course.title);
  } else {
    filteredCourses = courseList.map(course => course.title);
  }
  Array.from(new Set(filteredCourses)).sort().forEach(course => {
    const opt = document.createElement('option');
    opt.value = course;
    opt.textContent = course;
    courseSelect.appendChild(opt);
  });
}

[userTypeSelect, domainSelect, courseSelect, dateFromInput, dateToInput, assignmentStatusSelect, quizStatusSelect, scoreRange, attendanceRange, liveSearchInput].forEach(el => {
  if (el) el.addEventListener('input', renderDashboard);
});

if (scoreRange) {
  scoreRange.addEventListener('input', () => {
    scoreRangeValue.textContent = scoreRange.value + '+';
  });
}

if (attendanceRange) {
  attendanceRange.addEventListener('input', () => {
    attendanceRangeValue.textContent = attendanceRange.value + '%+';
  });
}

if (domainSelect) {
  domainSelect.addEventListener('input', () => {
    populateCourseFilter();
    renderDashboard();
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    sessionStorage.clear();
    alert('You have been logged out.');
    window.location.href = '/HTML/login.html';
  });
}

// Context-aware filter UI logic
function updateFilterVisibility() {
  const userType = userTypeSelect?.value;
  const assignmentDiv = assignmentStatusSelect?.closest('.col-12, .col-md-2');
  const quizDiv = quizStatusSelect?.closest('.col-12, .col-md-2');
  const scoreDiv = scoreRange?.closest('.col-12, .col-md-2');
  const attendanceDiv = attendanceRange?.closest('.col-12, .col-md-2');

  if (userType === 'teacher') {
    if (assignmentStatusSelect) assignmentStatusSelect.disabled = true;
    if (quizStatusSelect) quizStatusSelect.disabled = true;
    if (scoreRange) scoreRange.disabled = true;
    if (attendanceRange) attendanceRange.disabled = true;
    if (assignmentDiv) assignmentDiv.style.opacity = 0.5;
    if (quizDiv) quizDiv.style.opacity = 0.5;
    if (scoreDiv) scoreDiv.style.opacity = 0.5;
    if (attendanceDiv) attendanceDiv.style.opacity = 0.5;
  } else {
    if (assignmentStatusSelect) assignmentStatusSelect.disabled = false;
    if (quizStatusSelect) quizStatusSelect.disabled = false;
    if (scoreRange) scoreRange.disabled = false;
    if (attendanceRange) attendanceRange.disabled = false;
    if (assignmentDiv) assignmentDiv.style.opacity = 1;
    if (quizDiv) quizDiv.style.opacity = 1;
    if (scoreDiv) scoreDiv.style.opacity = 1;
    if (attendanceDiv) attendanceDiv.style.opacity = 1;
  }
}

if (userTypeSelect) {
  userTypeSelect.addEventListener('input', () => {
    updateFilterVisibility();
    renderDashboard();
  });
}
updateFilterVisibility();

function getFilteredData() {
  let data = [];
  const userType = userTypeSelect?.value;
  
  if (!userType) {
    data = [
      ...(DATA.students || []).map(s => ({...s, type: 'student'})),
      ...(DATA.teachers || []).map(t => ({...t, type: 'teacher'}))
    ];
  } else if (userType === 'student') {
    data = (DATA.students || []).map(s => ({...s, type: 'student'}));
  } else if (userType === 'teacher') {
    data = (DATA.teachers || []).map(t => ({...t, type: 'teacher'}));
  }

  // Domain filter
  const domain = domainSelect?.value;
  if (domain) {
    data = data.filter(item => {
      if (item.type === 'teacher') {
        return item.domain === domain;
      } else if (item.type === 'student') {
        const domainCourses = (DATA.courses || []).filter(c => c.domain === domain).map(c => c.title);
        const enrolledCourses = (DATA.enrollments || []).filter(e => e.studentId === item.id).map(e => e.courseTitle);
        return enrolledCourses.some(c => domainCourses.includes(c));
      }
      return false;
    });
  }

  // Course filter
  const course = courseSelect?.value;
  if (course) {
    data = data.filter(item => {
      if (item.type === 'teacher') {
        return Array.isArray(item.courses) && item.courses.includes(course);
      } else if (item.type === 'student') {
        return (DATA.enrollments || []).some(e => e.studentId === item.id && e.courseTitle === course);
      }
      return false;
    });
  }

  // Date filter
  const from = dateFromInput?.value;
  const to = dateToInput?.value;
  if (from || to) {
    data = data.filter(item => {
      if (!item.activityLog) return true;
      return item.activityLog.some(dateStr => {
        const d = new Date(dateStr);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(to)) return false;
        return true;
      });
    });
  }

  // Assignment status filter (students only)
  const assignmentStatus = assignmentStatusSelect?.value;
  if (assignmentStatus && userType === 'student') {
    data = data.filter(item => {
      const submissions = (DATA.assignmentSubmissions || []).filter(s => s.studentId === item.id);
      if (assignmentStatus === 'completed') return submissions.some(s => s.status === 'submitted');
      if (assignmentStatus === 'pending') return submissions.some(s => s.status === 'pending');
      return true;
    });
  }

  // Quiz status filter (students only)
  const quizStatus = quizStatusSelect?.value;
  if (quizStatus && userType === 'student') {
    data = data.filter(item => {
      const submissions = (DATA.quizSubmissions || []).filter(s => s.studentId === item.id);
      if (quizStatus === 'completed') return submissions.some(s => s.status === 'submitted');
      if (quizStatus === 'pending') return submissions.some(s => s.status === 'pending');
      return true;
    });
  }

  // Score filter (students only)
  const minScore = scoreRange?.value;
  if (minScore && userType === 'student') {
    data = data.filter(item => (item.score || 0) >= parseInt(minScore));
  }

  // Attendance filter (students only)
  const minAttendance = attendanceRange?.value;
  if (minAttendance && userType === 'student') {
    data = data.filter(item => (item.attendance || 0) >= parseInt(minAttendance));
  }

  // Live search
  const searchTerm = liveSearchInput?.value?.toLowerCase();
  if (searchTerm) {
    data = data.filter(item => 
      item.name?.toLowerCase().includes(searchTerm) ||
      item.email?.toLowerCase().includes(searchTerm) ||
      item.domain?.toLowerCase().includes(searchTerm)
    );
  }

  return data;
}

function renderDashboard() {
  const data = getFilteredData();
  renderSummaryCards(data);
  renderCharts(data);
  renderActivityLog();
}

function renderSummaryCards(data) {
  const students = data.filter(d => d.type === 'student');
  const teachers = data.filter(d => d.type === 'teacher');
  
  const totalAssignments = (DATA.assignmentSubmissions || []).filter(s => 
    students.some(st => st.id === s.studentId)
  ).length;
  
  const totalQuizzes = (DATA.quizSubmissions || []).filter(s => 
    students.some(st => st.id === s.studentId)
  ).length;
  
  const totalEnrollments = (DATA.enrollments || []).filter(e => 
    students.some(st => st.id === e.studentId)
  ).length;

  summaryCardsRow.innerHTML = `
    <div class="col-md-3"><div class="card bg-primary text-white mb-3"><div class="card-body">
      <h5>Total Students</h5><h3>${students.length}</h3></div></div></div>
    <div class="col-md-3"><div class="card bg-success text-white mb-3"><div class="card-body">
      <h5>Total Teachers</h5><h3>${teachers.length}</h3></div></div></div>
    <div class="col-md-3"><div class="card bg-info text-white mb-3"><div class="card-body">
      <h5>Assignments</h5><h3>${totalAssignments}</h3></div></div></div>
    <div class="col-md-3"><div class="card bg-warning text-white mb-3"><div class="card-body">
      <h5>Quizzes</h5><h3>${totalQuizzes}</h3></div></div></div>
  `;
}

function renderCharts(data) {
  // Destroy previous chart instances
  chartInstances.forEach(chart => chart.destroy());
  chartInstances = [];

  // Chart 1: Users per Course
  const courseCounts = {};
  data.forEach(d => {
    if (d.type === 'teacher' && Array.isArray(d.courses)) {
      d.courses.forEach(c => courseCounts[c] = (courseCounts[c] || 0) + 1);
    } else if (d.type === 'student') {
      (DATA.enrollments || []).filter(e => e.studentId === d.id).forEach(e => {
        courseCounts[e.courseTitle] = (courseCounts[e.courseTitle] || 0) + 1;
      });
    }
  });
  
  chartInstances.push(new Chart(document.getElementById('chart1'), {
    type: 'bar',
    data: {
      labels: Object.keys(courseCounts),
      datasets: [{ label: 'Users', data: Object.values(courseCounts), backgroundColor: '#4e73df' }]
    },
    options: { plugins: { title: { display: true, text: 'Users per Course' } }, responsive: true }
  }));

  const filteredStudentIds = new Set(data.filter(d => d.type === 'student' && d.id).map(d => d.id));

  // Chart 2: Assignment Submissions per Course
  const assignmentSubmissionsByCourse = {};
  (DATA.assignmentSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      assignmentSubmissionsByCourse[sub.course] = (assignmentSubmissionsByCourse[sub.course] || 0) + 1;
    }
  });
  
  chartInstances.push(new Chart(document.getElementById('chart2'), {
    type: 'pie',
    data: {
      labels: Object.keys(assignmentSubmissionsByCourse),
      datasets: [{ 
        label: 'Assignment Submissions', 
        data: Object.values(assignmentSubmissionsByCourse), 
        backgroundColor: ['#e74a3b', '#f6c23e', '#1cc88a', '#36b9cc', '#4e73df'] 
      }]
    },
    options: { plugins: { title: { display: true, text: 'Assignment Submissions by Course' } }, responsive: true }
  }));

  // Chart 3: Quiz Submissions per Course
  const quizSubmissionsByCourse = {};
  (DATA.quizSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      quizSubmissionsByCourse[sub.course] = (quizSubmissionsByCourse[sub.course] || 0) + 1;
    }
  });
  
  chartInstances.push(new Chart(document.getElementById('chart3'), {
    type: 'bar',
    data: {
      labels: Object.keys(quizSubmissionsByCourse),
      datasets: [{ label: 'Quiz Submissions', data: Object.values(quizSubmissionsByCourse), backgroundColor: '#36b9cc' }]
    },
    options: { plugins: { title: { display: true, text: 'Quiz Submissions by Course' } }, responsive: true }
  }));

  // Chart 4: Activity Over Time
  const activityByDate = {};
  data.forEach(d => {
    (d.activityLog || []).forEach(dateStr => {
      activityByDate[dateStr] = (activityByDate[dateStr] || 0) + 1;
    });
  });
  
  (DATA.assignmentSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      const date = sub.submittedAt ? sub.submittedAt.split('T')[0] : null;
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }
  });
  
  (DATA.quizSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      const date = sub.submittedAt ? sub.submittedAt.split('T')[0] : null;
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }
  });
  
  (DATA.issues || []).forEach(issue => {
    if (
      (issue.studentId && filteredStudentIds.has(issue.studentId)) ||
      (issue.studentName && data.some(d => d.name === issue.studentName))
    ) {
      const date = issue.date;
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }
  });
  
  const sortedDates = Object.keys(activityByDate).sort();
  chartInstances.push(new Chart(document.getElementById('chart4'), {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{ 
        label: 'Activity Count', 
        data: sortedDates.map(d => activityByDate[d]), 
        borderColor: '#4e73df', 
        backgroundColor: 'rgba(78,115,223,0.1)', 
        fill: true 
      }]
    },
    options: { plugins: { title: { display: true, text: 'Activity Over Time' } }, responsive: true }
  }));
}

function renderActivityLog() {
  if (!activityLogTable) return;
  
  let logs = [];
  
  (DATA.students || []).forEach(d => {
    (d.activityLog || []).forEach(dateStr => {
      logs.push({
        user: d.name,
        type: 'Student',
        domain: d.domain || '',
        course: '',
        activity: 'Learning',
        date: dateStr
      });
    });
  });
  
  (DATA.teachers || []).forEach(d => {
    (d.activityLog || []).forEach(dateStr => {
      logs.push({
        user: d.name,
        type: 'Teacher',
        domain: d.domain || '',
        course: '',
        activity: 'Teaching',
        date: dateStr
      });
    });
  });
  
  (DATA.assignmentSubmissions || []).forEach(sub => {
    logs.push({
      user: sub.studentName,
      type: 'Student',
      domain: '',
      course: sub.course,
      activity: 'Assignment Submitted',
      date: sub.submittedAt ? sub.submittedAt.split('T')[0] : ''
    });
  });
  
  (DATA.quizSubmissions || []).forEach(sub => {
    logs.push({
      user: sub.studentName,
      type: 'Student',
      domain: '',
      course: sub.course,
      activity: 'Quiz Attempted',
      date: sub.submittedAt ? sub.submittedAt.split('T')[0] : ''
    });
  });
  
  (DATA.chats || []).forEach(chat => {
    logs.push({
      user: chat.participants.join(', '),
      type: 'Chat',
      domain: '',
      course: chat.course,
      activity: 'Chat Created',
      date: chat.createdAt ? chat.createdAt.split('T')[0] : ''
    });
  });
  
  (DATA.notifications || []).forEach(note => {
    logs.push({
      user: note.userId,
      type: 'Notification',
      domain: '',
      course: '',
      activity: note.type,
      date: note.timestamp ? note.timestamp.split('T')[0] : ''
    });
  });
  
  (DATA.issues || []).forEach(issue => {
    logs.push({
      user: issue.studentName || issue.studentId || '',
      type: 'Issue',
      domain: '',
      course: issue.course || '',
      activity: 'Issue Reported',
      date: issue.date || ''
    });
  });
  
  logs.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  activityLogTable.innerHTML = logs.slice(0, 10).map(log => `
    <tr>
      <td>${log.user}</td>
      <td>${log.type}</td>
      <td>${log.domain}</td>
      <td>${log.course}</td>
      <td>${log.activity}</td>
      <td>${log.date}</td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-muted">No recent activity found.</td></tr>`;
}

function logoutUser() {
  localStorage.clear();
  sessionStorage.clear();
  alert('You have been logged out.');
  window.location.href = '/HTML/login.html';
}

function renderProfileOrLogin() {
  const container = document.getElementById('profileOrLogin');
  if (!container) return;
  
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (user) {
    const names = user.name.split(' ');
    const initials = names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}` : names[0][0];
    container.innerHTML = `
      <div class="profile-dropdown">
        <button class="profile-btn">${initials.toUpperCase()}</button>
        <div class="dropdown-content">
          <a href="/HTML/profile.html">View Profile</a>
          <a href="#" onclick="logoutUser()">Logout</a>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = '<button class="btn1">Login</button>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  if (!checkAdminAccess()) return;
  
  const darkModeBtn = document.getElementById('darkModeToggle');
  const prefersDark = localStorage.getItem('darkMode') === 'true';
  if (prefersDark) document.body.classList.add('dark-mode');
  
  if (darkModeBtn) {
    darkModeBtn.onclick = function() {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    };
  }
  
  renderProfileOrLogin();
  fetchAllData();
});