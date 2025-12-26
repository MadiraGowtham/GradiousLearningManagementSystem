const locationData = {
  India: {
    "Karnataka": ["Bangalore", "Mysore", "Hubli"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"]
  },
  USA: {
    "California": ["Los Angeles", "San Francisco", "San Diego"],
    "New York": ["New York City", "Buffalo"],
    "Texas": ["Houston", "Dallas"]
  },
  Canada: {
    "Ontario": ["Toronto", "Ottawa"],
    "Quebec": ["Montreal", "Quebec City"]
  }
};

// Global variables
let currentCourse = null;
let loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initializePage();
  } catch (error) {
    console.error("Page initialization failed:", error);
    showMessage("Failed to load page. Please refresh and try again.", "error");
  }
});

async function initializePage() {
  // Check access control - only students can access this page
  if (!loggedInUser) {
    alert("Please log in to access this page.");
    window.location.href = "/HTML/login.html";
    return;
  }
  
  if (loggedInUser.type !== "student") {
    alert("This page is only accessible to students.");
    if (loggedInUser.type === "teacher") {
      window.location.href = "/HTML/teacherIndex.html";
    } else if (loggedInUser.type === "admin") {
      window.location.href = "/HTML/adminIndex.html";
    } else {
      window.location.href = "/HTML/login.html";
    }
    return;
  }

  try {
    console.log("🚀 Initializing page...");
    
    setupNavigation();
    setupDropdowns();
    await loadCourseData();
    setupForm();
    
    console.log("✅ Page initialization completed successfully");
  } catch (error) {
    console.error("❌ Page initialization error:", error);
    
    if (error.message.includes("No course ID provided")) {
      showMessage("Please select a course from the course catalog first.", "error");
    } else if (error.message.includes("Course not found")) {
      showMessage("The selected course was not found. Please select a different course.", "error");
    } else {
      showMessage("Failed to load page. Please refresh and try again.", "error");
    }
  }
}

function setupDropdowns() {
  const countryDropdown = document.getElementById("country");
  const stateDropdown = document.getElementById("state");
  const cityDropdown = document.getElementById("city");

  if (countryDropdown) {
    Object.keys(locationData).forEach(country => {
      const opt = new Option(country, country);
      countryDropdown.appendChild(opt);
    });

    countryDropdown.addEventListener("change", () => {
      if (stateDropdown) {
        stateDropdown.innerHTML = `<option value="">Select State</option>`;
      }
      if (cityDropdown) {
        cityDropdown.innerHTML = `<option value="">Select City</option>`;
      }
      const states = locationData[countryDropdown.value];
      if (states && stateDropdown) {
        Object.keys(states).forEach(state => {
          stateDropdown.appendChild(new Option(state, state));
        });
      }
    });
  }

  if (stateDropdown) {
    stateDropdown.addEventListener("change", () => {
      if (cityDropdown) {
        cityDropdown.innerHTML = `<option value="">Select City</option>`;
      }
      const cities = locationData[countryDropdown?.value]?.[stateDropdown.value] || [];
      if (cityDropdown) {
        cities.forEach(city => {
          cityDropdown.appendChild(new Option(city, city));
        });
      }
    });
  }

  const daySelect = document.getElementById("day");
  if (daySelect) {
    for (let i = 1; i <= 31; i++) daySelect.appendChild(new Option(i, i));
  }

  const yearSelect = document.getElementById("year");
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    for (let y = 1990; y <= currentYear; y++) yearSelect.appendChild(new Option(y, y));
  }
}

function setupNavigation() {
  const nav = document.querySelector("nav");
  const profileBtn = nav?.querySelector(".btn1");

  if (loggedInUser && profileBtn) {
    const names = loggedInUser.name.split(" ");
    const initials = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0][0];
    const dropdown = document.createElement("div");
    dropdown.className = "profile-dropdown";
    dropdown.innerHTML = `
      <button class="profile-btn">${initials.toUpperCase()}</button>
      <div class="dropdown-content">
        <a href="/HTML/profile.html">View Profile</a>
        <a href="#" onclick="logoutUser()">Logout</a>
      </div>
    `;
    profileBtn.replaceWith(dropdown);
  } else if (!loggedInUser && profileBtn) {
    profileBtn.textContent = "Login";
    profileBtn.href = "/HTML/login.html";
  }
}

