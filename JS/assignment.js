// Assignment Management System - 100% Node.js Backend Version
class AssignmentManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.currentRole = this.currentUser.role;
        this.assignments = [];
        this.submissions = [];
        this.courses = [];
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.checkURLParams();
        this.updateUI();
    }

    getCurrentUser() {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
        if (loggedInUser) {
            return {
                id: loggedInUser.id || 'STD1000',
                name: loggedInUser.name || 'John Doe',
                role: loggedInUser.type || 'student',
                email: loggedInUser.email || 'john.doe@example.com'
            };
        }
        
        return {
            id: 'STD1000',
            name: 'John Doe',
            role: 'student',
            email: 'john.doe@example.com'
        };
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const assignmentId = urlParams.get('assignmentId');
        this.updateRoleDisplay();
        
        if (assignmentId) {
            const assignmentData = JSON.parse(localStorage.getItem('currentAssignment'));
            if (assignmentData) {
                this.currentAssignment = assignmentData;
            }
        }
    }

    updateRoleDisplay() {
        const roleBadge = document.getElementById('roleBadge');
        if (roleBadge) {
            if (this.currentRole === 'teacher') {
                roleBadge.innerHTML = '<i class="fas fa-chalkboard-teacher"></i> Teacher View';
                roleBadge.className = 'role-badge teacher';
            } else {
                roleBadge.innerHTML = '<i class="fas fa-user-graduate"></i> Student View';
                roleBadge.className = 'role-badge student';
            }
        }
    }

    async loadData() {
        try {
            // Load courses based on role
            if (this.currentRole === 'teacher') {
                this.courses = await this.getTeacherCourses();
            } else {
                this.courses = await this.getStudentEnrolledCourses();
            }
            
            // Load assignments from backend
            await this.loadAssignments();
            
            // Load submissions from backend
            await this.loadSubmissions();
            
            this.updateUI();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load assignment data');
        }
    }

    async loadAssignments() {
        try {
            // Call Node.js backend API for assignments
            const response = await fetch('/assignments/course', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify({
                        id: this.currentUser.id,
                        type: this.currentRole,
                        email: this.currentUser.email
                    })
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.assignments = result.assignments;
            } else {
                throw new Error('Backend fetch failed');
            }
        } catch (error) {
            console.error('Error loading assignments from backend:', error);
            
            // Fallback to json-server
            try {
                const fallbackResponse = await fetch('/api/assignments');
                if (fallbackResponse.ok) {
                    const allAssignments = await fallbackResponse.json();
                    // Filter by courses
                    this.assignments = allAssignments.filter(a => 
                        this.courses.some(courseName => a.course && a.course.trim() === courseName.trim())
                    );
                }
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
                this.assignments = [];
            }
        }
    }

    async loadSubmissions() {
        try {
            let endpoint = '';
            
            if (this.currentRole === 'student') {
                // Students get their own submissions
                endpoint = `/assignment-submissions/student/${this.currentUser.id}`;
            } else {
                // Teachers get all submissions for their courses
                endpoint = '/assignment-submissions/all';
            }

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify({
                        id: this.currentUser.id,
                        type: this.currentRole,
                        email: this.currentUser.email
                    })
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.submissions = result.submissions;
            } else {
                throw new Error('Backend fetch failed');
            }
        } catch (error) {
            console.error('Error loading submissions from backend:', error);
            
            // Fallback to json-server
            try {
                const fallbackResponse = await fetch('/api/assignmentSubmissions');
                if (fallbackResponse.ok) {
                    const allSubmissions = await fallbackResponse.json();
                    
                    if (this.currentRole === 'student') {
                        this.submissions = allSubmissions.filter(s => s.studentId === this.currentUser.id);
                    } else {
                        // Filter by teacher's courses
                        this.submissions = allSubmissions.filter(s => 
                            this.courses.some(course => s.course === course)
                        );
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
                this.submissions = [];
            }
        }
    }

    async getTeacherCourses() {
        try {
            // Call Node.js backend API for teacher courses
            const response = await fetch('/teacher/courses', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify({
                        id: this.currentUser.id,
                        type: 'teacher',
                        email: this.currentUser.email
                    })
                }
            });

            const result = await response.json();
            
            if (result.success && result.courses) {
                return result.courses.map(c => c.name);
            }
            
            throw new Error('Backend fetch failed');
        } catch (error) {
            console.error('Error getting teacher courses:', error);
            
            // Fallback to json-server
            try {
                const teachersResponse = await fetch('/api/teachers');
                if (teachersResponse.ok) {
                    const teachers = await teachersResponse.json();
                    const currentTeacher = teachers.find(teacher => 
                        teacher.email === this.currentUser.email || 
                        teacher.id === this.currentUser.id
                    );
                    
                    if (currentTeacher && currentTeacher.courses) {
                        return currentTeacher.courses;
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
            }
            
            return [];
        }
    }

    async getStudentEnrolledCourses() {
        try {
            // Call Node.js backend API for student enrollments
            const response = await fetch(`/enrollments/student/${this.currentUser.id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify({
                        id: this.currentUser.id,
                        type: 'student',
                        email: this.currentUser.email
                    })
                }
            });

            const result = await response.json();
            
            if (result.success && result.enrollments) {
                return result.enrollments.map(e => e.courseTitle);
            }
            
            throw new Error('Backend fetch failed');
        } catch (error) {
            console.error('Error getting student courses:', error);
            
            // Fallback to json-server
            try {
                const enrollmentsResponse = await fetch('/api/enrollments');
                if (enrollmentsResponse.ok) {
                    const enrollments = await enrollmentsResponse.json();
                    const studentEnrollments = enrollments.filter(enrollment => 
                        enrollment.studentId === this.currentUser.id
                    );
                    
                    if (studentEnrollments.length > 0) {
                        return studentEnrollments.map(e => e.courseTitle);
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
            }
            
            return [];
        }
    }

    setupEventListeners() {
        this.setupProfileDropdown();
        
        const courseFilter = document.getElementById('courseFilter');
        const statusFilter = document.getElementById('statusFilter');
        const teacherCourseFilter = document.getElementById('teacherCourseFilter');
        const teacherStatusFilter = document.getElementById('teacherStatusFilter');
        const refreshBtn = document.getElementById('refreshBtn');
        
        if (courseFilter) courseFilter.addEventListener('change', () => this.filterAssignments());
        if (statusFilter) statusFilter.addEventListener('change', () => this.filterAssignments());
        if (teacherCourseFilter) teacherCourseFilter.addEventListener('change', () => this.filterSubmissions());
        if (teacherStatusFilter) teacherStatusFilter.addEventListener('change', () => this.filterSubmissions());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadData());
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    setupProfileDropdown() {
        const profileBtn = document.getElementById('profileBtn');
        const dropdownContent = document.querySelector('.dropdown-content');
        
        if (profileBtn && dropdownContent) {
            profileBtn.addEventListener('click', () => {
                dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
            });
            
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.profile-dropdown')) {
                    dropdownContent.style.display = 'none';
                }
            });
        }
    }

    logoutUser() {
        localStorage.removeItem('loggedInUser');
        window.location.href = '/HTML/login.html';
    }

    updateUI() {
        if (this.currentRole === 'teacher') {
            this.showTeacherView();
        } else {
            this.showStudentView();
        }
    }

    showStudentView() {
        const studentSection = document.getElementById('studentSection');
        const teacherSection = document.getElementById('teacherSection');
        
        if (studentSection) studentSection.style.display = 'block';
        if (teacherSection) teacherSection.style.display = 'none';
        
        this.renderStudentAssignments();
    }

    showTeacherView() {
        const studentSection = document.getElementById('studentSection');
        const teacherSection = document.getElementById('teacherSection');
        
        if (studentSection) studentSection.style.display = 'none';
        if (teacherSection) teacherSection.style.display = 'block';
        
        this.populateTeacherFilters();
        this.renderTeacherSubmissions();
    }

    renderStudentAssignments() {
        const container = document.getElementById('assignmentsContainer');
        if (!container) return;
        
        const courseFilter = document.getElementById('courseFilter')?.value || 'all';
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        
        let filtered = this.assignments;
        
        if (courseFilter !== 'all') {
            filtered = filtered.filter(a => a.course === courseFilter);
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(a => a.status === statusFilter);
        }
        
        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-data">No assignments found.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        filtered.forEach(assignment => {
            const card = this.createAssignmentCard(assignment);
            container.appendChild(card);
        });
        
        this.populateStudentFilters();
    }

    createAssignmentCard(assignment) {
        const card = document.createElement('div');
        card.className = 'assignment-card';
        
        const isCompleted = assignment.status === 'completed';
        const isPending = assignment.status === 'pending';
        
        card.innerHTML = `
            <div class="assignment-header">
                <h3>${assignment.title || assignment.assignment}</h3>
                <span class="status-badge ${assignment.status || 'pending'}">${assignment.status || 'Pending'}</span>
            </div>
            <p class="assignment-course"><i class="fas fa-book"></i> ${assignment.course}</p>
            <p class="assignment-description">${assignment.description || assignment.instructions || 'No description available'}</p>
            <div class="assignment-actions">
                ${isCompleted 
                    ? `<button class="btn-secondary" onclick="assignmentManager.viewSubmission(${assignment.submissionId})">
                        <i class="fas fa-eye"></i> View Submission
                    </button>`
                    : `<button class="btn-primary" onclick="assignmentManager.submitAssignment(${assignment.id})">
                        <i class="fas fa-upload"></i> Submit Assignment
                    </button>`
                }
            </div>
        `;
        
        return card;
    }

    populateStudentFilters() {
        const courseFilter = document.getElementById('courseFilter');
        if (courseFilter && this.courses.length > 0) {
            courseFilter.innerHTML = '<option value="all">All Courses</option>';
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                courseFilter.appendChild(option);
            });
        }
    }

    renderTeacherSubmissions() {
        const container = document.getElementById('submissionsContainer');
        if (!container) return;
        
        const courseFilter = document.getElementById('teacherCourseFilter')?.value || 'all';
        const statusFilter = document.getElementById('teacherStatusFilter')?.value || 'all';
        
        let filtered = this.submissions;
        
        if (courseFilter !== 'all') {
            filtered = filtered.filter(s => s.course === courseFilter);
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(s => s.status === statusFilter);
        }
        
        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-data">No submissions found.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        filtered.forEach(submission => {
            const card = this.createSubmissionCard(submission);
            container.appendChild(card);
        });
    }

    createSubmissionCard(submission) {
        const card = document.createElement('div');
        card.className = 'submission-card';
        
        card.innerHTML = `
            <div class="submission-header">
                <h4>${submission.studentName}</h4>
                <span class="status-badge ${submission.status}">${submission.status}</span>
            </div>
            <p><strong>Assignment:</strong> ${submission.title}</p>
            <p><strong>Course:</strong> ${submission.course}</p>
            <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
            <p><strong>File:</strong> ${submission.fileName}</p>
            ${submission.score !== undefined ? `<p><strong>Score:</strong> ${submission.score}/100</p>` : ''}
            <div class="submission-actions">
                <button class="btn-secondary" onclick="assignmentManager.downloadFile('${submission.fileName}', '${submission.studentName}', '${submission.title}')">
                    <i class="fas fa-download"></i> Download
                </button>
                ${submission.status !== 'graded' ? `
                    <button class="btn-primary" onclick="assignmentManager.openGradeModal(${submission.id})">
                        <i class="fas fa-check"></i> Grade
                    </button>
                ` : ''}
            </div>
        `;
        
        return card;
    }

    populateTeacherFilters() {
        const courseFilter = document.getElementById('teacherCourseFilter');
        if (courseFilter && this.courses.length > 0) {
            courseFilter.innerHTML = '<option value="all">All Courses</option>';
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                courseFilter.appendChild(option);
            });
        }
    }

    async submitAssignment(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) {
            this.showError('Assignment not found');
            return;
        }
        
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,.txt,.zip';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const submission = {
                assignmentId: assignment.id,
                course: assignment.course,
                title: assignment.title || assignment.assignment,
                studentId: this.currentUser.id,
                studentName: this.currentUser.name,
                studentEmail: this.currentUser.email,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                submittedAt: new Date().toISOString(),
                status: 'submitted'
            };
            
            try {
                // Submit to Node.js backend
                const response = await fetch('/assignment-submissions/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user': JSON.stringify({
                            id: this.currentUser.id,
                            type: this.currentRole,
                            email: this.currentUser.email
                        })
                    },
                    body: JSON.stringify(submission)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showSuccess('Assignment submitted successfully!');
                    await this.loadData();
                } else {
                    throw new Error(result.error || 'Failed to submit assignment');
                }
            } catch (error) {
                console.error('Error submitting assignment:', error);
                this.showError('Failed to submit assignment. Please try again.');
            }
        };
        
        input.click();
    }

    viewSubmission(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        if (submission) {
            alert(
                `Assignment: ${submission.title}\n` +
                `Status: ${submission.status}\n` +
                `File: ${submission.fileName}\n` +
                `Submitted: ${this.formatDate(submission.submittedAt)}\n` +
                ${submission.score !== undefined ? `Score: ${submission.score}/100\n` : ''}` +
                ${submission.feedback ? `Feedback: ${submission.feedback}` : ''}
            `);
        }
    }

    openGradeModal(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        if (!submission) return;
        
        const modal = document.getElementById('gradeModal');
        if (!modal) {
            // Create modal if it doesn't exist
            this.createGradeModal();
            return this.openGradeModal(submissionId);
        }
        
        const form = document.getElementById('gradeForm');
        form.dataset.submissionId = submissionId;
        
        document.getElementById('gradeStudentName').textContent = submission.studentName;
        document.getElementById('gradeAssignmentTitle').textContent = submission.title;
        document.getElementById('gradeScore').value = submission.score || '';
        document.getElementById('gradeFeedback').value = submission.feedback || '';
        
        modal.style.display = 'block';
    }

    createGradeModal() {
        const modal = document.createElement('div');
        modal.id = 'gradeModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Grade Assignment</h2>
                    <span class="close" onclick="assignmentManager.closeModal(document.getElementById('gradeModal'))">&times;</span>
                </div>
                <div class="modal-body">
                    <p><strong>Student:</strong> <span id="gradeStudentName"></span></p>
                    <p><strong>Assignment:</strong> <span id="gradeAssignmentTitle"></span></p>
                    <form id="gradeForm">
                        <div class="form-group">
                            <label for="gradeScore">Score (0-100):</label>
                            <input type="number" id="gradeScore" min="0" max="100" required>
                        </div>
                        <div class="form-group">
                            <label for="gradeFeedback">Feedback:</label>
                            <textarea id="gradeFeedback" rows="4"></textarea>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="assignmentManager.closeModal(document.getElementById('gradeModal'))">Cancel</button>
                            <button type="button" class="btn-primary" onclick="assignmentManager.gradeSubmission()">Submit Grade</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async gradeSubmission() {
        const form = document.getElementById('gradeForm');
        const submissionId = form.dataset.submissionId;
        const score = parseInt(document.getElementById('gradeScore').value);
        const feedback = document.getElementById('gradeFeedback').value;
        
        try {
            // Submit grade to Node.js backend
            const response = await fetch(`/assignment-submissions/grade/${submissionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify({
                        id: this.currentUser.id,
                        type: this.currentRole,
                        email: this.currentUser.email
                    })
                },
                body: JSON.stringify({ score, feedback, status: 'graded' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('Assignment graded successfully!');
                this.closeModal(document.getElementById('gradeModal'));
                await this.loadData();
            } else {
                throw new Error(result.error || 'Failed to grade assignment');
            }
        } catch (error) {
            console.error('Error grading assignment:', error);
            this.showError('Failed to grade assignment. Please try again.');
        }
    }

    downloadFile(fileName, studentName, assignmentTitle) {
        // In a real application, this would download the actual file from the server
        // For now, we'll simulate a download with mock data
        const content = this.generateMockFileContent(fileName, studentName, assignmentTitle);
        const blob = new Blob([content], { type: this.getFileType(fileName) });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccess(`Downloaded: ${fileName}`);
        this.logDownloadActivity(fileName, studentName, assignmentTitle);
    }

    generateMockFileContent(fileName, studentName, assignmentTitle) {
        return `Mock Assignment Submission

Student: ${studentName}
Assignment: ${assignmentTitle}
File: ${fileName}
Date: ${new Date().toLocaleDateString()}

This is a mock file content for demonstration purposes.
In a real application, this would contain the actual assignment submission.`;
    }

    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'zip': 'application/zip'
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }

    logDownloadActivity(fileName, studentName, assignmentTitle) {
        const downloadLog = {
            timestamp: new Date().toISOString(),
            teacher: this.currentUser.name,
            teacherId: this.currentUser.id,
            student: studentName,
            assignment: assignmentTitle,
            file: fileName,
            action: 'download'
        };

        const existingLogs = JSON.parse(localStorage.getItem('downloadLogs') || '[]');
        existingLogs.push(downloadLog);
        localStorage.setItem('downloadLogs', JSON.stringify(existingLogs));

        console.log('Download logged:', downloadLog);
    }

    closeModal(modal) {
        if (modal) modal.style.display = 'none';
    }

    filterAssignments() {
        this.renderStudentAssignments();
    }

    filterSubmissions() {
        this.renderTeacherSubmissions();
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize the assignment manager when the page loads
let assignmentManager;
document.addEventListener('DOMContentLoaded', () => {
    assignmentManager = new AssignmentManager();
});

// Make logoutUser globally accessible
window.logoutUser = function() {
    if (assignmentManager) {
        assignmentManager.logoutUser();
    }
};

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);