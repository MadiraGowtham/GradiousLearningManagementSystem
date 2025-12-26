// ========================================
// TEACHER COURSE PAGE - CLIENT SIDE
// ========================================

const API_BASE_URL = '/api/teacher';
let teacherCurrentCourse = null;
let teacherCourseDetails = null;
let teacherAllQuizzes = [];
let teacherAssignmentsResource = [];
let allQuizSubmissions = [];
let allAssignmentSubmissions = [];
let teacherLoggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
let quizFilterStatus = '';
let assignmentFilterStatus = '';

// === UTILITY FUNCTIONS ===

function showLoading(show = true) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function showErrorOverlay(msg = 'Something went wrong. Please try again.', type = 'error') {
  const overlay = document.getElementById('errorOverlay');
  const msgEl = document.getElementById('errorOverlayMsg');
  const titleEl = document.getElementById('errorOverlayTitle');
  const iconEl = document.getElementById('popupIcon');
  const stateEl = document.getElementById('errorState');
  
  if (msgEl) msgEl.textContent = msg;
  if (titleEl) titleEl.textContent = type === 'success' ? 'Success' : 'Error';
  if (iconEl) iconEl.innerHTML = type === 'success' ? '&#10003;' : '&#9888;';
  if (stateEl) {
    stateEl.classList.remove('success');
    if (type === 'success') stateEl.classList.add('success');
  }
  
  if (overlay) overlay.style.display = 'flex';
  setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 2800);
}

// Create authentication headers
function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (teacherLoggedInUser) {
    headers['x-user'] = JSON.stringify(teacherLoggedInUser);
  }
  
  return headers;
}

// API request wrapper
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// === PROFILE DROPDOWN ===

function setupProfileDropdown() {
  const nav = document.querySelector('nav');
  const profileBtn = nav?.querySelector('.btn1#loginButton');
  
  if (teacherLoggedInUser && profileBtn) {
    const names = teacherLoggedInUser.name.split(' ');
    const initials = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0][0];
    
    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    dropdown.innerHTML = `
      <button class="btn1 profile-btn">${initials.toUpperCase()}</button>
      <div class="dropdown-content">
        <a href="/HTML/profile.html">View Profile</a>
        <a href="#" onclick="logoutUser()">Logout</a>
      </div>
    `;
    
    profileBtn.replaceWith(dropdown);
    
    const profileBtnNew = dropdown.querySelector('.profile-btn');
    const dropdownContent = dropdown.querySelector('.dropdown-content');
    
    profileBtnNew.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
    });
    
    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target)) {
        dropdownContent.style.display = 'none';
      }
    });
  }
}

window.logoutUser = function() {
  localStorage.clear();
  sessionStorage.clear();
  alert('You have been logged out.');
  window.location.href = '/HTML/login.html';
};

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', function() {
  initializeTeacherCoursePage();
});

async function initializeTeacherCoursePage() {
  try {
    showLoading(true);
    
    if (!teacherLoggedInUser || teacherLoggedInUser.type !== 'teacher') {
      alert('Please log in as a teacher to access this page.');
      window.location.href = '/HTML/login.html';
      return;
    }
    
    const selectedCourse = localStorage.getItem('selectedCourse');
    if (!selectedCourse) {
      alert('No course selected.');
      window.location.href = '/HTML/mycourses.html';
      return;
    }
    
    // Fetch course data
    const coursesData = await apiRequest('/api/courses');
    const coursesArr = coursesData.courses || coursesData;
    teacherCurrentCourse = coursesArr.find(c => c.title === selectedCourse);
    
    if (!teacherCurrentCourse) {
      alert('Course not found.');
      window.location.href = '/HTML/mycourses.html';
      return;
    }
    
    await loadTeacherCourseData();
    updateTeacherCourseDisplay();
    renderTeacherAllSections();
    setupTeacherEventListeners();
    setupProfileDropdown();
    
    showLoading(false);
  } catch (error) {
    showLoading(false);
    showErrorOverlay('Failed to load course. Please refresh and try again.');
    console.error('Error initializing teacher course page:', error);
  }
}

