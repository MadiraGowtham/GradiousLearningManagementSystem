// Global variables
let teacherDataCache = null;
let currentUser = null;
let assignmentFilterValue = '';
let performanceFilterValue = '';

// Initialize the teacher dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeTeacherDashboard();
});

async function initializeTeacherDashboard() {
    try {
        // Check if user is logged in and is a teacher
        if (!checkTeacherAccess()) {
            return;
        }
        
        // Setup UI components
        setupUI();
        
        // Load dashboard data from server
        await loadDashboardData();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing teacher dashboard:', error);
        showToast('Failed to load dashboard. Please refresh the page.', 'error');
    }
}

function checkTeacherAccess() {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    
    if (!user) {
        showToast('Please log in to access this page.', 'error');
        setTimeout(() => {
            window.location.href = '/HTML/login.html';
        }, 2000);
        return false;
    }
    
    if (user.type !== 'teacher') {
        showToast('This page is only accessible to teachers.', 'error');
        setTimeout(() => {
            if (user.type === 'student') {
                window.location.href = '/HTML/index.html';
            } else if (user.type === 'admin') {
                window.location.href = '/HTML/adminIndex.html';
            } else {
                window.location.href = '/HTML/login.html';
            }
        }, 2000);
        return false;
    }
    
    currentUser = user;
    return true;
}

function setupUI() {
    // Update teacher name
    document.getElementById('teacherName').textContent = currentUser.name;
    
    // Setup profile dropdown
    setupProfileDropdown();
    
    // Setup search functionality
    setupSearch();
}

function setupProfileDropdown() {
    const loginButton = document.getElementById('loginButton');
    if (!loginButton) return;
    
    const names = currentUser.name.split(' ');
    const initials = names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`
        : names[0][0];
    
    loginButton.outerHTML = `
        <div class="profile-dropdown">
            <button class="profile-btn">${initials.toUpperCase()}</button>
            <div class="dropdown-content">
                <a href="/HTML/profile.html">View Profile</a>
                <a href="#" onclick="logoutUser()">Logout</a>
            </div>
        </div>
    `;
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', async function(e) {
        const query = e.target.value.toLowerCase();
        
        if (query.length < 2) {
            // Reset to original state
            renderDashboard();
            return;
        }
        
        try {
            // Call server-side search endpoint
            const response = await fetch(`/api/teacher/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'x-user': JSON.stringify(currentUser)
                }
            });
            
            if (!response.ok) {
                throw new Error('Search failed');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update display with filtered results
                renderCourses(data.courses);
                renderRecentAssignments(
                    teacherDataCache.courses, 
                    data.assignments, 
                    teacherDataCache.students, 
                    teacherDataCache.coursesList
                );
            }
        } catch (error) {
            console.error('Search error:', error);
            showToast('Search failed', 'error');
        }
    });
}

