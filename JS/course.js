// ========================================
// COURSE PAGE - FULLY DYNAMIC & MODERN (NODE.JS BACKEND)
// ========================================

const API_BASE_URL = '/api';
let currentCourse = null;
let courseDetails = null;
let allQuizzes = [];
let allQuizSubmissions = [];
let loggedInUser = null;
let quizFilterStatus = '';
let assignmentsResource = [];

// Helper function to get auth headers
function getAuthHeaders() {
    if (!loggedInUser) return { 'Content-Type': 'application/json' };
    return {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify({
            id: loggedInUser.id,
            type: loggedInUser.type,
            email: loggedInUser.email
        })
    };
}

document.addEventListener('DOMContentLoaded', function() {
    initializeCoursePage();
});

async function initializeCoursePage() {
    try {
        // Safely parse logged in user
        try {
            const userStr = localStorage.getItem('loggedInUser');
            if (userStr) {
                loggedInUser = JSON.parse(userStr);
            }
        } catch (parseError) {
            console.error('[INIT] Error parsing logged in user:', parseError);
            alert('Session expired. Please log in again.');
            window.location.href = '/HTML/login.html';
            return;
        }

        if (!loggedInUser) {
            alert('Please log in to access this page.');
            window.location.href = '/HTML/login.html';
            return;
        }

        console.log('[INIT] Starting course page initialization');
        console.log('[INIT] Logged in user:', loggedInUser);

        // Get course from URL
        const urlParams = new URLSearchParams(window.location.search);
        let courseId = urlParams.get('id');
        let courseTitle = urlParams.get('title');
        
        console.log('[INIT] URL params - courseId:', courseId, 'courseTitle:', courseTitle);

        // Load course data first
        await loadCourseById(courseId, courseTitle);
        
        if (!currentCourse) {
            alert('Course not found.');
            window.location.href = '/HTML/index.html';
            return;
        }

        console.log('[INIT] Current course loaded:', currentCourse.title);

        // Check enrollment for students AFTER course is loaded
        if (loggedInUser.type === 'student') {
            console.log('[ENROLLMENT] Checking enrollment for student...');
            const isEnrolled = await checkEnrollment();
            console.log('[ENROLLMENT] Is enrolled:', isEnrolled);
            
            if (!isEnrolled) {
                alert('You are not enrolled in this course: ' + currentCourse.title);
                window.location.href = '/HTML/index.html';
                return;
            }
            console.log('[ENROLLMENT] ✅ Enrollment verified - proceeding to load course');
        }

        await loadCourseData();
        updateCourseDisplay();
        await renderAllSections();
        setupEventListeners();
        setupProfileDropdown();
        
        console.log('[INIT] ✅ Course page initialization complete');
    } catch (error) {
        console.error('[INIT] Error initializing page:', error);
        showError('Failed to load course. Please refresh and try again.');
    }
}

async function loadCourseById(courseId, courseTitle) {
    try {
        console.log('[COURSE] Loading course - ID:', courseId, 'Title:', courseTitle);
        
        let foundCourse = null;
        
        // Try to fetch by ID first
        if (courseId) {
            try {
                const courseRes = await fetch(`${API_BASE_URL}/courses/${courseId}`);
                if (courseRes.ok) {
                    foundCourse = await courseRes.json();
                    console.log('[COURSE] ✅ Found course by ID:', foundCourse.title);
                }
            } catch (error) {
                console.log('[COURSE] Failed to fetch by ID, trying alternatives:', error);
            }
        }
        
        // If not found by id, try fetching all and finding by ID
        if (!foundCourse && courseId) {
            try {
                const allCoursesRes = await fetch(`${API_BASE_URL}/courses`);
                if (allCoursesRes.ok) {
                    const allCourses = await allCoursesRes.json();
                    foundCourse = allCourses.find(c => 
                        String(c.id) === String(courseId) || 
                        c.id === parseInt(courseId)
                    );
                    if (foundCourse) {
                        console.log('[COURSE] ✅ Found course by ID from all courses:', foundCourse.title);
                    }
                }
            } catch (error) {
                console.log('[COURSE] Failed to fetch all courses:', error);
            }
        }
        
        // Try to find by title
        if (!foundCourse && courseTitle) {
            try {
                const allCoursesRes = await fetch(`${API_BASE_URL}/courses`);
                if (allCoursesRes.ok) {
                    const allCourses = await allCoursesRes.json();
                    foundCourse = allCourses.find(c => 
                        c.title && c.title.trim().toLowerCase() === courseTitle.trim().toLowerCase()
                    );
                    if (foundCourse) {
                        console.log('[COURSE] ✅ Found course by title:', foundCourse.title);
                    }
                }
            } catch (error) {
                console.log('[COURSE] Failed to fetch courses by title:', error);
            }
        }

        if (!foundCourse) {
            console.error('[COURSE] ❌ Course not found with ID:', courseId, 'Title:', courseTitle);
            throw new Error('Course not found');
        }
        
        currentCourse = foundCourse;
    } catch (error) {
        console.error('[COURSE] Error loading course:', error);
        throw error;
    }
}