async function loadTeacherCourseData() {
  try {
    const courseName = teacherCurrentCourse.title;
    
    // Fetch quizzes
    const quizzesData = await apiRequest(`${API_BASE_URL}/quizzes?course=${encodeURIComponent(courseName)}`);
    teacherAllQuizzes = quizzesData.quizzes || [];
    
    // Fetch assignments
    const assignmentsData = await apiRequest(`${API_BASE_URL}/assignments?course=${encodeURIComponent(courseName)}`);
    teacherAssignmentsResource = assignmentsData.assignments || [];
    
    // Fetch quiz submissions
    const quizSubsData = await apiRequest(`${API_BASE_URL}/quiz-submissions?course=${encodeURIComponent(courseName)}`);
    allQuizSubmissions = quizSubsData.submissions || [];
    
    // Fetch assignment submissions
    const assignmentSubsData = await apiRequest(`${API_BASE_URL}/assignment-submissions?course=${encodeURIComponent(courseName)}`);
    allAssignmentSubmissions = assignmentSubsData.submissions || [];
    
    // Fetch resources
    const resourcesData = await apiRequest(`${API_BASE_URL}/resources?course=${encodeURIComponent(courseName)}`);
    const allResources = resourcesData.resources || [];
    
    // Fetch sessions
    const sessionsData = await apiRequest(`${API_BASE_URL}/sessions?course=${encodeURIComponent(courseName)}`);
    const allSessions = sessionsData.sessions || [];
    
    // Build course details
    teacherCourseDetails = {
      title: teacherCurrentCourse.title,
      description: teacherCurrentCourse.description,
      coordinator: teacherCurrentCourse.coordinator,
      image: teacherCurrentCourse.img || teacherCurrentCourse.image,
      duration: teacherCurrentCourse.duration,
      quiz: teacherAllQuizzes,
      assignments: teacherAssignmentsResource,
      resources: allResources,
      sessions: allSessions
    };
    
  } catch (error) {
    console.error('Error loading course data:', error);
    throw error;
  }
}

function updateTeacherCourseDisplay() {
  if (!teacherCurrentCourse || !teacherCourseDetails) return;
  
  document.title = `${teacherCourseDetails.title} - LearnEdge LMS (Teacher)`;
  
  const titleElement = document.getElementById('dynamic-course-title');
  if (titleElement) titleElement.textContent = teacherCourseDetails.title;
  
  const descElement = document.getElementById('dynamic-course-desc');
  if (descElement) {
    descElement.textContent = teacherCourseDetails.description || 'Course description will be available soon.';
  }
  
  const durationElement = document.getElementById('dynamic-course-duration');
  if (durationElement) {
    durationElement.textContent = `Duration: ${teacherCourseDetails.duration || 'TBD'}`;
  }
  
  const imageElement = document.getElementById('dynamic-course-img');
  if (imageElement) {
    imageElement.src = teacherCourseDetails.image || '../images/Consultant.jpeg';
    imageElement.alt = teacherCourseDetails.title;
    imageElement.onerror = function() { this.src = '../images/Consultant.jpeg'; };
  }
}

function renderTeacherAllSections() {
  renderTeacherQuizSection();
  renderTeacherSessionsSection();
  renderTeacherResourcesSection();
  renderTeacherAssignmentsSection();
  setupQuizSearch();
  setupAssignmentSearch();
}

// === QUIZ SECTION ===

function renderTeacherQuizSection() {
  const quizStats = document.getElementById('quizStats');
  const quizContainer = document.getElementById('quizContainer');
  
  let quizzes = teacherCourseDetails.quiz || [];
  
  // Apply filter
  if (quizFilterStatus) {
    quizzes = quizzes.filter(q => {
      if (quizFilterStatus === 'pending') return !q.completed && !q.overdue;
      if (quizFilterStatus === 'completed') return q.completed;
      if (quizFilterStatus === 'overdue') return q.overdue;
      return true;
    });
  }
  
  // Calculate stats
  const courseQuizIds = quizzes.map(q => q.id);
  const relevantSubmissions = allQuizSubmissions.filter(sub => courseQuizIds.includes(sub.quizId));
  const totalScore = relevantSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
  const avgScore = relevantSubmissions.length > 0 ? Math.round(totalScore / relevantSubmissions.length) : 0;
  
  // Render stats
  if (quizStats) {
    quizStats.innerHTML = `
      <div class="stat-card">
        <i class="fas fa-clipboard-list"></i>
        <div class="stat-info">
          <span class="stat-number">${quizzes.length}</span>
          <span class="stat-label">Total Quizzes</span>
        </div>
      </div>
      <div class="stat-card">
        <i class="fas fa-star"></i>
        <div class="stat-info">
          <span class="stat-number">${avgScore}</span>
          <span class="stat-label">Avg Score</span>
        </div>
      </div>
    `;
  }
  
  // Render quizzes
  if (quizContainer) {
    quizContainer.innerHTML = quizzes.length === 0 
      ? '<div class="empty-state">No quizzes available.</div>'
      : quizzes.map((quiz, idx) => `
          <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: column; gap: 12px; border: 1.5px solid #e0e0e0;">
            <div style="display: flex; flex-direction: row; align-items: center; gap: 18px;">
              <img src="${quiz.image || '../images/quiz.jpeg'}" alt="Quiz Image" 
                   style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" 
                   onerror="this.src='../images/quiz.jpeg'">
              <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || 'No due date'}</div>
              </div>
            </div>
            <div class="quiz-actions" style="display: flex; gap: 10px; margin-top: 8px;">
              <button class="btn btn-primary" onclick="openQuizEditModal('${quiz.id}')">Edit</button>
              <button class="btn btn-danger" onclick="deleteQuiz('${quiz.id}')">Delete</button>
              <button class="btn btn2" onclick="viewQuizSubmissions('${quiz.id}')">View Submissions</button>
            </div>
          </div>
        `).join('');
  }
}

