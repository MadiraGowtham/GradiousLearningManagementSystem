// Access control - only teachers can access this page
function checkTeacherAccess() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (!user) {
    alert("Please log in to access this page.");
    window.location.href = "/HTML/login.html";
    return false;
  }
  
  if (user.type !== "teacher") {
    alert("This page is only accessible to teachers.");
    if (user.type === "student") {
      window.location.href = "/HTML/index.html";
    } else if (user.type === "admin") {
      window.location.href = "/HTML/adminIndex.html";
    } else {
      window.location.href = "/HTML/login.html";
    }
    return false;
  }
  
  return true;
}

// Setup navigation with profile dropdown
function setupNavigation() {
  const loginButton = document.getElementById("loginButton");
  if (!loginButton) return;
  
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (user) {
    const names = user.name.split(" ");
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
    
    document.getElementById("logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
}

// Global logout function
function logoutUser() {
  localStorage.clear();
  sessionStorage.clear();
  alert("You have been logged out.");
  window.location.href = "/HTML/login.html";
}

// Setup navigation when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (!checkTeacherAccess()) {
    return;
  }
  
  setupNavigation();
  loadTeacherCourses();
});

// Load teacher courses from Node.js backend
async function loadTeacherCourses() {
  const coursesContainer = document.getElementById('coursesContainer');
  const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
  
  if (!loggedInUser || loggedInUser.type !== 'teacher') {
    coursesContainer.innerHTML = '<p class="no-courses">Please log in as a teacher to view courses.</p>';
    return;
  }
  
  try {
    // Call Node.js backend API - passes user in header for authentication
    const response = await fetch('/teacher/courses', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(loggedInUser)
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load courses');
    }
    
    if (!data.success) {
      coursesContainer.innerHTML = `<p class="no-courses">${data.error || 'Failed to load courses'}</p>`;
      return;
    }
    
    const { courses, domain } = data;
    
    if (courses.length === 0) {
      coursesContainer.innerHTML = '<p class="no-courses">No courses found for this teacher.</p>';
      return;
    }
    
    // Update page title with domain
    if (domain) {
      document.title = `${domain} - My Courses`;
    }
    
    coursesContainer.innerHTML = '';
    
    // Render each course
    courses.forEach(course => {
      const courseDiv = document.createElement('div');
      courseDiv.className = 'course';
      
      courseDiv.innerHTML = `
        <div class="info">
          <img src="${course.image}" alt="${course.name}" class="course-img">
          <h3>${course.name}</h3>
        </div>
        <div class="buttons">
          <button class="btn" onclick="viewCourse('${course.name}', '${course.domain}', '${course.description}', '${course.company}')">View Course</button>
          <button class="btn" onclick="uploadMaterial('${course.name}', '${course.domain}')">Upload Material</button>
          <button class="btn" onclick="viewSubmissions('${course.name}', '${course.domain}')">View Submissions</button>
        </div>
      `;
      
      coursesContainer.appendChild(courseDiv);
    });
    
  } catch (error) {
    console.error('Error loading teacher courses:', error);
    coursesContainer.innerHTML = '<p class="no-courses">Error loading courses. Please try again later.</p>';
  }
}

// View course details
function viewCourse(courseName, domain, description, company) {
  localStorage.setItem('selectedCourse', courseName);
  localStorage.setItem('selectedDomain', domain);
  localStorage.setItem('selectedDescription', description || "");
  localStorage.setItem('selectedCompany', company || "");
  window.location.href = '/HTML/teacherCourse.html';
}

// Upload material for a course
function uploadMaterial(courseName, domain) {
  localStorage.setItem('selectedCourse', courseName);
  localStorage.setItem('selectedDomain', domain);
  viewCourse(courseName, domain, '', '');
}

// View submissions for a course
function viewSubmissions(courseName, domain) {
  localStorage.setItem('selectedCourse', courseName);
  localStorage.setItem('selectedDomain', domain);
  viewCourse(courseName, domain, '', '');
}