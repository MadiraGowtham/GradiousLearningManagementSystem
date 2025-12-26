document.addEventListener('DOMContentLoaded', function() {
  // Admin access check
  const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
  if (!user || user.type !== 'admin') {
    alert('Admin access required!');
    window.location.href = '/HTML/login.html';
    return;
  }

  const container = document.querySelector('.container') || document.getElementById('users-container') || document.getElementById('usersGrid');
  const userForm = document.getElementById('userForm');
  const userTypeSelect = document.querySelector('.userType') || document.getElementById('userRole') || document.getElementById('filterUserType');
  const searchInput = document.querySelector('input[search]') || document.querySelector('input[name="search"]') || document.getElementById('searchInput');
  const addUserBtn = document.getElementById('addUserBtn');
  const cancelEditBtn = document.getElementById('cancelEdit');
  let users = [];
  let editingId = null;

  // Helper function to get authentication headers
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

  // Fetch users with filters from Node.js backend
  async function fetchUsers(typeFilter = 'all', searchTerm = '') {
    try {
      console.log('[FETCH] Fetching users - type:', typeFilter, 'search:', searchTerm);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const queryString = params.toString();
      const url = `/admin/users${queryString ? '?' + queryString : ''}`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert('Unauthorized access. Please log in as admin.');
          window.location.href = '/HTML/login.html';
          return;
        }
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Handle response format: { success: true, users: [], total: 0 }
      if (result.success && Array.isArray(result.users)) {
        users = result.users;
        console.log('[FETCH] Fetched users:', users.length, 'Total:', result.total);
        renderUsers(users);
      } else if (Array.isArray(result)) {
        // Fallback: if response is direct array
        users = result;
        console.log('[FETCH] Fetched users (direct array):', users.length);
        renderUsers(users);
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (error) {
      console.error('[FETCH] Error:', error);
      if (container) {
        container.innerHTML = `<p class="error-message">Error loading users: ${error.message}. Please try again.</p>`;
      }
      showNotification('Failed to load users: ' + error.message, 'error');
    }
  }

  // Render users table/cards
  function renderUsers(usersToRender) {
    if (!container) {
      console.error('[RENDER] Container not found');
      return;
    }
    
    container.innerHTML = '';
    
    if (usersToRender.length === 0) {
      container.innerHTML = '<p class="no-users">No users found</p>';
      return;
    }
    
    usersToRender.forEach(u => {
      const card = document.createElement('div');
      card.className = 'user-card';
      
      // Safely escape values for onclick handlers
      const userId = String(u.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const userType = String(u.type || 'student').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const userName = (u.name || 'Unnamed User').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const userEmail = (u.email || 'No email').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const userDomain = u.domain ? String(u.domain).replace(/'/g, "\\'").replace(/"/g, '&quot;') : '';
      const userPhone = u.phone ? String(u.phone).replace(/'/g, "\\'").replace(/"/g, '&quot;') : '';
      
      card.innerHTML = `
        <div class="user-avatar">
          <i class="fas fa-user-circle"></i>
        </div>
        <div class="user-info">
          <h3>${userName}</h3>
          <div class="user-role ${u.type || 'student'}">${(u.type || 'unknown').charAt(0).toUpperCase() + (u.type || 'unknown').slice(1)}</div>
          <div class="user-email">${userEmail}</div>
          ${u.domain ? `<div class="user-domain"><i class="fas fa-tag"></i> ${userDomain}</div>` : ''}
          ${u.phone ? `<div class="user-phone"><i class="fas fa-phone"></i> ${userPhone}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-edit" onclick="editUser('${userId}', '${userType}')">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn-delete" onclick="deleteUser('${userId}', '${userType}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      `;
      container.appendChild(card);
    });
    
    console.log('[RENDER] Rendered', usersToRender.length, 'users');
  }

  // Form handlers
  if (userForm) {
    userForm.onsubmit = async (e) => {
      e.preventDefault();
      
      try {
        const formData = new FormData(userForm);
        const data = {
          name: formData.get('userName') || formData.get('name'),
          email: formData.get('userEmail') || formData.get('email'),
          password: formData.get('userPassword') || formData.get('password'),
          phone: formData.get('userPhone') || formData.get('phone') || '',
          type: formData.get('userRole') || formData.get('type') || formData.get('role')
        };
        
        // Validate required fields
        if (!data.name || !data.email || !data.password || !data.type) {
          showNotification('Please fill in all required fields', 'error');
          return;
        }
        
        console.log('[FORM] Submitting:', editingId ? 'UPDATE' : 'CREATE', data);
        
        if (editingId) {
          // Update existing user using Node.js admin endpoint
          const response = await fetch(`/admin/users/${editingId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to update user' }));
            throw new Error(errorData.error || `Failed to update user: ${response.status}`);
          }
          
          const result = await response.json();
          console.log('[FORM] User updated successfully:', result);
          showNotification('User updated successfully!', 'success');
          
        } else {
          // Create new user using Node.js admin endpoint
          const response = await fetch('/admin/users', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to create user' }));
            const errorMessage = errorData.error || `Failed to create user: ${response.status}`;
            if (response.status === 409) {
              showNotification('Email already exists. Please use a different email.', 'error');
            } else {
              throw new Error(errorMessage);
            }
            return;
          }
          
          const result = await response.json();
          console.log('[FORM] User created successfully:', result);
          showNotification('User created successfully!', 'success');
        }
        
        // Reset form
        userForm.reset();
        editingId = null;
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        
        // Hide form section
        const formSection = document.querySelector('.users-crud') || userForm.parentElement;
        if (formSection) formSection.style.display = 'none';
        
        // Refresh user list
        fetchUsers(userTypeSelect?.value || 'all', searchInput?.value || '');
        
      } catch (error) {
        console.error('[FORM] Error:', error);
        showNotification('Operation failed: ' + error.message, 'error');
      }
    };
  }

  // Edit user
  window.editUser = (id, type) => {
    console.log('[EDIT] Editing user:', id, type);
    editingId = id;
    
    // Find user by ID (handle both string and number IDs)
    const userToEdit = users.find(u => 
      String(u.id) === String(id) || u.id === parseInt(id) || u.id === id
    );
    
    if (!userToEdit) {
      console.error('[EDIT] User not found:', id, 'Available users:', users.map(u => u.id));
      showNotification('User not found', 'error');
      return;
    }
    
    if (userForm) {
      // Populate form fields
      const nameField = document.getElementById('userName') || document.getElementById('name');
      const emailField = document.getElementById('userEmail') || document.getElementById('email');
      const passwordField = document.getElementById('userPassword') || document.getElementById('password');
      const phoneField = document.getElementById('userPhone') || document.getElementById('phone');
      const roleField = document.getElementById('userRole') || document.getElementById('type') || document.getElementById('role');
      
      if (nameField) nameField.value = userToEdit.name || '';
      if (emailField) emailField.value = userToEdit.email || '';
      if (passwordField) passwordField.value = userToEdit.password || '';
      if (phoneField) phoneField.value = userToEdit.phone || '';
      if (roleField) roleField.value = type || userToEdit.type || '';
      
      // Show form
      const formSection = document.querySelector('.users-crud') || userForm.parentElement;
      if (formSection) formSection.style.display = 'block';
      if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
      
      console.log('[EDIT] Form populated for user:', userToEdit.name);
    }
  };

  // Delete user
  window.deleteUser = async (id, type) => {
    // Find user to show name in confirmation
    const userToDelete = users.find(u => 
      String(u.id) === String(id) || u.id === parseInt(id) || u.id === id
    );
    const userName = userToDelete ? userToDelete.name : 'this user';
    
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      console.log('[DELETE] Deleting user:', id, type);
      
      // Use Node.js admin endpoint for deletion
      const response = await fetch(`/admin/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete user' }));
        throw new Error(errorData.error || `Failed to delete user: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[DELETE] User deleted successfully:', result);
      showNotification('User deleted successfully!', 'success');
      
      // Refresh user list
      fetchUsers(userTypeSelect?.value || 'all', searchInput?.value || '');
      
    } catch (error) {
      console.error('[DELETE] Error:', error);
      showNotification('Delete failed: ' + error.message, 'error');
    }
  };

  // Cancel edit
  if (cancelEditBtn) {
    cancelEditBtn.onclick = () => {
      if (userForm) userForm.reset();
      editingId = null;
      cancelEditBtn.style.display = 'none';
      const formSection = document.querySelector('.users-crud') || userForm?.parentElement;
      if (formSection) formSection.style.display = 'none';
    };
  }

  // Add user button
  if (addUserBtn) {
    addUserBtn.onclick = () => {
      if (userForm) userForm.reset();
      editingId = null;
      const formSection = document.querySelector('.users-crud') || userForm?.parentElement;
      if (formSection) formSection.style.display = 'block';
      if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
    };
  }

  // Filters
  if (userTypeSelect) {
    userTypeSelect.onchange = () => {
      console.log('[FILTER] Type changed:', userTypeSelect.value);
      fetchUsers(userTypeSelect.value, searchInput?.value || '');
    };
  }
  
  if (searchInput) {
    searchInput.oninput = () => {
      console.log('[FILTER] Search changed:', searchInput.value);
      fetchUsers(userTypeSelect?.value || 'all', searchInput.value);
    };
  }

  // Notification function
  function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
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
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Initial load
  console.log('[INIT] Initializing users page');
  fetchUsers();

  // Logout
  window.logoutUser = () => {
    localStorage.clear();
    window.location.href = '/HTML/login.html';
  };
});

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .notification {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .user-card {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.3s ease;
  }
  
  .user-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  
  .user-avatar {
    font-size: 48px;
    color: #6c757d;
  }
  
  .user-info {
    flex: 1;
  }
  
  .user-info h3 {
    margin: 0 0 8px 0;
    color: #333;
  }
  
  .user-role {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .user-role.student {
    background: #e3f2fd;
    color: #1976d2;
  }
  
  .user-role.teacher {
    background: #f3e5f5;
    color: #7b1fa2;
  }
  
  .user-role.admin {
    background: #ffebee;
    color: #c62828;
  }
  
  .user-email, .user-domain, .user-phone {
    font-size: 14px;
    color: #666;
    margin: 4px 0;
  }
  
  .card-actions {
    display: flex;
    gap: 8px;
  }
  
  .btn-edit, .btn-delete {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
  }
  
  .btn-edit {
    background: #007bff;
    color: white;
  }
  
  .btn-edit:hover {
    background: #0056b3;
  }
  
  .btn-delete {
    background: #dc3545;
    color: white;
  }
  
  .btn-delete:hover {
    background: #c82333;
  }
  
  .no-users, .error-message {
    text-align: center;
    padding: 40px 20px;
    color: #666;
    font-size: 16px;
  }
  
  .error-message {
    color: #dc3545;
  }
`;
document.head.appendChild(style);