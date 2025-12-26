// ========================================
// SERVER.JS - PART 1 OF 4
// Copy parts 1-4 in order to create complete server.js
// ========================================

const express = require('express');
const jsonServer = require('json-server');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 2000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /pdf|doc|docx|txt|zip|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only documents, images, and zip files are allowed!'));
    }
  }
});

// Helper functions for async/await db operations
const readDb = async () => {
  const dbPath = path.join(__dirname, 'db.json');
  const data = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(data);
};

const writeDb = async (data) => {
  const dbPath = path.join(__dirname, 'db.json');
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
};

// Essential middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Static assets
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use('/materials', express.static(path.join(__dirname, 'materials')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// JSON Server setup
const apiRouter = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// === AUTHENTICATION MIDDLEWARE ===
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['x-user'] || req.headers['authorization'];
  let user = null;
  
  try {
    if (authHeader) {
      user = JSON.parse(authHeader);
    }
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid auth header' });
  }
  
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  req.user = user;
  next();
};

const requireStudent = (req, res, next) => {
  const authHeader = req.headers['x-user'] || req.headers['authorization'];
  let user = null;
  
  try {
    if (authHeader) {
      user = JSON.parse(authHeader);
    }
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid auth header' });
  }
  
  if (!user || user.type !== 'student') {
    return res.status(403).json({ success: false, error: 'Student access required' });
  }
  
  req.user = user;
  next();
};

const requireTeacher = (req, res, next) => {
  const authHeader = req.headers['x-user'] || req.headers['authorization'];
  let user = null;
  
  try {
    if (authHeader) {
      user = JSON.parse(authHeader);
    }
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid auth header' });
  }
  
  if (!user || user.type !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Teacher access required' });
  }
  
  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers['x-user'] || req.headers['authorization'];
  let user = null;
  
  try {
    if (authHeader) {
      user = JSON.parse(authHeader);
    }
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid auth header' });
  }
  
  if (!user || user.type !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  
  req.user = user;
  next();
};

// === LOGIN ENDPOINT ===
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please enter both email and password' });
  }

  const db = apiRouter.db;
  
  const checkUser = (collection, type) => {
    const users = db.get(collection).value() || [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        type
      };
      
      if (type === 'student') {
        userData.domain = user.domain;
        userData.score = user.score;
        userData.phone = user.phone;
      } else if (type === 'teacher') {
        userData.courses = user.courses;
        userData.domain = user.domain;
        userData.phone = user.phone;
      } else if (type === 'admin') {
        userData.permissions = user.permissions;
      }
      
      return {
        success: true,
        user: userData,
        redirect: `/HTML/${type}Index.html`
      };
    }
    return null;
  };

  let result = checkUser('students', 'student');
  if (!result) result = checkUser('teachers', 'teacher');
  if (!result) result = checkUser('admins', 'admin');

  if (result) {
    res.json(result);
  } else {
    res.status(401).json({ success: false, error: 'Invalid email or password!' });
  }
});

// === SIGNUP ENDPOINT ===
app.post('/signup', (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body;
  
  if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({ success: false, error: 'Please fill in all fields' });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, error: 'Passwords do not match!' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email' });
  }

  const db = apiRouter.db;
  
  try {
    const existingStudents = db.get('students').value() || [];
    if (existingStudents.some(student => student.email === email)) {
      return res.status(409).json({ success: false, error: 'Email already registered!' });
    }

    const newStudent = {
      id: Date.now(),
      name: `${firstName} ${lastName}`,
      email,
      password,
      phone,
      domain: 'General',
      score: 0,
      assignments: { completed: 0, pending: 0, overdue: 0 },
      attendance: 0,
      quizTypes: { MCQ: 0, Written: 0, Project: 0 },
      activityLog: [new Date().toISOString().split('T')[0]]
    };

    db.get('students').push(newStudent).write();
    
    res.json({ 
      success: true, 
      message: 'Registration successful! Please login.',
      redirect: '/HTML/login.html',
      user: { name: newStudent.name, email: newStudent.email, type: 'student' }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: 'Registration failed.' });
  }
});

// === REPORT ENDPOINT ===
app.post('/report', (req, res) => {
  const { studentName, studentEmail, subject, description } = req.body;
  
  if (!studentName || !studentEmail || !subject || !description) {
    return res.status(400).json({ success: false, error: 'Please fill in all fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(studentEmail)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email' });
  }

  const db = apiRouter.db;
  
  try {
    const newIssue = {
      id: Date.now(),
      studentName,
      studentEmail,
      subject,
      description,
      date: new Date().toISOString().slice(0, 10),
      status: 'open'
    };

    db.get('issues').push(newIssue).write();
    
    res.json({ 
      success: true, 
      message: 'Your issue has been submitted successfully!',
      issueId: newIssue.id 
    });

  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit issue.' });
  }
});

// === PROFILE MANAGEMENT ENDPOINTS ===
app.get('/api/profile/:userId', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.params.userId;
  
  if (String(req.user.id) !== String(userId) && req.user.type !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const profiles = db.get('profiles').value() || [];
    const profile = profiles.find(p => String(p.userId) === String(userId));
    
    if (profile) {
      res.json({ success: true, profile: profile });
    } else {
      res.json({ success: false, message: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

app.post('/api/profile', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const profileData = req.body;
  
  if (String(req.user.id) !== String(profileData.userId) && req.user.type !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const profiles = db.get('profiles').value() || [];
    const existingIndex = profiles.findIndex(p => String(p.userId) === String(profileData.userId));
    
    profileData.lastUpdated = new Date().toISOString();
    
    if (existingIndex !== -1) {
      profiles[existingIndex] = profileData;
      db.get('profiles').write();
      res.json({ success: true, message: 'Profile updated successfully', profile: profileData });
    } else {
      db.get('profiles').push(profileData).write();
      res.json({ success: true, message: 'Profile created successfully', profile: profileData });
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ success: false, error: 'Failed to save profile' });
  }
});

// === CERTIFICATE ENDPOINTS ===
app.get('/api/certificates', (req, res) => {
  const db = apiRouter.db;
  const { studentId } = req.query;
  
  try {
    const certificates = db.get('certificates').value() || [];
    
    if (studentId) {
      const studentCerts = certificates.filter(c => String(c.studentId) === String(studentId));
      res.json(studentCerts);
    } else {
      res.json(certificates);
    }
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json([]);
  }
});

app.post('/api/certificates', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const certificateData = req.body;
  
  if (req.user.type !== 'admin' && req.user.type !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Only admins and teachers can add certificates' });
  }
  
  try {
    const newCertificate = {
      id: Date.now(),
      studentId: certificateData.studentId,
      courseTitle: certificateData.courseTitle,
      issuer: certificateData.issuer || 'LearnEdge LMS',
      date: certificateData.date || new Date().toISOString().split('T')[0],
      url: certificateData.url || '',
      issuedBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.get('certificates').push(newCertificate).write();
    
    res.status(201).json({
      success: true,
      message: 'Certificate added successfully',
      certificate: newCertificate
    });
  } catch (error) {
    console.error('Error adding certificate:', error);
    res.status(500).json({ success: false, error: 'Failed to add certificate' });
  }
});

app.delete('/api/certificates/:id', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const certId = req.params.id;
  
  if (req.user.type !== 'admin' && req.user.type !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Only admins and teachers can delete certificates' });
  }
  
  try {
    const certificates = db.get('certificates').value() || [];
    const cert = certificates.find(c => String(c.id) === String(certId));
    
    if (!cert) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }
    
    db.get('certificates').remove(c => String(c.id) === String(certId)).write();
    res.json({ success: true, message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ success: false, error: 'Failed to delete certificate' });
  }
});

// === ENROLLMENT ENDPOINTS ===
app.get('/enrollments/check', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const { courseId } = req.query;
  
  if (!courseId) {
    return res.status(400).json({ success: false, error: 'courseId is required' });
  }
  
  try {
    const enrollments = db.get('enrollments').value() || [];
    const enrollment = enrollments.find(
      enr => String(enr.studentId) === String(req.user.id) && (String(enr.courseId) === String(courseId) || enr.courseId === parseInt(courseId))
    );
    
    res.json({
      success: true,
      isEnrolled: !!enrollment,
      enrollment: enrollment || null
    });
  } catch (error) {
    console.error('Error checking enrollment:', error);
    res.status(500).json({ success: false, error: 'Failed to check enrollment' });
  }
});