async function checkEnrollment() {
    try {
        console.log('[ENROLLMENT] Checking enrollment for:', {
            studentId: loggedInUser.id,
            courseId: currentCourse.id,
            courseTitle: currentCourse.title
        });
        
        // Try using the enrollment check endpoint first with both courseId and courseTitle
        try {
            let checkUrl = `/enrollments/check?`;
            if (currentCourse.id) {
                checkUrl += `courseId=${encodeURIComponent(currentCourse.id)}`;
            }
            if (currentCourse.title) {
                if (currentCourse.id) checkUrl += '&';
                checkUrl += `courseTitle=${encodeURIComponent(currentCourse.title)}`;
            }
            
            const checkResponse = await fetch(checkUrl, {
                headers: getAuthHeaders()
            });
            
            if (checkResponse.ok) {
                const checkResult = await checkResponse.json();
                if (checkResult.success !== undefined) {
                    console.log('[ENROLLMENT] Check endpoint result:', checkResult.isEnrolled, checkResult.enrollment);
                    if (checkResult.isEnrolled) {
                        console.log('[ENROLLMENT] ✅ Enrollment found via check endpoint');
                        return true;
                    }
                }
            } else {
                console.log('[ENROLLMENT] Check endpoint returned:', checkResponse.status, checkResponse.statusText);
            }
        } catch (checkError) {
            console.log('[ENROLLMENT] Check endpoint failed, trying alternative:', checkError);
        }
        
        // Fallback: Get all student enrollments and check manually
        try {
            const allEnrollmentsResponse = await fetch(`${API_BASE_URL}/enrollments?studentId=${loggedInUser.id}`);
            
            if (allEnrollmentsResponse.ok) {
                const allEnrollments = await allEnrollmentsResponse.json();
                console.log('[ENROLLMENT] All student enrollments:', allEnrollments);
                
                // Check if enrolled by matching courseId OR courseTitle
                const isEnrolled = allEnrollments.some(e => {
                    // Match by courseId if both have it
                    if (currentCourse.id && e.courseId) {
                        if (String(e.courseId) === String(currentCourse.id) || e.courseId === parseInt(currentCourse.id)) {
                            console.log('[ENROLLMENT] ✅ Matched by courseId:', e.courseId, currentCourse.id);
                            return true;
                        }
                    }
                    
                    // Match by courseTitle
                    if (currentCourse.title && e.courseTitle) {
                        if (e.courseTitle.trim() === currentCourse.title.trim() ||
                            e.courseTitle.toLowerCase().trim() === currentCourse.title.toLowerCase().trim()) {
                            console.log('[ENROLLMENT] ✅ Matched by courseTitle:', e.courseTitle, currentCourse.title);
                            return true;
                        }
                    }
                    
                    // Also check course field (if it exists)
                    if (currentCourse.title && e.course) {
                        if (e.course.trim() === currentCourse.title.trim() ||
                            e.course.toLowerCase().trim() === currentCourse.title.toLowerCase().trim()) {
                            console.log('[ENROLLMENT] ✅ Matched by course field:', e.course, currentCourse.title);
                            return true;
                        }
                    }
                    
                    return false;
                });
                
                if (isEnrolled) {
                    console.log('[ENROLLMENT] ✅ Enrollment found via manual check');
                    return true;
                } else {
                    console.log('[ENROLLMENT] ❌ No matching enrollment found in', allEnrollments.length, 'enrollments');
                }
            }
        } catch (manualCheckError) {
            console.log('[ENROLLMENT] Manual check failed:', manualCheckError);
        }
        
        // Final fallback: Try individual filters
        try {
            // Try courseId filter
            if (currentCourse.id) {
                const enrollmentsByIdResponse = await fetch(`${API_BASE_URL}/enrollments?studentId=${loggedInUser.id}&courseId=${encodeURIComponent(currentCourse.id)}`);
                if (enrollmentsByIdResponse.ok) {
                    const enrollments = await enrollmentsByIdResponse.json();
                    if (enrollments.length > 0) {
                        console.log('[ENROLLMENT] ✅ Found enrollment by courseId filter');
                        return true;
                    }
                }
            }
            
            // Try courseTitle filter
            if (currentCourse.title) {
                const enrollmentsByTitleResponse = await fetch(`${API_BASE_URL}/enrollments?studentId=${loggedInUser.id}&courseTitle=${encodeURIComponent(currentCourse.title)}`);
                if (enrollmentsByTitleResponse.ok) {
                    const enrollments = await enrollmentsByTitleResponse.json();
                    if (enrollments.length > 0) {
                        console.log('[ENROLLMENT] ✅ Found enrollment by courseTitle filter');
                        return true;
                    }
                }
            }
        } catch (filterError) {
            console.log('[ENROLLMENT] Filter check failed:', filterError);
        }
        
        console.log('[ENROLLMENT] ❌ No enrollment found after all checks');
        return false;
    } catch (error) {
        console.error('[ENROLLMENT] Error checking enrollment:', error);
        return false;
    }
}

