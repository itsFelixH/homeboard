/**
 * Slideshow module - cycles through images
 * Auto-discovers images from data/photos/ folder via /api/photos endpoint.
 * Falls back to config.slideshow.images, then picsum.photos placeholders.
 */
const Slideshow = (() => {
  let images = [];
  let currentIndex = 0;
  let interval;
  let imgEl;

  async function init() {
    const config = HOMEBOARD_CONFIG.slideshow;
    imgEl = document.getElementById('slideshow-img');

    // Try auto-discover from data/photos/ folder
    if (!config.images || config.images.length === 0) {
      try {
        const res = await fetch('/api/photos');
        if (res.ok) {
          const discovered = await res.json();
          if (discovered.length > 0) {
            images = discovered;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Fall back to config images
    if (images.length === 0 && config.images && config.images.length > 0) {
      images = config.images;
    }

    // Final fallback: placeholders
    if (images.length === 0) {
      images = [
        'https://picsum.photos/800/400?random=1',
        'https://picsum.photos/800/400?random=2',
        'https://picsum.photos/800/400?random=3'
      ];
    }

    show(0);
    interval = setInterval(next, (config.intervalSeconds || 30) * 1000);

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
    interval = setInterval(next, (HOMEBOARD_CONFIG.slideshow.intervalSeconds || 30) * 1000);
  }

  return { init };
})();