app.get('/api/enrollments', (req, res) => {
  const db = apiRouter.db;
  const { studentId, courseTitle, courseId } = req.query;
  
  try {
    let enrollments = db.get('enrollments').value() || [];
    
    // Filter by studentId if provided
    if (studentId) {
      enrollments = enrollments.filter(e => String(e.studentId) === String(studentId));
    }
    
    // Filter by courseTitle if provided
    if (courseTitle) {
      enrollments = enrollments.filter(e => 
        e.courseTitle === courseTitle || 
        e.course === courseTitle ||
        e.courseTitle?.toLowerCase().trim() === courseTitle.toLowerCase().trim()
      );
    }
    
    // Filter by courseId if provided
    if (courseId) {
      enrollments = enrollments.filter(e => 
        String(e.courseId) === String(courseId) || 
        e.courseId === parseInt(courseId)
      );
    }
    
    res.json(enrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json([]);
  }
});

app.get('/enrollments', (req, res) => {
  const db = apiRouter.db;
  
  try {
    const enrollments = db.get('enrollments').value() || [];
    const { status, courseId } = req.query;
    
    let filtered = enrollments;
    
    if (status) {
      filtered = filtered.filter(enr => enr.status === status);
    }
    
    if (courseId) {
      filtered = filtered.filter(enr => String(enr.courseId) === String(courseId) || enr.courseId === parseInt(courseId));
    }
    
    res.json({
      success: true,
      enrollments: filtered,
      total: filtered.length
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch enrollments' });
  }
});

app.get('/api/enrollments/student/:studentId', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const studentId = req.params.studentId;
  
  if (String(req.user.id) !== String(studentId)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const enrollments = db.get('enrollments').value() || [];
    const courses = db.get('courses').value() || [];
    
    const studentEnrollments = enrollments
      .filter(e => String(e.studentId) === String(studentId))
      .map(enrollment => {
        const courseDetails = courses.find(c => c.id === enrollment.courseId || c.title === enrollment.courseTitle);
        
        return {
          ...enrollment,
          title: enrollment.courseTitle,
          domain: courseDetails?.domain || '',
          coordinator: courseDetails?.coordinator || '',
          level: courseDetails?.level || '',
          duration: courseDetails?.duration || '',
          description: courseDetails?.description || ''
        };
      });
    
    res.json({
      success: true,
      enrollments: studentEnrollments,
      count: studentEnrollments.length
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch enrollments' });
  }
});

// ========================================
// END OF PART 1 - CONTINUE WITH PART 2
// ========================================

// ========================================
// SERVER.JS - PART 2 OF 4
// Add this after Part 1
// ========================================

// === ASSIGNMENT SUBMISSION ENDPOINTS ===
app.get('/api/assignmentSubmissions', (req, res) => {
  const db = apiRouter.db;
  
  try {
    const submissions = db.get('assignmentSubmissions').value() || [];
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching assignment submissions:', error);
    res.status(500).json([]);
  }
});

app.delete('/api/assignmentSubmissions/:id', (req, res) => {
  const db = apiRouter.db;
  const assignmentId = req.params.id;
  
  try {
    const submissions = db.get('assignmentSubmissions').value() || [];
    const submission = submissions.find(s => s.id == assignmentId);
    
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    
    db.get('assignmentSubmissions').remove({ id: submission.id }).write();
    
    res.json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete assignment' });
  }
});

app.get('/assignment-submissions/student/:studentId', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const studentId = req.params.studentId;
  
  if (String(studentId) !== String(req.user.id)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const submissions = db.get('assignmentSubmissions').value() || [];
    const studentSubmissions = submissions.filter(sub => String(sub.studentId) === String(studentId));
    
    res.json({
      success: true,
      submissions: studentSubmissions,
      count: studentSubmissions.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

app.post('/assignment-submissions/submit', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const submissionData = req.body;
  
  try {
    if (!submissionData.assignmentId || !submissionData.fileName) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const submissions = db.get('assignmentSubmissions').value() || [];
    const existingSubmission = submissions.find(
      sub => sub.studentId === req.user.id && sub.assignmentId === submissionData.assignmentId
    );
    
    if (existingSubmission) {
      return res.status(409).json({ 
        success: false, 
        error: 'You have already submitted this assignment' 
      });
    }
    
    const newSubmission = {
      id: submissionData.id || `ASUB${Date.now()}`,
      assignmentId: submissionData.assignmentId,
      course: submissionData.course,
      title: submissionData.title,
      studentId: req.user.id,
      studentName: req.user.name || submissionData.studentName,
      studentEmail: req.user.email || submissionData.studentEmail,
      fileName: submissionData.fileName,
      fileType: submissionData.fileType,
      fileSize: submissionData.fileSize,
      submittedAt: new Date().toISOString(),
      status: submissionData.status || 'submitted',
      feedback: submissionData.feedback || ''
    };
    
    db.get('assignmentSubmissions').push(newSubmission).write();
    
    res.status(201).json({
      success: true,
      message: 'Assignment submitted successfully',
      submission: newSubmission
    });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to submit assignment' });
  }
});

app.patch('/assignment-submissions/grade/:submissionId', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const submissionId = req.params.submissionId;
  const { score, feedback, status } = req.body;
  
  try {
    const submissions = db.get('assignmentSubmissions').value() || [];
    const submissionIdx = submissions.findIndex(s => s.id === submissionId);
    
    if (submissionIdx === -1) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    
    if (score !== undefined) submissions[submissionIdx].score = score;
    if (feedback !== undefined) submissions[submissionIdx].feedback = feedback;
    if (status !== undefined) submissions[submissionIdx].status = status;
    
    submissions[submissionIdx].gradedAt = new Date().toISOString();
    submissions[submissionIdx].gradedBy = req.user.id;
    
    db.get('assignmentSubmissions').write();
    
    res.json({
      success: true,
      message: 'Assignment graded successfully',
      submission: submissions[submissionIdx]
    });
  } catch (error) {
    console.error('Error grading assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to grade assignment' });
  }
});

app.get('/assignment-submissions/all', requireAuth, (req, res) => {
  const db = apiRouter.db;
  
  if (req.user.type !== 'teacher' && req.user.type !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const submissions = db.get('assignmentSubmissions').value() || [];
    const { status, course } = req.query;
    
    let filtered = submissions;
    
    if (req.user.type === 'teacher') {
      const teachers = db.get('teachers').value() || [];
      const teacher = teachers.find(t => t.email === req.user.email || t.id === req.user.id);
      
      if (teacher && teacher.courses) {
        filtered = filtered.filter(sub => teacher.courses.includes(sub.course));
      }
    }
    
    if (status) {
      filtered = filtered.filter(sub => sub.status === status);
    }
    
    if (course) {
      filtered = filtered.filter(sub => sub.course === course);
    }
    
    res.json({
      success: true,
      submissions: filtered,
      total: filtered.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

app.get('/api/teacher/assignment-submissions', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const { assignmentId, course } = req.query;
  
  try {
    const submissions = db.get('assignmentSubmissions').value() || [];
    
    let filtered = submissions;
    
    if (assignmentId) {
      filtered = filtered.filter(s => s.assignmentId == assignmentId);
    }
    
    if (course) {
      filtered = filtered.filter(s => s.course === course);
    }
    
    res.json({
      success: true,
      submissions: filtered
    });
  } catch (error) {
    console.error('Error fetching assignment submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

app.patch('/api/teacher/assignment-submissions/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const submissionId = req.params.id;
  const { score, feedback, status } = req.body;
  
  try {
    const submission = db.get('assignmentSubmissions').find({ id: submissionId }).value();
    
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    
    const updateData = {};
    if (score !== undefined) updateData.score = score;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (status !== undefined) updateData.status = status;
    updateData.gradedAt = new Date().toISOString();
    updateData.gradedBy = req.user.id;
    
    db.get('assignmentSubmissions').find({ id: submissionId }).assign(updateData).write();
    
    const updatedSubmission = db.get('assignmentSubmissions').find({ id: submissionId }).value();
    
    res.json({
      success: true,
      message: 'Submission graded successfully',
      submission: updatedSubmission
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ success: false, error: 'Failed to grade submission' });
  }
});

// === MESSAGING SYSTEM ENDPOINTS ===
app.get('/api/messages/contacts', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.user.id;
  const userType = req.user.type;
  const { course } = req.query;
  
  try {
    const teachers = db.get('teachers').value() || [];
    const students = db.get('students').value() || [];
    const enrollments = db.get('enrollments').value() || [];
    
    let contacts = [];
    
    if (userType === 'teacher') {
      const teacher = teachers.find(t => t.id === userId);
      
      if (!teacher || !teacher.courses || teacher.courses.length === 0) {
        return res.json({
          success: true,
          contacts: [],
          courses: [],
          message: 'No courses assigned'
        });
      }
      
      const teacherCourses = teacher.courses;
      const targetCourse = course || teacherCourses[0];
      
      const enrolledStudentIds = enrollments
        .filter(e => e.courseTitle === targetCourse)
        .map(e => e.studentId);
      
      const enrolledStudents = students.filter(s => enrolledStudentIds.includes(s.id));
      
      contacts = enrolledStudents.map(student => ({
        id: student.id,
        name: student.name + ' (Student)',
        type: 'student',
        course: targetCourse,
        avatar: student.avatar || '../images/profileicon.jpeg',
        email: student.email
      }));
      
      return res.json({
        success: true,
        contacts: contacts,
        courses: teacherCourses,
        selectedCourse: targetCourse
      });
      
    } else if (userType === 'student') {
      const studentEnrollments = enrollments.filter(e => e.studentId === userId);
      const enrolledCourses = studentEnrollments.map(e => e.courseTitle);
      
      if (enrolledCourses.length === 0) {
        return res.json({
          success: true,
          contacts: [],
          courses: [],
          message: 'Not enrolled in any courses'
        });
      }
      
      const targetCourse = course || enrolledCourses[0];
      
      const courseTeachers = teachers.filter(t => t.courses && t.courses.includes(targetCourse));
      
      contacts = courseTeachers.map(teacher => ({
        id: teacher.id,
        name: teacher.name + ' (Instructor)',
        type: 'teacher',
        course: targetCourse,
        avatar: teacher.avatar || '../images/profileicon.jpeg',
        email: teacher.email
      }));
      
      const coStudentIds = enrollments
        .filter(e => e.courseTitle === targetCourse && e.studentId !== userId)
        .map(e => e.studentId);
      
      const coStudents = students.filter(s => coStudentIds.includes(s.id));
      
      coStudents.forEach(student => {
        contacts.push({
          id: student.id,
          name: student.name + ' (Student)',
          type: 'student',
          course: targetCourse,
          avatar: student.avatar || '../images/profileicon.jpeg',
          email: student.email
        });
      });
      
      return res.json({
        success: true,
        contacts: contacts,
        courses: enrolledCourses,
        selectedCourse: targetCourse
      });
    }
    
    res.json({
      success: true,
      contacts: [],
      courses: []
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

app.post('/api/messages/chat', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { contactId, course } = req.body;
  const userId = req.user.id;
  
  if (!contactId || !course) {
    return res.status(400).json({ success: false, error: 'contactId and course are required' });
  }
  
  try {
    const chats = db.get('chats').value() || [];
    
    const existingChat = chats.find(chat => 
      chat.participants.includes(userId) && 
      chat.participants.includes(contactId) && 
      chat.course === course
    );
    
    if (existingChat) {
      return res.json({
        success: true,
        chat: existingChat
      });
    }
    
    const chatKey = [userId, contactId, course].sort().join('_');
    const newChat = {
      id: chatKey,
      participants: [userId, contactId].sort(),
      course: course,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db.get('chats').push(newChat).write();
    
    res.json({
      success: true,
      chat: newChat
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ success: false, error: 'Failed to create chat' });
  }
});

app.get('/api/messages/chat/:chatId', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { chatId } = req.params;
  const userId = req.user.id;
  
  try {
    const chats = db.get('chats').value() || [];
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }
    
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({
      success: true,
      chat: chat
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chat' });
  }
});

app.post('/api/messages/send', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { chatId, text, forwardedFrom } = req.body;
  const userId = req.user.id;
  
  if (!chatId || !text) {
    return res.status(400).json({ success: false, error: 'chatId and text are required' });
  }
  
  try {
    const chats = db.get('chats').value() || [];
    const chatIndex = chats.findIndex(c => c.id === chatId);
    
    if (chatIndex === -1) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }
    
    const chat = chats[chatIndex];
    
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const newMessage = {
      id: Date.now().toString(),
      senderId: userId,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      forwardedFrom: forwardedFrom || null
    };
    
    chats[chatIndex].messages.push(newMessage);
    chats[chatIndex].updatedAt = new Date().toISOString();
    
    db.get('chats').write();
    
    res.json({
      success: true,
      message: newMessage,
      chat: chats[chatIndex]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

app.delete('/api/messages/:chatId/:messageId', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { chatId, messageId } = req.params;
  const userId = req.user.id;
  
  try {
    const chats = db.get('chats').value() || [];
    const chatIndex = chats.findIndex(c => c.id === chatId);
    
    if (chatIndex === -1) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }
    
    const chat = chats[chatIndex];
    
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    const message = chat.messages[messageIndex];
    
    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own messages' });
    }
    
    chats[chatIndex].messages.splice(messageIndex, 1);
    chats[chatIndex].updatedAt = new Date().toISOString();
    
    db.get('chats').write();
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

app.get('/api/messages/blocked', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.user.id;
  
  try {
    const blockedUsers = db.get('blockedUsers').value() || [];
    const userBlocked = blockedUsers.filter(b => b.userId === userId);
    
    res.json({
      success: true,
      blocked: userBlocked.map(b => b.blockedId)
    });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blocked users' });
  }
});

app.post('/api/messages/block', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { blockedId } = req.body;
  const userId = req.user.id;
  
  if (!blockedId) {
    return res.status(400).json({ success: false, error: 'blockedId is required' });
  }
  
  try {
    const blockedUsers = db.get('blockedUsers').value() || [];
    
    const existing = blockedUsers.find(b => b.userId === userId && b.blockedId === blockedId);
    
    if (existing) {
      return res.json({
        success: true,
        message: 'User already blocked'
      });
    }
    
    const newBlock = {
      id: Date.now(),
      userId: userId,
      blockedId: blockedId,
      createdAt: new Date().toISOString()
    };
    
    db.get('blockedUsers').push(newBlock).write();
    
    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ success: false, error: 'Failed to block user' });
  }
});

app.delete('/api/messages/block/:blockedId', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { blockedId } = req.params;
  const userId = req.user.id;
  
  try {
    const blockedUsers = db.get('blockedUsers').value() || [];
    const blockIndex = blockedUsers.findIndex(b => b.userId === userId && b.blockedId == blockedId);
    
    if (blockIndex === -1) {
      return res.status(404).json({ success: false, error: 'Block not found' });
    }
    
    db.get('blockedUsers').remove({ userId: userId, blockedId: parseInt(blockedId) }).write();
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ success: false, error: 'Failed to unblock user' });
  }
});

app.get('/api/messages/chats', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.user.id;
  
  try {
    const chats = db.get('chats').value() || [];
    const userChats = chats.filter(chat => chat.participants.includes(userId));
    
    res.json({
      success: true,
      chats: userChats
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chats' });
  }
});

// ========================================
// END OF PART 2 - CONTINUE WITH PART 3
// ========================================

// ========================================
// SERVER.JS - PART 3 OF 4
// Add this after Part 2
// ========================================

// === COURSES ENDPOINTS ===
app.get('/courses', (req, res) => {
  const db = apiRouter.db;
  
  try {
    let courses = db.get('courses').value() || [];
    
    const { domain, coordinator, level, duration, search } = req.query;
    
    if (domain) courses = courses.filter(c => c.domain === domain);
    if (coordinator) courses = courses.filter(c => c.coordinator === coordinator);
    if (level) courses = courses.filter(c => c.level === level);
    if (duration) courses = courses.filter(c => c.duration === duration);
    
    if (search) {
      const searchLower = search.toLowerCase();
      courses = courses.filter(c => 
        (c.title && c.title.toLowerCase().includes(searchLower)) ||
        (c.description && c.description.toLowerCase().includes(searchLower)) ||
        (c.domain && c.domain.toLowerCase().includes(searchLower)) ||
        (c.coordinator && c.coordinator.toLowerCase().includes(searchLower))
      );
    }
    
    const allCourses = db.get('courses').value() || [];
    const filterOptions = {
      domains: [...new Set(allCourses.map(c => c.domain).filter(Boolean))],
      coordinators: [...new Set(allCourses.map(c => c.coordinator).filter(Boolean))],
      levels: [...new Set(allCourses.map(c => c.level).filter(Boolean))],
      durations: [...new Set(allCourses.map(c => c.duration).filter(Boolean))]
    };
    
    res.json({
      success: true,
      courses: courses,
      total: courses.length,
      allTotal: allCourses.length,
      filterOptions: filterOptions
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
});

app.get('/api/courses', (req, res) => {
  const db = apiRouter.db;
  
  try {
    const courses = db.get('courses').value() || [];
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json([]);
  }
});

app.get('/courses/:id', (req, res) => {
  const db = apiRouter.db;
  const courseId = req.params.id;
  
  try {
    const courses = db.get('courses').value() || [];
    // Find by ID (handle both string and number IDs)
    const course = courses.find(c => String(c.id) === String(courseId));
    
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }
    
    res.json({
      success: true,
      course: course
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch course' });
  }
});

// === STUDENTS ENDPOINTS ===
app.get('/api/students', (req, res) => {
  const db = apiRouter.db;
  
  try {
    const students = db.get('students').value() || [];
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json([]);
  }
});

// === TEACHERS ENDPOINTS ===
app.get('/api/teachers', (req, res) => {
  const db = apiRouter.db;
  const { email } = req.query;
  
  try {
    const teachers = db.get('teachers').value() || [];
    
    if (email) {
      const teacher = teachers.filter(t => t.email === email);
      return res.json(teacher);
    }
    
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json([]);
  }
});

app.get('/api/teacherDashboard', (req, res) => {
  const db = apiRouter.db;
  
  try {
    const teacherDashboard = db.get('teacherDashboard').value() || {};
    res.json(teacherDashboard);
  } catch (error) {
    console.error('Error fetching teacher dashboard:', error);
    res.status(500).json({});
  }
});

app.get('/api/teacher/:teacherId/courses', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const teacherId = parseInt(req.params.teacherId);
  
  if (req.user.id !== teacherId && req.user.type !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const teachers = db.get('teachers').value() || [];
    const teacher = teachers.find(t => t.id === teacherId);
    
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    
    const teacherCourses = teacher.courses || [];
    const courses = db.get('courses').value() || [];
    const enrollments = db.get('enrollments').value() || [];
    
    const enrichedCourses = teacherCourses.map(courseName => {
      const courseDetails = courses.find(c => c.title === courseName);
      const enrollmentCount = enrollments.filter(e => e.courseTitle === courseName).length;
      
      return {
        title: courseName,
        id: courseDetails?.id || null,
        domain: teacher.domain || courseDetails?.domain || '',
        description: courseDetails?.description || '',
        coordinator: courseDetails?.coordinator || teacher.name,
        level: courseDetails?.level || '',
        duration: courseDetails?.duration || '',
        students: enrollmentCount
      };
    });
    
    res.json({
      success: true,
      courses: enrichedCourses,
      domain: teacher.domain || '',
      teacher: {
        name: teacher.name,
        email: teacher.email
      }
    });
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
});

// === ADMIN DASHBOARD ENDPOINT ===
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  
  try {
    const students = db.get('students').value() || [];
    const teachers = db.get('teachers').value() || [];
    const courses = db.get('courses').value() || [];
    const assignments = db.get('assignments').value() || [];
    const quizzes = db.get('quizzes').value() || [];
    const videoSessions = db.get('videoSessions').value() || [];
    const issues = db.get('issues').value() || [];
    const enrollments = db.get('enrollments').value() || [];
    const assignmentSubmissions = db.get('assignmentSubmissions').value() || [];
    const quizSubmissions = db.get('quizSubmissions').value() || [];
    
    const studentDistribution = {};
    enrollments.forEach(enrollment => {
      if (enrollment.status === 'active') {
        const courseTitle = enrollment.courseTitle || 'Unknown Course';
        if (!studentDistribution[courseTitle]) {
          studentDistribution[courseTitle] = 0;
        }
        studentDistribution[courseTitle]++;
      }
    });
    
    const allTimeActivity = {
      "Total Assignments": assignments.length,
      "Total Videos": videoSessions.length,
      "Total Quizzes": quizzes.length,
      "Total Issues": issues.length,
      "Total Students": students.length,
      "Total Teachers": teachers.length,
      "Total Courses": courses.length
    };
    
    const enrichedIssues = issues.map(issue => ({
      id: issue.id,
      studentId: issue.studentId || issue.studentEmail || 'N/A',
      studentName: issue.studentName || 'N/A',
      course: issue.course || issue.subject || 'General',
      description: issue.description || '',
      date: issue.date || new Date().toISOString().slice(0, 10),
      status: issue.status || 'open'
    }));
    
    const statistics = {
      totalEnrollments: enrollments.length,
      activeEnrollments: enrollments.filter(e => e.status === 'active').length,
      completedAssignments: assignmentSubmissions.filter(s => s.status === 'submitted').length,
      completedQuizzes: quizSubmissions.filter(s => s.status === 'submitted').length,
      openIssues: issues.filter(i => i.status === 'open').length,
      resolvedIssues: issues.filter(i => i.status === 'resolved').length
    };
    
    res.json({
      success: true,
      data: {
        studentDistribution,
        allTimeActivity,
        issues: enrichedIssues,
        statistics,
        counts: {
          students: students.length,
          teachers: teachers.length,
          courses: courses.length,
          assignments: assignments.length,
          quizzes: quizzes.length,
          videos: videoSessions.length,
          enrollments: enrollments.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// === ADMIN ACTIVITY ANALYTICS ENDPOINT ===
app.get('/admin/activity', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  
  try {
    const students = db.get('students').value() || [];
    const teachers = db.get('teachers').value() || [];
    const courses = db.get('courses').value() || [];
    const assignments = db.get('assignments').value() || [];
    const quizzes = db.get('quizzes').value() || [];
    const assignmentSubmissions = db.get('assignmentSubmissions').value() || [];
    const quizSubmissions = db.get('quizSubmissions').value() || [];
    const chats = db.get('chats').value() || [];
    const notifications = db.get('notifications').value() || [];
    const applications = db.get('applications').value() || [];
    const enrollments = db.get('enrollments').value() || [];
    const videoSessions = db.get('videoSessions').value() || [];
    const materials = db.get('materials').value() || [];
    const issues = db.get('issues').value() || [];
    const profiles = db.get('profiles').value() || [];
    
    res.json({
      success: true,
      data: {
        students,
        teachers,
        courses,
        assignments,
        quizzes,
        assignmentSubmissions,
        quizSubmissions,
        chats,
        notifications,
        applications,
        enrollments,
        videoSessions,
        materials,
        issues,
        profiles
      }
    });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity data' });
  }
});

app.patch('/admin/issues/:id', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  const issueId = parseInt(req.params.id);
  const { status } = req.body;
  
  try {
    const issues = db.get('issues').value() || [];
    const issueIdx = issues.findIndex(i => i.id === issueId);
    
    if (issueIdx === -1) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    
    if (status) {
      issues[issueIdx].status = status;
    }
    
    db.get('issues').write();
    
    res.json({
      success: true,
      message: 'Issue updated successfully',
      issue: issues[issueIdx]
    });
  } catch (error) {
    console.error('Error updating issue:', error);
    res.status(500).json({ success: false, error: 'Failed to update issue' });
  }
});

app.delete('/admin/issues/:id', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  const issueId = parseInt(req.params.id);
  
  try {
    const issues = db.get('issues').value() || [];
    const issueIdx = issues.findIndex(i => i.id === issueId);
    
    if (issueIdx === -1) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    
    db.get('issues').remove({ id: issueId }).write();
    
    res.json({
      success: true,
      message: 'Issue deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ success: false, error: 'Failed to delete issue' });
  }
});

// === NOTIFICATION ENDPOINTS ===
app.get('/notifications', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.user.id;
  
  try {
    const notifications = db.get('notifications').value() || [];
    let userNotifications = notifications.filter(n => n.userId === userId);
    userNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      notifications: userNotifications,
      unreadCount: userNotifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

app.get('/notifications/unread-count', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.user.id;
  
  try {
    const notifications = db.get('notifications').value() || [];
    const unreadCount = notifications.filter(n => n.userId === userId && !n.read).length;
    
    res.json({
      success: true,
      count: unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
});

app.patch('/notifications/:id/read', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const notificationId = parseInt(req.params.id);
  const userId = req.user.id;
  
  try {
    const notifications = db.get('notifications').value() || [];
    const notificationIdx = notifications.findIndex(n => n.id === notificationId && n.userId === userId);
    
    if (notificationIdx === -1) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    notifications[notificationIdx].read = true;
    db.get('notifications').write();
    
    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: notifications[notificationIdx]
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

app.patch('/notifications/mark-all-read', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const userId = req.user.id;
  
  try {
    const notifications = db.get('notifications').value() || [];
    let updatedCount = 0;
    
    notifications.forEach((notification, index) => {
      if (notification.userId === userId && !notification.read) {
        notifications[index].read = true;
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      db.get('notifications').write();
    }
    
    res.json({
      success: true,
      message: `${updatedCount} notifications marked as read`,
      updatedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

app.post('/notifications', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const { userId, message, link } = req.body;
  
  if (!userId || !message) {
    return res.status(400).json({ success: false, error: 'userId and message are required' });
  }
  
  try {
    const newNotification = {
      id: Date.now(),
      userId: userId,
      message: message,
      link: link || null,
      read: false,
      timestamp: new Date().toISOString()
    };
    
    db.get('notifications').push(newNotification).write();
    
    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notification: newNotification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
});

app.post('/notifications/broadcast', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  const { userType, message, link } = req.body;
  
  if (!userType || !message) {
    return res.status(400).json({ success: false, error: 'userType and message are required' });
  }
  
  try {
    const collection = userType === 'student' ? 'students' : userType === 'teacher' ? 'teachers' : 'admins';
    const users = db.get(collection).value() || [];
    
    const notifications = users.map(user => ({
      id: Date.now() + Math.random(),
      userId: user.id,
      message: message,
      link: link || null,
      read: false,
      timestamp: new Date().toISOString()
    }));
    
    notifications.forEach(notification => {
      db.get('notifications').push(notification).write();
    });
    
    res.status(201).json({
      success: true,
      message: `Broadcast notification sent to ${users.length} ${userType}(s)`,
      count: users.length
    });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ success: false, error: 'Failed to broadcast notification' });
  }
});

app.delete('/notifications/:id', requireAuth, (req, res) => {
  const db = apiRouter.db;
  const notificationId = parseInt(req.params.id);
  const userId = req.user.id;
  
  try {
    const notifications = db.get('notifications').value() || [];
    const notificationIdx = notifications.findIndex(n => n.id === notificationId && n.userId === userId);
    
    if (notificationIdx === -1) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    db.get('notifications').remove({ id: notificationId }).write();
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

// === TEACHER DASHBOARD ENDPOINT ===
app.get('/api/teacher/dashboard', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const teacherEmail = req.user.email;
  
  try {
    const teachers = db.get('teachers').value() || [];
    const teacher = teachers.find(t => t.email === teacherEmail);
    
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    
    const enrollments = db.get('enrollments').value() || [];
    const assignmentSubs = db.get('assignmentSubmissions').value() || [];
    const courses = db.get('courses').value() || [];
    const students = db.get('students').value() || [];
    const teacherDashboard = db.get('teacherDashboard').value() || {};
    
    const teacherCourses = teacher.courses || [];
    const performanceSummary = teacherDashboard.performanceSummary || [];
    
    const courseStats = teacherCourses.map(courseTitle => {
      const studentsInCourse = enrollments
        .filter(e => (e.courseTitle || e.course) === courseTitle)
        .map(e => e.studentId);
      const uniqueStudents = [...new Set(studentsInCourse)];
      
      const assignmentsForCourse = assignmentSubs.filter(sub => sub.course === courseTitle);
      
      const pendingAssignments = assignmentsForCourse
        .filter(a => a.status !== 'completed' && a.status !== 'graded').length;
      
      const graded = assignmentsForCourse
        .filter(a => a.status === 'graded' && typeof a.score === 'number');
      const avgPerformance = graded.length > 0 
        ? Math.round(graded.reduce((sum, a) => sum + a.score, 0) / graded.length) 
        : 0;
      
      return {
        course: courseTitle,
        students: uniqueStudents.length,
        assignments: assignmentsForCourse,
        pendingAssignments,
        avgPerformance
      };
    });
    
    const allAssignments = courseStats.flatMap(cs => 
      cs.assignments.map(a => ({...a, course: cs.course}))
    );
    
    const enrolledStudents = enrollments
      .filter(e => teacherCourses.includes(e.courseTitle || e.course));
    const uniqueStudentIds = [...new Set(enrolledStudents.map(e => e.studentId))];
    
    const totalPending = courseStats.reduce((sum, cs) => sum + cs.pendingAssignments, 0);
    
    const avgPerformance = courseStats.length > 0 
      ? Math.round(courseStats.reduce((sum, cs) => sum + cs.avgPerformance, 0) / courseStats.length) 
      : 0;
    
    const teacherPerformance = performanceSummary.filter(p => 
      teacherCourses.includes(p.course)
    );
    
    res.json({
      success: true,
      data: {
        teacher: {
          name: teacher.name,
          email: teacher.email,
          domain: teacher.domain || '',
          courses: teacherCourses
        },
        quickStats: {
          totalCourses: teacherCourses.length,
          totalStudents: uniqueStudentIds.length,
          pendingAssignments: totalPending,
          avgPerformance: avgPerformance
        },
        courses: teacherCourses,
        courseStats: courseStats,
        assignments: allAssignments,
        assignmentSubmissions: assignmentSubs.filter(a => teacherCourses.includes(a.course)),
        performance: teacherPerformance,
        students: students,
        coursesList: courses,
        enrollments: enrollments
      }
    });
  } catch (error) {
    console.error('Error fetching teacher dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// ========================================
// END OF PART 3 - CONTINUE WITH PART 4
// ========================================

// ========================================
// SERVER.JS - PART 4 OF 4 (FINAL)
// Add this after Part 3 to complete server.js
// ========================================

// === TEACHER SEARCH ENDPOINT ===
app.get('/api/teacher/search', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const teacherEmail = req.user.email;
  const { query } = req.query;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
  }
  
  try {
    const teachers = db.get('teachers').value() || [];
    const teacher = teachers.find(t => t.email === teacherEmail);
    
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    
    const teacherCourses = teacher.courses || [];
    const assignmentSubs = db.get('assignmentSubmissions').value() || [];
    const queryLower = query.toLowerCase();
    
    const filteredCourses = teacherCourses.filter(course => 
      course.toLowerCase().includes(queryLower)
    );
    
    const filteredAssignments = assignmentSubs.filter(assignment => 
      teacherCourses.includes(assignment.course) &&
      (assignment.assignment?.toLowerCase().includes(queryLower) ||
       assignment.course?.toLowerCase().includes(queryLower) ||
       assignment.studentName?.toLowerCase().includes(queryLower))
    );
    
    res.json({
      success: true,
      courses: filteredCourses,
      assignments: filteredAssignments
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

app.delete('/api/teacher/assignments/:id/review', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const assignmentId = req.params.id;
  const teacherEmail = req.user.email;
  
  try {
    const teachers = db.get('teachers').value() || [];
    const teacher = teachers.find(t => t.email === teacherEmail);
    
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    
    const teacherCourses = teacher.courses || [];
    const assignmentSubs = db.get('assignmentSubmissions').value() || [];
    const assignment = assignmentSubs.find(a => a.id == assignmentId);
    
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    
    if (!teacherCourses.includes(assignment.course)) {
      return res.status(403).json({ success: false, error: 'Not authorized to review this assignment' });
    }
    
    db.get('assignmentSubmissions').remove({ id: assignment.id }).write();
    
    res.json({
      success: true,
      message: 'Assignment marked as reviewed and removed'
    });
  } catch (error) {
    console.error('Error marking assignment as reviewed:', error);
    res.status(500).json({ success: false, error: 'Failed to mark assignment as reviewed' });
  }
});

// === TEACHER COURSE ENDPOINTS ===
app.get('/teacher/courses', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const teacherEmail = req.user.email;
  
  try {
    const teachers = db.get('teachers').value() || [];
    const teacher = teachers.find(t => t.email === teacherEmail);
    
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }
    
    const teacherCourses = teacher.courses || [];
    const teacherDomain = teacher.domain || '';
    
    const courseDetailsMap = {
      "Introduction to Machine Learning": {
        description: "This course provides foundational understanding of key ML concepts, algorithms, and applications.",
        company: "Microsoft"
      },
      "Full Stack Development": {
        description: "Learn to build robust web applications using modern technologies.",
        company: "Google"
      },
      "Data Analytics": {
        description: "Master data analysis, visualization, and business intelligence.",
        company: "IBM"
      }
    };
    
    const getImageForDomain = (domain) => {
      const domainLower = domain.toLowerCase();
      if (domainLower.includes('data analytics')) return '../images/DataAnalytics.jpeg';
      if (domainLower.includes('software engineering')) return '../images/SE.jpeg';
      if (domainLower.includes('full stack')) return '../images/FSD.jpeg';
      if (domainLower.includes('devops')) return '../images/DevOps.jpeg';
      if (domainLower.includes('ui/ux')) return '../images/UI:UX.jpeg';
      return '../images/MachineLearning.jpeg';
    };
    
    const enrichedCourses = teacherCourses.map(courseName => ({
      name: courseName,
      domain: teacherDomain,
      description: courseDetailsMap[courseName]?.description || "",
      company: courseDetailsMap[courseName]?.company || "",
      image: getImageForDomain(teacherDomain)
    }));
    
    res.json({
      success: true,
      courses: enrichedCourses,
      domain: teacherDomain,
      teacher: {
        name: teacher.name,
        email: teacher.email
      }
    });
  } catch (error) {
    console.error('Error loading teacher courses:', error);
    res.status(500).json({ success: false, error: 'Failed to load courses' });
  }
});

// === ADMIN USER MANAGEMENT ===
app.get('/admin/users', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  const students = db.get('students').value() || [];
  const teachers = db.get('teachers').value() || [];
  
  const allUsers = [
    ...students.map(u => ({ ...u, type: 'student' })),
    ...teachers.map(u => ({ ...u, type: 'teacher' }))
  ];
  
  let filtered = allUsers;
  const { type, search } = req.query;
  
  if (type && type !== 'all') {
    filtered = filtered.filter(u => u.type === type);
  }
  if (search) {
    filtered = filtered.filter(u => 
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({ success: true, users: filtered, total: filtered.length });
});

app.post('/admin/users', requireAdmin, (req, res) => {
  const { type, name, email, password, phone } = req.body;
  
  if (!type || !name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const db = apiRouter.db;
  const collection = type === 'student' ? 'students' : 'teachers';
  
  try {
    const existingUsers = db.get(collection).value();
    if (existingUsers.some(u => u.email === email)) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    const newUser = {
      id: Date.now(),
      name,
      email,
      password,
      ...(type === 'student' ? { 
        phone: phone || '', 
        domain: 'General', 
        score: 0,
        assignments: { completed: 0, pending: 0, overdue: 0 },
        attendance: 0
      } : { 
        phone: phone || '',
        courses: []
      })
    };
    
    db.get(collection).push(newUser).write();
    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

app.patch('/admin/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const db = apiRouter.db;
  let updated = false;
  
  const students = db.get('students').value();
  const studentIdx = students.findIndex(u => u.id == id);
  if (studentIdx !== -1) {
    Object.assign(students[studentIdx], updates);
    db.get('students').write(students);
    updated = true;
  }
  
  const teachers = db.get('teachers').value();
  const teacherIdx = teachers.findIndex(u => u.id == id);
  if (teacherIdx !== -1) {
    Object.assign(teachers[teacherIdx], updates);
    db.get('teachers').write(teachers);
    updated = true;
  }
  
  if (!updated) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  
  res.json({ success: true, message: 'User updated successfully' });
});

app.delete('/admin/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = apiRouter.db;
  let deleted = false;
  
  const students = db.get('students').value();
  const studentIdx = students.findIndex(u => u.id == id);
  if (studentIdx !== -1) {
    db.get('students').remove({ id: parseInt(id) }).write();
    deleted = true;
  }
  
  const teachers = db.get('teachers').value();
  const teacherIdx = teachers.findIndex(u => u.id == id);
  if (teacherIdx !== -1) {
    db.get('teachers').remove({ id: parseInt(id) }).write();
    deleted = true;
  }
  
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  
  res.json({ success: true, message: 'User deleted successfully' });
});

// === COURSE APPLICATION ENDPOINTS ===
app.post('/applications/submit', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const applicationData = req.body;
  
  try {
    if (!applicationData.courseId || !applicationData.courseTitle) {
      return res.status(400).json({ success: false, error: 'Course information is required' });
    }
    
    const applications = db.get('applications').value() || [];
    const existingApplication = applications.find(
      app => app.studentId === req.user.id && app.courseId === applicationData.courseId
    );
    
    if (existingApplication) {
      return res.status(409).json({ 
        success: false, 
        error: 'You have already applied for this course' 
      });
    }
    
    const newApplication = {
      id: Date.now(),
      courseId: applicationData.courseId,
      courseTitle: applicationData.courseTitle,
      studentId: req.user.id,
      name: applicationData.name || req.user.name,
      email: applicationData.email || req.user.email,
      gender: applicationData.gender,
      dob: applicationData.dob,
      location: applicationData.location,
      education: applicationData.education,
      experience: applicationData.experience,
      submittedAt: new Date().toISOString(),
      status: 'approved'
    };
    
    db.get('applications').push(newApplication).write();
    
    const newEnrollment = {
      id: Date.now() + 1,
      studentId: req.user.id,
      studentName: applicationData.name || req.user.name,
      courseId: applicationData.courseId,
      courseTitle: applicationData.courseTitle,
      enrolledAt: new Date().toISOString(),
      status: 'active',
      progress: 0
    };
    
    db.get('enrollments').push(newEnrollment).write();
    
    res.status(201).json({
      success: true,
      message: 'Application submitted and approved! You are now enrolled.',
      application: newApplication,
      enrollment: newEnrollment
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, error: 'Failed to submit application' });
  }
});

app.get('/applications/student/:studentId', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const studentId = req.params.studentId;
  
  if (String(studentId) !== String(req.user.id)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const applications = db.get('applications').value() || [];
    const studentApplications = applications.filter(app => String(app.studentId) === String(studentId));
    
    res.json({
      success: true,
      applications: studentApplications,
      count: studentApplications.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch applications' });
  }
});

app.get('/applications', requireAdmin, (req, res) => {
  const db = apiRouter.db;
  
  try {
    const applications = db.get('applications').value() || [];
    const { status, courseId } = req.query;
    
    let filtered = applications;
    
    if (status) {
      filtered = filtered.filter(app => app.status === status);
    }
    
    if (courseId) {
      filtered = filtered.filter(app => String(app.courseId) === String(courseId));
    }
    
    res.json({
      success: true,
      applications: filtered,
      total: filtered.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch applications' });
  }
});

// === QUIZ ENDPOINTS ===
app.get('/quizzes/my-courses', requireAuth, (req, res) => {
  const db = apiRouter.db;
  
  try {
    const quizzes = db.get('quizzes').value() || [];
    
    let userCourses = [];
    
    if (req.user.type === 'teacher') {
      const teachers = db.get('teachers').value() || [];
      const teacher = teachers.find(t => t.email === req.user.email || t.id === req.user.id);
      if (teacher && teacher.courses) {
        userCourses = teacher.courses;
      }
    } else if (req.user.type === 'student') {
      const enrollments = db.get('enrollments').value() || [];
      const studentEnrollments = enrollments.filter(e => e.studentId === req.user.id);
      userCourses = studentEnrollments.map(e => e.courseTitle);
    }
    
    const userQuizzes = quizzes.filter(q => 
      userCourses.some(courseName => q.course && q.course.trim() === courseName.trim())
    );
    
    res.json({
      success: true,
      quizzes: userQuizzes,
      count: userQuizzes.length
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch quizzes' });
  }
});

app.post('/quizzes/create', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const quizData = req.body;
  
  try {
    if (!quizData.title || !quizData.course || !quizData.questions) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const newQuiz = {
      id: quizData.id || Date.now().toString(),
      title: quizData.title,
      course: quizData.course,
      instructions: quizData.instructions || '',
      duration: quizData.duration || 30,
      dueDate: quizData.dueDate,
      maxScore: quizData.maxScore || quizData.questions.length * 10,
      questions: quizData.questions,
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.get('quizzes').push(newQuiz).write();
    
    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz: newQuiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to create quiz' });
  }
});

app.delete('/quizzes/:quizId', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const quizId = req.params.quizId;
  
  try {
    const quizzes = db.get('quizzes').value() || [];
    const quiz = quizzes.find(q => q.id === quizId);
    
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }
    
    if (quiz.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    db.get('quizzes').remove({ id: quizId }).write();
    
    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to delete quiz' });
  }
});

// === QUIZ SUBMISSION ENDPOINTS ===
app.get('/quiz-submissions/my-submissions', requireAuth, (req, res) => {
  const db = apiRouter.db;
  
  try {
    const submissions = db.get('quizSubmissions').value() || [];
    let userSubmissions = [];
    
    if (req.user.type === 'student') {
      userSubmissions = submissions.filter(s => s.studentId === req.user.id);
    } else if (req.user.type === 'teacher') {
      const teachers = db.get('teachers').value() || [];
      const teacher = teachers.find(t => t.email === req.user.email || t.id === req.user.id);
      
      if (teacher && teacher.courses) {
        userSubmissions = submissions.filter(s => 
          teacher.courses.some(course => s.course === course)
        );
      }
    }
    
    res.json({
      success: true,
      submissions: userSubmissions,
      count: userSubmissions.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

app.post('/quiz-submissions/submit', requireStudent, (req, res) => {
  const db = apiRouter.db;
  const submissionData = req.body;
  
  try {
    if (!submissionData.quizId || !submissionData.answers) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const submissions = db.get('quizSubmissions').value() || [];
    const existingSubmission = submissions.find(
      sub => sub.studentId === req.user.id && sub.quizId === submissionData.quizId
    );
    
    if (existingSubmission) {
      return res.status(409).json({ 
        success: false, 
        error: 'You have already submitted this quiz' 
      });
    }
    
    const newSubmission = {
      id: submissionData.id || Date.now().toString(),
      quizId: submissionData.quizId,
      studentId: req.user.id,
      studentName: req.user.name || submissionData.studentName,
      course: submissionData.course,
      answers: submissionData.answers,
      score: submissionData.score,
      maxScore: submissionData.maxScore,
      submittedAt: new Date().toISOString(),
      status: submissionData.status || 'graded',
      feedback: submissionData.feedback || ''
    };
    
    db.get('quizSubmissions').push(newSubmission).write();
    
    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      submission: newSubmission
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to submit quiz' });
  }
});

app.patch('/quiz-submissions/grade/:submissionId', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const submissionId = req.params.submissionId;
  const { score, feedback, status } = req.body;
  
  try {
    const submissions = db.get('quizSubmissions').value() || [];
    const submissionIdx = submissions.findIndex(s => s.id === submissionId);
    
    if (submissionIdx === -1) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    
    if (score !== undefined) submissions[submissionIdx].score = score;
    if (feedback !== undefined) submissions[submissionIdx].feedback = feedback;
    if (status !== undefined) submissions[submissionIdx].status = status;
    
    submissions[submissionIdx].gradedAt = new Date().toISOString();
    submissions[submissionIdx].gradedBy = req.user.id;
    
    db.get('quizSubmissions').write();
    
    res.json({
      success: true,
      message: 'Submission graded successfully',
      submission: submissions[submissionIdx]
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ success: false, error: 'Failed to grade submission' });
  }
});

// === ASSIGNMENT ENDPOINTS ===
app.get('/assignments/course', requireAuth, (req, res) => {
  const db = apiRouter.db;
  
  try {
    const assignments = db.get('assignments').value() || [];
    
    let userCourses = [];
    
    if (req.user.type === 'teacher') {
      const teachers = db.get('teachers').value() || [];
      const teacher = teachers.find(t => t.email === req.user.email || t.id === req.user.id);
      if (teacher && teacher.courses) {
        userCourses = teacher.courses;
      }
    } else if (req.user.type === 'student') {
      const enrollments = db.get('enrollments').value() || [];
      const studentEnrollments = enrollments.filter(e => e.studentId === req.user.id);
      userCourses = studentEnrollments.map(e => e.courseTitle);
    }
    
    const userAssignments = assignments.filter(a => 
      userCourses.some(courseName => a.course && a.course.trim() === courseName.trim())
    );
    
    if (req.user.type === 'student') {
      const assignmentSubmissions = db.get('assignmentSubmissions').value() || [];
      const enrichedAssignments = userAssignments.map(assignment => {
        const submission = assignmentSubmissions.find(
          sub => sub.assignmentId === assignment.id && sub.studentId === req.user.id
        );
        return {
          ...assignment,
          status: submission ? 'completed' : 'pending',
          submissionId: submission ? submission.id : null
        };
      });
      
      return res.json({
        success: true,
        assignments: enrichedAssignments,
        count: enrichedAssignments.length
      });
    }
    
    res.json({
      success: true,
      assignments: userAssignments,
      count: userAssignments.length
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

// === TEACHER CONTENT MANAGEMENT ENDPOINTS ===
app.get('/api/teacher/quizzes', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const { course } = req.query;
  
  try {
    const quizzes = db.get('quizzes').value() || [];
    
    if (course) {
      const courseQuizzes = quizzes.filter(q => q.course === course);
      return res.json({
        success: true,
        quizzes: courseQuizzes
      });
    }
    
    res.json({
      success: true,
      quizzes: quizzes
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch quizzes' });
  }
});

app.post('/api/teacher/quizzes', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const quizData = req.body;
  
  try {
    if (!quizData.title || !quizData.course) {
      return res.status(400).json({ success: false, error: 'Title and course are required' });
    }
    
    const newQuiz = {
      id: Date.now().toString(),
      title: quizData.title,
      description: quizData.description || '',
      course: quizData.course,
      due: quizData.due || '',
      dueDate: quizData.dueDate || quizData.due || '',
      maxScore: quizData.maxScore || 100,
      duration: quizData.duration || 30,
      instructions: quizData.instructions || '',
      questions: quizData.questions || [],
      image: quizData.image || '../images/quiz.jpeg',
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.get('quizzes').push(newQuiz).write();
    
    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz: newQuiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to create quiz' });
  }
});

app.patch('/api/teacher/quizzes/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const quizId = req.params.id;
  const updateData = req.body;
  
  try {
    const quizzes = db.get('quizzes').value() || [];
    const quizIndex = quizzes.findIndex(q => q.id === quizId);
    
    if (quizIndex === -1) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }
    
    const updatedQuiz = {
      ...quizzes[quizIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    db.get('quizzes').find({ id: quizId }).assign(updatedQuiz).write();
    
    res.json({
      success: true,
      message: 'Quiz updated successfully',
      quiz: updatedQuiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to update quiz' });
  }
});

app.delete('/api/teacher/quizzes/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const quizId = req.params.id;
  
  try {
    const quiz = db.get('quizzes').find({ id: quizId }).value();
    
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }
    
    db.get('quizzes').remove({ id: quizId }).write();
    
    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to delete quiz' });
  }
});

app.get('/api/teacher/assignments', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const { course } = req.query;
  
  try {
    const assignments = db.get('assignments').value() || [];
    
    if (course) {
      const courseAssignments = assignments.filter(a => a.course === course);
      return res.json({
        success: true,
        assignments: courseAssignments
      });
    }
    
    res.json({
      success: true,
      assignments: assignments
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

app.post('/api/teacher/assignments', requireTeacher, upload.single('file'), (req, res) => {
  const db = apiRouter.db;
  const assignmentData = req.body;
  
  try {
    if (!assignmentData.title && !assignmentData.assignment) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    if (!assignmentData.course) {
      return res.status(400).json({ success: false, error: 'Course is required' });
    }
    
    const newAssignment = {
      id: Date.now().toString(),
      assignment: assignmentData.assignment || assignmentData.title,
      title: assignmentData.title || assignmentData.assignment,
      description: assignmentData.description || '',
      course: assignmentData.course,
      date: assignmentData.date || assignmentData.dueDate || '',
      dueDate: assignmentData.dueDate || assignmentData.date || '',
      instructions: assignmentData.instructions || '',
      pdf: assignmentData.pdf || (req.file ? `/uploads/${req.file.filename}` : ''),
      status: 'active',
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.get('assignments').push(newAssignment).write();
    
    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      assignment: newAssignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to create assignment' });
  }
});

app.patch('/api/teacher/assignments/:id', requireTeacher, upload.single('file'), (req, res) => {
  const db = apiRouter.db;
  const assignmentId = req.params.id;
  const updateData = req.body;
  
  try {
    const assignment = db.get('assignments').find({ id: assignmentId }).value();
    
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    
    if (req.file) {
      updateData.pdf = `/uploads/${req.file.filename}`;
    }
    
    const updatedAssignment = {
      ...assignment,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    db.get('assignments').find({ id: assignmentId }).assign(updatedAssignment).write();
    
    res.json({
      success: true,
      message: 'Assignment updated successfully',
      assignment: updatedAssignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
});

app.delete('/api/teacher/assignments/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const assignmentId = req.params.id;
  
  try {
    const assignment = db.get('assignments').find({ id: assignmentId }).value();
    
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    
    db.get('assignments').remove({ id: assignmentId }).write();
    
    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete assignment' });
  }
});

app.get('/api/teacher/resources', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const { course } = req.query;
  
  try {
    const materials = db.get('materials').value() || [];
    
    if (course) {
      const courseResources = materials.filter(m => m.course === course || !m.course);
      return res.json({
        success: true,
        resources: courseResources
      });
    }
    
    res.json({
      success: true,
      resources: materials
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch resources' });
  }
});

app.post('/api/teacher/resources', requireTeacher, upload.single('file'), (req, res) => {
  const db = apiRouter.db;
  const resourceData = req.body;
  
  try {
    if (!resourceData.title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    const newResource = {
      id: Date.now().toString(),
      title: resourceData.title,
      description: resourceData.description || '',
      course: resourceData.course || '',
      pdf: resourceData.pdf || (req.file ? `/uploads/${req.file.filename}` : ''),
      image: resourceData.image || '../images/materials.jpeg',
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.get('materials').push(newResource).write();
    
    res.status(201).json({
      success: true,
      message: 'Resource created successfully',
      resource: newResource
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ success: false, error: 'Failed to create resource' });
  }
});

app.patch('/api/teacher/resources/:id', requireTeacher, upload.single('file'), (req, res) => {
  const db = apiRouter.db;
  const resourceId = req.params.id;
  const updateData = req.body;
  
  try {
    const resource = db.get('materials').find({ id: resourceId }).value();
    
    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }
    
    if (req.file) {
      updateData.pdf = `/uploads/${req.file.filename}`;
    }
    
    const updatedResource = {
      ...resource,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    db.get('materials').find({ id: resourceId }).assign(updatedResource).write();
    
    res.json({
      success: true,
      message: 'Resource updated successfully',
      resource: updatedResource
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ success: false, error: 'Failed to update resource' });
  }
});

app.delete('/api/teacher/resources/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const resourceId = req.params.id;
  
  try {
    const resource = db.get('materials').find({ id: resourceId }).value();
    
    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }
    
    db.get('materials').remove({ id: resourceId }).write();
    
    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ success: false, error: 'Failed to delete resource' });
  }
});

app.get('/api/teacher/sessions', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const { course } = req.query;
  
  try {
    const videoSessions = db.get('videoSessions').value() || [];
    
    if (course) {
      const courseSessions = videoSessions.filter(v => v.course === course || !v.course);
      return res.json({
        success: true,
        sessions: courseSessions
      });
    }
    
    res.json({
      success: true,
      sessions: videoSessions
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

app.post('/api/teacher/sessions', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const sessionData = req.body;
  
  try {
    if (!sessionData.title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    const newSession = {
      id: Date.now().toString(),
      title: sessionData.title,
      description: sessionData.description || '',
      course: sessionData.course || '',
      video: sessionData.video || '',
      image: sessionData.image || '../images/videoSessions.jpeg',
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    
    db.get('videoSessions').push(newSession).write();
    
    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      session: newSession
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

app.patch('/api/teacher/sessions/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const sessionId = req.params.id;
  const updateData = req.body;
  
  try {
    const session = db.get('videoSessions').find({ id: sessionId }).value();
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const updatedSession = {
      ...session,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    db.get('videoSessions').find({ id: sessionId }).assign(updatedSession).write();
    
    res.json({
      success: true,
      message: 'Session updated successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, error: 'Failed to update session' });
  }
});

app.delete('/api/teacher/sessions/:id', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const sessionId = req.params.id;
  
  try {
    const session = db.get('videoSessions').find({ id: sessionId }).value();
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    db.get('videoSessions').remove({ id: sessionId }).write();
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

app.get('/api/teacher/quiz-submissions', requireTeacher, (req, res) => {
  const db = apiRouter.db;
  const { quizId, course } = req.query;
  
  try {
    const submissions = db.get('quizSubmissions').value() || [];
    
    let filtered = submissions;
    
    if (quizId) {
      filtered = filtered.filter(s => s.quizId === quizId);
    }
    
    if (course) {
      filtered = filtered.filter(s => s.course === course);
    }
    
    res.json({
      success: true,
      submissions: filtered
    });
  } catch (error) {
    console.error('Error fetching quiz submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

// Serve HTML files
app.get('/HTML/signin.html', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'signin.html')));
app.get('/HTML/login.html', (req, res) => res.sendFile(path.join(__dirname, 'HTML', 'login.html')));

// Mount JSON Server (AFTER custom routes)
app.use('/api', middlewares, apiRouter);

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'HTML', 'index.html'));
});

// Start server (THIS MUST BE THE LAST LINE)
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ========================================
// END OF PART 4 - SERVER.JS COMPLETE
// ========================================