async function loadCourseData() {
    try {
        console.log('[LOAD] Loading course data for:', currentCourse.id);
        
        // Fetch all quizzes
        const quizzesRes = await fetch(`${API_BASE_URL}/quizzes`);
        allQuizzes = quizzesRes.ok ? await quizzesRes.json() : [];
        console.log('[LOAD] Loaded quizzes:', allQuizzes.length);

        // Fetch quiz submissions using Node.js backend endpoint
        try {
            const submissionsRes = await fetch('/quiz-submissions/my-submissions', {
                headers: getAuthHeaders()
            });
            if (submissionsRes.ok) {
                const result = await submissionsRes.json();
                allQuizSubmissions = result.submissions || result || [];
                console.log('[LOAD] Loaded quiz submissions from backend:', allQuizSubmissions.length);
            } else {
                // Fallback to json-server endpoint
                const fallbackRes = await fetch(`${API_BASE_URL}/quizSubmissions`);
                if (fallbackRes.ok) {
                    const allSubmissions = await fallbackRes.json();
                    allQuizSubmissions = allSubmissions.filter(s => String(s.studentId) === String(loggedInUser.id));
                    console.log('[LOAD] Loaded quiz submissions from fallback:', allQuizSubmissions.length);
                }
            }
        } catch (error) {
            console.error('[LOAD] Error loading quiz submissions:', error);
            allQuizSubmissions = [];
        }

        // Fetch assignments resource
        const assignmentsRes = await fetch(`${API_BASE_URL}/assignments`);
        assignmentsResource = assignmentsRes.ok ? await assignmentsRes.json() : [];
        console.log('[LOAD] Loaded assignments:', assignmentsResource.length);

        // Fetch videoSessions and materials from global resources
        const videoSessionsRes = await fetch(`${API_BASE_URL}/videoSessions`);
        const allVideoSessions = videoSessionsRes.ok ? await videoSessionsRes.json() : [];
        const materialsRes = await fetch(`${API_BASE_URL}/materials`);
        const allMaterials = materialsRes.ok ? await materialsRes.json() : [];

        // Try to find courseDetails if available (from db.json courseDetails)
        try {
            const dbRes = await fetch(`${API_BASE_URL}/db.json`);
            if (dbRes.ok) {
                const dbData = await dbRes.json();
                const courseDetailsData = dbData.courseDetails || {};
                if (courseDetailsData[currentCourse.title]) {
                    courseDetails = courseDetailsData[currentCourse.title];
                } else {
                    // Try partial match
                    const courseKeys = Object.keys(courseDetailsData);
                    const matchingKey = courseKeys.find(key =>
                        key.toLowerCase().includes(currentCourse.title.toLowerCase()) ||
                        currentCourse.title.toLowerCase().includes(key.toLowerCase())
                    );
                    if (matchingKey) {
                        courseDetails = courseDetailsData[matchingKey];
                    }
                }
            }
        } catch (dbError) {
            console.log('[LOAD] Could not load courseDetails from db.json:', dbError);
        }
        
        // Initialize courseDetails if not found
        if (!courseDetails) {
            courseDetails = {
                title: currentCourse.title,
                description: currentCourse.description,
                coordinator: currentCourse.coordinator,
                image: currentCourse.img || currentCourse.image,
                quiz: [],
                sessions: [],
                resources: [],
                assignments: []
            };
        }

        // Filter quizzes for this course
        courseDetails.quiz = allQuizzes.filter(quiz => 
            quiz.course && quiz.course.trim() === currentCourse.title.trim()
        );
        
        // Use global videoSessions and materials if not present in courseDetails
        courseDetails.sessions = (courseDetails.sessions && courseDetails.sessions.length > 0)
            ? courseDetails.sessions
            : allVideoSessions.filter(v => !v.course || v.course === currentCourse.title);
            
        courseDetails.resources = (courseDetails.resources && courseDetails.resources.length > 0)
            ? courseDetails.resources
            : allMaterials.filter(m => !m.course || m.course === currentCourse.title);
            
        console.log('[LOAD] ✅ Course data loaded successfully');
    } catch (error) {
        console.error('[LOAD] Error loading course data:', error);
        throw error;
    }
}

function updateCourseDisplay() {
    if (!currentCourse || !courseDetails) return;
    
    document.title = `${courseDetails.title || currentCourse.title} - LearnEdge LMS`;
    
    const titleElement = document.querySelector('.course-title');
    if (titleElement) titleElement.textContent = courseDetails.title || currentCourse.title;
    
    const descElement = document.querySelector('.course-desc');
    if (descElement) descElement.textContent = courseDetails.description || currentCourse.description || 'Course description will be available soon.';
    
    const durationElement = document.querySelector('.course-duration');
    if (durationElement) durationElement.textContent = `Duration: ${courseDetails.duration || currentCourse.duration || 'TBD'}`;
    
    const imageElement = document.querySelector('.course-image');
    if (imageElement) {
        imageElement.src = courseDetails.image || currentCourse.img || currentCourse.image || '../images/Consultant.jpeg';
        imageElement.alt = courseDetails.title || currentCourse.title;
        imageElement.onerror = function() { this.src = '../images/Consultant.jpeg'; };
    }
}

