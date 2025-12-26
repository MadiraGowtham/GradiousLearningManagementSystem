// Global variables
let courseData = [];
let visibleCount = 6;
let currentFilters = {
  domain: '',
  coordinator: '',
  level: '',
  duration: '',
  search: ''
};

// DOM elements
const courseSection = document.querySelector(".course-cards");
const searchbar = document.querySelector(".searchbar");
const selectors = document.querySelectorAll(".select");
const loadMoreBtn = document.querySelector(".load-more-btn");
const loginButton = document.querySelector(".btn1");

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
    // If user is logged in, check their type
    if (user.type === "teacher") {
      alert("Teachers should access their dashboard instead.");
      window.location.href = "/HTML/teacherIndex.html";
      return false;
    } else if (user.type === "admin") {
      alert("Admins should access the admin panel instead.");
      window.location.href = "/HTML/adminIndex.html";
      return false;
    }
    // Students can access this page
  }
  // Non-logged in users can also access this page
  return true;
}

async function initializeApp() {
  // Show loading state
  showLoadingState();
  
  // Load course data from Node.js backend
  await loadCourseData();
  
  // Setup UI components
  setupNavigation();
  setupFilters();
  setupSearch();
  
  // Hide loading state
  hideLoadingState();
}

async function loadCourseData() {
  try {
    // Call Node.js backend API - No authentication required (public endpoint)
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
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load courses');
    }
    
    courseData = result.courses || [];
    console.log(`✅ Loaded ${courseData.length} courses from server`);
    
    // Setup the UI with filter options from backend
    if (result.filterOptions) {
      populateSelectOptionsFromBackend(result.filterOptions);
    } else {
      populateSelectOptions();
    }
    
    applyFilters();
    
  } catch (error) {
    console.error("❌ Error loading courses:", error);
    showErrorMessage("Unable to load courses. Please check your connection and try again.");
  }
}

function populateSelectOptionsFromBackend(filterOptions) {
  if (!selectors || selectors.length === 0) return;
  
  const { domains, coordinators, levels, durations } = filterOptions;

  // Domain filter
  selectors[0].innerHTML = `<option value="">All Domains</option>` + 
    (domains || []).map(d => `<option value="${d}">${d}</option>`).join("");

  // Coordinator filter
  selectors[1].innerHTML = `<option value="">All Coordinators</option>` + 
    (coordinators || []).map(c => `<option value="${c}">${c}</option>`).join("");

  // Level filter
  selectors[2].innerHTML = `<option value="">All Levels</option>` + 
    (levels || []).map(l => `<option value="${l}">${l}</option>`).join("");

  // Duration filter
  selectors[3].innerHTML = `<option value="">All Durations</option>` + 
    (durations || []).map(d => `<option value="${d}">${d}</option>`).join("");
}

function populateSelectOptions() {
  if (!selectors || selectors.length === 0) return;
  
  const domains = [...new Set(courseData.map(c => c.domain))].filter(Boolean);
  const coordinators = [...new Set(courseData.map(c => c.coordinator))].filter(Boolean);
  const levels = [...new Set(courseData.map(c => c.level))].filter(Boolean);
  const durations = [...new Set(courseData.map(c => c.duration))].filter(Boolean);

  // Domain filter
  selectors[0].innerHTML = `<option value="">All Domains</option>` + 
    domains.map(d => `<option value="${d}">${d}</option>`).join("");

  // Coordinator filter
  selectors[1].innerHTML = `<option value="">All Coordinators</option>` + 
    coordinators.map(c => `<option value="${c}">${c}</option>`).join("");

  // Level filter
  selectors[2].innerHTML = `<option value="">All Levels</option>` + 
    levels.map(l => `<option value="${l}">${l}</option>`).join("");

  // Duration filter
  selectors[3].innerHTML = `<option value="">All Durations</option>` + 
    durations.map(d => `<option value="${d}">${d}</option>`).join("");
}

function setupFilters() {
  if (!selectors) return;
  
  selectors.forEach((select, index) => {
    select.addEventListener("change", async (e) => {
      const filterType = ['domain', 'coordinator', 'level', 'duration'][index];
      currentFilters[filterType] = e.target.value;
      visibleCount = 6;
      
      // Fetch filtered data from backend
      await fetchFilteredCourses();
    });
  });
}

function setupSearch() {
  if (!searchbar) return;
  
  let searchTimeout;
  
  searchbar.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(async () => {
      currentFilters.search = e.target.value.toLowerCase().trim();
      visibleCount = 6;
      
      // Fetch filtered data from backend
      await fetchFilteredCourses();
    }, 300);
  });
  
  // Clear search with Escape key
  searchbar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchbar.value = '';
      currentFilters.search = '';
      fetchFilteredCourses();
    }
  });
}

