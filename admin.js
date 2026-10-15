// public/admin.js - Admin Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
  // API Base: supports running via http://localhost:3000/ or directly opening file:/// in browser
  const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';

  // DOM Elements
  const authModal = document.getElementById('authModal');
  const authForm = document.getElementById('authForm');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authSubmitBtnText = document.getElementById('authSubmitBtnText');
  const authError = document.getElementById('authError');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const deleteCompletedBtn = document.getElementById('deleteCompletedBtn');
  const btnClosedCount = document.getElementById('btnClosedCount');
  const actionBanner = document.getElementById('actionBanner');
  const actionBannerIcon = document.getElementById('actionBannerIcon');
  const actionBannerMsg = document.getElementById('actionBannerMsg');
  const confirmModal = document.getElementById('confirmModal');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmMessage = document.getElementById('confirmMessage');
  const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
  const okConfirmBtn = document.getElementById('okConfirmBtn');

  // Stats Counters
  const countAll = document.getElementById('countAll');
  const countNew = document.getElementById('countNew');
  const countContacted = document.getElementById('countContacted');
  const countQualified = document.getElementById('countQualified');
  const countClosed = document.getElementById('countClosed');
  const statCards = document.querySelectorAll('.stat-card');

  // Filters & Table
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const leadsTableBody = document.getElementById('leadsTableBody');
  const emptyState = document.getElementById('emptyState');

  // State
  let adminKey = sessionStorage.getItem('leadflow_admin_key') || '';
  let allLeads = [];

  // Toggle key visibility (show/hide password)
  if (toggleKeyVisibility) {
    toggleKeyVisibility.addEventListener('click', () => {
      if (adminKeyInput.type === 'password') {
        adminKeyInput.type = 'text';
        toggleKeyVisibility.textContent = '🙈';
        toggleKeyVisibility.title = 'Hide key';
      } else {
        adminKeyInput.type = 'password';
        toggleKeyVisibility.textContent = '👁️';
        toggleKeyVisibility.title = 'Show key';
      }
      adminKeyInput.focus();
    });
  }

  // Initialize
  if (adminKey) {
    loadLeads();
  } else {
    showAuthModal();
  }

  // --- Authentication Helpers ---
  function showAuthModal(errorMessage = null) {
    authModal.classList.add('active');
    logoutBtn.style.display = 'none';

    if (errorMessage) {
      authErrorMsg.textContent = errorMessage;
      authError.style.display = 'flex';
    } else {
      authError.style.display = 'none';
    }

    setTimeout(() => {
      adminKeyInput.focus();
      adminKeyInput.select();
    }, 100);
  }

  function hideAuthModal() {
    authModal.classList.remove('active');
    authError.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
  }

  function setAuthLoading(isLoading) {
    if (authSubmitBtn) {
      authSubmitBtn.disabled = isLoading;
    }
    if (authSubmitBtnText) {
      authSubmitBtnText.textContent = isLoading ? 'Verifying Key...' : 'Unlock Dashboard';
    }
    adminKeyInput.disabled = isLoading;
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enteredKey = adminKeyInput.value.trim();
    if (!enteredKey) {
      showAuthModal('Please enter your secret key.');
      return;
    }

    adminKey = enteredKey;
    setAuthLoading(true);

    try {
      await loadLeads();
    } finally {
      setAuthLoading(false);
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('leadflow_admin_key');
    adminKey = '';
    adminKeyInput.value = '';
    allLeads = [];
    renderLeads();
    updateCounts({ all: 0, new: 0, contacted: 0, qualified: 0, closed: 0 });
    if (deleteCompletedBtn) deleteCompletedBtn.disabled = true;
    showAuthModal();
  });

  refreshBtn.addEventListener('click', () => {
    if (adminKey) loadLeads();
  });

  // --- Action Notification Banner ---
  let bannerTimer = null;
  function showActionNotification(type, message) {
    if (!actionBanner) return;
    if (bannerTimer) clearTimeout(bannerTimer);

    actionBanner.className = `alert-box ${type === 'success' ? 'alert-success' : 'alert-error'}`;
    if (actionBannerIcon) actionBannerIcon.textContent = type === 'success' ? '✓' : '⚠️';
    if (actionBannerMsg) actionBannerMsg.textContent = message;
    actionBanner.style.display = 'flex';

    bannerTimer = setTimeout(() => {
      actionBanner.style.display = 'none';
    }, 4500);
  }

  // --- Confirmation Dialog Helper ---
  function confirmAction(title, message, confirmBtnLabel, onConfirm) {
    if (!confirmModal) {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    if (okConfirmBtn) okConfirmBtn.textContent = confirmBtnLabel || 'Delete';
    confirmModal.classList.add('active');

    const cleanup = () => {
      confirmModal.classList.remove('active');
      if (cancelConfirmBtn) cancelConfirmBtn.onclick = null;
      if (okConfirmBtn) okConfirmBtn.onclick = null;
      document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') cleanup();
    };

    if (cancelConfirmBtn) cancelConfirmBtn.onclick = cleanup;
    if (okConfirmBtn) {
      okConfirmBtn.onclick = () => {
        cleanup();
        onConfirm();
      };
    }

    document.addEventListener('keydown', handleKey);
  }

  // --- Delete Completed Leads ---
  async function deleteCompletedLeads() {
    const closedLeads = allLeads.filter(l => l.status === 'closed');
    const closedCount = closedLeads.length;

    if (closedCount === 0) {
      showActionNotification('error', 'No completed (closed) leads to delete.');
      return;
    }

    confirmAction(
      'Delete Completed Leads?',
      `Are you sure you want to permanently delete all ${closedCount} completed (closed) lead(s)? This action cannot be reversed.`,
      `Delete ${closedCount} Completed Lead(s)`,
      async () => {
        if (deleteCompletedBtn) {
          deleteCompletedBtn.disabled = true;
          deleteCompletedBtn.textContent = 'Deleting...';
        }

        try {
          const response = await fetch(`${API_BASE}/api/leads/completed`, {
            method: 'DELETE',
            headers: {
              'x-admin-key': adminKey
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to delete completed leads (HTTP ${response.status})`);
          }

          const data = await response.json();
          allLeads = allLeads.filter(l => l.status !== 'closed');
          recalculateCounts();
          renderLeads();
          showActionNotification('success', data.message || `Deleted ${closedCount} completed lead(s).`);
        } catch (err) {
          console.error('Error deleting completed leads:', err);
          showActionNotification('error', 'Failed to delete completed leads. Please check your connection.');
        } finally {
          recalculateCounts();
        }
      }
    );
  }

  // --- Delete Single Lead ---
  function deleteSingleLead(leadId, leadName, leadStatus) {
    const label = leadStatus === 'closed' ? 'completed lead' : 'lead';
    confirmAction(
      `Delete Lead #${leadId}?`,
      `Are you sure you want to permanently delete ${label} #${leadId} (${leadName || 'Unnamed'})? This action cannot be undone.`,
      'Delete Lead',
      async () => {
        try {
          const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
            method: 'DELETE',
            headers: {
              'x-admin-key': adminKey
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to delete lead #${leadId}`);
          }

          const data = await response.json();
          allLeads = allLeads.filter(l => l.id !== leadId);
          recalculateCounts();
          renderLeads();
          showActionNotification('success', data.message || `Lead #${leadId} deleted successfully.`);
        } catch (err) {
          console.error('Error deleting lead:', err);
          showActionNotification('error', `Failed to delete lead #${leadId}.`);
        }
      }
    );
  }

  if (deleteCompletedBtn) {
    deleteCompletedBtn.addEventListener('click', deleteCompletedLeads);
  }

  // --- API Actions ---
  async function loadLeads() {
    try {
      const response = await fetch(`${API_BASE}/api/leads`, {
        headers: {
          'x-admin-key': adminKey
        }
      });

      if (response.status === 401) {
        sessionStorage.removeItem('leadflow_admin_key');
        showAuthModal('Invalid Admin Key. Please check the key in your .env file.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      sessionStorage.setItem('leadflow_admin_key', adminKey);
      hideAuthModal();

      allLeads = data.leads || [];
      if (data.counts) {
        updateCounts(data.counts);
      } else {
        recalculateCounts();
      }
      renderLeads();
    } catch (err) {
      console.error('Error fetching leads:', err);
      const serverTarget = API_BASE || window.location.origin;
      showAuthModal(`Cannot connect to server at ${serverTarget}. Ensure "node server.js" is running.`);
    }
  }

  async function updateLeadStatus(leadId, newStatus, selectEl, saveIndicator) {
    const originalStatus = selectEl.getAttribute('data-prev-status') || 'new';
    selectEl.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const data = await response.json();
      
      // Update local state
      const targetLead = allLeads.find(l => l.id === leadId);
      if (targetLead) {
        targetLead.status = newStatus;
      }

      // Update dropdown styling
      selectEl.className = `status-dropdown status-${newStatus}`;
      selectEl.setAttribute('data-prev-status', newStatus);

      // Show save confirmation
      saveIndicator.classList.add('visible');
      setTimeout(() => {
        saveIndicator.classList.remove('visible');
      }, 1800);

      recalculateCounts();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status on server. Reverting to previous status.');
      selectEl.value = originalStatus;
      selectEl.className = `status-dropdown status-${originalStatus}`;
    } finally {
      selectEl.disabled = false;
    }
  }

  // --- Rendering & Escaping (Strict XSS Prevention) ---
  function renderLeads() {
    leadsTableBody.innerHTML = '';

    const searchTerm = searchInput.value.trim().toLowerCase();
    const filterStatus = statusFilter.value;

    const filteredLeads = allLeads.filter(lead => {
      const matchesStatus = (filterStatus === 'all') || (lead.status === filterStatus);
      const matchesSearch = !searchTerm ||
        (lead.name && lead.name.toLowerCase().includes(searchTerm)) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm)) ||
        (lead.message && lead.message.toLowerCase().includes(searchTerm));

      return matchesStatus && matchesSearch;
    });

    if (filteredLeads.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    filteredLeads.forEach(lead => {
      const tr = document.createElement('tr');

      // 1. Lead ID cell (using textContent)
      const tdId = document.createElement('td');
      tdId.className = 'lead-id';
      tdId.textContent = `#${lead.id}`;
      tr.appendChild(tdId);

      // 2. Created Date cell (using textContent)
      const tdDate = document.createElement('td');
      tdDate.className = 'lead-date';
      tdDate.textContent = formatDateTime(lead.created_at);
      tr.appendChild(tdDate);

      // 3. Name cell (using textContent - prevents XSS)
      const tdName = document.createElement('td');
      tdName.className = 'lead-name';
      tdName.textContent = lead.name || '';
      tr.appendChild(tdName);

      // 4. Email cell (using textContent - prevents XSS)
      const tdEmail = document.createElement('td');
      const emailLink = document.createElement('a');
      emailLink.className = 'lead-email';
      emailLink.href = `mailto:${encodeURIComponent(lead.email || '')}`;
      emailLink.textContent = lead.email || '';
      tdEmail.appendChild(emailLink);
      tr.appendChild(tdEmail);

      // 5. Message cell (using textContent - prevents XSS)
      const tdMessage = document.createElement('td');
      tdMessage.className = 'lead-message';
      tdMessage.title = lead.message || '';
      tdMessage.textContent = lead.message || '—';
      tr.appendChild(tdMessage);

      // 6. Status Dropdown cell
      const tdStatus = document.createElement('td');
      const statusWrapper = document.createElement('div');
      statusWrapper.style.display = 'flex';
      statusWrapper.style.alignItems = 'center';

      const select = document.createElement('select');
      select.className = `status-dropdown status-${lead.status}`;
      select.setAttribute('data-prev-status', lead.status);
      select.setAttribute('aria-label', `Status for lead #${lead.id}`);

      const statuses = [
        { val: 'new', label: 'New' },
        { val: 'contacted', label: 'Contacted' },
        { val: 'qualified', label: 'Qualified' },
        { val: 'closed', label: 'Closed' }
      ];

      statuses.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.val;
        opt.textContent = s.label;
        if (lead.status === s.val) opt.selected = true;
        select.appendChild(opt);
      });

      const saveInd = document.createElement('span');
      saveInd.className = 'save-indicator';
      saveInd.textContent = '✓ Saved';

      select.addEventListener('change', () => {
        updateLeadStatus(lead.id, select.value, select, saveInd);
      });

      statusWrapper.appendChild(select);
      statusWrapper.appendChild(saveInd);
      tdStatus.appendChild(statusWrapper);
      tr.appendChild(tdStatus);

      // 7. Action Column (Delete Single Lead)
      const tdAction = document.createElement('td');
      tdAction.style.textAlign = 'center';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon-danger';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = lead.status === 'closed' ? `Delete completed lead #${lead.id}` : `Delete lead #${lead.id}`;
      deleteBtn.setAttribute('aria-label', `Delete lead #${lead.id}`);

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSingleLead(lead.id, lead.name, lead.status);
      });

      tdAction.appendChild(deleteBtn);
      tr.appendChild(tdAction);

      leadsTableBody.appendChild(tr);
    });
  }

  function updateCounts(counts) {
    const closedCount = counts.closed ?? 0;
    countAll.textContent = counts.all ?? counts.total ?? 0;
    countNew.textContent = counts.new ?? 0;
    countContacted.textContent = counts.contacted ?? 0;
    countQualified.textContent = counts.qualified ?? 0;
    countClosed.textContent = closedCount;

    if (deleteCompletedBtn) {
      deleteCompletedBtn.disabled = closedCount === 0;
      deleteCompletedBtn.title = closedCount > 0
        ? `Permanently delete ${closedCount} completed (closed) lead(s)`
        : 'No completed leads to delete';
      deleteCompletedBtn.innerHTML = `🗑️ Clear Completed (<span id="btnClosedCount">${closedCount}</span>)`;
    }
  }

  function recalculateCounts() {
    const counts = {
      all: allLeads.length,
      new: allLeads.filter(l => l.status === 'new').length,
      contacted: allLeads.filter(l => l.status === 'contacted').length,
      qualified: allLeads.filter(l => l.status === 'qualified').length,
      closed: allLeads.filter(l => l.status === 'closed').length
    };
    updateCounts(counts);
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  // --- Filtering & Interaction Listeners ---
  searchInput.addEventListener('input', renderLeads);
  statusFilter.addEventListener('change', () => {
    setActiveStatCard(statusFilter.value);
    renderLeads();
  });

  // Clicking a stat card sets filter directly
  statCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetStatus = card.getAttribute('data-status');
      statusFilter.value = targetStatus;
      setActiveStatCard(targetStatus);
      renderLeads();
    });
  });

  function setActiveStatCard(status) {
    statCards.forEach(c => {
      if (c.getAttribute('data-status') === status) {
        c.classList.add('active-filter');
      } else {
        c.classList.remove('active-filter');
      }
    });
  }
});