async function renderAllSections() {
    renderSessionsSection();
    renderResourcesSection();
    await renderAssignmentsSection();
    await renderQuizSection();
}

async function renderQuizSection() {
    const quizContainer = document.getElementById('quizContainer');
    if (!quizContainer) return;
    
    // Reload quiz submissions to ensure we have the latest data
    try {
        const submissionsRes = await fetch('/quiz-submissions/my-submissions', {
            headers: getAuthHeaders()
        });
        if (submissionsRes.ok) {
            const result = await submissionsRes.json();
            allQuizSubmissions = result.submissions || result || [];
        }
    } catch (error) {
        console.error('[QUIZ] Error reloading quiz submissions:', error);
    }
    
    const quizzes = (courseDetails.quiz || []).filter(q => {
        if (!quizFilterStatus) return true;
        if (quizFilterStatus === 'pending') {
            const submission = allQuizSubmissions.find(s => String(s.quizId) === String(q.id));
            return !submission;
        }
        if (quizFilterStatus === 'completed') {
            const submission = allQuizSubmissions.find(s => String(s.quizId) === String(q.id));
            return !!submission;
        }
        return true;
    });
    
    quizContainer.innerHTML = quizzes.length === 0 
        ? `<div class="empty-state">No quizzes available.</div>` 
        : quizzes.map((quiz, idx) => {
            // Check if this quiz is already submitted by the current user
            const submission = allQuizSubmissions.find(sub => String(sub.quizId) === String(quiz.id));
            
            if (submission) {
                return `
                <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                    <img src="${quiz.image || quiz.img || '../images/quiz.jpeg'}" alt="Quiz Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/quiz.jpeg'">
                    <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                        <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                        <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || ''}</div>
                        <div style="margin-top: 8px;">
                            <button class="btn btn-outline-primary btn-sm" onclick="viewQuizResult('${submission.id}')">
                                View Result (Score: ${submission.score || 0}/${submission.maxScore || 100})
                            </button>
                        </div>
                    </div>
                </div>
                `;
            } else {
                return `
                <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                    <img src="${quiz.image || quiz.img || '../images/quiz.jpeg'}" alt="Quiz Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/quiz.jpeg'">
                    <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                        <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                        <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || ''}</div>
                        <div style="margin-top: 8px;">
                            <button class="btn btn-primary" onclick="openQuizExamModal('${quiz.id}')">Take Quiz</button>
                        </div>
                    </div>
                </div>
                `;
            }
        }).join('');

    // Calculate stats
    const userSubmissions = allQuizSubmissions.filter(s => String(s.studentId) === String(loggedInUser.id));
    const courseQuizIds = quizzes.map(q => q.id);
    const relevantSubmissions = userSubmissions.filter(sub => courseQuizIds.includes(sub.quizId));
    const totalScore = relevantSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
    const avgScore = relevantSubmissions.length > 0 ? Math.round(totalScore / relevantSubmissions.length) : 0;

    const completedCount = courseDetails.quiz.filter(q => userSubmissions.some(s => String(s.quizId) === String(q.id))).length;
    const pendingCount = courseDetails.quiz.length - completedCount;

    const totalQuizzesEl = document.getElementById('totalQuizzes');
    const completedQuizzesEl = document.getElementById('completedQuizzes');
    const pendingQuizzesEl = document.getElementById('pendingQuizzes');
    const avgScoreEl = document.getElementById('avgScore');
    
    if (totalQuizzesEl) totalQuizzesEl.textContent = courseDetails.quiz.length;
    if (completedQuizzesEl) completedQuizzesEl.textContent = completedCount;
    if (pendingQuizzesEl) pendingQuizzesEl.textContent = pendingCount;
    if (avgScoreEl) avgScoreEl.textContent = avgScore;
}

function renderSessionsSection() {
    const sessionContainer = document.querySelector('#sessions .session-container');
    if (!sessionContainer) return;
    
    const sessions = courseDetails.sessions || [];
    sessionContainer.innerHTML = sessions.length === 0 
        ? `<div class="empty-state">No video sessions available.</div>` 
        : sessions.map((session, idx) => `
            <div class="session-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                <img src="${session.image || '../images/videoSessions.jpeg'}" alt="Session Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/videoSessions.jpeg'">
                <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${session.title || 'Untitled Session'}</div>
                    <div style="font-size: 0.95rem; color: #555;">${session.description || ''}</div>
                </div>
                <button class="btn btn-primary" onclick="viewVideoSession('${session.video || session.videoPath || session.path || ''}')">View</button>
            </div>
        `).join('');
}