async function loadDashboardData() {
    try {
        // Fetch complete dashboard data from server
        const response = await fetch('/api/teacher/dashboard', {
            headers: {
                'X-User': JSON.stringify(currentUser)
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load dashboard data');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load dashboard data');
        }
        
        // Store data in cache
        teacherDataCache = {
            teacher: result.data.teacher,
            courses: result.data.courses,
            courseStats: result.data.courseStats,
            assignments: result.data.assignments,
            assignmentSubs: result.data.assignmentSubmissions,
            performance: result.data.performance,
            students: result.data.students,
            coursesList: result.data.coursesList,
            enrollments: result.data.enrollments,
            quickStats: result.data.quickStats
        };
        
        // Render dashboard with loaded data
        renderDashboard();
        
        console.log('Dashboard data loaded:', teacherDataCache);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
        
        // Initialize with empty data to prevent errors
        teacherDataCache = {
            teacher: { name: currentUser.name, email: currentUser.email },
            courses: [],
            courseStats: [],
            assignments: [],
            assignmentSubs: [],
            performance: [],
            students: [],
            coursesList: [],
            enrollments: [],
            quickStats: {
                totalCourses: 0,
                totalStudents: 0,
                pendingAssignments: 0,
                avgPerformance: 0
            }
        };
        
        renderDashboard();
    }
}

function renderDashboard() {
    if (!teacherDataCache) return;
    
    // Update quick stats
    updateQuickStats();
    
    // Render courses section
    renderCourses(teacherDataCache.courses);
    
    // Render assignment filter
    renderAssignmentFilter(teacherDataCache.courses);
    
    // Render assignments section
    const assignments = assignmentFilterValue
        ? teacherDataCache.assignmentSubs.filter(a => a.course === assignmentFilterValue)
        : teacherDataCache.assignmentSubs;
    
    renderRecentAssignments(
        teacherDataCache.courses, 
        assignments, 
        teacherDataCache.students, 
        teacherDataCache.coursesList
    );
    
    // Render performance filter
    renderPerformanceFilter(teacherDataCache.courses);
    
    // Render performance section
    const perf = performanceFilterValue
        ? teacherDataCache.performance.filter(p => p.course === performanceFilterValue)
        : teacherDataCache.performance;
    
    renderPerformance(perf);
}

function updateQuickStats() {
    if (!teacherDataCache || !teacherDataCache.quickStats) return;
    
    const stats = teacherDataCache.quickStats;
    
    document.getElementById('totalCourses').textContent = stats.totalCourses;
    document.getElementById('totalStudents').textContent = stats.totalStudents;
    
    // Calculate pending reviews based on current filter
    const assignments = assignmentFilterValue
        ? teacherDataCache.assignmentSubs.filter(a => a.course === assignmentFilterValue)
        : teacherDataCache.assignmentSubs;
    
    const pending = assignments.filter(a => 
        a.status !== 'completed' && a.status !== 'graded'
    ).length;
    
    document.getElementById('pendingAssignments').textContent = pending;
    document.getElementById('avgPerformance').textContent = `${stats.avgPerformance}%`;
}

function renderCourses(courses) {
    const container = document.getElementById('courseContainer');
    container.innerHTML = '';
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book"></i>
                <h3>No Courses</h3>
                <p>No courses have been assigned yet.</p>
            </div>
        `;
        return;
    }
    
    // Show first 4 courses
    const displayCourses = courses.slice(0, 4);
    
    displayCourses.forEach(course => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.innerHTML = `
            <div class="course-info">
                <h3>${course}</h3>
                <p>Active Course</p>
            </div>
            <div class="course-actions">
                <button class="course-btn" onclick="viewCourse('${course}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        `;
        container.appendChild(courseItem);
    });
    
    // Add "View All" button if there are more courses
    if (courses.length > 4) {
        const viewAllItem = document.createElement('div');
        viewAllItem.className = 'course-item view-all-item';
        viewAllItem.innerHTML = `
            <div class="course-info">
                <h3>View All Courses</h3>
                <p>${courses.length} total courses</p>
            </div>
            <div class="course-actions">
                <button class="course-btn" onclick="viewAllCourses()">
                    <i class="fas fa-arrow-right"></i> View All
                </button>
            </div>
        `;
        container.appendChild(viewAllItem);
    }
}

function renderAssignmentFilter(courses) {
    const filter = document.getElementById('assignmentFilter');
    if (!filter) return;
    
    filter.innerHTML = '<option value="">All Courses</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course;
        option.textContent = course;
        filter.appendChild(option);
    });
}

