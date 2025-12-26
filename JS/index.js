// Global variables
let courseData = [];
const maxDisplayCount = 10; // Show only 10 courses initially

// DOM elements
const courseSection = document.querySelector(".course-cards");
const courseList = document.querySelector(".course-list");
const searchbar = document.querySelector(".searchbar");
const loginButton = document.querySelector(".btn1");
const notificationBell = document.querySelector('.notif');

// Initialize the application
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check access control first
    if (!checkAccessControl()) {
      return;
    }
    
    await initializeApp();
  } catch (error) {
    console.error("Application initialization failed:", error);
    showErrorMessage("Failed to load application. Please refresh the page.");
  }
});

// Access control function
function checkAccessControl() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (user) {
    if (user.type === "teacher") {
      alert("Teachers should access their dashboard instead.");
      window.location.href = "/HTML/teacherIndex.html";
      return false;
    } else if (user.type === "admin") {
      alert("Admins should access the admin panel instead.");
      window.location.href = "/HTML/adminIndex.html";
      return false;
    }
  }
  return true;
}

async function initializeApp() {
  showLoadingState();
  
  await loadCourseData();
  
  setupNavigation();
  setupSearch();
  setupNotifications();
  
  hideLoadingState();
}

async function loadCourseData() {
  try {
    // Call Node.js backend API for courses
    const response = await fetch('/courses', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Handle both response formats
    if (result.success && result.courses) {
      courseData = result.courses;
    } else if (Array.isArray(result)) {
      courseData = result;
    } else {
      throw new Error('Invalid response format');
    }
    
    console.log(`✅ Loaded ${courseData.length} courses from backend`);
    
    renderDomains();
    renderCourses(getLimitedCourses(courseData));
    
  } catch (error) {
    console.error("❌ Error loading courses:", error);
    
    // Try fallback to json-server endpoint
    try {
      const fallbackResponse = await fetch('/api/courses');
      if (fallbackResponse.ok) {
        courseData = await fallbackResponse.json();
        console.log("📦 Using json-server fallback");
        renderDomains();
        renderCourses(getLimitedCourses(courseData));
      } else {
        throw new Error("Fallback also failed");
      }
    } catch (fallbackError) {
      console.error("❌ Fallback failed:", fallbackError);
      showErrorMessage("Unable to load courses. Please check your connection and try again.");
    }
  }
}

function getLimitedCourses(courses) {
  return courses.slice(0, maxDisplayCount);
}

function renderDomains() {
  if (!courseList) return;
  
  courseList.innerHTML = "";

  // Add "All Courses" option
  const allDomains = document.createElement("a");
  allDomains.href = "#";
  allDomains.textContent = "All Courses";
  allDomains.className = "domain-link active";
  allDomains.onclick = (e) => {
    e.preventDefault();
    setActiveDomain(allDomains);
    renderCourses(getLimitedCourses(courseData));
  };
  courseList.appendChild(allDomains);

  // Get unique domains
  const domains = [...new Set(courseData.map(course => course.domain))].filter(Boolean);
  
  domains.forEach(domain => {
    const domainLink = document.createElement("a");
    domainLink.href = "#";
    domainLink.textContent = domain;
    domainLink.className = "domain-link";
    domainLink.onclick = (e) => {
      e.preventDefault();
      setActiveDomain(domainLink);
      const filtered = courseData.filter(c => c.domain === domain);
      renderCourses(getLimitedCourses(filtered));
    };
    courseList.appendChild(domainLink);
  });
}

function setActiveDomain(activeLink) {
  document.querySelectorAll('.domain-link').forEach(link => {
    link.classList.remove('active');
  });
  activeLink.classList.add('active');
}

function renderCourses(courses) {
  if (!courseSection) return;
  
  courseSection.innerHTML = "";
  
  if (courses.length === 0) {
    courseSection.innerHTML = `
      <div class="no-results">
        <p>No courses found matching your criteria</p>
        <button onclick="resetFilters()" class="btn">Show All Courses</button>
      </div>
    `;
    return;
  }

  let row = document.createElement("div");
  row.className = "cards-row";

  courses.forEach((course, i) => {
    const card = createCourseCard(course);
    row.appendChild(card);

    if ((i + 1) % 3 === 0 || i === courses.length - 1) {
      courseSection.appendChild(row);
      if (i !== courses.length - 1) {
        row = document.createElement("div");
        row.className = "cards-row";
      }
    }
  });
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";
  
  const imageSrc = course.image || course.img || "../images/Consultant.jpeg";
  const imageAlt = course.title || "Course Image";
  
  card.innerHTML = `
    <div class="card-image">
      <img src="${imageSrc}" alt="${imageAlt}" class="course-img" 
           onerror="this.src='../images/Consultant.jpeg'">
    </div>
    <div class="card-content">
      <h4 class="course-title">${course.title || 'Untitled Course'}</h4>
      <p class="course-provider"><b>Provider:</b> ${course.provider || course.coordinator || 'LearnEdge'}</p>
      <p class="course-date"><b>Start Date:</b> ${course.startDate || "Coming Soon"}</p>
      <p class="course-duration"><b>Duration:</b> ${course.duration || "TBD"}</p>
      <p class="course-level"><b>Level:</b> ${course.level || "All Levels"}</p>
      <div class="card-actions">
        <a href="/HTML/courseView.html?id=${course.id}" class="view-btn-link">
          <button class="view-btn">View More</button>
        </a>
        ${course.price ? `<span class="course-price">${course.price}</span>` : ''}
      </div>
    </div>
  `;
  
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-5px)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
  });
  
  return card;
}

