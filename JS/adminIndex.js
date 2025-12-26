// Access control - only admins can access this page
function checkAdminAccess() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (!user) {
    alert("Please log in to access this page.");
    window.location.href = "/HTML/login.html";
    return false;
  }
  
  if (user.type !== "admin") {
    alert("This page is only accessible to administrators.");
    if (user.type === "student") {
      window.location.href = "/HTML/index.html";
    } else if (user.type === "teacher") {
      window.location.href = "/HTML/teacherIndex.html";
    } else {
      window.location.href = "/HTML/login.html";
    }
    return false;
  }
  
  return true;
}

// DOM Elements
const pieChartContainer = document.getElementById('myPieChart');
const barChartContainer = document.getElementById('updateChart');
const issuesContainer = document.getElementById('issuesList');

// Loading indicators
const pieChartLoading = document.getElementById('pieChartLoading');
const barChartLoading = document.getElementById('barChartLoading');
const issuesLoading = document.getElementById('issuesLoading');

function showLoading(el) {
  if (el) el.style.display = 'block';
}

function hideLoading(el) {
  if (el) el.style.display = 'none';
}

// Fetch dashboard data from Node.js backend
async function fetchDashboardData() {
  showLoading(pieChartLoading);
  showLoading(barChartLoading);
  showLoading(issuesLoading);

  try {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    
    // Call Node.js backend API
    const response = await fetch('/admin/dashboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user': JSON.stringify(user)
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load dashboard data');
    }
    
    return result.data;
    
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    if (pieChartLoading) pieChartLoading.textContent = 'Error loading chart.';
    if (barChartLoading) barChartLoading.textContent = 'Error loading activity.';
    if (issuesLoading) issuesLoading.textContent = 'Error loading issues.';
    throw err;
  }
}

