// All the code related to the save functionality working on the polls.ejs page

document.addEventListener('DOMContentLoaded', () => {
  const saveToggleButtons = document.querySelectorAll('.save-toggle-btn');
    // making sure save buttons are on the page
    // what happens when the user saves a poll from the polls page 
  if (saveToggleButtons) {
    saveToggleButtons.forEach(button => {
      button.addEventListener('click', async (event) => {
        // fixed accessibility issue coming from the save button here
        const button = event.currentTarget;
        const pollId = button.dataset.pollId;
        const icon = button.querySelector('i');

        // poll is currently saved is the star icon is filled 
        const isCurrentlySaved = icon.classList.contains('bi-star-fill');
        const method = isCurrentlySaved ? 'DELETE' : 'POST';
        // using the save and unsave poll routes
        const apiUrl = isCurrentlySaved ? `/unsave-poll/${pollId}` : `/save-poll/${pollId}`;

        // Sending a request to the API
        try {
          const response = await fetch(apiUrl, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
            },
          });
          // converting JSON into JavaScript object
          const data = await response.json();

          if (response.ok && data.message) {
            // toggling star icon between filled state and unfilled state
            icon.classList.toggle('bi-star');
            icon.classList.toggle('bi-star-fill');
          } else {
            // if error occurrs and a poll cannot save
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
   const savedPollsScript = document.getElementById('saved-polls-data');
let savedPolls = [];

if (savedPollsScript?.textContent) {
  try {
    savedPolls = JSON.parse(savedPollsScript.textContent);
  } catch (err) {
    console.error('Could not parse saved polls data:', err);
  }
}

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