function setupSearch() {
  if (!searchbar) return;
  
  let searchTimeout;
  
  searchbar.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
      const keyword = e.target.value.toLowerCase().trim();
      
      if (keyword.length === 0) {
        renderCourses(getLimitedCourses(courseData));
        return;
      }
      
      const filtered = courseData.filter(course => {
        const title = (course.title || '').toLowerCase();
        const domain = (course.domain || '').toLowerCase();
        const provider = (course.provider || course.coordinator || '').toLowerCase();
        const description = (course.description || '').toLowerCase();
        
        return title.includes(keyword) || 
               domain.includes(keyword) || 
               provider.includes(keyword) ||
               description.includes(keyword);
      });
      
      renderCourses(filtered);
    }, 300);
  });
  
  searchbar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchbar.value = '';
      renderCourses(getLimitedCourses(courseData));
    }
  });
}

function setupNavigation() {
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

function setupNotifications() {
  if (!notificationBell) return;
  
  let notificationCount = document.querySelector('.notification-count');
  if (!notificationCount) {
    notificationCount = document.createElement('span');
    notificationCount.className = 'notification-count';
    notificationBell.appendChild(notificationCount);
  }

  notificationBell.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    document.querySelectorAll('.notification-dropdown').forEach(dropdown => dropdown.remove());
    
    await showNotificationDropdown();
  };

  document.addEventListener('click', (e) => {
    if (!notificationBell.contains(e.target)) {
      document.querySelectorAll('.notification-dropdown').forEach(dropdown => dropdown.remove());
    }
  });

  if (localStorage.getItem('loggedInUser')) {
    updateNotificationCount();
  }
}

async function showNotificationDropdown() {
  try {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) {
      showNotificationMessage("Please log in to view notifications");
      return;
    }
    
    // Call Node.js backend API for notifications
    const response = await fetch('/notifications', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(user)
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load notifications');
    }
    
    const notifications = result.notifications || [];
    const unreadNotifications = notifications.filter(n => !n.read);

    const notificationDropdown = document.createElement('div');
    notificationDropdown.className = 'notification-dropdown';

    if (notifications.length === 0) {
      notificationDropdown.innerHTML = '<p class="no-notifications">No notifications yet</p>';
    } else {
      notifications.forEach(notif => {
        const notifElement = document.createElement('div');
        notifElement.className = `notification-item ${notif.read ? 'read' : 'unread'}`;
        notifElement.innerHTML = `
          <div class="notification-content">
            <p>${notif.message}</p>
            <small>${formatNotificationTime(notif.timestamp)}</small>
          </div>
          ${notif.read ? '' : '<div class="unread-dot"></div>'}
        `;
        
        if (!notif.read) {
          notifElement.addEventListener('click', async () => {
            await markNotificationAsRead(notif.id);
            notifElement.classList.remove('unread');
            notifElement.classList.add('read');
            notifElement.querySelector('.unread-dot')?.remove();
            updateNotificationCount();
          });
        }
        
        notificationDropdown.appendChild(notifElement);
      });
      
      if (unreadNotifications.length > 0) {
        const markAllRead = document.createElement('button');
        markAllRead.className = 'mark-all-read';
        markAllRead.textContent = 'Mark all as read';
        markAllRead.onclick = async () => {
          await markAllNotificationsAsRead();
          notificationDropdown.remove();
          await showNotificationDropdown();
        };
        notificationDropdown.appendChild(markAllRead);
      }
    }
    
    notificationBell.appendChild(notificationDropdown);
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    showNotificationMessage("Failed to load notifications");
  }
}

function formatNotificationTime(timestamp) {
  const now = new Date();
  const notifDate = new Date(timestamp);
  const diffInSeconds = Math.floor((now - notifDate) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${diffInSeconds >= 7200 ? 's' : ''} ago`;
  return notifDate.toLocaleDateString();
}

async function markNotificationAsRead(notificationId) {
  try {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    
    await fetch(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(user)
      }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsAsRead() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) return;

  try {
    await fetch('/notifications/mark-all-read', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(user)
      }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

async function updateNotificationCount() {
  try {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user) return;
    
    const response = await fetch('/notifications/unread-count', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(user)
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      const notificationCount = document.querySelector('.notification-count');
      if (notificationCount) {
        if (result.count > 0) {
          notificationCount.textContent = result.count;
          notificationCount.style.display = 'block';
        } else {
          notificationCount.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Error updating notification count:', error);
  }
}

function logoutUser() {
  localStorage.removeItem("loggedInUser");
  alert("Logged out successfully!");
  window.location.href = "/HTML/login.html";
}

function resetFilters() {
  if (searchbar) {
    searchbar.value = '';
  }
  setActiveDomain(document.querySelector('.domain-link'));
  renderCourses(getLimitedCourses(courseData));
}

function showLoadingState() {
  if (courseSection) {
    courseSection.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading courses...</p>
      </div>
    `;
  }
}

function hideLoadingState() {
  // Loading state will be replaced when courses are rendered
}

function showErrorMessage(message) {
  if (courseSection) {
    courseSection.innerHTML = `
      <div class="error-state">
        <h3>⚠️ Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn">Retry</button>
      </div>
    `;
  }
}

function showNotificationMessage(message) {
  const notificationDropdown = document.createElement('div');
  notificationDropdown.className = 'notification-dropdown';
  notificationDropdown.innerHTML = `<p class="notification-message">${message}</p>`;
  notificationBell.appendChild(notificationDropdown);
  
  setTimeout(() => {
    notificationDropdown.remove();
  }, 3000);
}

// Export functions for global access
window.resetFilters = resetFilters;