// Quiz Management System - Node.js Backend Version
class QuizManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.currentRole = this.currentUser.role;
        this.quizzes = [];
        this.submissions = [];
        this.courses = [];
        this.currentQuiz = null;
        this.quizTimer = null;
        this.timeRemaining = 0;
        this.currentSubmission = null;
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
        const quizId = urlParams.get('quizId');
        this.updateRoleDisplay();
        if (quizId) {
            const quizData = JSON.parse(localStorage.getItem('currentQuiz'));
            if (quizData) {
                this.currentQuiz = quizData;
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

            // Load quizzes and submissions from Node.js backend
            await this.loadQuizzesFromBackend();
            await this.loadSubmissionsFromBackend();

            // Update UI
            this.updateUI();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load quiz data');
        }
    }

    async loadQuizzesFromBackend() {
        try {
            // Call Node.js backend API
            const response = await fetch('/quizzes/my-courses', {
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
                this.quizzes = result.quizzes || [];
            } else {
                throw new Error(result.error || 'Failed to load quizzes');
            }
        } catch (error) {
            console.error('Error loading quizzes from backend:', error);
            
            // Fallback to json-server
            try {
                const fallbackResponse = await fetch('/api/quizzes');
                if (fallbackResponse.ok) {
                    const allQuizzes = await fallbackResponse.json();
                    // Filter by courses
                    this.quizzes = allQuizzes.filter(q => 
                        this.courses.some(courseName => q.course && q.course.trim() === courseName.trim())
                    );
                }
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
            }
        }
    }

    async loadSubmissionsFromBackend() {
        try {
            // Call Node.js backend API
            const response = await fetch('/quiz-submissions/my-submissions', {
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
                this.submissions = result.submissions || [];
            } else {
                throw new Error(result.error || 'Failed to load submissions');
            }
        } catch (error) {
            console.error('Error loading submissions from backend:', error);
            
            // Fallback to json-server
            try {
                const fallbackResponse = await fetch('/api/quizSubmissions');
                if (fallbackResponse.ok) {
                    const allSubmissions = await fallbackResponse.json();
                    if (this.currentRole === 'student') {
                        this.submissions = allSubmissions.filter(s => s.studentId === this.currentUser.id);
                    } else {
                        this.submissions = allSubmissions;
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
            }
        }
    }

    async getTeacherCourses() {
        try {
            // Call Node.js backend endpoint for teacher courses
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

            throw new Error('Failed to load teacher courses');
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
            // Call Node.js backend endpoint for student enrollments
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

            throw new Error('Failed to load enrollments');
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
        document.getElementById('courseFilter')?.addEventListener('change', () => this.filterQuizzes());
        document.getElementById('statusFilter')?.addEventListener('change', () => this.filterQuizzes());
        document.getElementById('teacherCourseFilter')?.addEventListener('change', () => this.updateTeacherView());
        document.getElementById('teacherStatusFilter')?.addEventListener('change', () => this.filterSubmissions());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadData());
        document.getElementById('createQuizBtn')?.addEventListener('click', () => this.showCreateQuizModal());
        document.getElementById('closeTakeQuizModal')?.addEventListener('click', () => this.closeModal('takeQuizModal'));
        document.getElementById('closeCreateModal')?.addEventListener('click', () => this.closeModal('createQuizModal'));
        document.getElementById('closeGradeModal')?.addEventListener('click', () => this.closeModal('gradeModal'));
        document.getElementById('closeResultsModal')?.addEventListener('click', () => this.closeModal('quizResultsModal'));
        document.getElementById('closeDetailsModal')?.addEventListener('click', () => this.closeModal('quizDetailsModal'));
        document.getElementById('quizForm')?.addEventListener('submit', (e) => this.submitQuiz(e));
        document.getElementById('createQuizForm')?.addEventListener('submit', (e) => this.createQuiz(e));
        document.getElementById('gradeForm')?.addEventListener('submit', (e) => this.gradeSubmission(e));
        document.getElementById('cancelQuiz')?.addEventListener('click', () => this.closeModal('takeQuizModal'));
        document.getElementById('cancelCreate')?.addEventListener('click', () => this.closeModal('createQuizModal'));
        document.getElementById('cancelGrade')?.addEventListener('click', () => this.closeModal('gradeModal'));
        document.getElementById('addQuestionBtn')?.addEventListener('click', () => this.addQuestion());
        document.getElementById('quizSearch')?.addEventListener('input', (e) => this.searchQuizzes(e.target.value));
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
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
            this.updateTeacherView();
        } else {
            this.updateStudentView();
        }
    }

    updateStudentView() {
        const quizzesGrid = document.getElementById('quizzesGrid');
        const submissionsGrid = document.getElementById('submissionsGrid');
        
        if (!quizzesGrid) return;
        
        quizzesGrid.innerHTML = '';
        
        if (this.quizzes.length === 0) {
            quizzesGrid.innerHTML = '<p class="no-data">No quizzes available for your enrolled courses.</p>';
            return;
        }
        
        this.quizzes.forEach(quiz => {
            const submission = this.submissions.find(sub => sub.quizId === quiz.id);
            const card = this.createQuizCard(quiz, submission);
            quizzesGrid.appendChild(card);
        });
        
        if (submissionsGrid) {
            this.updateSubmissionsView(submissionsGrid);
        }
    }

    updateSubmissionsView(container) {
        container.innerHTML = '';
        
        const userSubmissions = this.submissions.filter(sub => 
            sub.studentId === this.currentUser.id
        );
        
        if (userSubmissions.length === 0) {
            container.innerHTML = '<p class="no-data">No submissions yet.</p>';
            return;
        }
        
        userSubmissions.forEach(submission => {
            const quiz = this.quizzes.find(q => q.id === submission.quizId);
            if (quiz) {
                const card = this.createSubmissionCard(submission, quiz);
                container.appendChild(card);
            }
        });
    }

    createQuizCard(quiz, submission) {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        
        const status = this.getQuizStatus(quiz, submission);
        const statusClass = status.toLowerCase().replace(' ', '-');
        
        card.innerHTML = `
            <div class="quiz-header">
                <h3 class="quiz-title">${quiz.title}</h3>
                <span class="quiz-status ${statusClass}">${status}</span>
            </div>
            <p class="quiz-course"><i class="fas fa-book"></i> ${quiz.course}</p>
            <p class="quiz-info"><i class="fas fa-clock"></i> Duration: ${quiz.duration} minutes</p>
            <p class="quiz-info"><i class="fas fa-question-circle"></i> Questions: ${quiz.questions?.length || 0}</p>
            <p class="quiz-info"><i class="fas fa-calendar"></i> Due: ${this.formatDate(quiz.dueDate)}</p>
            ${submission ? `<p class="quiz-score">Score: ${submission.score}/${quiz.maxScore}</p>` : ''}
            <div class="quiz-actions">
                ${this.getQuizActions(quiz, submission)}
            </div>
        `;
        
        return card;
    }

    getQuizStatus(quiz, submission) {
        if (submission) {
            if (submission.status === 'graded') return 'Graded';
            return 'Submitted';
        }
        
        const dueDate = new Date(quiz.dueDate);
        const now = new Date();
        
        if (now > dueDate) return 'Overdue';
        return 'Available';
    }

    getQuizActions(quiz, submission) {
        if (submission) {
            return `<button class="btn-secondary" onclick="quizManager.viewResults('${submission.id}')">
                <i class="fas fa-chart-bar"></i> View Results
            </button>`;
        }
        
        const dueDate = new Date(quiz.dueDate);
        const now = new Date();
        
        if (now > dueDate) {
            return `<button class="btn-secondary" disabled>Quiz Expired</button>`;
        }
        
        return `<button class="btn-primary" onclick="quizManager.takeQuiz('${quiz.id}')">
            <i class="fas fa-pen"></i> Take Quiz
        </button>`;
    }

    createSubmissionCard(submission, quiz) {
        const card = document.createElement('div');
        card.className = 'submission-card';
        
        card.innerHTML = `
            <h4>${quiz.title}</h4>
            <p><strong>Course:</strong> ${quiz.course}</p>
            <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
            <p><strong>Status:</strong> <span class="status-badge ${submission.status}">${submission.status}</span></p>
            ${submission.score !== undefined ? `<p><strong>Score:</strong> ${submission.score}/${quiz.maxScore}</p>` : ''}
            <button class="btn-secondary" onclick="quizManager.viewResults('${submission.id}')">View Details</button>
        `;
        
        return card;
    }

    updateTeacherView() {
        const quizzesGrid = document.getElementById('teacherQuizzesGrid');
        const submissionsGrid = document.getElementById('teacherSubmissionsGrid');
        
        if (quizzesGrid) {
            quizzesGrid.innerHTML = '';
            
            if (this.quizzes.length === 0) {
                quizzesGrid.innerHTML = '<p class="no-data">No quizzes created yet.</p>';
            } else {
                this.quizzes.forEach(quiz => {
                    const card = this.createTeacherQuizCard(quiz);
                    quizzesGrid.appendChild(card);
                });
            }
        }
        
        if (submissionsGrid) {
            this.filterSubmissions();
        }
    }

    createTeacherQuizCard(quiz) {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        
        const submissionCount = this.submissions.filter(sub => sub.quizId === quiz.id).length;
        
        card.innerHTML = `
            <div class="quiz-header">
                <h3 class="quiz-title">${quiz.title}</h3>
                <span class="quiz-badge">${submissionCount} Submissions</span>
            </div>
            <p class="quiz-course"><i class="fas fa-book"></i> ${quiz.course}</p>
            <p class="quiz-info"><i class="fas fa-clock"></i> Duration: ${quiz.duration} minutes</p>
            <p class="quiz-info"><i class="fas fa-question-circle"></i> Questions: ${quiz.questions?.length || 0}</p>
            <p class="quiz-info"><i class="fas fa-calendar"></i> Due: ${this.formatDate(quiz.dueDate)}</p>
            <div class="quiz-actions">
                <button class="btn-secondary" onclick="quizManager.viewQuizDetails('${quiz.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn-danger" onclick="quizManager.deleteQuiz('${quiz.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        return card;
    }

    filterSubmissions() {
        const submissionsGrid = document.getElementById('teacherSubmissionsGrid');
        if (!submissionsGrid) return;
        
        const statusFilter = document.getElementById('teacherStatusFilter')?.value || 'all';
        
        submissionsGrid.innerHTML = '';
        
        let filteredSubmissions = this.submissions;
        
        if (statusFilter !== 'all') {
            filteredSubmissions = filteredSubmissions.filter(sub => sub.status === statusFilter);
        }
        
        if (filteredSubmissions.length === 0) {
            submissionsGrid.innerHTML = '<p class="no-data">No submissions found.</p>';
            return;
        }
        
        filteredSubmissions.forEach(submission => {
            const quiz = this.quizzes.find(q => q.id === submission.quizId);
            if (quiz) {
                const card = this.createTeacherSubmissionCard(submission, quiz);
                submissionsGrid.appendChild(card);
            }
        });
    }

    createTeacherSubmissionCard(submission, quiz) {
        const card = document.createElement('div');
        card.className = 'submission-card';
        
        card.innerHTML = `
            <h4>${submission.studentName}</h4>
            <p><strong>Quiz:</strong> ${quiz.title}</p>
            <p><strong>Course:</strong> ${quiz.course}</p>
            <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
            <p><strong>Status:</strong> <span class="status-badge ${submission.status}">${submission.status}</span></p>
            ${submission.score !== undefined ? `<p><strong>Score:</strong> ${submission.score}/${quiz.maxScore}</p>` : ''}
            <div class="submission-actions">
                <button class="btn-secondary" onclick="quizManager.viewSubmission('${submission.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${submission.status !== 'graded' ? `
                    <button class="btn-primary" onclick="quizManager.gradeSubmission('${submission.id}')">
                        <i class="fas fa-check"></i> Grade
                    </button>
                ` : ''}
            </div>
        `;
        
        return card;
    }

    filterQuizzes() {
        // Implement filtering logic
        this.updateUI();
    }

    showCreateQuizModal() {
        document.getElementById('createQuizModal').style.display = 'block';
        document.getElementById('questionsContainer').innerHTML = '';
        this.addQuestion();
    }

    addQuestion() {
        const container = document.getElementById('questionsContainer');
        const questionIndex = container.children.length;
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-block';
        questionDiv.innerHTML = `
            <h4>Question ${questionIndex + 1}</h4>
            <input type="text" class="form-input" placeholder="Enter question" required>
            <div class="options-container">
                <input type="text" class="form-input option-input" placeholder="Option 1" required>
                <input type="text" class="form-input option-input" placeholder="Option 2" required>
                <input type="text" class="form-input option-input" placeholder="Option 3" required>
                <input type="text" class="form-input option-input" placeholder="Option 4" required>
            </div>
            <select class="form-input" required>
                <option value="">Select Correct Answer</option>
                <option value="0">Option 1</option>
                <option value="1">Option 2</option>
                <option value="2">Option 3</option>
                <option value="3">Option 4</option>
            </select>
            ${questionIndex > 0 ? '<button type="button" class="btn-danger" onclick="this.parentElement.remove()">Remove</button>' : ''}
        `;
        
        container.appendChild(questionDiv);
    }

    async createQuiz(e) {
        e.preventDefault();
        
        const form = e.target;
        const questionsContainer = document.getElementById('questionsContainer');
        const questionBlocks = questionsContainer.querySelectorAll('.question-block');
        
        const questions = Array.from(questionBlocks).map(block => {
            const inputs = block.querySelectorAll('input[type="text"]');
            const question = inputs[0].value;
            const options = Array.from(inputs).slice(1).map(input => input.value);
            const correctAnswer = parseInt(block.querySelector('select').value);
            
            return { question, options, correctAnswer };
        });
        
        const quizData = {
            id: Date.now().toString(),
            title: form.quizTitle.value,
            course: form.quizCourse.value,
            instructions: form.quizInstructions.value,
            duration: parseInt(form.quizDuration.value),
            dueDate: form.quizDueDate.value,
            maxScore: questions.length * 10,
            questions: questions,
            createdBy: this.currentUser.id,
            createdAt: new Date().toISOString()
        };
        
        try {
            // Call Node.js backend API to create quiz
            const response = await fetch('/quizzes/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify({
                        id: this.currentUser.id,
                        type: this.currentRole,
                        email: this.currentUser.email
                    })
                },
                body: JSON.stringify(quizData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.quizzes.push(result.quiz);
                this.closeModal('createQuizModal');
                this.updateUI();
                this.showSuccess('Quiz created successfully!');
            } else {
                throw new Error(result.error || 'Failed to create quiz');
            }
        } catch (error) {
            console.error('Error creating quiz:', error);
            this.showError('Failed to create quiz. Please try again.');
        }
    }

    async takeQuiz(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        
        this.currentQuiz = quiz;
        this.timeRemaining = quiz.duration * 60;
        
        const modal = document.getElementById('takeQuizModal');
        const content = document.getElementById('quizQuestionsContainer');
        
        content.innerHTML = quiz.questions.map((q, index) => `
            <div class="question-item">
                <h4>Question ${index + 1}</h4>
                <p>${q.question}</p>
                <div class="options">
                    ${q.options.map((opt, optIndex) => `
                        <label class="option-label">
                            <input type="radio" name="question-${index}" value="${optIndex}" required>
                            <span>${opt}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        modal.style.display = 'block';
        this.startTimer();
    }

    startTimer() {
        const timerElement = document.getElementById('quizTimer');
        
        this.quizTimer = setInterval(() => {
            this.timeRemaining--;
            
            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;
            
            if (timerElement) {
                timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
            
            if (this.timeRemaining <= 0) {
                clearInterval(this.quizTimer);
                this.submitQuiz();
            }
        }, 1000);
    }

    async submitQuiz(e) {
        if (e) e.preventDefault();
        
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
        }
        
        const answers = [];
        const form = document.getElementById('quizForm');
        
        this.currentQuiz.questions.forEach((q, index) => {
            const selected = form.querySelector(`input[name="question-${index}"]:checked`);
            answers.push(selected ? parseInt(selected.value) : -1);
        });
        
        const score = answers.reduce((total, answer, index) => {
            return total + (answer === this.currentQuiz.questions[index].correctAnswer ? 10 : 0);
        }, 0);
        
        const submission = {
            id: Date.now().toString(),
            quizId: this.currentQuiz.id,
            studentId: this.currentUser.id,
            studentName: this.currentUser.name,
            course: this.currentQuiz.course,
            answers: answers,
            score: score,
            maxScore: this.currentQuiz.maxScore,
            submittedAt: new Date().toISOString(),
            status: 'graded'
        };
        
        try {
            // Call Node.js backend API to submit quiz
            const response = await fetch('/quiz-submissions/submit', {
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
                this.submissions.push(result.submission);
                this.closeModal('takeQuizModal');
                this.showQuizResults(result.submission);
                this.updateUI();
            } else {
                throw new Error(result.error || 'Failed to submit quiz');
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
            this.showError('Failed to submit quiz. Please try again.');
        }
    }

    showQuizResults(submission) {
        const quiz = this.quizzes.find(q => q.id === submission.quizId);
        if (!quiz) return;
        
        const modal = document.getElementById('quizResultsModal');
        const content = document.getElementById('resultsContent');
        
        const percentage = ((submission.score / quiz.maxScore) * 100).toFixed(2);
        
        content.innerHTML = `
            <h3>Quiz Results</h3>
            <div class="results-summary">
                <p><strong>Quiz:</strong> ${quiz.title}</p>
                <p><strong>Course:</strong> ${quiz.course}</p>
                <p><strong>Score:</strong> ${submission.score}/${quiz.maxScore} (${percentage}%)</p>
                <p><strong>Status:</strong> ${submission.status}</p>
                <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
            </div>
            
            <h4>Your Answers:</h4>
            ${quiz.questions.map((q, index) => {
                const userAnswer = submission.answers[index];
                const isCorrect = userAnswer === q.correctAnswer;
                
                return `
                    <div class="answer-review ${isCorrect ? 'correct' : 'incorrect'}">
                        <h5>Question ${index + 1}: ${q.question}</h5>
                        <p><strong>Your Answer:</strong> ${userAnswer >= 0 ? q.options[userAnswer] : 'Not answered'}</p>
                        <p><strong>Correct Answer:</strong> ${q.options[q.correctAnswer]}</p>
                        <span class="result-icon">${isCorrect ? '✓' : '✗'}</span>
                    </div>
                `;
            }).join('')}
        `;
        
        modal.style.display = 'block';
    }

    async gradeSubmission(submissionId) {
        const submission = this.submissions.find(sub => sub.id === submissionId);
        const quiz = this.quizzes.find(q => q.id === submission.quizId);
        
        if (!submission || !quiz) return;
        
        this.currentSubmission = submission;
        
        const modal = document.getElementById('gradeModal');
        const content = document.getElementById('gradeContent');
        
        content.innerHTML = `
            <h4>${submission.studentName}</h4>
            <p><strong>Quiz:</strong> ${quiz.title}</p>
            <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
            <p><strong>Current Score:</strong> ${submission.score || 0}/${quiz.maxScore}</p>
        `;
        
        document.getElementById('gradeScore').value = submission.score || 0;
        document.getElementById('gradeFeedback').value = submission.feedback || '';
        
        modal.style.display = 'block';
    }

    async saveGrade(e) {
        e.preventDefault();
        
        const score = parseInt(document.getElementById('gradeScore').value);
        const feedback = document.getElementById('gradeFeedback').value;
        
        this.currentSubmission.score = score;
        this.currentSubmission.status = 'graded';
        this.currentSubmission.feedback = feedback;
        
        try {
            // Call Node.js backend API to update submission
            const response = await fetch(`/quiz-submissions/grade/${this.currentSubmission.id}`, {
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
                this.closeModal('gradeModal');
                this.updateUI();
                this.showSuccess('Quiz graded successfully!');
            } else {
                throw new Error(result.error || 'Failed to grade quiz');
            }
        } catch (error) {
            console.error('Error grading quiz:', error);
            this.showError('Failed to grade quiz. Please try again.');
        }
    }

    async deleteQuiz(quizId) {
        if (!confirm('Are you sure you want to delete this quiz?')) return;
        
        try {
            // Call Node.js backend API to delete quiz
            const response = await fetch(`/quizzes/${quizId}`, {
                method: 'DELETE',
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
                this.quizzes = this.quizzes.filter(q => q.id !== quizId);
                this.updateUI();
                this.showSuccess('Quiz deleted successfully!');
            } else {
                throw new Error(result.error || 'Failed to delete quiz');
            }
        } catch (error) {
            console.error('Error deleting quiz:', error);
            this.showError('Failed to delete quiz. Please try again.');
        }
    }

    viewQuizDetails(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        
        const content = document.getElementById('quizDetailsContent');
        content.innerHTML = `
            <h3>${quiz.title}</h3>
            <p><strong>Course:</strong> ${quiz.course}</p>
            <p><strong>Instructions:</strong> ${quiz.instructions}</p>
            <p><strong>Duration:</strong> ${quiz.duration} minutes</p>
            <p><strong>Questions:</strong> ${quiz.questions.length}</p>
            <p><strong>Maximum Score:</strong> ${quiz.maxScore}</p>
            <p><strong>Due Date:</strong> ${this.formatDate(quiz.dueDate)}</p>
            <p><strong>Created:</strong> ${this.formatDate(quiz.createdAt)}</p>
            
            <h4>Questions Preview:</h4>
            ${quiz.questions.map((q, index) => `
                <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #e9ecef; border-radius: 5px;">
                    <strong>Question ${index + 1}:</strong> ${q.question}
                    <ul style="margin: 5px 0 0 20px;">
                        ${q.options.map((opt, optIndex) => `
                            <li style="color: ${optIndex === q.correctAnswer ? '#28a745' : '#666'};">
                                ${opt} ${optIndex === q.correctAnswer ? '(Correct)' : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('')}
        `;
        
        document.getElementById('quizDetailsModal').style.display = 'block';
    }

    viewSubmission(submissionId) {
        const submission = this.submissions.find(sub => sub.id === submissionId);
        if (!submission) return;
        this.showQuizResults(submission);
    }

    viewResults(submissionId) {
        const submission = this.submissions.find(sub => sub.id === submissionId);
        if (!submission) return;
        this.showQuizResults(submission);
    }

    searchQuizzes(query) {
        const searchTerm = query.toLowerCase();
        const quizCards = document.querySelectorAll('.quiz-card');
        
        quizCards.forEach(card => {
            const title = card.querySelector('.quiz-title')?.textContent.toLowerCase() || '';
            const course = card.querySelector('.quiz-course')?.textContent.toLowerCase() || '';
            
            if (title.includes(searchTerm) || course.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    closeModal(modalId) {
        if (modalId === 'takeQuizModal' && this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        document.getElementById(modalId).style.display = 'none';
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
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
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
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize quiz manager when page loads
let quizManager;
document.addEventListener('DOMContentLoaded', () => {
    quizManager = new QuizManager();
    window.quizManager = quizManager;
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);