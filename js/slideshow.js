/**
 * Slideshow module - cycles through configured images
 */
const Slideshow = (() => {
  let images = [];
  let currentIndex = 0;
  let interval;
  let imgEl;

  function init() {
    const config = HOMEBOARD_CONFIG.slideshow;
    imgEl = document.getElementById('slideshow-img');

    if (!config.images || config.images.length === 0) {
      // Use placeholder images if none configured
      images = [
        'https://picsum.photos/800/400?random=1',
        'https://picsum.photos/800/400?random=2',
        'https://picsum.photos/800/400?random=3'
      ];
    } else {
      images = config.images;
    }

    show(0);
    interval = setInterval(next, config.intervalSeconds * 1000);

    document.getElementById('slide-prev').addEventListener('click', prev);
    document.getElementById('slide-next').addEventListener('click', next);
  }

  function show(index) {
    currentIndex = ((index % images.length) + images.length) % images.length;
    imgEl.src = images[currentIndex];
    imgEl.alt = `Slideshow image ${currentIndex + 1} of ${images.length}`;
  }

  function next() {
    show(currentIndex + 1);
    resetInterval();
  }

  function prev() {
    show(currentIndex - 1);
    resetInterval();
  }

  function resetInterval() {
    clearInterval(interval);
    interval = setInterval(next, HOMEBOARD_CONFIG.slideshow.intervalSeconds * 1000);
  }

  return { init };
})();
