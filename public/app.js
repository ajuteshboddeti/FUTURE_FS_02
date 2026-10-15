// public/app.js - Contact Form Controller

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const nameInput = document.getElementById('nameInput');
  const emailInput = document.getElementById('emailInput');
  const messageInput = document.getElementById('messageInput');
  const honeypotInput = document.getElementById('honeypot');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const alertBox = document.getElementById('alertBox');
  const alertIcon = document.getElementById('alertIcon');
  const alertMessage = document.getElementById('alertMessage');

  const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';

  function showAlert(type, message) {
    alertBox.className = 'alert-box ' + (type === 'success' ? 'alert-success' : 'alert-error');
    alertIcon.textContent = type === 'success' ? '✓' : '⚠️';
    alertMessage.textContent = message;
    alertBox.style.display = 'flex';
  }

  function hideAlert() {
    alertBox.style.display = 'none';
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline';
    } else {
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();
    const _gotcha = honeypotInput.value;

    // Client-side Validation
    if (!name || name.length < 2) {
      showAlert('error', 'Please enter your full name (at least 2 characters).');
      nameInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showAlert('error', 'Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          message,
          _gotcha
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert('success', data.message || 'Thank you! Your message was sent successfully.');
        form.reset();
      } else {
        showAlert('error', data.error || 'Failed to submit inquiry. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      showAlert('error', 'Network error. Please make sure the server is running and try again.');
    } finally {
      setLoading(false);
    }
  });
});