window.viewVideoSession = function(videoUrl) {
    if (!videoUrl) return alert('No video available.');
    // Create fullscreen modal
    let modal = document.getElementById('videoSessionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'videoSessionModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.95)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
            <div style="background:white; margin:40px auto; max-width:900px; border-radius:12px; padding:32px; position:relative; min-height:400px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; align-items:center;">
                <button style="position:absolute; top:16px; right:16px; font-size:1.5em; background:none; border:none; color:#1025a1; cursor:pointer;" onclick="document.getElementById('videoSessionModal').remove()">&times;</button>
                <video controls autoplay style="width:100%; max-width:800px; height:auto; border-radius:10px; background:#000;">
                    <source src="${videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
        const video = modal.querySelector('video source');
        if (video) video.src = videoUrl;
    }
};

function renderResourcesSection() {
    const resourceContainer = document.querySelector('#resources .resource-container');
    if (!resourceContainer) return;
    
    const resources = courseDetails.resources || [];
    resourceContainer.innerHTML = resources.length === 0 
        ? `<div class="empty-state">No resources available.</div>` 
        : resources.map((resource, idx) => `
            <div class="resource-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                <img src="${resource.image || '../images/materials.jpeg'}" alt="Resource Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/materials.jpeg'">
                <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${resource.title || 'Untitled Resource'}</div>
                    <div style="font-size: 0.95rem; color: #555;">${resource.description || ''}</div>
                </div>
                <button class="btn btn-primary" onclick="viewMaterialPDF('${resource.pdf || resource.pdfPath || resource.path || ''}')">View</button>
            </div>
        `).join('');
}

window.viewMaterialPDF = function(pdfUrl) {
    if (!pdfUrl) return alert('No PDF available.');
    // Create fullscreen modal
    let modal = document.getElementById('materialPDFModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'materialPDFModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.95)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
            <div style="background:white; margin:40px auto; max-width:900px; border-radius:12px; padding:32px; position:relative; min-height:400px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; align-items:center;">
                <button style="position:absolute; top:16px; right:16px; font-size:1.5em; background:none; border:none; color:#1025a1; cursor:pointer;" onclick="document.getElementById('materialPDFModal').remove()">&times;</button>
                <embed src="${pdfUrl}" type="application/pdf" style="width:100%; max-width:800px; height:80vh; border-radius:10px; background:#f8f9fa;" />
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
        const embed = modal.querySelector('embed');
        if (embed) embed.src = pdfUrl;
    }
};

async function renderAssignmentsSection() {
    const assignmentContainer = document.getElementById('assignmentContainer');
    if (!assignmentContainer) return;
    
    const courseTitle = currentCourse.title.trim().toLowerCase();
    let assignments = (assignmentsResource || []).filter(a => (a.course || '').trim().toLowerCase() === courseTitle);
    
    // Fetch assignment submissions using Node.js backend endpoint
    let submissions = [];
    try {
        const submissionsRes = await fetch(`/assignment-submissions/student/${loggedInUser.id}`, {
            headers: getAuthHeaders()
        });
        if (submissionsRes.ok) {
            const result = await submissionsRes.json();
            submissions = result.submissions || result || [];
            console.log('[ASSIGN] Loaded assignment submissions from backend:', submissions.length);
        } else {
            // Fallback to json-server endpoint
            const fallbackRes = await fetch(`${API_BASE_URL}/assignmentSubmissions`);
            if (fallbackRes.ok) {
                const allSubmissions = await fallbackRes.json();
                submissions = allSubmissions.filter(s => String(s.studentId) === String(loggedInUser.id));
                console.log('[ASSIGN] Loaded assignment submissions from fallback:', submissions.length);
            }
        }
    } catch (error) {
        console.error('[ASSIGN] Error loading assignment submissions:', error);
        submissions = [];
    }
    
    // Calculate stats
    const totalAssignments = assignments.length;
    const completedCount = assignments.filter(a => submissions.some(sub => String(sub.assignmentId) === String(a.id))).length;
    const pendingCount = totalAssignments - completedCount;
    const today = new Date();
    const overdueCount = assignments.filter(a => {
        if (submissions.some(sub => String(sub.assignmentId) === String(a.id))) return false;
        const due = new Date(a.date || a.dueDate);
        return a.date && due < today;
    }).length;
    
    const totalAssignmentsEl = document.getElementById('totalAssignments');
    const completedAssignmentsEl = document.getElementById('completedAssignments');
    const pendingAssignmentsEl = document.getElementById('pendingAssignments');
    const overdueAssignmentsEl = document.getElementById('overdueAssignments');
    
    if (totalAssignmentsEl) totalAssignmentsEl.textContent = totalAssignments;
    if (completedAssignmentsEl) completedAssignmentsEl.textContent = completedCount;
    if (pendingAssignmentsEl) pendingAssignmentsEl.textContent = pendingCount;
    if (overdueAssignmentsEl) overdueAssignmentsEl.textContent = overdueCount;
    
    assignmentContainer.innerHTML = totalAssignments === 0
        ? '<div class="empty-state">No assignments available.</div>'
        : assignments.map((assignment, idx) => {
            const submission = submissions.find(sub => String(sub.assignmentId) === String(assignment.id));
            if (submission) {
                return `
                <div class="assignment-card">
                    <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
                        <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
                        <span class="assignment-status" style="margin-left:auto; color: #28a745; font-weight: 600;">Completed</span>
                    </div>
                    <div class="assignment-course">
                        <i class="fas fa-book"></i> ${assignment.course}
                    </div>
                    <div class="assignment-details">
                        <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
                    </div>
                    <div class="assignment-actions">
                        <button class="btn btn-outline-primary" onclick="viewAssignmentSubmission('${submission.id}')">View Submission</button>
                    </div>
                </div>
                `;
            } else {
                // Check if overdue
                const due = new Date(assignment.date || assignment.dueDate);
                const isOverdue = assignment.date && due < today;
                return `
                <div class="assignment-card">
                    <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
                        <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
                        <span class="assignment-status" style="margin-left:auto; color: ${isOverdue ? '#dc3545' : '#ffc107'}; font-weight: 600;">${isOverdue ? 'Overdue' : 'Pending'}</span>
                    </div>
                    <div class="assignment-course">
                        <i class="fas fa-book"></i> ${assignment.course}
                    </div>
                    <div class="assignment-details">
                        <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
                    </div>
                    <div class="assignment-actions">
                        <button class="btn btn-primary" onclick="openAssignmentSubmissionModal('${assignment.id}')">Submit</button>
                    </div>
                </div>
                `;
            }
        }).join('');
}