window.logoutUser = function() {
  localStorage.removeItem("loggedInUser");
  alert("Logged out successfully!");
  window.location.href = "/HTML/login.html";
};

async function loadCourseData() {
  console.log("📚 Loading course data...");
  
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("id");
  
  console.log("🔍 Course ID from URL:", courseId);
  
  if (!courseId) {
    console.error("❌ No course ID provided");
    throw new Error("No course ID provided. Please select a course first.");
  }

  try {
    console.log("🌐 Fetching course from backend...");
    
    // Try the new backend endpoint first
    let response = await fetch(`/courses/${courseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("📡 Backend API response status:", response.status);
    
    // If backend endpoint fails, try the json-server endpoint
    if (!response.ok) {
      console.log("⚠️ Backend endpoint failed, trying json-server endpoint...");
      response = await fetch(`/api/courses/${courseId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log("📡 JSON-server API response status:", response.status);
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Course not found (ID: ${courseId})`);
      } else {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
    }
    
    const result = await response.json();
    console.log("📦 Raw API result:", result);
    
    // Handle both response formats:
    // 1. {success: true, course: {...}} - from custom endpoint
    // 2. {...course data...} - from json-server
    if (result.success && result.course) {
      currentCourse = result.course;
    } else if (result.id) {
      // Direct course object from json-server
      currentCourse = result;
    } else {
      throw new Error('Invalid course data format');
    }
    
    console.log("✅ Course loaded:", currentCourse);
    
    const titleElement = document.getElementById("courseTitle");
    if (titleElement) {
      titleElement.textContent = currentCourse.title || "Course Application";
      console.log("📝 Course title updated:", titleElement.textContent);
    } else {
      console.warn("⚠️ Course title element not found");
    }
    
  } catch (error) {
    console.error("❌ Error loading course:", error);
    
    const titleElement = document.getElementById("courseTitle");
    if (titleElement) {
      titleElement.textContent = "Course Application";
    }
    
    throw error;
  }
}

function setupForm() {
  console.log("🔧 Setting up form...");
  
  // Prefill user info if logged in
  if (loggedInUser) {
    console.log("👤 Prefilling user info for:", loggedInUser.name);
    const nameInput = document.querySelector('input[name="name"]');
    const emailInput = document.querySelector('input[name="email"]');
    if (nameInput) nameInput.value = loggedInUser.name || '';
    if (emailInput) emailInput.value = loggedInUser.email || '';
  }

  const form = document.querySelector("#applicationForm");
  console.log("📋 Form found:", !!form);
  
  if (form) {
    form.addEventListener("submit", handleFormSubmission);
    console.log("✅ Form submit event listener attached");
  } else {
    console.error("❌ Form not found!");
  }
}

async function handleFormSubmission(e) {
  e.preventDefault();
  
  console.log("🚀 Form submission started");
  
  showLoadingState();
  
  try {
    console.log("🔍 Validating form...");
    if (!validateForm()) {
      console.log("❌ Form validation failed");
      hideLoadingState();
      return;
    }
    console.log("✅ Form validation passed");

    console.log("📝 Gathering form data...");
    const formData = gatherFormData();
    console.log("📊 Form data:", formData);
    
    // Submit application to Node.js backend
    console.log("📤 Submitting application to backend...");
    await submitApplicationToBackend(formData);
    
    console.log("🎉 Enrollment successful!");
    showMessage("🎉 Enrollment successful! You are now enrolled. Redirecting to course...", "success");
    
    // Redirect to course.html with course ID
    setTimeout(() => {
      window.location.href = `/HTML/course.html?id=${currentCourse.id}`;
    }, 2000);
    
  } catch (error) {
    console.error("❌ Form submission error:", error);
    hideLoadingState();
    showMessage(`Failed to submit application: ${error.message}`, "error");
  }
}

function validateForm() {
  // Check required text inputs
  const requiredInputs = [
    'input[name="name"]',
    'input[name="email"]',
    'input[id="university"]',
    'input[id="gradYear"]',
    'input[id="gpa"]'
  ];

  for (const selector of requiredInputs) {
    const element = document.querySelector(selector);
    if (!element || !element.value.trim()) {
      showMessage(`Please fill in all required fields.`, "error");
      element?.focus();
      return false;
    }
  }

  // Check radio button selection
  const genderSelected = document.querySelector('input[name="gender"]:checked');
  if (!genderSelected) {
    showMessage(`Please select your gender.`, "error");
    return false;
  }

  // Check dropdown selections
  const requiredDropdowns = [
    'select[name="month"]',
    'select[name="day"]',
    'select[name="year"]',
    'select[name="country"]',
    'select[name="state"]',
    'select[name="city"]',
    '#qualification',
    '#field',
    '#experience'
  ];

  for (const selector of requiredDropdowns) {
    const element = document.querySelector(selector);
    if (!element || !element.value) {
      showMessage(`Please fill in all required fields.`, "error");
      element?.focus();
      return false;
    }
  }

  return true;
}

function gatherFormData() {
  const name = document.querySelector('input[name="name"]').value;
  const email = document.querySelector('input[name="email"]').value;
  const gender = document.querySelector('input[name="gender"]:checked').value;
  const month = document.querySelector('select[name="month"]').value;
  const day = document.querySelector('select[name="day"]').value;
  const year = document.querySelector('select[name="year"]').value;
  const country = document.querySelector('select[name="country"]').value;
  const state = document.querySelector('select[name="state"]').value;
  const city = document.querySelector('select[name="city"]').value;
  const qualification = document.getElementById("qualification").value;
  const field = document.getElementById("field").value;
  const university = document.getElementById("university").value;
  const gradYear = document.getElementById("gradYear").value;
  const gpa = document.getElementById("gpa").value;
  const experience = document.getElementById("experience").value;

  return {
    courseId: currentCourse.id,
    courseTitle: currentCourse.title,
    studentId: loggedInUser ? loggedInUser.id : `STD${Date.now()}`,
    name,
    email,
    gender,
    dob: `${day}-${month}-${year}`,
    location: { country, state, city },
    education: {
      qualification,
      field,
      university,
      graduationYear: gradYear,
      gpa,
    },
    experience,
    submittedAt: new Date().toISOString(),
    status: 'approved'
  };
}

async function submitApplicationToBackend(formData) {
  try {
    // Call Node.js backend API with authentication
    const response = await fetch('/applications/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(loggedInUser)
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to submit application');
    }

    console.log("✅ Application submitted successfully:", result);
    return result;
    
  } catch (error) {
    console.error("❌ Error submitting application:", error);
    throw error;
  }
}

function showLoadingState() {
  const submitBtn = document.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;
  }
}

function hideLoadingState() {
  const submitBtn = document.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = "Submit";
    submitBtn.disabled = false;
  }
}

function showMessage(message, type) {
  // Remove existing messages
  const existingMessages = document.querySelectorAll(".success-message, .error-message");
  existingMessages.forEach(msg => msg.remove());

  // Create new message
  const messageElement = document.createElement("div");
  messageElement.className = type === "success" ? "success-message" : "error-message";
  messageElement.textContent = message;
  messageElement.style.cssText = `
    padding: 12px 16px;
    margin: 16px 0;
    border-radius: 6px;
    font-weight: 500;
    ${type === "success" 
      ? "background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;" 
      : "background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;"
    }
  `;

  // Insert message before the form
  const form = document.querySelector("#applicationForm");
  if (form) {
    form.parentNode.insertBefore(messageElement, form);
  }

  // Auto-remove message after 5 seconds
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.remove();
    }
  }, 5000);
}