function renderRecentAssignments(teacherCourses, assignmentSubs, students, coursesData) {
    const container = document.getElementById('assignmentContainer');
    container.innerHTML = '';
    
    const filtered = assignmentSubs.filter(a => teacherCourses.includes(a.course));
    
    if (!filtered || filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>No Assignment Submissions</h3>
                <p>No assignments have been submitted yet.</p>
            </div>
        `;
        return;
    }
    
    // Sort by date descending, show up to 5
    filtered.sort((a, b) => 
        new Date(b.date || b.submittedAt) - new Date(a.date || a.submittedAt)
    );
    
    filtered.slice(0, 5).forEach(a => {
        const student = students.find(s => s.id === a.studentId) || {};
        const course = coursesData.find(c => c.title === a.course) || {};
        
        const assignmentItem = document.createElement('div');
        assignmentItem.className = 'assignment-item';
        assignmentItem.innerHTML = `
            <div class="assignment-info">
                <h4>${a.assignment || a.title || 'Assignment'}</h4>
                <p><strong>Student:</strong> ${student.name || a.studentName || a.studentId}</p>
                <p><strong>Course:</strong> ${a.course}</p>
                <p><strong>Submitted:</strong> ${(a.date || a.submittedAt) ? new Date(a.date || a.submittedAt).toLocaleDateString() : ''}</p>
                <span class="assignment-status">${a.status === 'completed' ? 'Completed' : a.status === 'graded' ? 'Graded' : 'Pending Review'}</span>
            </div>
            <div class="assignment-actions">
                <button class="course-btn" onclick="reviewCourse('${a.course}')">Review</button>
                <button class="course-btn mark-reviewed-btn" onclick="markAssignmentReviewed('${a.id}')">Mark as Reviewed</button>
            </div>
        `;
        container.appendChild(assignmentItem);
    });
}

function renderPerformanceFilter(courses) {
    const filter = document.getElementById('performanceFilter');
    if (!filter) return;
    
    filter.innerHTML = '<option value="">All Courses</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course;
        option.textContent = course;
        filter.appendChild(option);
    });
}

function renderPerformance(performance) {
    const container = document.getElementById('performanceContainer');
    container.innerHTML = '';
    
    if (!performance || performance.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <h3>No Performance Data</h3>
                <p>No performance data available yet.</p>
            </div>
        `;
        return;
    }
    
    // Sort by score (highest first)
    const sortedPerformance = [...performance].sort((a, b) => b.score - a.score);
    
    sortedPerformance.forEach((item, index) => {
        const performanceItem = document.createElement('div');
        performanceItem.className = 'performance-item';
        performanceItem.innerHTML = `
            <div class="performance-rank">${index + 1}</div>
            <div class="performance-info">
                <h4>${item.name}</h4>
                <p>${item.course}</p>
            </div>
            <div class="performance-score">${item.score}%</div>
        `;
        container.appendChild(performanceItem);
    });
}

function setupEventListeners() {
    const assignmentFilter = document.getElementById('assignmentFilter');
    if (assignmentFilter) {
        assignmentFilter.addEventListener('change', function(e) {
            assignmentFilterValue = e.target.value;
            
            // Only update assignments section
            const assignments = assignmentFilterValue
                ? teacherDataCache.assignmentSubs.filter(a => a.course === assignmentFilterValue)
                : teacherDataCache.assignmentSubs;
            
            renderRecentAssignments(
                teacherDataCache.courses, 
                assignments, 
                teacherDataCache.students, 
                teacherDataCache.coursesList
            );
            
            updateQuickStats(); // Update quick stats for pending reviews
        });
    }
    
    const performanceFilter = document.getElementById('performanceFilter');
    if (performanceFilter) {
        performanceFilter.addEventListener('change', function(e) {
            performanceFilterValue = e.target.value;
            
            // Only update performance section
            const perf = performanceFilterValue
                ? teacherDataCache.performance.filter(p => p.course === performanceFilterValue)
                : teacherDataCache.performance;
            
            renderPerformance(perf);
        });
    }
}

// Mark assignment as reviewed
window.markAssignmentReviewed = async function(assignmentId) {
    try {
        const response = await fetch(`/api/teacher/assignments/${assignmentId}/review`, {
            method: 'DELETE',
            headers: {
                'X-User': JSON.stringify(currentUser)
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark assignment as reviewed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Assignment marked as reviewed and removed.', 'success');
            
            // Reload dashboard data
            await loadDashboardData();
        } else {
            throw new Error(result.error || 'Failed to mark assignment as reviewed');
        }
    } catch (error) {
        console.error('Error marking assignment as reviewed:', error);
        showToast('Error removing assignment: ' + error.message, 'error');
    }
};

// Utility Functions
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    if (!container) {
        console.warn('Toast container not found');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function viewCourse(courseName) {
    // Store the selected course in localStorage for teacherCourse.html
    localStorage.setItem('selectedCourse', courseName);
    // Navigate to teacher course page
    window.location.href = '/HTML/teacherCourse.html';
}

function viewAllCourses() {
    // Navigate to mycourses page
    window.location.href = '/HTML/mycourses.html';
}

function reviewCourse(courseName) {
    localStorage.setItem('selectedCourse', courseName);
    window.location.href = '/HTML/teacherCourse.html';
}

function logoutUser() {
    localStorage.clear();
    sessionStorage.clear();
    showToast('You have been logged out successfully.', 'success');
    setTimeout(() => {
        window.location.href = '/HTML/login.html';
    }, 1500);
}

// Export functions for global access
window.viewCourse = viewCourse;
window.viewAllCourses = viewAllCourses;
window.reviewCourse = reviewCourse;
window.logoutUser = logoutUser;