// Click-to-play videos: nothing is loaded from YouTube until the visitor presses play.
// Without JavaScript the picture is simply a link to the video on YouTube.
document.querySelectorAll('.video-box').forEach(function (box) {
  box.addEventListener('click', function (e) {
    e.preventDefault();
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(box.dataset.video) + '?autoplay=1&rel=0';
    f.title = box.dataset.title || 'Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    box.classList.add('playing');
    box.replaceChildren(f);
  });
});
