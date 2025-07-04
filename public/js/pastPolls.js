// CLIENT-SIDE SCRIPTS FOR PASTPOLLS.EJS

let originalPollData = null;

// Script to open the edit modal
function openEditModal(poll) {
  originalPollData = JSON.parse(JSON.stringify(poll));
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

function resetEditPollForm() {
  Swal.fire({
    title: 'Are you sure?',
    text: 'This will discard all unsaved changes.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, reset it!',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#f36f21'
  }).then((result) => {
    if (!result.isConfirmed) return;

    if (!originalPollData) return;

    // Reset core fields
    document.getElementById('pollId').value = originalPollData._id;
    document.getElementById('title').value = originalPollData.title || '';
    document.getElementById('description').value = originalPollData.description || '';
    document.getElementById('importance').value = originalPollData.importance || 'Low';
    document.getElementById('available').value = originalPollData.available ? 'true' : 'false';

    // Reset options
    const optionInputs = document.querySelectorAll('.option-input');
    for (let i = 0; i < optionInputs.length; i++) {
      optionInputs[i].value = originalPollData.choices && originalPollData.choices[i]
        ? originalPollData.choices[i].text
        : '';
    }

    // Reset dates
    document.getElementById('startDate').value = originalPollData.startDate
      ? new Date(originalPollData.startDate).toISOString().split('T')[0]
      : '';
    document.getElementById('endDate').value = originalPollData.endDate
      ? new Date(originalPollData.endDate).toISOString().split('T')[0]
      : '';

    // Reset tags
    const tagCheckboxes = document.querySelectorAll('.btn-check[name="tags[]"]');
    const selectedTagsContainer = document.getElementById('editSelectedTags');
    tagCheckboxes.forEach(cb => cb.checked = false);
    selectedTagsContainer.innerHTML = '';

    if (originalPollData.tags) {
      const tagsArray = Array.isArray(originalPollData.tags)
        ? originalPollData.tags
        : originalPollData.tags.split(',');
      tagsArray.forEach(tag => {
        const trimmed = tag.trim();
        const checkbox = document.querySelector(`.btn-check[value="${trimmed}"]`);
        if (checkbox) checkbox.checked = true;

        const badge = document.createElement('span');
        badge.className = 'badge bg-info text-dark me-1';
        badge.textContent = trimmed;
        selectedTagsContainer.appendChild(badge);
      });
    }

    // Show success acknowledgement
    Swal.fire({
      icon: 'success',
      title: 'Reset Complete',
      text: 'The form has been restored to its original state.',
      confirmButtonColor: '#003366'
    });
  });
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

// Enforce at least two valid option inputs before form submission
function validateOptions() {
  const optionInputs = document.querySelectorAll('#editPollForm .option-input');
  let validCount = 0;

  optionInputs.forEach(input => {
    if (input.value.trim().length > 0) {
      validCount++;
    }
  });

  // Clear previous validation state
  optionInputs.forEach(input => {
    input.setCustomValidity('');
  });

  if (validCount < 2) {
    // Set error on first two inputs
    optionInputs[0].setCustomValidity('Please enter at least two valid options.');
    optionInputs[1].setCustomValidity('Please enter at least two valid options.');
    return false;
  }

  return true;
}

// Edit poll confirmation script
function confirmEdit(event) {
  event.preventDefault();

  const optionInputs = document.querySelectorAll('.option-input');
  const filledOptions = Array.from(optionInputs).filter(input => input.value.trim() !== '');

  if (filledOptions.length < 2) {
    // Find the first option input and show native tooltip
    optionInputs[0].setCustomValidity('Please enter at least two options.');
    optionInputs[0].reportValidity();

    // Clear the error after a short delay
    setTimeout(() => {
      optionInputs[0].setCustomValidity('');
    }, 2000);
    return false;
  }

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

function setupDeleteAllListener() {
  const form = document.getElementById('deleteAllForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // Stop form from submitting immediately

    Swal.fire({
      title: 'Delete All Polls?',
      text: 'This will permanently delete all polls you’ve created.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete all!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545'
    }).then(result => {
      if (result.isConfirmed) {
        form.submit(); // Only submit if confirmed
      }
    });
  });
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

  if (urlParams.get('deletedAll') === 'true') {
    Swal.fire({
      icon: 'success',
      title: 'All Polls Deleted',
      text: 'All your polls have been removed.',
      confirmButtonColor: '#003366'
    }).then(() => {
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    });
  }

  // Attach reset button listener
  const resetBtn = document.getElementById('resetEditBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetEditPollForm);
  }

  // Attach delete all polls confirmation listener
  const deleteAllForm = document.getElementById('deleteAllForm');
  if (deleteAllForm) {
    deleteAllForm.addEventListener('submit', function (e) {
      e.preventDefault();

      Swal.fire({
        title: 'Delete All Polls?',
        text: 'This will permanently delete all polls you’ve created.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete all!',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545'
      }).then(result => {
        if (result.isConfirmed) {
          deleteAllForm.submit();
        }
      });
    });
  }
});