function setupQuizSearch() {
  const quizSearch = document.getElementById('quizSearch');
  if (quizSearch) {
    if (!document.getElementById('quizSearchClear')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'quizSearchClear';
      clearBtn.type = 'button';
      clearBtn.innerHTML = '<i class="fas fa-times"></i>';
      clearBtn.className = 'btn btn2';
      clearBtn.style.marginLeft = '6px';
      quizSearch.parentNode.appendChild(clearBtn);
      clearBtn.onclick = () => {
        quizSearch.value = '';
        filterQuizCards('');
      };
    }
    
    quizSearch.addEventListener('input', function(e) {
      filterQuizCards(e.target.value);
    });
  }
}

function filterQuizCards(searchTerm) {
  const quizCards = document.querySelectorAll('.quiz-card');
  const term = searchTerm.toLowerCase();
  
  quizCards.forEach(card => {
    const title = card.querySelector('div[style*="font-size: 1.2rem"]')?.textContent.toLowerCase() || '';
    const description = card.querySelector('div[style*="font-size: 0.95rem"]')?.textContent.toLowerCase() || '';
    
    if (title.includes(term) || description.includes(term)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

window.openQuizEditModal = async function(quizId) {
  try {
    const quiz = teacherAllQuizzes.find(q => q.id === quizId);
    if (!quiz) {
      showErrorOverlay('Quiz not found');
      return;
    }
    
    showQuizModal('edit', quiz);
  } catch (error) {
    console.error('Error opening quiz edit modal:', error);
    showErrorOverlay('Failed to open quiz editor');
  }
};

window.deleteQuiz = async function(quizId) {
  if (!confirm('Are you sure you want to delete this quiz?')) return;
  
  showLoading(true);
  
  try {
    await apiRequest(`${API_BASE_URL}/quizzes/${quizId}`, {
      method: 'DELETE'
    });
    
    await loadTeacherCourseData();
    renderTeacherQuizSection();
    
    showLoading(false);
    showErrorOverlay('Quiz deleted successfully', 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay('Failed to delete quiz');
    console.error('Delete quiz error:', error);
  }
};

window.viewQuizSubmissions = async function(quizId) {
  try {
    const quiz = teacherAllQuizzes.find(q => q.id === quizId);
    const submissions = allQuizSubmissions.filter(s => s.quizId === quizId);
    
    const modal = document.getElementById('modal') || createModal();
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = `Submissions: ${quiz.title}`;
    
    if (submissions.length === 0) {
      modalBody.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No submissions yet.</div>';
    } else {
      modalBody.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto;">
          ${submissions.map(sub => `
            <div style="border: 1px solid #eee; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
              <div><strong>Student:</strong> ${sub.studentName || sub.studentId}</div>
              <div><strong>Score:</strong> ${sub.score || 0} / ${sub.maxScore || quiz.maxScore || 100}</div>
              <div><strong>Submitted:</strong> ${new Date(sub.submittedAt).toLocaleString()}</div>
              <div><strong>Status:</strong> ${sub.status || 'Completed'}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    modal.classList.remove('hidden');
  } catch (error) {
    console.error('Error viewing submissions:', error);
    showErrorOverlay('Failed to load submissions');
  }
};

function showQuizModal(mode, quiz = {}) {
  const modal = document.getElementById('modal') || createModal();
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = mode === 'edit' ? 'Edit Quiz' : 'Create New Quiz';
  
  let questions = Array.isArray(quiz.questions) ? JSON.parse(JSON.stringify(quiz.questions)) : [];
  
  function renderQuestionsUI() {
    const questionsHTML = questions.map((q, qIdx) => `
      <div class="question-block" style="border:1px solid #e0e0e0; border-radius:7px; padding:12px; margin-bottom:12px;">
        <label>Question:
          <input type="text" class="q-text" value="${q.question || ''}" data-qidx="${qIdx}" required style="width: 100%; padding: 8px; margin: 4px 0;">
        </label>
        <div class="options-list" style="margin-top: 8px;">
          ${q.options.map((opt, oIdx) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <input type="text" class="q-option" value="${opt}" data-qidx="${qIdx}" data-oidx="${oIdx}" required style="flex: 1; padding: 6px;">
              <input type="radio" name="correct-${qIdx}" value="${oIdx}" ${q.correctAnswer === oIdx ? 'checked' : ''}> Correct
              <button type="button" class="btn btn2 removeOptBtn" data-qidx="${qIdx}" data-oidx="${oIdx}"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn2 addOptBtn" data-qidx="${qIdx}" style="margin-top: 8px;"><i class="fas fa-plus"></i> Add Option</button>
        <button type="button" class="btn btn-danger removeQBtn" data-qidx="${qIdx}" style="float:right;margin-top:4px;"><i class="fas fa-trash"></i> Remove Question</button>
      </div>
    `).join('');
    
    modalBody.innerHTML = `
      <form id="quizForm" style="max-height: 70vh; overflow-y: auto;">
        <label>Title: <input type="text" name="title" value="${quiz.title || ''}" required style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
        <label>Description: <textarea name="description" style="width: 100%; padding: 8px; margin: 4px 0; min-height: 60px;">${quiz.description || ''}</textarea></label><br>
        <label>Due Date: <input type="date" name="due" value="${quiz.due || ''}" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
        <label>Max Score: <input type="number" name="maxScore" value="${quiz.maxScore || 100}" min="1" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
        <label>Duration (minutes): <input type="number" name="duration" value="${quiz.duration || 30}" min="1" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
        <label>Instructions: <textarea name="instructions" style="width: 100%; padding: 8px; margin: 4px 0; min-height: 60px;">${quiz.instructions || ''}</textarea></label><br>
        
        <div id="questionsSection" style="margin-top: 20px;">
          <h4>Questions</h4>
          <div id="questionsContainer">${questionsHTML}</div>
          <button type="button" class="btn btn2" id="addQuestionBtn"><i class="fas fa-plus"></i> Add Question</button>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 10px;">
          <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Update' : 'Create'}</button>
          <button type="button" class="btn btn2" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    `;
    
    // Attach event listeners
    attachQuestionEventListeners();
  }
  
  function attachQuestionEventListeners() {
    document.getElementById('addQuestionBtn').onclick = () => {
      questions.push({ question: '', options: ['', ''], correctAnswer: 0 });
      renderQuestionsUI();
    };
    
    document.querySelectorAll('.addOptBtn').forEach(btn => {
      btn.onclick = () => {
        const qIdx = +btn.getAttribute('data-qidx');
        questions[qIdx].options.push('');
        renderQuestionsUI();
      };
    });
    
    document.querySelectorAll('.removeOptBtn').forEach(btn => {
      btn.onclick = () => {
        const qIdx = +btn.getAttribute('data-qidx');
        const oIdx = +btn.getAttribute('data-oidx');
        questions[qIdx].options.splice(oIdx, 1);
        if (questions[qIdx].correctAnswer === oIdx) questions[qIdx].correctAnswer = 0;
        renderQuestionsUI();
      };
    });
    
    document.querySelectorAll('.removeQBtn').forEach(btn => {
      btn.onclick = () => {
        const qIdx = +btn.getAttribute('data-qidx');
        questions.splice(qIdx, 1);
        renderQuestionsUI();
      };
    });
    
    document.querySelectorAll('.q-text').forEach(input => {
      input.oninput = () => {
        const qIdx = +input.getAttribute('data-qidx');
        questions[qIdx].question = input.value;
      };
    });
    
    document.querySelectorAll('.q-option').forEach(input => {
      input.oninput = () => {
        const qIdx = +input.getAttribute('data-qidx');
        const oIdx = +input.getAttribute('data-oidx');
        questions[qIdx].options[oIdx] = input.value;
      };
    });
    
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.onchange = () => {
        const qIdx = +radio.name.split('-')[1];
        questions[qIdx].correctAnswer = +radio.value;
      };
    });
    
    document.getElementById('quizForm').onsubmit = async (e) => {
      e.preventDefault();
      await handleQuizSubmit(mode, quiz.id);
    };
  }
  
  if (mode === 'add' && questions.length === 0) {
    questions = [{ question: '', options: ['', ''], correctAnswer: 0 }];
  }
  
  renderQuestionsUI();
  modal.classList.remove('hidden');
}

async function handleQuizSubmit(mode, quizId) {
  const form = document.getElementById('quizForm');
  const formData = new FormData(form);
  
  const data = {
    title: formData.get('title'),
    description: formData.get('description'),
    due: formData.get('due'),
    maxScore: parseInt(formData.get('maxScore')),
    duration: parseInt(formData.get('duration')),
    instructions: formData.get('instructions'),
    course: teacherCurrentCourse.title,
    questions: questions.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer
    }))
  };
  
  showLoading(true);
  
  try {
    if (mode === 'add') {
      await apiRequest(`${API_BASE_URL}/quizzes`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } else {
      await apiRequest(`${API_BASE_URL}/quizzes/${quizId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    await loadTeacherCourseData();
    renderTeacherQuizSection();
    
    showLoading(false);
    showErrorOverlay(`Quiz ${mode === 'add' ? 'created' : 'updated'} successfully`, 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay(`Failed to ${mode === 'add' ? 'create' : 'update'} quiz`);
    console.error('Quiz submit error:', error);
  }
}

// === ASSIGNMENTS SECTION ===

function renderTeacherAssignmentsSection() {
  const assignmentStats = document.getElementById('assignmentStats');
  const assignmentContainer = document.getElementById('assignmentContainer');
  
  const assignments = teacherAssignmentsResource || [];
  
  // Calculate stats
  const courseAssignmentIds = assignments.map(a => a.id);
  const relevantSubmissions = allAssignmentSubmissions.filter(sub => 
    courseAssignmentIds.includes(sub.assignmentId)
  );
  const scoredSubmissions = relevantSubmissions.filter(sub => typeof sub.score === 'number');
  const totalScore = scoredSubmissions.reduce((acc, sub) => acc + sub.score, 0);
  const avgScore = scoredSubmissions.length > 0 ? Math.round(totalScore / scoredSubmissions.length) : 0;
  
  // Render stats
  if (assignmentStats) {
    assignmentStats.innerHTML = `
      <div class="stat-card">
        <i class="fas fa-clipboard-list"></i>
        <div class="stat-info">
          <span class="stat-number">${assignments.length}</span>
          <span class="stat-label">Total Assignments</span>
        </div>
      </div>
      <div class="stat-card">
        <i class="fas fa-star"></i>
        <div class="stat-info">
          <span class="stat-number">${avgScore}</span>
          <span class="stat-label">Avg Score</span>
        </div>
      </div>
    `;
  }
  
  // Render assignments
  if (assignmentContainer) {
    assignmentContainer.innerHTML = assignments.length === 0
      ? '<div class="empty-state">No assignments available.</div>'
      : assignments.map((assignment) => `
          <div class="assignment-card">
            <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
              <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
              <span class="assignment-status" style="margin-left:auto; color: #1025a1; font-weight: 600;">${assignment.status || 'Active'}</span>
            </div>
            <div class="assignment-course">
              <i class="fas fa-book"></i> ${assignment.course}
            </div>
            <div class="assignment-details">
              <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
            </div>
            <div class="assignment-actions">
              <button class="btn btn-primary" onclick="openAssignmentEditModal('${assignment.id}')">Edit</button>
              <button class="btn btn-danger" onclick="deleteAssignment('${assignment.id}')">Delete</button>
              <button class="btn btn2" onclick="reviewAssignmentSubmissions('${assignment.id}')">Review Submissions</button>
            </div>
          </div>
        `).join('');
  }
}

function setupAssignmentSearch() {
  const assignmentSearch = document.getElementById('assignmentSearch');
  if (assignmentSearch) {
    if (!document.getElementById('assignmentSearchClear')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'assignmentSearchClear';
      clearBtn.type = 'button';
      clearBtn.innerHTML = '<i class="fas fa-times"></i>';
      clearBtn.className = 'btn btn2';
      clearBtn.style.marginLeft = '6px';
      assignmentSearch.parentNode.appendChild(clearBtn);
      clearBtn.onclick = () => {
        assignmentSearch.value = '';
        filterAssignmentCards('');
      };
    }
    
    assignmentSearch.addEventListener('input', function(e) {
      filterAssignmentCards(e.target.value);
    });
  }
}

function filterAssignmentCards(searchTerm) {
  const assignmentCards = document.querySelectorAll('.assignment-card');
  const term = searchTerm.toLowerCase();
  
  assignmentCards.forEach(card => {
    const title = card.querySelector('.assignment-title')?.textContent.toLowerCase() || '';
    const course = card.querySelector('.assignment-course')?.textContent.toLowerCase() || '';
    
    if (title.includes(term) || course.includes(term)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

window.openAssignmentEditModal = async function(assignmentId) {
  try {
    const assignment = teacherAssignmentsResource.find(a => a.id === assignmentId);
    if (!assignment) {
      showErrorOverlay('Assignment not found');
      return;
    }
    
    showAssignmentModal('edit', assignment);
  } catch (error) {
    console.error('Error opening assignment edit modal:', error);
    showErrorOverlay('Failed to open assignment editor');
  }
};

window.deleteAssignment = async function(assignmentId) {
  if (!confirm('Are you sure you want to delete this assignment?')) return;
  
  showLoading(true);
  
  try {
    await apiRequest(`${API_BASE_URL}/assignments/${assignmentId}`, {
      method: 'DELETE'
    });
    
    await loadTeacherCourseData();
    renderTeacherAssignmentsSection();
    
    showLoading(false);
    showErrorOverlay('Assignment deleted successfully', 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay('Failed to delete assignment');
    console.error('Delete assignment error:', error);
  }
};

window.reviewAssignmentSubmissions = async function(assignmentId) {
  try {
    const assignment = teacherAssignmentsResource.find(a => a.id === assignmentId);
    const submissions = allAssignmentSubmissions.filter(s => s.assignmentId === assignmentId);
    
    let modal = document.getElementById('reviewAssignmentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reviewAssignmentModal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }
    
    modal.style.display = 'block';
    modal.innerHTML = `
      <div style="background:white; margin:40px auto; max-width:700px; border-radius:12px; padding:32px; position:relative; max-height:90vh; overflow-y:auto;">
        <h2>Review Submissions: ${assignment.assignment || assignment.title}</h2>
        <button style="position:absolute; top:16px; right:16px; font-size:1.5em; background:none; border:none; color:#1025a1; cursor:pointer;" onclick="closeReviewModal()">&times;</button>
        <div id="reviewSubmissionsList">
          ${submissions.length === 0 
            ? '<div style="color:#888;">No submissions yet.</div>' 
            : submissions.map((sub, i) => `
              <div style="border:1px solid #eee; border-radius:8px; padding:14px; margin-bottom:14px;">
                <div><b>Student:</b> ${sub.studentName || sub.studentId}</div>
                <div><b>Email:</b> ${sub.studentEmail || 'N/A'}</div>
                <div><b>Submitted:</b> ${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}</div>
                <div><b>File:</b> ${sub.fileName ? `<a href="#" style="color:#1025a1;">${sub.fileName}</a>` : 'No file uploaded'}</div>
                <div style="margin-top: 10px;">
                  <label><b>Score:</b> <input type="number" min="0" max="100" value="${sub.score ?? ''}" id="scoreInput${i}" style="width:60px; padding: 4px;"> / ${sub.maxScore || 100}</label>
                </div>
                <div style="margin-top: 10px;">
                  <label><b>Feedback:</b><br><textarea id="feedbackInput${i}" style="width:100%; padding: 8px; margin-top: 4px; min-height: 60px;">${sub.feedback || ''}</textarea></label>
                </div>
                <button class="btn btn-primary" onclick="saveReview('${assignmentId}', ${i})" style="margin-top: 10px;">Save Review</button>
              </div>
            `).join('')}
        </div>
      </div>
    `;
    
    window.saveReview = async function(assignmentId, idx) {
      const submissions = allAssignmentSubmissions.filter(s => s.assignmentId === assignmentId);
      const sub = submissions[idx];
      if (!sub) return;
      
      const score = parseInt(document.getElementById(`scoreInput${idx}`).value);
      const feedback = document.getElementById(`feedbackInput${idx}`).value;
      
      showLoading(true);
      
      try {
        await apiRequest(`${API_BASE_URL}/assignment-submissions/${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ score, feedback, status: 'graded' })
        });
        
        showLoading(false);
        showErrorOverlay('Review saved successfully', 'success');
        closeReviewModal();
        await loadTeacherCourseData();
        renderTeacherAssignmentsSection();
      } catch (error) {
        showLoading(false);
        showErrorOverlay('Failed to save review');
        console.error('Save review error:', error);
      }
    };
  } catch (error) {
    console.error('Error reviewing submissions:', error);
    showErrorOverlay('Failed to load submissions');
  }
};

window.closeReviewModal = function() {
  const modal = document.getElementById('reviewAssignmentModal');
  if (modal) modal.remove();
};

function showAssignmentModal(mode, assignment = {}) {
  const modal = document.getElementById('modal') || createModal();
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = mode === 'edit' ? 'Edit Assignment' : 'Create New Assignment';
  
  modalBody.innerHTML = `
    <form id="assignmentForm" style="max-height: 70vh; overflow-y: auto;">
      <label>Title: <input type="text" name="title" value="${assignment.assignment || assignment.title || ''}" required style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      <label>Description: <textarea name="description" style="width: 100%; padding: 8px; margin: 4px 0; min-height: 60px;">${assignment.description || ''}</textarea></label><br>
      <label>Due Date: <input type="date" name="date" value="${assignment.date || assignment.dueDate || ''}" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      <label>Instructions: <textarea name="instructions" style="width: 100%; padding: 8px; margin: 4px 0; min-height: 80px;">${assignment.instructions || ''}</textarea></label><br>
      <label>PDF Link: <input type="text" name="pdf" value="${assignment.pdf || ''}" placeholder="Paste PDF link" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      <label>Or Upload File: <input type="file" id="assignmentFileUpload" accept="application/pdf" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn2" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `;
  
  document.getElementById('assignmentForm').onsubmit = async (e) => {
    e.preventDefault();
    await handleAssignmentSubmit(mode, assignment.id);
  };
  
  modal.classList.remove('hidden');
}

async function handleAssignmentSubmit(mode, assignmentId) {
  const form = document.getElementById('assignmentForm');
  const formData = new FormData(form);
  
  const fileInput = document.getElementById('assignmentFileUpload');
  const file = fileInput?.files[0];
  
  showLoading(true);
  
  try {
    let uploadedFileUrl = formData.get('pdf');
    
    if (file) {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('title', formData.get('title'));
      uploadFormData.append('description', formData.get('description'));
      uploadFormData.append('date', formData.get('date'));
      uploadFormData.append('instructions', formData.get('instructions'));
      uploadFormData.append('course', teacherCurrentCourse.title);
      
      const headers = { 'x-user': JSON.stringify(teacherLoggedInUser) };
      
      if (mode === 'add') {
        const response = await fetch(`${API_BASE_URL}/assignments`, {
          method: 'POST',
          headers: headers,
          body: uploadFormData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        const result = await response.json();
        uploadedFileUrl = result.assignment.pdf;
      } else {
        const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}`, {
          method: 'PATCH',
          headers: headers,
          body: uploadFormData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        const result = await response.json();
        uploadedFileUrl = result.assignment.pdf;
      }
    } else {
      const data = {
        title: formData.get('title'),
        assignment: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        dueDate: formData.get('date'),
        instructions: formData.get('instructions'),
        pdf: uploadedFileUrl,
        course: teacherCurrentCourse.title
      };
      
      if (mode === 'add') {
        await apiRequest(`${API_BASE_URL}/assignments`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } else {
        await apiRequest(`${API_BASE_URL}/assignments/${assignmentId}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
      }
    }
    
    closeModal();
    await loadTeacherCourseData();
    renderTeacherAssignmentsSection();
    
    showLoading(false);
    showErrorOverlay(`Assignment ${mode === 'add' ? 'created' : 'updated'} successfully`, 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay(`Failed to ${mode === 'add' ? 'create' : 'update'} assignment`);
    console.error('Assignment submit error:', error);
  }
}

// === RESOURCES SECTION ===

function renderTeacherResourcesSection() {
  const resourceContainer = document.getElementById('resourceContainer');
  const resources = teacherCourseDetails.resources || [];
  
  if (resourceContainer) {
    resourceContainer.innerHTML = resources.length === 0
      ? '<div class="empty-state">No resources available.</div>'
      : resources.map((resource) => `
          <div class="resource-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
            <img src="${resource.image || '../images/materials.jpeg'}" alt="Resource Image" 
                 style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" 
                 onerror="this.src='../images/materials.jpeg'">
            <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
              <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${resource.title || 'Untitled Resource'}</div>
              <div style="font-size: 0.95rem; color: #555;">${resource.description || ''}</div>
            </div>
            <button class="btn btn-primary" onclick="openResourceEditModal('${resource.id}')">Edit</button>
            <button class="btn btn-danger" onclick="deleteResource('${resource.id}')">Delete</button>
          </div>
        `).join('');
  }
}

window.openResourceEditModal = async function(resourceId) {
  try {
    const resource = teacherCourseDetails.resources.find(r => r.id === resourceId);
    if (!resource) {
      showErrorOverlay('Resource not found');
      return;
    }
    
    showResourceModal('edit', resource);
  } catch (error) {
    console.error('Error opening resource edit modal:', error);
    showErrorOverlay('Failed to open resource editor');
  }
};

window.deleteResource = async function(resourceId) {
  if (!confirm('Are you sure you want to delete this resource?')) return;
  
  showLoading(true);
  
  try {
    await apiRequest(`${API_BASE_URL}/resources/${resourceId}`, {
      method: 'DELETE'
    });
    
    await loadTeacherCourseData();
    renderTeacherResourcesSection();
    
    showLoading(false);
    showErrorOverlay('Resource deleted successfully', 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay('Failed to delete resource');
    console.error('Delete resource error:', error);
  }
};

function showResourceModal(mode, resource = {}) {
  const modal = document.getElementById('modal') || createModal();
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = mode === 'edit' ? 'Edit Resource' : 'Create New Resource';
  
  modalBody.innerHTML = `
    <form id="resourceForm">
      <label>Title: <input type="text" name="title" value="${resource.title || ''}" required style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      <label>Description: <textarea name="description" style="width: 100%; padding: 8px; margin: 4px 0; min-height: 60px;">${resource.description || ''}</textarea></label><br>
      <label>PDF Link: <input type="text" name="pdf" value="${resource.pdf || ''}" placeholder="Paste PDF link" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      <label>Or Upload File: <input type="file" id="resourceFileUpload" accept="application/pdf" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn2" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `;
  
  document.getElementById('resourceForm').onsubmit = async (e) => {
    e.preventDefault();
    await handleResourceSubmit(mode, resource.id);
  };
  
  modal.classList.remove('hidden');
}

async function handleResourceSubmit(mode, resourceId) {
  const form = document.getElementById('resourceForm');
  const formData = new FormData(form);
  
  const fileInput = document.getElementById('resourceFileUpload');
  const file = fileInput?.files[0];
  
  showLoading(true);
  
  try {
    if (file) {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('title', formData.get('title'));
      uploadFormData.append('description', formData.get('description'));
      uploadFormData.append('course', teacherCurrentCourse.title);
      
      const headers = { 'x-user': JSON.stringify(teacherLoggedInUser) };
      
      const url = mode === 'add' 
        ? `${API_BASE_URL}/resources` 
        : `${API_BASE_URL}/resources/${resourceId}`;
      
      const response = await fetch(url, {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: headers,
        body: uploadFormData
      });
      
      if (!response.ok) throw new Error('Upload failed');
    } else {
      const data = {
        title: formData.get('title'),
        description: formData.get('description'),
        pdf: formData.get('pdf'),
        course: teacherCurrentCourse.title
      };
      
      if (mode === 'add') {
        await apiRequest(`${API_BASE_URL}/resources`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } else {
        await apiRequest(`${API_BASE_URL}/resources/${resourceId}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
      }
    }
    
    closeModal();
    await loadTeacherCourseData();
    renderTeacherResourcesSection();
    
    showLoading(false);
    showErrorOverlay(`Resource ${mode === 'add' ? 'created' : 'updated'} successfully`, 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay(`Failed to ${mode === 'add' ? 'create' : 'update'} resource`);
    console.error('Resource submit error:', error);
  }
}

// === SESSIONS SECTION ===

function renderTeacherSessionsSection() {
  const sessionContainer = document.getElementById('sessionContainer');
  const sessions = teacherCourseDetails.sessions || [];
  
  if (sessionContainer) {
    sessionContainer.innerHTML = sessions.length === 0
      ? '<div class="empty-state">No video sessions available.</div>'
      : sessions.map((session) => `
          <div class="session-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
            <img src="${session.image || '../images/videoSessions.jpeg'}" alt="Session Image" 
                 style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" 
                 onerror="this.src='../images/videoSessions.jpeg'">
            <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
              <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${session.title || 'Untitled Session'}</div>
              <div style="font-size: 0.95rem; color: #555;">${session.description || ''}</div>
            </div>
            <button class="btn btn-primary" onclick="openSessionEditModal('${session.id}')">Edit</button>
            <button class="btn btn-danger" onclick="deleteSession('${session.id}')">Delete</button>
          </div>
        `).join('');
  }
}

window.openSessionEditModal = async function(sessionId) {
  try {
    const session = teacherCourseDetails.sessions.find(s => s.id === sessionId);
    if (!session) {
      showErrorOverlay('Session not found');
      return;
    }
    
    showSessionModal('edit', session);
  } catch (error) {
    console.error('Error opening session edit modal:', error);
    showErrorOverlay('Failed to open session editor');
  }
};

window.deleteSession = async function(sessionId) {
  if (!confirm('Are you sure you want to delete this session?')) return;
  
  showLoading(true);
  
  try {
    await apiRequest(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    
    await loadTeacherCourseData();
    renderTeacherSessionsSection();
    
    showLoading(false);
    showErrorOverlay('Session deleted successfully', 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay('Failed to delete session');
    console.error('Delete session error:', error);
  }
};

function showSessionModal(mode, session = {}) {
  const modal = document.getElementById('modal') || createModal();
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = mode === 'edit' ? 'Edit Session' : 'Create New Session';
  
  modalBody.innerHTML = `
    <form id="sessionForm">
      <label>Title: <input type="text" name="title" value="${session.title || ''}" required style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      <label>Description: <textarea name="description" style="width: 100%; padding: 8px; margin: 4px 0; min-height: 60px;">${session.description || ''}</textarea></label><br>
      <label>Video Link: <input type="text" name="video" value="${session.video || ''}" placeholder="Paste video URL" style="width: 100%; padding: 8px; margin: 4px 0;"></label><br>
      
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn2" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `;
  
  document.getElementById('sessionForm').onsubmit = async (e) => {
    e.preventDefault();
    await handleSessionSubmit(mode, session.id);
  };
  
  modal.classList.remove('hidden');
}

async function handleSessionSubmit(mode, sessionId) {
  const form = document.getElementById('sessionForm');
  const formData = new FormData(form);
  
  const data = {
    title: formData.get('title'),
    description: formData.get('description'),
    video: formData.get('video'),
    course: teacherCurrentCourse.title
  };
  
  showLoading(true);
  
  try {
    if (mode === 'add') {
      await apiRequest(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } else {
      await apiRequest(`${API_BASE_URL}/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    await loadTeacherCourseData();
    renderTeacherSessionsSection();
    
    showLoading(false);
    showErrorOverlay(`Session ${mode === 'add' ? 'created' : 'updated'} successfully`, 'success');
  } catch (error) {
    showLoading(false);
    showErrorOverlay(`Failed to ${mode === 'add' ? 'create' : 'update'} session`);
    console.error('Session submit error:', error);
  }
}

// === MODAL HELPERS ===

function createModal() {
  const modal = document.createElement('div');
  modal.id = 'modal';
  modal.className = 'modal hidden';
  modal.style.cssText = 'display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);';
  
  modal.innerHTML = `
    <div style="background-color: white; margin: 5% auto; padding: 30px; border-radius: 12px; width: 90%; max-width: 800px; position: relative; max-height: 85vh; overflow-y: auto;">
      <span onclick="closeModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; font-weight: bold; color: #aaa; cursor: pointer;">&times;</span>
      <h2 id="modal-title" style="margin-top: 0; color: #1025a1;"></h2>
      <div id="modal-body"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

window.closeModal = function() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

// === EVENT LISTENERS ===

function setupTeacherEventListeners() {
  document.getElementById('addQuizBtn')?.addEventListener('click', () => showQuizModal('add'));
  document.getElementById('addAssignmentBtn')?.addEventListener('click', () => showAssignmentModal('add'));
  document.getElementById('addResourceBtn')?.addEventListener('click', () => showResourceModal('add'));
  document.getElementById('addSessionBtn')?.addEventListener('click', () => showSessionModal('add'));
}