function setupEventListeners() {
    // Quiz search
    const quizSearch = document.getElementById('quizSearch');
    if (quizSearch) {
        quizSearch.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const quizCards = document.querySelectorAll('.quiz-card');
            quizCards.forEach(card => {
                const title = card.querySelector('div[style*="font-size: 1.2rem"]')?.textContent.toLowerCase() || '';
                const desc = card.querySelector('div[style*="font-size: 0.95rem"]')?.textContent.toLowerCase() || '';
                card.style.display = (title.includes(searchTerm) || desc.includes(searchTerm)) ? 'flex' : 'none';
            });
        });
    }
    
    // Quiz filter
    const quizStatusFilter = document.getElementById('quizStatusFilter');
    if (quizStatusFilter) {
        quizStatusFilter.addEventListener('change', function(e) {
            quizFilterStatus = e.target.value;
            renderQuizSection();
        });
    }
}

function setupAssignmentEventListeners() {
    const search = document.getElementById('assignmentSearch');
    const filter = document.getElementById('assignmentStatusFilter');
    const refresh = document.getElementById('refreshAssignmentBtn');
    
    if (search) search.addEventListener('input', renderAssignmentsSection);
    if (filter) filter.addEventListener('change', renderAssignmentsSection);
    if (refresh) refresh.addEventListener('click', () => {
        if (document.getElementById('assignmentSearch')) document.getElementById('assignmentSearch').value = '';
        if (document.getElementById('assignmentStatusFilter')) document.getElementById('assignmentStatusFilter').value = '';
        renderAssignmentsSection();
    });
}

function setupProfileDropdown() {
    const nav = document.querySelector('nav');
    const profileBtn = nav?.querySelector('.btn1');
    if (loggedInUser && profileBtn) {
        const names = loggedInUser.name.split(' ');
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
        profileBtnNew.addEventListener('click', function() {
            dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
        });
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
                dropdownContent.style.display = 'none';
            }
        });
    }
}

function showError(message) {
    alert('Error: ' + message);
}

window.logoutUser = function() {
    localStorage.clear();
    sessionStorage.clear();
    alert('You have been logged out.');
    window.location.href = '/HTML/login.html';
};