function renderStudentDistBarChart(studentDistribution) {
  hideLoading(pieChartLoading);
  const ctx = document.getElementById('studentDistBarChart').getContext('2d');
  
  // Destroy previous chart if exists
  if (window.studentDistBarChartInstance) {
    window.studentDistBarChartInstance.destroy();
  }
  
  window.studentDistBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(studentDistribution),
      datasets: [{
        label: 'Enrolled Students',
        data: Object.values(studentDistribution),
        backgroundColor: [
          '#1025a1', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
          '#6f42c1', '#fd7e14', '#20c997', '#17a2b8', '#6610f2'
        ],
        borderRadius: 8,
        maxBarThickness: 32
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Student Distribution by Course',
          font: { size: 20, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.parsed.x} students`;
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'right',
          color: '#1025a1',
          font: { weight: 'bold', size: 14 },
          formatter: function(value) { return value; }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#333', font: { size: 14 } },
          grid: { color: '#e9ecef' }
        },
        y: {
          ticks: { color: '#1025a1', font: { size: 15, weight: 'bold' } },
          grid: { display: false }
        }
      }
    },
    plugins: [window.ChartDataLabels || {}]
  });
}

function renderBarChart(allTimeActivity) {
  hideLoading(barChartLoading);
  const ctx = barChartContainer.getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(allTimeActivity),
      datasets: [{
        label: 'Count',
        data: Object.values(allTimeActivity),
        backgroundColor: '#36b9cc'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Platform Totals (All Time)'
        }
      }
    }
  });
}

// Issues Search & Actions
const issueSearch = document.getElementById('issueSearch');
let allIssues = [];

function renderIssues(issues) {
  hideLoading(issuesLoading);
  issuesContainer.innerHTML = '';
  
  issues.forEach((issue) => {
    const div = document.createElement('div');
    div.className = 'issueContainer' + (issue.status === 'resolved' ? ' resolved' : '');
    div.tabIndex = 0;
    div.innerHTML = `
      <div class="name">
        <p class="diff"><b>StudentID:</b> ${issue.studentId}</p>
        <p class="diff"><b>Course:</b> ${issue.course}</p>
        <p><b>Date of Issue :</b> ${issue.date}</p>
      </div>
      <p>${issue.description}</p>
      <div class="issue-actions">
        ${issue.status === 'resolved' ? '' : `<button class="issue-action-btn" aria-label="Resolve Issue" data-id="${issue.id}">Resolve</button>`}
        <button class="issue-action-btn" aria-label="Delete Issue" data-id="${issue.id}">Delete</button>
      </div>
    `;
    
    // Action handlers
    div.querySelectorAll('.issue-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.textContent.trim();
        const issueId = btn.getAttribute('data-id');
        const user = JSON.parse(localStorage.getItem('loggedInUser'));
        
        if (action === 'Resolve') {
          try {
            const response = await fetch(`/admin/issues/${issueId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'x-user': JSON.stringify(user)
              },
              body: JSON.stringify({ status: 'resolved' })
            });
            
            const result = await response.json();
            
            if (result.success) {
              allIssues = allIssues.map(issue => 
                issue.id == issueId ? { ...issue, status: 'resolved' } : issue
              );
              renderIssues(allIssues);
              showNotification('Issue resolved!', 'success');
            } else {
              showNotification(result.error || 'Failed to resolve issue', 'error');
            }
          } catch (err) {
            console.error('Error resolving issue:', err);
            showNotification('Failed to resolve issue.', 'error');
          }
        } else if (action === 'Delete') {
          try {
            const response = await fetch(`/admin/issues/${issueId}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'x-user': JSON.stringify(user)
              }
            });
            
            const result = await response.json();
            
            if (result.success) {
              allIssues = allIssues.filter(issue => issue.id != issueId);
              renderIssues(allIssues);
              showNotification('Issue deleted!', 'success');
            } else {
              showNotification(result.error || 'Failed to delete issue', 'error');
            }
          } catch (err) {
            console.error('Error deleting issue:', err);
            showNotification('Failed to delete issue.', 'error');
          }
        }
      });
    });
    
    issuesContainer.appendChild(div);
  });
}

// Issue search functionality
if (issueSearch) {
  issueSearch.addEventListener('input', () => {
    const q = issueSearch.value.trim().toLowerCase();
    renderIssues(allIssues.filter(issue =>
      issue.description.toLowerCase().includes(q) ||
      issue.studentId.toLowerCase().includes(q) ||
      issue.course.toLowerCase().includes(q)
    ));
  });
}

// Dashboard Search (global)
const dashboardSearch = document.getElementById('dashboardSearch');
if (dashboardSearch) {
  dashboardSearch.addEventListener('input', () => {
    const q = dashboardSearch.value.trim().toLowerCase();
    renderIssues(allIssues.filter(issue =>
      issue.description.toLowerCase().includes(q) ||
      issue.studentId.toLowerCase().includes(q) ||
      issue.course.toLowerCase().includes(q)
    ));
  });
}

// Render admin name
const adminNameSpan = document.getElementById('adminName');
if (adminNameSpan) {
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (user && user.name) adminNameSpan.textContent = user.name;
}

// Main dashboard rendering
async function renderDashboard() {
  try {
    const data = await fetchDashboardData();
    
    allIssues = Array.isArray(data.issues) ? [...data.issues] : [];
    
    renderStudentDistBarChart(data.studentDistribution);
    renderBarChart(data.allTimeActivity);
    renderIssues(allIssues);
    
  } catch (err) {
    console.error('Error rendering dashboard:', err);
  }
}

// Profile/Login button logic for header
function renderProfileOrLogin() {
  const container = document.getElementById('profileOrLogin');
  if (!container) return;
  
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  
  if (user) {
    // Get initials from first and last name
    const names = user.name.split(' ');
    const initials = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}` 
      : names[0][0];
      
    container.innerHTML = `
      <div class="profile-dropdown">
        <button class="profile-btn">${initials.toUpperCase()}</button>
        <div class="dropdown-menu">
          <a href="/HTML/profile.html">Go to Profile</a>
          <a href="#" id="logout-link">Logout</a>
        </div>
      </div>
    `;
    
    document.getElementById('logout-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      alert('You have been logged out.');
      window.location.href = '/HTML/login.html';
    });
  } else {
    container.innerHTML = '<button class="btn1">Login</button>';
  }
}

// Notification helper function
function showNotification(message, type) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#1cc88a' : '#e74a3b'};
    color: white;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Check access first
  if (!checkAdminAccess()) {
    return;
  }
  
  // Continue with page initialization
  renderProfileOrLogin();
  renderDashboard();
});