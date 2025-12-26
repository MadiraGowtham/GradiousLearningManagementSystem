// Notification System - Client-side code that calls Node.js backend

class NotificationSystem {
    constructor() {
        this.notificationBell = document.querySelector('.notif');
        this.user = JSON.parse(localStorage.getItem('loggedInUser'));
        this.init();
    }

    init() {
        if (!this.user) return;
        
        this.setupNotificationBell();
        this.setupClickOutside();
        this.updateNotificationCount();
        
        // Update notification count every 30 seconds
        setInterval(() => {
            this.updateNotificationCount();
        }, 30000);
    }

    setupNotificationBell() {
        if (!this.notificationBell) return;

        // Create notification counter if not already present
        let notificationCount = document.querySelector('.notification-count');
        if (!notificationCount) {
            notificationCount = document.createElement('span');
            notificationCount.className = 'notification-count';
            this.notificationBell.appendChild(notificationCount);
        }

        this.notificationBell.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove any existing dropdowns
            document.querySelectorAll('.notification-dropdown').forEach(dropdown => dropdown.remove());
            
            // Fetch and show notifications
            await this.showNotificationDropdown();
        };
    }

    setupClickOutside() {
        document.addEventListener('click', (e) => {
            if (!this.notificationBell?.contains(e.target)) {
                document.querySelectorAll('.notification-dropdown').forEach(dropdown => dropdown.remove());
            }
        });
    }

    async showNotificationDropdown() {
        try {
            // Call Node.js backend API
            const response = await fetch('/notifications', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(this.user)
                }
            });
            
            const data = await response.json();
            
            if (!data.success) {
                console.error('Failed to load notifications:', data.error);
                return;
            }
            
            const notifications = data.notifications || [];
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
                            <small>${this.formatNotificationTime(notif.timestamp)}</small>
                            ${!notif.read ? '<span class="unread-dot"></span>' : ''}
                        </div>
                    `;
                    
                    notifElement.onclick = async () => {
                        await this.markNotificationAsRead(notif.id);
                        this.updateNotificationCount();
                        
                        // Handle navigation if link is provided
                        if (notif.link) {
                            window.location.href = notif.link;
                        }
                    };
                    
                    notificationDropdown.appendChild(notifElement);
                });

                // Add mark all as read button if there are unread notifications
                if (unreadNotifications.length > 0) {
                    const markAllRead = document.createElement('button');
                    markAllRead.className = 'mark-all-read';
                    markAllRead.textContent = 'Mark all as read';
                    markAllRead.onclick = async () => {
                        await this.markAllNotificationsAsRead();
                        notificationDropdown.remove();
                        await this.showNotificationDropdown();
                    };
                    notificationDropdown.appendChild(markAllRead);
                }
            }

            this.notificationBell.appendChild(notificationDropdown);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    formatNotificationTime(timestamp) {
        const now = new Date();
        const notifTime = new Date(timestamp);
        const diffInMinutes = Math.floor((now - notifTime) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }

    async markNotificationAsRead(notificationId) {
        try {
            await fetch(`/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(this.user)
                }
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllNotificationsAsRead() {
        try {
            const response = await fetch('/notifications/mark-all-read', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(this.user)
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Refresh notifications UI
                document.querySelectorAll('.notification-item').forEach(item => {
                    item.classList.remove('unread');
                    item.classList.add('read');
                    const unreadDot = item.querySelector('.unread-dot');
                    if (unreadDot) unreadDot.remove();
                });

                // Update notification count
                this.updateNotificationCount();
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    async updateNotificationCount() {
        try {
            const response = await fetch('/notifications/unread-count', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(this.user)
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const notificationCount = document.querySelector('.notification-count');
                
                if (notificationCount) {
                    notificationCount.textContent = data.count > 0 ? data.count : '';
                    notificationCount.style.display = data.count > 0 ? 'block' : 'none';
                }
            }
        } catch (error) {
            console.error('Error updating notification count:', error);
        }
    }

    // Static method to create notifications
    static async createNotification(userId, message, link = null) {
        try {
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            
            const response = await fetch('/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(user)
                },
                body: JSON.stringify({
                    userId: userId,
                    message: message,
                    link: link
                })
            });
            
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error creating notification:', error);
            return false;
        }
    }

    // Static method to create notifications for specific user types (admin only)
    static async createNotificationForUserType(userType, message, link = null) {
        try {
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            
            if (user.type !== 'admin') {
                console.error('Only admins can broadcast notifications');
                return false;
            }
            
            const response = await fetch('/notifications/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': JSON.stringify(user)
                },
                body: JSON.stringify({
                    userType: userType,
                    message: message,
                    link: link
                })
            });
            
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error creating notifications for user type:', error);
            return false;
        }
    }
}

// Initialize notification system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NotificationSystem();
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}