// Add the openQuizExamModal function to window
window.openQuizExamModal = async function(quizId) {
    const quiz = (courseDetails.quiz || []).find(q => String(q.id) === String(quizId));
    if (!quiz) return;
    
    // Create modal
    let modal = document.getElementById('quizExamModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quizExamModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.9)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
            <div id="quizExamContent" style="background:white; margin:40px auto; max-width:700px; border-radius:12px; padding:32px; position:relative; min-height:400px; max-height:90vh; overflow-y:auto;">
                <h2 id="quizExamTitle"></h2>
                <div id="quizExamTimer" style="font-size:1.3em; font-weight:bold; margin-bottom:16px;"></div>
                <form id="quizExamForm"></form>
                <div style="margin-top:24px; text-align:right;">
                    <button type="button" class="btn btn-secondary" id="quizExamCancel">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="quizExamSubmit">Submit</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
    
    // Render quiz
    document.getElementById('quizExamTitle').textContent = quiz.title;
    let timeRemaining = (quiz.duration || 20) * 60;
    const timerEl = document.getElementById('quizExamTimer');
    
    function updateTimer() {
        const min = Math.floor(timeRemaining / 60);
        const sec = timeRemaining % 60;
        timerEl.textContent = `Time Remaining: ${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        if (timeRemaining <= 0) {
            submitQuizExam(true);
        }
    }
    
    updateTimer();
    let timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimer();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
    
    // Render questions
    const form = document.getElementById('quizExamForm');
    form.innerHTML = quiz.questions.map((q, i) => `
        <div class="question-block" style="margin-bottom:18px;">
            <p><b>Q${i+1}:</b> ${q.question}</p>
            ${(q.options || []).map((opt, j) => `
                <label style="display:block; margin-bottom:4px;">
                    <input type="radio" name="q${q.id || i}" value="${j}"> ${opt}
                </label>
            `).join('')}
        </div>
    `).join('');
    
    // Cancel button
    document.getElementById('quizExamCancel').onclick = function() {
        if (confirm('Are you sure you want to cancel? Your progress will be lost.')) {
            submitQuizExam(true);
        }
    };
    
    // Submit button
    const submitBtn = document.getElementById('quizExamSubmit');
    form.onsubmit = function(e) {
        e.preventDefault();
        submitQuizExam(false);
    };
    
    // Submission logic
    let submitted = false;
    async function submitQuizExam(isAuto) {
        if (submitted) return;
        submitted = true;
        clearInterval(timerInterval);
        
        // Collect answers
        const answers = quiz.questions.map((q, i) => {
            const selected = form.querySelector(`input[name='q${q.id || i}']:checked`);
            return selected ? parseInt(selected.value) : -1;
        });
        
        // Calculate score
        let correct = 0;
        answers.forEach((ans, i) => {
            const q = quiz.questions[i];
            if (q && ans === q.correctAnswer) correct++;
        });
        const score = Math.round((correct / quiz.questions.length) * (quiz.maxScore || 100));
        
        // Build submission
        const submission = {
            id: `SUB${Date.now()}`,
            quizId: quiz.id,
            course: quiz.course,
            title: quiz.title,
            studentId: loggedInUser.id,
            studentName: loggedInUser.name,
            studentEmail: loggedInUser.email,
            answers: answers,
            score: score,
            maxScore: quiz.maxScore || 100,
            submittedAt: new Date().toISOString(),
            status: 'graded',
            feedback: ''
        };
        
        // Save to Node.js backend
        try {
            const response = await fetch('/quiz-submissions/submit', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(submission)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[QUIZ] Quiz submitted successfully:', result);
            } else {
                const error = await response.json();
                console.error('[QUIZ] Failed to submit quiz:', error);
                alert('Failed to submit quiz. Please try again.');
            }
        } catch (err) {
            console.error('[QUIZ] Error submitting quiz:', err);
            alert('Failed to submit quiz. Please try again.');
        }
        
        // Close modal
        if (modal) {
            modal.style.display = 'none';
            setTimeout(() => { 
                if (modal && modal.parentNode) modal.parentNode.removeChild(modal); 
            }, 200);
        }
        
        alert(isAuto ? 'Time is up! Quiz submitted automatically.' : 'Quiz submitted successfully!');
        
        // Reload quiz section to show the result
        await renderQuizSection();
    }
};

// Add a global function to view quiz result
window.viewQuizResult = async function(submissionId) {
    try {
        // Try to fetch from backend first
        const submissionsRes = await fetch('/quiz-submissions/my-submissions', {
            headers: getAuthHeaders()
        });
        
        let submission = null;
        if (submissionsRes.ok) {
            const result = await submissionsRes.json();
            const submissions = result.submissions || result || [];
            submission = submissions.find(sub => String(sub.id) === String(submissionId));
        }
        
        // Fallback to json-server
        if (!submission) {
            const fallbackRes = await fetch(`${API_BASE_URL}/quizSubmissions`);
            if (fallbackRes.ok) {
                const allSubmissions = await fallbackRes.json();
                submission = allSubmissions.find(sub => String(sub.id) === String(submissionId));
            }
        }
        
        if (submission) {
            alert(`Quiz: ${submission.title || 'Quiz'}\nScore: ${submission.score || 0}/${submission.maxScore || 100}\nStatus: ${submission.status || 'graded'}`);
        } else {
            alert('Result not found.');
        }
    } catch (error) {
        console.error('[QUIZ] Error viewing quiz result:', error);
        alert('Failed to load quiz result.');
    }
};

window.openAssignmentSubmissionModal = async function(assignmentId) {
    // Find assignment
    let assignment = (assignmentsResource || []).find(a => String(a.id) === String(assignmentId));
    if (!assignment) return;
    
    // Create modal
    let modal = document.getElementById('assignmentSubmissionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'assignmentSubmissionModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.9)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
            <div id="assignmentSubmissionContent" style="background:white; margin:40px auto; max-width:700px; border-radius:12px; padding:32px; position:relative; min-height:200px; max-height:90vh; overflow-y:auto;">
                <h2 id="assignmentSubmissionTitle"></h2>
                <div id="assignmentSubmissionDesc" style="margin-bottom:16px;"></div>
                <div id="assignmentSubmissionPDF" style="margin-bottom:16px;"></div>
                <form id="assignmentSubmissionForm">
                    <div class="form-group">
                        <label for="assignmentFile">Upload Assignment File (PDF, DOC, DOCX, ZIP):</label>
                        <input id="assignmentFile" name="assignmentFile" type="file" accept=".pdf,.doc,.docx,.zip" required />
                        <small>Max file size: 10MB</small>
                    </div>
                    <div style="margin-top:24px; text-align:right;">
                        <button type="button" class="btn btn-secondary" id="assignmentSubmissionCancel">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="assignmentSubmissionSubmit">Submit</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
    
    document.getElementById('assignmentSubmissionTitle').textContent = assignment.assignment || assignment.title || 'Assignment';
    document.getElementById('assignmentSubmissionDesc').textContent = assignment.description || assignment.instructions || 'No description available.';
    
    // PDF download link if available
    let pdfUrl = assignment.pdf || assignment.pdfPath || assignment.file || '';
    const pdfContainer = document.getElementById('assignmentSubmissionPDF');
    if (pdfContainer) {
        pdfContainer.innerHTML = pdfUrl ? `<a href="${pdfUrl}" target="_blank" class="btn btn-outline-primary">Download Assignment PDF</a>` : '';
    }
    
    // Cancel button
    document.getElementById('assignmentSubmissionCancel').onclick = function() {
        modal.style.display = 'none';
        setTimeout(() => { 
            if (modal && modal.parentNode) modal.parentNode.removeChild(modal); 
        }, 200);
    };
    
    // Submit button
    document.getElementById('assignmentSubmissionForm').onsubmit = async function(e) {
        e.preventDefault();
        const fileInput = document.getElementById('assignmentFile');
        if (!fileInput.files[0]) return alert('Please select a file to upload.');
        
        const file = fileInput.files[0];
        if (file.size > 10 * 1024 * 1024) {
            return alert('File size exceeds 10MB limit.');
        }
        
        // Build submission object
        const submission = {
            id: `ASUB${Date.now()}`,
            assignmentId: assignment.id,
            course: assignment.course,
            title: assignment.assignment || assignment.title,
            studentId: loggedInUser.id,
            studentName: loggedInUser.name,
            studentEmail: loggedInUser.email,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            submittedAt: new Date().toISOString(),
            status: 'submitted',
            feedback: ''
        };
        
        // Save to Node.js backend
        try {
            const response = await fetch('/assignment-submissions/submit', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(submission)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[ASSIGN] Assignment submitted successfully:', result);
                alert('Assignment submitted successfully!');
            } else {
                const error = await response.json();
                console.error('[ASSIGN] Failed to submit assignment:', error);
                alert(error.error || 'Failed to submit assignment. Please try again.');
                return;
            }
        } catch (err) {
            console.error('[ASSIGN] Error submitting assignment:', err);
            alert('Failed to submit assignment. Please try again.');
            return;
        }
        
        // Close modal
        modal.style.display = 'none';
        setTimeout(() => { 
            if (modal && modal.parentNode) modal.parentNode.removeChild(modal); 
        }, 200);
        
        // Reload assignments section to show the submission
        await renderAssignmentsSection();
    };
};

window.viewAssignmentSubmission = async function(submissionId) {
    try {
        // Try to fetch from backend first
        const submissionsRes = await fetch(`/assignment-submissions/student/${loggedInUser.id}`, {
            headers: getAuthHeaders()
        });
        
        let submission = null;
        if (submissionsRes.ok) {
            const result = await submissionsRes.json();
            const submissions = result.submissions || result || [];
            submission = submissions.find(sub => String(sub.id) === String(submissionId));
        }
        
        // Fallback to json-server
        if (!submission) {
            const fallbackRes = await fetch(`${API_BASE_URL}/assignmentSubmissions`);
            if (fallbackRes.ok) {
                const allSubmissions = await fallbackRes.json();
                submission = allSubmissions.find(sub => String(sub.id) === String(submissionId));
            }
        }
        
        if (submission) {
            let message = `Assignment: ${submission.title || 'Assignment'}\nStatus: ${submission.status || 'submitted'}\nSubmitted File: ${submission.fileName || 'No file uploaded'}`;
            if (submission.score !== undefined) {
                message += `\nScore: ${submission.score}`;
            }
            if (submission.feedback) {
                message += `\nFeedback: ${submission.feedback}`;
            }
            alert(message);
        } else {
            alert('Submission not found.');
        }
    } catch (error) {
        console.error('[ASSIGN] Error viewing assignment submission:', error);
        alert('Failed to load submission details.');
    }
};
