// All the code the will be needed for profile.ejs to accuratly show saved polls

document.addEventListener('DOMContentLoaded', () => {
  const unsaveButtons = document.querySelectorAll('.save-toggle-btn.saved'); // Target only those already saved

  if (unsaveButtons) {
    unsaveButtons.forEach(button => {
      button.addEventListener('click', async (event) => {
        const pollId = event.target.dataset.pollId;
        try {
          const response = await fetch(`/unsave-poll/${pollId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
          const data = await response.json();
          if (response.ok && data.message) {
            // Reload to update the list on the profile page
            window.location.reload();
          } else {
            console.error('Unsave error:', data);
            alert('Failed to unsave.');
          }
        } catch (error) {
          console.error('Network error:', error);
          alert('Network error.');
        }
      });
    });
  }


  // Initially ensure the star is filled for saved items on load 
  const savedPollsOnLoad = document.querySelectorAll('.save-toggle-btn.saved i.bi-star');
  savedPollsOnLoad.forEach(icon => icon.classList.replace('bi-star', 'bi-star-fill'));
});