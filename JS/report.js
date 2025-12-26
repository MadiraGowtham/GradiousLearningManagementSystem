document.addEventListener('DOMContentLoaded', function() {
  const reportForm = document.getElementById('reportForm');
  const formFeedback = document.getElementById('formFeedback');
  
  if (!reportForm || !formFeedback) return;

  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();
    
    formFeedback.textContent = '';
    
    if (!name || !email || !subject || !message) {
      formFeedback.textContent = 'Please fill in all fields.';
      formFeedback.style.color = 'red';
      return;
    }

    try {
      const response = await fetch('/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: name, studentEmail: email, subject, description: message })
      });
      
      const data = await response.json();
      
      if (data.success) {
        formFeedback.textContent = data.message;
        formFeedback.style.color = 'green';
        reportForm.reset();
      } else {
        formFeedback.textContent = data.error;
        formFeedback.style.color = 'red';
      }
    } catch (error) {
      formFeedback.textContent = 'Failed to submit issue. Please try again.';
      formFeedback.style.color = 'red';
    }
  });
});
