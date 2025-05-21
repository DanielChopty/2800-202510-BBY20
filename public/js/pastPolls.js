// CLIENT-SIDE SCRIPTS FOR PASTPOLLS.EJS

// Script to open the edit modal
function openEditModal(poll) {
  document.getElementById('pollId').value = poll._id;
  document.getElementById('title').value = poll.title || '';
  document.getElementById('description').value = poll.description || '';
  document.getElementById('importance').value = poll.importance || 'Low';
  document.getElementById('available').value = poll.available ? 'true' : 'false';

  // Pre-fill options based on poll.choices
  const optionInputs = document.querySelectorAll('.option-input');
  for (let i = 0; i < optionInputs.length; i++) {
    optionInputs[i].value = poll.choices && poll.choices[i] ? poll.choices[i].text : '';
  }

  // Pre-fill start and end dates if they exist
  if (poll.startDate) {
    const startDate = new Date(poll.startDate).toISOString().split('T')[0];
    document.getElementById('startDate').value = startDate;
  } else {
    document.getElementById('startDate').value = '';
  }

  if (poll.endDate) {
    const endDate = new Date(poll.endDate).toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate;
  } else {
    document.getElementById('endDate').value = '';
  }

  // Pre-select tags and display selected badges
  const editTagCheckboxes = document.querySelectorAll('.btn-check[name="tags[]"]');
  const editSelectedTagsContainer = document.getElementById('editSelectedTags');

  // Clear previous selections
  editTagCheckboxes.forEach(cb => cb.checked = false);
  editSelectedTagsContainer.innerHTML = '';

  if (poll.tags) {
    const tagsArray = Array.isArray(poll.tags) ? poll.tags : poll.tags.split(',');
    tagsArray.forEach(tag => {
      const trimmedTag = tag.trim();
      const checkbox = document.querySelector(`.btn-check[name="tags[]"][value="${trimmedTag}"]`);
      if (checkbox) {
        checkbox.checked = true;

        const badge = document.createElement('span');
        badge.className = 'badge bg-info text-dark me-1';
        badge.textContent = trimmedTag;
        editSelectedTagsContainer.appendChild(badge);
      }
    });
  }

  // Update badges when checkboxes change
  editTagCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const selected = Array.from(editTagCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      editSelectedTagsContainer.innerHTML = '';
      selected.forEach(tag => {
        const badge = document.createElement('span');
        badge.className = 'badge bg-info text-dark me-1';
        badge.textContent = tag;
        editSelectedTagsContainer.appendChild(badge);
      });
    });
  });

  // Set form action dynamically
  const editForm = document.getElementById('editPollForm');
  editForm.action = `/editpoll/${poll._id}`;

  // Show the Bootstrap modal
  const modal = new bootstrap.Modal(document.getElementById('editPollModal'));
  modal.show();
}

// Script to toggle the full description upon clicking 'expand'
function toggleDetails(id, fullText) {
  const descElement = document.getElementById(`desc-${id}`);
  const toggleLink = document.getElementById(`toggle-${id}`);
  const detailsElement = document.getElementById(`details-${id}`);

  if (descElement.dataset.expanded === 'true') {
    if (fullText.length > 80) {
      descElement.innerHTML = fullText.substring(0, 80) + '...';
    } else {
      descElement.innerHTML = fullText;
    }
    detailsElement.style.display = 'none';
    descElement.dataset.expanded = 'false';
    toggleLink.textContent = 'expand';
  } else {
    const formattedText = fullText.replace(/\n/g, '<br>');
    descElement.innerHTML = formattedText;
    detailsElement.style.display = 'block';
    descElement.dataset.expanded = 'true';
    toggleLink.textContent = 'collapse';
  }
}

// Delete poll confirmation script 
function confirmDelete(event, pollId) {
  event.preventDefault();
  Swal.fire({
    title: 'Are you sure?',
    text: 'This poll will be permanently deleted.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#dc3545'
  }).then((result) => {
    if (result.isConfirmed) {
      document.getElementById(`delete-form-${pollId}`).submit();
    }
  });
  return false;
}

// Edit poll confirmation script
function confirmEdit(event) {
  event.preventDefault();
  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to save these changes to the poll?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, save them!',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#f36f21'
  }).then((result) => {
    if (result.isConfirmed) {
      document.getElementById('editPollForm').submit();
    }
  });
  return false;
}

// Event listener to give acknowledgement message that poll has been deleted/edited
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('deleted') === 'true') {
    Swal.fire({
      icon: 'success',
      title: 'Poll Deleted',
      text: 'The poll was successfully deleted.',
      confirmButtonColor: '#003366'
    }).then(() => {
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    });
  }

  if (urlParams.get('edited') === 'true') {
    Swal.fire({
      icon: 'success',
      title: 'Poll Edited',
      text: 'The poll was successfully updated.',
      confirmButtonColor: '#003366'
    }).then(() => {
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    });
  }
});
