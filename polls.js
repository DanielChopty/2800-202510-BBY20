// All the code related to the save functionality working on the polls.ejs page

document.addEventListener('DOMContentLoaded', () => {
  const saveToggleButtons = document.querySelectorAll('.save-toggle-btn');

  if (saveToggleButtons) {
    saveToggleButtons.forEach(button => {
      button.addEventListener('click', async (event) => {
        const pollId = event.target.dataset.pollId;
        const icon = event.target.querySelector('i');
        const isCurrentlySaved = icon.classList.contains('bi-star-fill');
        const method = isCurrentlySaved ? 'DELETE' : 'POST';
        const apiUrl = isCurrentlySaved ? `/unsave-poll/${pollId}` : `/save-poll/${pollId}`;

        try {
          const response = await fetch(apiUrl, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (response.ok && data.message) {
            icon.classList.toggle('bi-star');
            icon.classList.toggle('bi-star-fill');
          } else {
            console.error('Error toggling save:', data);
            alert('Failed to toggle save.');
          }
        } catch (error) {
          console.error('Network error:', error);
          alert('Network error occurred.');
        }
      });
    });

    // Initially set the correct star icon based on user's saved polls (if logged in)
    const savedPolls = JSON.parse(document.getElementById('saved-polls-data')?.textContent || '[]');
    saveToggleButtons.forEach(button => {
      const pollId = button.dataset.pollId;
      const icon = button.querySelector('i');
      if (savedPolls.includes(pollId)) {
        icon.classList.remove('bi-star');
        icon.classList.add('bi-star-fill');
      }
    });
  }
});