async function fetchFilteredCourses() {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (currentFilters.domain) queryParams.append('domain', currentFilters.domain);
    if (currentFilters.coordinator) queryParams.append('coordinator', currentFilters.coordinator);
    if (currentFilters.level) queryParams.append('level', currentFilters.level);
    if (currentFilters.duration) queryParams.append('duration', currentFilters.duration);
    if (currentFilters.search) queryParams.append('search', currentFilters.search);
    
    // Call Node.js backend with filters
    const response = await fetch(`/courses?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      courseData = result.courses || [];
      applyFilters();
    }
    
  } catch (error) {
    console.error("Error fetching filtered courses:", error);
  }
}

function applyFilters() {
  // Since filtering is now done on backend, just render the courses
  renderCourses(courseData.slice(0, visibleCount));
  
  // Show/hide load more button
  if (loadMoreBtn) {
    loadMoreBtn.style.display = courseData.length > visibleCount ? "block" : "none";
    loadMoreBtn.onclick = () => {
      visibleCount += 6;
      renderCourses(courseData.slice(0, visibleCount));
      if (visibleCount >= courseData.length) {
        loadMoreBtn.style.display = "none";
      }
    };
  }
  
  // Show filter summary
  showFilterSummary(courseData.length);
}

function renderCourses(courses) {
  if (!courseSection) return;
  
  courseSection.innerHTML = "";

  if (courses.length === 0) {
    courseSection.innerHTML = `
      <div class="no-results">
        <h3>No courses found</h3>
        <p>Try adjusting your filters or search terms</p>
        <button onclick="resetAllFilters()" class="btn">Clear All Filters</button>
      </div>
    `;
    return;
  }

  let row = document.createElement("div");
  row.className = "cards-row";

  courses.forEach((course, index) => {
    const card = createCourseCard(course);
    row.appendChild(card);

    // Create new row every 3 cards
    if ((index + 1) % 3 === 0) {
      courseSection.appendChild(row);
      row = document.createElement("div");
      row.className = "cards-row";
    }
  });

  // Add remaining cards
  if (row.children.length > 0) {
    courseSection.appendChild(row);
  }
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";
  
  // Handle missing images gracefully
  const imageSrc = course.image || course.img || "../images/Consultant.jpeg";
  const imageAlt = course.title || "Course Image";
  
  card.innerHTML = `
    <div class="card-image">
      <img src="${imageSrc}" alt="${imageAlt}" class="course-img" 
           onerror="this.src='../images/Consultant.jpeg'">
      ${course.enrolled ? `<div class="enrolled-badge">👥 ${course.enrolled}</div>` : ''}
    </div>
    <div class="card-content">
      <h4 class="course-title">${course.title || 'Untitled Course'}</h4>
      <p class="course-provider"><b>Provider:</b> ${course.coordinator || 'LearnEdge'}</p>
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
  
  // Add hover effects
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-5px)';
    card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  });
  
  return card;
}

function setupNavigation() {
  if (!loginButton) return;
  
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (user) {
    // Create profile dropdown
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
    
    // Add logout functionality
    document.getElementById("logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
}

function showFilterSummary(filteredCount) {
  // Remove existing filter summary
  const existingSummary = document.querySelector('.filter-summary');
  if (existingSummary) {
    existingSummary.remove();
  }
  
  // Create new filter summary
  const summary = document.createElement('div');
  summary.className = 'filter-summary';
  summary.innerHTML = `<p>Showing ${filteredCount} course${filteredCount !== 1 ? 's' : ''}</p>`;
  
  // Insert before course cards
  if (courseSection) {
    courseSection.parentNode.insertBefore(summary, courseSection);
  }
}

async function resetAllFilters() {
  // Reset search
  if (searchbar) {
    searchbar.value = '';
  }
  
  // Reset selectors
  selectors.forEach(select => {
    select.value = '';
  });
  
  // Reset current filters
  currentFilters = {
    domain: '',
    coordinator: '',
    level: '',
    duration: '',
    search: ''
  };
  
  // Reset visible count
  visibleCount = 6;
  
  // Reload all courses from backend
  await loadCourseData();
}

function logoutUser() {
  localStorage.removeItem("loggedInUser");
  alert("Logged out successfully!");
  window.location.href = "/HTML/login.html";
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

// Export functions for global access
window.resetAllFilters = resetAllFilters;