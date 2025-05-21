// All the code the will be needed for profile.ejs to accurately show saved polls

document.addEventListener('DOMContentLoaded', () => {
  const unsaveButtons = document.querySelectorAll('.save-toggle-btn.saved'); // Target only those already saved

  if (unsaveButtons) {
    unsaveButtons.forEach(button => {
      button.addEventListener('click', async (event) => {
        // fixed accessibility issue coming from the save button here
        const button = event.currentTarget;
        const pollId = button.dataset.pollId;

        try {
          // logic for unsaving a poll from a user's profile page 
          const response = await fetch(`/unsave-poll/${pollId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
          const data = await response.json();
          if (response.ok && data.message) {
            // Reload to update the list on the profile page
            window.location.reload();
          } else {
            // catching an error that occurs when unsaving a poll from the profile page
            console.error('Unsave error:', data);
            alert('Failed to unsave.');
          }
        } catch (error) {
          // catching when a network error occurrs 
          console.error('Network error:', error);
          alert('Network error.');
        }
      });
    });
  }


  // Initially the star is filled for saved items on load 
  const savedPollsOnLoad = document.querySelectorAll('.save-toggle-btn.saved i.bi-star');
  savedPollsOnLoad.forEach(icon => icon.classList.replace('bi-star', 'bi-star-fill'));
});
