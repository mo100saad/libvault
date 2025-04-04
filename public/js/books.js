document.addEventListener('DOMContentLoaded', function() {
    // Rating select styling
    const ratingSelects = document.querySelectorAll('select[id^="rating-"]');
    if (ratingSelects) {
      ratingSelects.forEach(select => {
        select.addEventListener('change', function() {
          const selectedValue = this.value;
          if (selectedValue) {
            this.classList.add('rated');
          } else {
            this.classList.remove('rated');
          }
        });
      });
    }
  });