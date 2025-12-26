// Global variables
let currentUser = null;
let userProfile = null;
let isEditingBasic = false;
let isEditingAcademic = false;
let isAddingCertificate = false;
let isAddingAcademic = false;

// API endpoints - use relative paths for Node.js backend
const API_BASE = '/api';

// Helper function to get auth headers
function getAuthHeaders() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
    return {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify({
            id: loggedInUser.id,
            type: loggedInUser.type,
            email: loggedInUser.email
        })
    };
}

// Initialize the profile page
document.addEventListener('DOMContentLoaded', function() {
    initializeProfile();
});

async function initializeProfile() {
    try {
        showLoading(true);
        
        // Safely parse logged in user
        let loggedInUser = null;
        try {
            const userStr = localStorage.getItem('loggedInUser');
            if (userStr) {
                loggedInUser = JSON.parse(userStr);
            }
        } catch (parseError) {
            console.error('[INIT] Error parsing logged in user:', parseError);
            showNotification('Session expired. Please log in again.', 'error');
            setTimeout(() => {
                window.location.href = '/HTML/login.html';
            }, 2000);
            return;
        }
        
        if (!loggedInUser) {
            showNotification('Please log in to access your profile.', 'error');
            setTimeout(() => {
                window.location.href = '/HTML/login.html';
            }, 2000);
            return;
        }

        currentUser = loggedInUser;
        console.log('[INIT] Initialized profile for user:', currentUser);
        
        // Validate currentUser has required fields
        if (!currentUser.id || !currentUser.type) {
            console.error('[INIT] Invalid user data:', currentUser);
            showNotification('Invalid user session. Please log in again.', 'error');
            setTimeout(() => {
                window.location.href = '/HTML/login.html';
            }, 2000);
            return;
        }
        
        // Initialize userProfile to default first
        userProfile = createDefaultProfile();
        
        // Set up navigation based on user type
        setupNavigation();
        
        // Load user profile data
        await loadUserProfile();
        
        // Set up event listeners
        setupEventListeners();
        
        // Render the profile
        await renderProfile();
        
        // Show certificates section by default for students
        if (currentUser.type === 'student') {
            showSection('certificates');
            const certNav = document.getElementById('certificatesNav');
            if (certNav) updateActiveNav(certNav);
        } else {
            showDefaultSection();
        }
        
    } catch (error) {
        console.error('[INIT] Error initializing profile:', error);
        // Ensure userProfile exists even on error
        if (!userProfile) {
            userProfile = createDefaultProfile();
            await renderProfile();
        }
        showNotification('Failed to load profile. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function setupNavigation() {
    const homeButton = document.getElementById('homeButton');
    const certificatesNav = document.getElementById('certificatesNav');
    const coursesNav = document.getElementById('coursesNav');
    
    // Set home button based on user type
    const homePages = {
        'student': '/HTML/index.html',
        'teacher': '/HTML/teacherIndex.html',
        'admin': '/HTML/adminIndex.html'
    };
    if (homeButton) {
        homeButton.href = homePages[currentUser.type] || '/HTML/index.html';
    }
    
    // Show/hide navigation based on user type
    if (currentUser.type === 'admin') {
        if (coursesNav) coursesNav.style.display = 'none';
        if (certificatesNav) certificatesNav.innerHTML = '<i class="fas fa-certificate"></i><span>Certificates (Editable)</span>';
    } else if (currentUser.type === 'teacher') {
        if (certificatesNav) certificatesNav.innerHTML = '<i class="fas fa-certificate"></i><span>Certificates (Editable)</span>';
        if (coursesNav) coursesNav.innerHTML = '<i class="fas fa-book"></i><span>My Teaching Courses</span>';
    } else {
        if (certificatesNav) certificatesNav.innerHTML = '<i class="fas fa-certificate"></i><span>Certificates (Read-only)</span>';
        if (coursesNav) coursesNav.innerHTML = '<i class="fas fa-book"></i><span>My Enrolled Courses</span>';
    }
}

async function loadUserProfile() {
    try {
        console.log('[LOAD] Loading user profile for:', currentUser.id, currentUser.type);
        
        // Try to load existing profile from API first
        try {
            const profileResponse = await fetch(`/api/profile/${currentUser.id}`, {
                headers: getAuthHeaders()
            });
            
            if (profileResponse.ok) {
                const profileResult = await profileResponse.json();
                if (profileResult.success && profileResult.profile) {
                    console.log('[LOAD] Found existing profile:', profileResult.profile);
                    userProfile = profileResult.profile;
                    await loadCertificates();
                    await loadCourses();
                    return;
                }
            }
        } catch (profileError) {
            console.log('[LOAD] No existing profile found, loading from user collection:', profileError);
        }
        
        // Load user data from appropriate collection
        let collection = 'students';
        if (currentUser.type === 'teacher') collection = 'teachers';
        else if (currentUser.type === 'admin') collection = 'admins';
        
        const response = await fetch(`/api/${collection}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${collection}: ${response.status}`);
        }
        
        const users = await response.json();
        const userData = users.find(u => String(u.id) === String(currentUser.id) || u.email === currentUser.email);
        
        if (userData) {
            console.log('[LOAD] Found user data:', userData);
            userProfile = {
                userId: userData.id,
                userType: currentUser.type,
                basic: {
                    name: userData.name || currentUser.name || '',
                    dob: userData.dob || '',
                    gender: userData.gender || '',
                    email: userData.email || currentUser.email || '',
                    phone: userData.phone || '',
                    address: userData.address || '',
                    social: {
                        instagram: userData.instagram || '',
                        linkedin: userData.linkedin || '',
                        github: userData.github || ''
                    }
                },
                academic: userData.academic || {},
                certificates: [],
                courses: [],
                domain: userData.domain || '',
                score: userData.score || 0,
                lastUpdated: new Date().toISOString()
            };
        } else {
            console.log('[LOAD] User not found, using default profile');
            userProfile = createDefaultProfile();
        }
        
        // Load certificates and courses
        await loadCertificates();
        await loadCourses();
        
    } catch (error) {
        console.error('[LOAD] Error loading user profile:', error);
        userProfile = createDefaultProfile();
    }
}

async function loadCertificates() {
    try {
        console.log('[CERT] Loading certificates for user:', currentUser.id, currentUser.type);
        
        if (currentUser.type === 'student') {
            // For students: Only show certificates for completed courses
            const certResponse = await fetch(`/api/certificates?studentId=${currentUser.id}`);
            
            if (certResponse.ok) {
                const certificates = await certResponse.json();
                console.log('[CERT] Loaded certificates:', certificates);
                const userCerts = certificates.filter(c => String(c.studentId) === String(currentUser.id));
                userProfile.certificates = userCerts.map(cert => ({
                    courseTitle: cert.courseTitle || cert.title,
                    issuer: cert.issuer || 'LearnEdge LMS',
                    date: cert.date || cert.createdAt || new Date().toISOString(),
                    url: cert.url || '',
                    id: cert.id,
                    studentId: cert.studentId
                }));
            }
            
            // Also check for completed courses
            await loadCompletedCoursesCertificates();
            
        } else if (currentUser.type === 'teacher' || currentUser.type === 'admin') {
            // For teachers/admin: Load all certificates
            const certResponse = await fetch(`/api/certificates`, {
                headers: getAuthHeaders()
            });
            
            if (certResponse.ok) {
                const certificates = await certResponse.json();
                console.log('[CERT] Loaded all certificates:', certificates);
                userProfile.certificates = certificates.map(cert => ({
                    courseTitle: cert.courseTitle || cert.title,
                    issuer: cert.issuer || 'LearnEdge LMS',
                    date: cert.date || cert.createdAt || new Date().toISOString(),
                    url: cert.url || '',
                    id: cert.id,
                    studentId: cert.studentId,
                    studentName: cert.studentName
                }));
            }
        }
        
    } catch (error) {
        console.error('[CERT] Error loading certificates:', error);
        userProfile.certificates = userProfile.certificates || [];
    }
}

async function loadCompletedCoursesCertificates() {
    try {
        // Load enrollments
        const enrollmentsResponse = await fetch(`/api/enrollments?studentId=${currentUser.id}`);
        if (!enrollmentsResponse.ok) return;
        
        const enrollments = await enrollmentsResponse.json();
        if (!enrollments || enrollments.length === 0) return;
        
        // Load quiz and assignment submissions to determine completion
        const [quizSubsResponse, assignmentSubsResponse] = await Promise.all([
            fetch(`/quiz-submissions/my-submissions`, {
                headers: getAuthHeaders()
            }).catch(() => null),
            fetch(`/assignment-submissions/student/${currentUser.id}`, {
                headers: getAuthHeaders()
            }).catch(() => null)
        ]);
        
        let quizSubmissions = [];
        let assignmentSubmissions = [];
        
        if (quizSubsResponse && quizSubsResponse.ok) {
            try {
                const quizResult = await quizSubsResponse.json();
                quizSubmissions = quizResult.submissions || quizResult || [];
            } catch (e) {
                console.error('[CERT] Error parsing quiz submissions:', e);
            }
        }
        
        if (assignmentSubsResponse && assignmentSubsResponse.ok) {
            try {
                const assignResult = await assignmentSubsResponse.json();
                assignmentSubmissions = assignResult.submissions || assignResult || [];
            } catch (e) {
                console.error('[CERT] Error parsing assignment submissions:', e);
            }
        }
        
        // Determine completed courses
        const completedCourses = enrollments.filter(enrollment => {
            const courseTitle = enrollment.courseTitle || enrollment.course;
            if (!courseTitle) return false;
            
            const hasQuizCompletion = quizSubmissions.some(qs => 
                (qs.course === courseTitle || qs.courseTitle === courseTitle) && 
                (qs.status === 'completed' || qs.status === 'graded' || qs.status === 'submitted')
            );
            const hasAssignmentCompletion = assignmentSubmissions.some(as => 
                (as.course === courseTitle || as.courseTitle === courseTitle) && 
                (as.status === 'completed' || as.status === 'submitted' || as.status === 'graded')
            );
            
            return hasQuizCompletion && hasAssignmentCompletion;
        });
        
        // Convert to certificate format
        const courseCertificates = completedCourses.map(enrollment => ({
            id: `cert_${enrollment.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            studentId: currentUser.id,
            courseTitle: enrollment.courseTitle || enrollment.course,
            issuer: 'LearnEdge LMS',
            date: enrollment.enrolledAt || new Date().toISOString(),
            url: ''
        }));
        
        // Merge with existing certificates (avoid duplicates)
        const existingCertTitles = (userProfile.certificates || []).map(c => c.courseTitle);
        const newCerts = courseCertificates.filter(c => !existingCertTitles.includes(c.courseTitle));
        
        if (newCerts.length > 0) {
            userProfile.certificates = [...(userProfile.certificates || []), ...newCerts];
        }
        
    } catch (error) {
        console.error('[CERT] Error loading completed courses certificates:', error);
    }
}

async function loadCourses() {
    try {
        console.log('[COURSE] Loading courses for user:', currentUser.id, currentUser.type);
        
        if (currentUser.type === 'student') {
            // Fetch enrollments and courses in parallel
            const [enrollmentsResponse, coursesResponse] = await Promise.all([
                fetch(`/api/enrollments?studentId=${currentUser.id}`).catch(() => null),
                fetch(`/api/courses`).catch(() => null)
            ]);
            
            let enrollments = [];
            let allCourses = [];
            
            if (enrollmentsResponse && enrollmentsResponse.ok) {
                enrollments = await enrollmentsResponse.json();
                console.log('[COURSE] Loaded student enrollments:', enrollments);
            }
            
            if (coursesResponse && coursesResponse.ok) {
                allCourses = await coursesResponse.json();
                console.log('[COURSE] Loaded all courses:', allCourses.length);
            }
            
            // Map enrollments to course objects, ensuring we have courseId
            userProfile.courses = enrollments.map(e => {
                // Try to find the full course details by matching courseId or courseTitle
                let courseDetails = null;
                
                if (e.courseId) {
                    courseDetails = allCourses.find(c => 
                        String(c.id) === String(e.courseId) || c.id === parseInt(e.courseId)
                    );
                }
                
                // If not found by courseId, try to find by courseTitle
                if (!courseDetails && e.courseTitle) {
                    courseDetails = allCourses.find(c => 
                        c.title && (
                            c.title.trim() === e.courseTitle.trim() ||
                            c.title.toLowerCase().trim() === e.courseTitle.toLowerCase().trim()
                        )
                    );
                }
                
                // Use courseId from enrollment or from courseDetails
                const courseId = e.courseId || (courseDetails ? courseDetails.id : null);
                const courseTitle = e.courseTitle || (courseDetails ? courseDetails.title : '');
                
                return {
                    courseId: courseId,
                    courseTitle: courseTitle,
                    enrolledAt: e.enrolledAt,
                    status: e.status || 'active',
                    progress: e.progress || 0,
                    domain: courseDetails?.domain || '',
                    coordinator: courseDetails?.coordinator || '',
                    level: courseDetails?.level || '',
                    duration: courseDetails?.duration || ''
                };
            });
            
            console.log('[COURSE] Mapped courses for student:', userProfile.courses);
            
        } else if (currentUser.type === 'teacher') {
            const [teachersResponse, coursesResponse] = await Promise.all([
                fetch(`/api/teachers`).catch(() => null),
                fetch(`/api/courses`).catch(() => null)
            ]);
            
            if (teachersResponse && teachersResponse.ok) {
                const teachers = await teachersResponse.json();
                const teacherData = teachers.find(t => 
                    String(t.id) === String(currentUser.id) || 
                    t.email === currentUser.email ||
                    String(t.id) === String(currentUser.id)
                );
                
                let allCourses = [];
                if (coursesResponse && coursesResponse.ok) {
                    allCourses = await coursesResponse.json();
                }
                
                if (teacherData && teacherData.courses && Array.isArray(teacherData.courses)) {
                    userProfile.courses = teacherData.courses.map(courseName => {
                        const course = allCourses.find(c => 
                            c.title === courseName || 
                            String(c.id) === String(courseName) ||
                            (c.title && c.title.trim().toLowerCase() === String(courseName).trim().toLowerCase())
                        );
                        return {
                            courseId: course ? course.id : courseName,
                            courseTitle: course ? course.title : courseName,
                            status: 'teaching',
                            domain: course?.domain || '',
                            coordinator: course?.coordinator || '',
                            level: course?.level || '',
                            duration: course?.duration || ''
                        };
                    });
                } else {
                    userProfile.courses = [];
                }
            }
        } else {
            userProfile.courses = [];
        }
        
    } catch (error) {
        console.error('[COURSE] Error loading courses:', error);
        userProfile.courses = [];
    }
}

function createDefaultProfile() {
    return {
        userId: currentUser.id,
        userType: currentUser.type,
        basic: {
            name: currentUser.name || '',
            dob: '',
            gender: '',
            email: currentUser.email || '',
            phone: '',
            address: '',
            social: {
                instagram: '',
                linkedin: '',
                github: ''
            }
        },
        academic: {},
        certificates: [],
        courses: [],
        lastUpdated: new Date().toISOString()
    };
}

function setupEventListeners() {
    // Basic details form
    const editBasicBtn = document.getElementById('editBasicBtn');
    const cancelBasicBtn = document.getElementById('cancelBasicBtn');
    const basicDetailsForm = document.getElementById('basicDetailsForm');
    
    if (editBasicBtn) editBasicBtn.addEventListener('click', toggleBasicForm);
    if (cancelBasicBtn) cancelBasicBtn.addEventListener('click', cancelBasicForm);
    if (basicDetailsForm) basicDetailsForm.addEventListener('submit', saveBasicDetails);
    
    // Academic details form
    const editAcademicBtn = document.getElementById('editAcademicBtn');
    const addAcademicBtn = document.getElementById('addAcademicBtn');
    const cancelAcademicBtn = document.getElementById('cancelAcademicBtn');
    const academicDetailsForm = document.getElementById('academicDetailsForm');
    
    if (editAcademicBtn) editAcademicBtn.addEventListener('click', toggleAcademicForm);
    if (addAcademicBtn) addAcademicBtn.addEventListener('click', showAddAcademicForm);
    if (cancelAcademicBtn) cancelAcademicBtn.addEventListener('click', cancelAcademicForm);
    if (academicDetailsForm) academicDetailsForm.addEventListener('submit', saveAcademicDetails);
    
    // Certificate form
    const addCertBtn = document.getElementById('addCertBtn');
    const cancelCertBtn = document.getElementById('cancelCertBtn');
    const addCertificateForm = document.getElementById('addCertificateForm');
    
    if (addCertBtn) addCertBtn.addEventListener('click', toggleCertificateForm);
    if (cancelCertBtn) cancelCertBtn.addEventListener('click', cancelCertificateForm);
    if (addCertificateForm) addCertificateForm.addEventListener('submit', saveCertificate);
    
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-section');
            if (targetId) {
                showSection(targetId);
                updateActiveNav(this);
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllForms();
        }
    });
}

async function renderProfile() {
    if (!userProfile) {
        console.warn('[RENDER] userProfile is null, cannot render');
        return;
    }
    
    // Update header
    const welcomeMessage = document.getElementById('welcomeMessage');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const userTypeDisplay = document.getElementById('userTypeDisplay');
    
    if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUser.name || 'User'}`;
    if (userIdDisplay) userIdDisplay.textContent = `${currentUser.type.charAt(0).toUpperCase() + currentUser.type.slice(1)} ID: ${currentUser.id}`;
    if (userTypeDisplay) userTypeDisplay.textContent = `${currentUser.type.charAt(0).toUpperCase() + currentUser.type.slice(1)}`;
    
    // Render sections
    try {
        renderBasicDetails();
    } catch (error) {
        console.error('[RENDER] Error rendering basic details:', error);
    }
    
    try {
        renderAcademicDetails();
    } catch (error) {
        console.error('[RENDER] Error rendering academic details:', error);
    }
    
    try {
        await renderCertificates();
    } catch (error) {
        console.error('[RENDER] Error rendering certificates:', error);
    }
    
    try {
        await renderCourses();
    } catch (error) {
        console.error('[RENDER] Error rendering courses:', error);
    }
}

function renderBasicDetails() {
    const container = document.getElementById('basicDetailsDisplay') || document.getElementById('basicContainer');
    if (!container || !userProfile) return;
    
    const basic = userProfile.basic || {};
    
    container.innerHTML = `
        <div class="details-display">
            <div class="detail-item">
                <h4><i class="fas fa-user"></i> Full Name</h4>
                <p>${basic.name || 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-calendar"></i> Date of Birth</h4>
                <p>${basic.dob ? new Date(basic.dob).toLocaleDateString() : 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-venus-mars"></i> Gender</h4>
                <p>${basic.gender ? basic.gender.charAt(0).toUpperCase() + basic.gender.slice(1) : 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-map-marker-alt"></i> Address</h4>
                <p>${basic.address || 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-phone"></i> Phone Number</h4>
                <p>${basic.phone || 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-envelope"></i> Email</h4>
                <p>${basic.email || 'Not specified'}</p>
            </div>
            ${renderSocialLinks(basic.social || {})}
        </div>
    `;
}

function renderSocialLinks(social) {
    const links = [];
    if (social.instagram) links.push(`<a href="${social.instagram}" target="_blank"><i class="fab fa-instagram"></i> Instagram</a>`);
    if (social.linkedin) links.push(`<a href="${social.linkedin}" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>`);
    if (social.github) links.push(`<a href="${social.github}" target="_blank"><i class="fab fa-github"></i> GitHub</a>`);
    
    if (links.length === 0) {
        return '<div class="detail-item"><h4><i class="fas fa-share-alt"></i> Social Media</h4><p>No social media links added</p></div>';
    }
    
    return `
        <div class="detail-item">
            <h4><i class="fas fa-share-alt"></i> Social Media</h4>
            <div class="social-media">
                ${links.join('')}
            </div>
        </div>
    `;
}

function renderAcademicDetails() {
    const container = document.getElementById('academicDetailsDisplay') || document.getElementById('academicContainer');
    if (!container || !userProfile) return;
    
    const academic = userProfile.academic || {};
    
    if (Object.keys(academic).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-graduation-cap"></i>
                <h3>No Academic Details</h3>
                <p>Add your academic qualifications to showcase your educational background.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    Object.keys(academic).forEach(level => {
        const details = academic[level];
        html += `
            <div class="academic-level">
                <h3><i class="fas fa-graduation-cap"></i> ${getAcademicLevelName(level)}</h3>
                <div class="academic-details">
                    <div class="detail-item">
                        <h4>Percentage/CGPA</h4>
                        <p>${details.percentage || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <h4>Board/University</h4>
                        <p>${details.board || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <h4>School/College</h4>
                        <p>${details.school || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <h4>Year</h4>
                        <p>${details.year || 'Not specified'}</p>
                    </div>
                    ${details.branch ? `
                        <div class="detail-item">
                            <h4>Branch/Stream</h4>
                            <p>${details.branch}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function renderCertificates() {
    const container = document.getElementById('certificatesContainer');
    if (!container || !userProfile) return;
    
    const certificates = userProfile.certificates || [];
    const canEdit = currentUser.type === 'teacher' || currentUser.type === 'admin';
    
    // Show/hide Add Certificate button
    const addBtn = document.getElementById('addCertBtn');
    if (addBtn) {
        addBtn.style.display = canEdit ? 'flex' : 'none';
    }
    
    if (!certificates || certificates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-certificate"></i>
                <h3>No Certificates</h3>
                <p>${currentUser.type === 'student' ? 'Certificates will appear here once you complete courses.' : 'Click "Add Certificate" to add a new certificate.'}</p>
            </div>
        `;
        return;
    }
    
    // Filter certificates based on user type
    let displayCertificates = certificates;
    if (currentUser.type === 'student') {
        displayCertificates = certificates.filter(c => String(c.studentId) === String(currentUser.id));
    }
    
    // Load student names for teachers/admin
    let studentNamesMap = {};
    if (canEdit) {
        try {
            const studentsResponse = await fetch('/api/students');
            if (studentsResponse.ok) {
                const students = await studentsResponse.json();
                students.forEach(s => {
                    studentNamesMap[String(s.id)] = s.name;
                });
            }
        } catch (error) {
            console.error('[CERT] Error loading student names:', error);
        }
    }
    
    const studentName = userProfile.basic?.name || currentUser.name || 'Student';
    
    let html = '';
    displayCertificates.forEach((cert, index) => {
        const certStudentName = cert.studentName || (cert.studentId ? studentNamesMap[String(cert.studentId)] : null) || studentName;
        const certTitle = (cert.courseTitle || cert.title || 'Certificate').replace(/'/g, "\\'");
        const certDate = cert.date || '';
        
        html += `
            <div class="certificate-item">
                <div class="certificate-info">
                    <h3>${certTitle}</h3>
                    <p><strong>Issuer:</strong> ${cert.issuer || 'LearnEdge LMS'}</p>
                    <p><strong>Issue Date:</strong> ${certDate ? new Date(certDate).toLocaleDateString() : 'N/A'}</p>
                    ${canEdit && cert.studentId ? `<p><strong>Student:</strong> ${certStudentName}</p>` : ''}
                    ${cert.url ? `<p><strong>Verification:</strong> <a href="${cert.url}" target="_blank">View Certificate</a></p>` : ''}
                </div>
                <div class="certificate-actions">
                    ${currentUser.type === 'student' ? `
                        <button class="view-btn" onclick="viewCertificateDownload('${studentName.replace(/'/g, "\\'")}', '${certTitle}', '${certDate}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    ` : `
                        <button class="view-btn" onclick="viewCertificateDownload('${certStudentName.replace(/'/g, "\\'")}', '${certTitle}', '${certDate}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="delete-btn" onclick="deleteCertificateById('${cert.id}')" title="Delete Certificate">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    `}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function renderCourses() {
    const container = document.getElementById('coursesContainer');
    if (!container || !userProfile) return;
    
    const courses = userProfile.courses || [];
    
    if (currentUser.type === 'admin') {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-shield"></i>
                <h3>Admin Access</h3>
                <p>Admins do not have personal courses. Use the admin panel to manage all courses.</p>
            </div>
        `;
        return;
    }
    
    if (courses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book"></i>
                <h3>No ${currentUser.type === 'student' ? 'Enrolled' : 'Teaching'} Courses</h3>
                <p>${currentUser.type === 'student' ? 'You haven\'t enrolled in any courses yet. Browse our course catalog to get started.' : 'No teaching courses have been assigned yet. Please contact the administrator.'}</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    courses.forEach(course => {
        const courseId = course.courseId || '';
        const courseTitle = course.courseTitle || course.title || '';
        
        // For students, always show "Go to Course" since these are enrolled courses
        // For teachers, show "View" or "Manage Course"
        let buttonText = 'View';
        let buttonIcon = 'fa-eye';
        
        if (currentUser.type === 'student') {
            // Students viewing enrolled courses should always see "Go to Course"
            buttonText = 'Go to Course';
            buttonIcon = 'fa-arrow-right';
        } else if (currentUser.type === 'teacher') {
            buttonText = 'Manage Course';
            buttonIcon = 'fa-chalkboard-teacher';
        }
        
        html += `
            <div class="course-item">
                <div class="course-info">
                    <h3>${courseTitle}</h3>
                    ${course.status ? `<p><span class="course-status ${course.status}">${course.status.charAt(0).toUpperCase() + course.status.slice(1)}</span></p>` : ''}
                    ${course.domain ? `<p><strong>Domain:</strong> ${course.domain}</p>` : ''}
                    ${course.coordinator ? `<p><strong>Coordinator:</strong> ${course.coordinator}</p>` : ''}
                    ${course.level ? `<p><strong>Level:</strong> ${course.level}</p>` : ''}
                    ${course.duration ? `<p><strong>Duration:</strong> ${course.duration}</p>` : ''}
                    ${course.progress !== undefined && currentUser.type === 'student' ? `<p><strong>Progress:</strong> ${course.progress}%</p>` : ''}
                    ${course.enrolledAt ? `<p><strong>Enrolled:</strong> ${new Date(course.enrolledAt).toLocaleDateString()}</p>` : ''}
                </div>
                <div class="course-actions">
                    <button class="view-btn" onclick="viewCourse('${String(courseId).replace(/'/g, "\\'")}', '${String(courseTitle).replace(/'/g, "\\'")}')">
                        <i class="fas ${buttonIcon}"></i> ${buttonText}
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function showDefaultSection() {
    // Show courses section by default for teachers
    if (currentUser.type === 'teacher') {
        showSection('mycourses');
        const navLink = document.querySelector('[data-section="mycourses"]');
        if (navLink) updateActiveNav(navLink);
    } else {
        showSection('basic-details');
        const navLink = document.querySelector('[data-section="basic-details"]');
        if (navLink) updateActiveNav(navLink);
    }
}

// Form management functions
function toggleBasicForm() {
    const form = document.getElementById('basicForm') || document.getElementById('basicDetailsForm');
    const display = document.getElementById('basicDetailsDisplay') || document.getElementById('basicContainer');
    
    if (!form || !display) return;
    
    if (isEditingBasic) {
        closeForm(form, display);
        isEditingBasic = false;
    } else {
        // Populate form with current data
        const basic = userProfile.basic || {};
        const nameInput = document.getElementById('name') || document.getElementById('editName');
        const dobInput = document.getElementById('dob') || document.getElementById('editDob');
        const genderInput = document.getElementById('gender') || document.getElementById('editGender');
        const emailInput = document.getElementById('email') || document.getElementById('editEmail');
        const phoneInput = document.getElementById('phone') || document.getElementById('editPhone');
        const addressInput = document.getElementById('address') || document.getElementById('editAddress');
        const instagramInput = document.getElementById('instagram') || document.getElementById('editInstagram');
        const linkedinInput = document.getElementById('linkedin') || document.getElementById('editLinkedin');
        const githubInput = document.getElementById('github') || document.getElementById('editGithub');
        
        if (nameInput) nameInput.value = basic.name || '';
        if (dobInput) dobInput.value = basic.dob || '';
        if (genderInput) genderInput.value = basic.gender || '';
        if (emailInput) emailInput.value = basic.email || '';
        if (phoneInput) phoneInput.value = basic.phone || '';
        if (addressInput) addressInput.value = basic.address || '';
        if (instagramInput) instagramInput.value = (basic.social || {}).instagram || '';
        if (linkedinInput) linkedinInput.value = (basic.social || {}).linkedin || '';
        if (githubInput) githubInput.value = (basic.social || {}).github || '';
        
        openForm(form, display);
        isEditingBasic = true;
    }
}

function cancelBasicForm() {
    const form = document.getElementById('basicForm') || document.getElementById('basicDetailsForm');
    const display = document.getElementById('basicDetailsDisplay') || document.getElementById('basicContainer');
    if (form && display) {
        closeForm(form, display);
    }
    isEditingBasic = false;
}

async function saveBasicDetails(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        userProfile.basic = {
            name: formData.get('name') || formData.get('editName'),
            dob: formData.get('dob') || formData.get('editDob'),
            gender: formData.get('gender') || formData.get('editGender'),
            email: formData.get('email') || formData.get('editEmail'),
            phone: formData.get('phone') || formData.get('editPhone'),
            address: formData.get('address') || formData.get('editAddress'),
            social: {
                instagram: formData.get('instagram') || formData.get('editInstagram') || '',
                linkedin: formData.get('linkedin') || formData.get('editLinkedin') || '',
                github: formData.get('github') || formData.get('editGithub') || ''
            }
        };
        
        // Save to API
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userProfile)
        });
        
        if (response.ok) {
            renderBasicDetails();
            cancelBasicForm();
            showNotification('Basic details updated successfully!', 'success');
        } else {
            throw new Error('Failed to update profile');
        }
    } catch (error) {
        console.error('Error saving basic details:', error);
        showNotification('Failed to save basic details. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function toggleAcademicForm() {
    const form = document.getElementById('academicForm') || document.getElementById('academicDetailsForm');
    const display = document.getElementById('academicDetailsDisplay') || document.getElementById('academicContainer');
    
    if (!form || !display) return;
    
    if (isEditingAcademic) {
        closeForm(form, display);
        isEditingAcademic = false;
    } else {
        openForm(form, display);
        isEditingAcademic = true;
        isAddingAcademic = false;
    }
}

function showAddAcademicForm() {
    const form = document.getElementById('academicForm') || document.getElementById('academicDetailsForm');
    const display = document.getElementById('academicDetailsDisplay') || document.getElementById('academicContainer');
    
    if (!form || !display) return;
    
    // Clear form
    if (form.reset) form.reset();
    
    openForm(form, display);
    isEditingAcademic = true;
    isAddingAcademic = true;
}

function cancelAcademicForm() {
    const form = document.getElementById('academicForm') || document.getElementById('academicDetailsForm');
    const display = document.getElementById('academicDetailsDisplay') || document.getElementById('academicContainer');
    if (form && display) {
        closeForm(form, display);
    }
    isEditingAcademic = false;
    isAddingAcademic = false;
}

async function saveAcademicDetails(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        const level = formData.get('academicLevel');
        
        if (!userProfile.academic) {
            userProfile.academic = {};
        }
        
        userProfile.academic[level] = {
            percentage: formData.get('percentage'),
            board: formData.get('board'),
            school: formData.get('school'),
            year: formData.get('academicYear') || formData.get('year'),
            branch: formData.get('branch')
        };
        
        // Save to API
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userProfile)
        });
        
        if (response.ok) {
            renderAcademicDetails();
            cancelAcademicForm();
            showNotification('Academic details updated successfully!', 'success');
        } else {
            throw new Error('Failed to update profile');
        }
    } catch (error) {
        console.error('Error saving academic details:', error);
        showNotification('Failed to save academic details. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function toggleCertificateForm() {
    const form = document.getElementById('certificateForm');
    const container = document.getElementById('certificatesContainer');
    
    if (!form || !container) return;
    
    if (isAddingCertificate) {
        closeForm(form, container);
        isAddingCertificate = false;
    } else {
        // Clear form
        const formElement = document.getElementById('addCertificateForm');
        if (formElement && formElement.reset) formElement.reset();
        
        // Show/hide student selector based on user type
        const studentGroup = document.getElementById('certStudentGroup');
        const studentSelect = document.getElementById('certStudent');
        
        if (currentUser.type === 'teacher' || currentUser.type === 'admin') {
            if (studentGroup) studentGroup.style.display = 'block';
            if (studentSelect) studentSelect.required = true;
            loadStudentsForCertificate();
        } else {
            if (studentGroup) studentGroup.style.display = 'none';
            if (studentSelect) studentSelect.required = false;
        }
        
        openForm(form, container);
        isAddingCertificate = true;
    }
}

async function loadStudentsForCertificate() {
    try {
        const response = await fetch('/api/students');
        if (response.ok) {
            const students = await response.json();
            const studentSelect = document.getElementById('certStudent');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">Select Student</option>' + 
                    students.map(s => `<option value="${s.id}">${s.name} (${s.email})</option>`).join('');
            }
        }
    } catch (error) {
        console.error('[CERT] Error loading students:', error);
    }
}

function cancelCertificateForm() {
    const form = document.getElementById('certificateForm');
    const container = document.getElementById('certificatesContainer');
    if (form && container) {
        closeForm(form, container);
    }
    isAddingCertificate = false;
}

async function saveCertificate(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        const certificateData = {
            courseTitle: formData.get('certTitle'),
            issuer: formData.get('certIssuer'),
            date: formData.get('certDate'),
            url: formData.get('certUrl') || ''
        };
        
        // For teachers/admin, get student ID from form
        if (currentUser.type === 'teacher' || currentUser.type === 'admin') {
            const studentId = formData.get('certStudent') || document.getElementById('certStudent')?.value;
            if (!studentId) {
                showNotification('Please select a student', 'error');
                showLoading(false);
                return;
            }
            certificateData.studentId = studentId;
        } else {
            certificateData.studentId = currentUser.id;
        }
        
        const response = await fetch('/api/certificates', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(certificateData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('Certificate added successfully!', 'success');
            cancelCertificateForm();
            // Reload certificates
            await loadCertificates();
            await renderCertificates();
        } else {
            throw new Error(result.error || 'Failed to add certificate');
        }
    } catch (error) {
        console.error('[CERT] Error saving certificate:', error);
        showNotification(error.message || 'Failed to add certificate. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Utility functions
function openForm(form, display) {
    if (form) form.style.display = 'block';
    if (display) display.style.display = 'none';
}

function closeForm(form, display) {
    if (form) form.style.display = 'none';
    if (display) display.style.display = 'block';
}

function closeAllForms() {
    if (isEditingBasic) {
        cancelBasicForm();
    } else if (isEditingAcademic) {
        cancelAcademicForm();
    } else if (isAddingCertificate) {
        cancelCertificateForm();
    }
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

function getAcademicLevelName(level) {
    const names = {
        'X': 'Class X',
        'XII': 'Class XII',
        'UG': 'Undergraduate',
        'PG': 'Postgraduate',
        'PhD': 'PhD',
        'Current': 'Current Education'
    };
    return names[level] || level;
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.profile-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        console.log(`[UI] Showing section: ${sectionId}`);
        targetSection.classList.add('active');
    }
}

function updateActiveNav(activeLink) {
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to clicked link
    if (activeLink) activeLink.classList.add('active');
}

// Action functions
async function deleteCertificateById(certId) {
    if (!confirm('Are you sure you want to delete this certificate?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`/api/certificates/${certId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('Certificate deleted successfully!', 'success');
            // Reload certificates
            await loadCertificates();
            await renderCertificates();
        } else {
            throw new Error(result.error || 'Failed to delete certificate');
        }
    } catch (error) {
        console.error('[CERT] Error deleting certificate:', error);
        showNotification(error.message || 'Failed to delete certificate. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function viewCourse(courseId, courseTitle) {
    try {
        console.log('[NAV] viewCourse called with courseId:', courseId, 'courseTitle:', courseTitle);
        const userType = currentUser.type;
        
        if (userType === 'teacher') {
            localStorage.setItem('selectedCourse', courseTitle);
            window.location.href = '/HTML/teacherCourse.html';
        } else if (userType === 'student') {
            window.location.href = '/HTML/course.html?id=' + encodeURIComponent(courseId);
        } else if (userType === 'admin') {
            localStorage.setItem('selectedCourse', courseId);
            window.location.href = '/HTML/adminCourseManagement.html';
        } else {
            window.location.href = '/HTML/course.html?id=' + encodeURIComponent(courseId);
        }
    } catch (error) {
        console.error('[NAV] Error navigating to course:', error);
        showNotification('Failed to open course. Please try again.', 'error');
    }
}

function viewCertificateDownload(studentName, courseTitle, date) {
    const url = `/HTML/certificate.html?studentName=${encodeURIComponent(studentName)}&courseTitle=${encodeURIComponent(courseTitle)}&date=${encodeURIComponent(date)}&autoDownload=1`;
    window.open(url, '_blank');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span> ${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; margin-left: 10px; cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Logout function
function logoutUser() {
    try {
        localStorage.clear();
        sessionStorage.clear();
        showNotification('You have been logged out successfully.', 'success');
        setTimeout(() => {
            window.location.href = '/HTML/login.html';
        }, 1500);
    } catch (error) {
        console.error('Error during logout:', error);
        window.location.href = '/HTML/login.html';
    }
}

// Export functions for global access
window.viewCourse = viewCourse;
window.logoutUser = logoutUser;
window.viewCertificateDownload = viewCertificateDownload;
window.deleteCertificateById = deleteCertificateById;
window.toggleBasicForm = toggleBasicForm;
window.cancelBasicForm = cancelBasicForm;
window.toggleAcademicForm = toggleAcademicForm;
window.cancelAcademicForm = cancelAcademicForm;
window.toggleCertificateForm = toggleCertificateForm;
window.cancelCertificateForm = cancelCertificateForm;

window.deleteCertificate = deleteCertificate;