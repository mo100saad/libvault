document.addEventListener('DOMContentLoaded', function() {
    // Confirm user deletion
    const deleteButtons = document.querySelectorAll('form[action*="/delete"] button');
    if (deleteButtons) {
      deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
          const confirm = window.confirm('Are you sure you want to delete this user? This action cannot be undone.');
          if (!confirm) {
            e.preventDefault();
          }
        });
      });
    }
  });