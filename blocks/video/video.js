/*
 * Video (cmp-p04).
 *
 * The source page ships a Brightcove video.js player: roughly 30KB of vendor
 * runtime injected before anything is painted. The authored payload behind all
 * of that is only a Brightcove account/player/video triple plus a poster, so
 * this block renders a facade instead — poster and play button on load, the
 * real player only once a visitor asks for it. No vendor JS is fetched
 * eagerly, so the block costs one lazy image until it is used.
 *
 * Markup contract — simple block, so the two authoring surfaces deliver
 * different row structures:
 *
 *   Universal Editor                 Document
 *   block > div > div  (url)         block > div > div  (url)
 *   block > div > div  (poster)                  > div  (poster)
 *   block > div > div  (title)                   > div  (title)
 *         3 rows x 1 cell                  1 row x 3 cells
 *
 * decorate() classifies cells by content and never by position, so an omitted
 * field cannot shift the ones that remain.
 *
 * Variants (block classes): `square`, `vertical`. Default is 16:9.
 */

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/* account / player / videoId, the way the Brightcove embed code prints it */
const BRIGHTCOVE_TRIPLE = /^(\d+)\s*\/\s*([A-Za-z0-9_-]+)\s*\/\s*(\d+)$/;
const BRIGHTCOVE_URL = /players\.brightcove\.net\/(\d+)\/([A-Za-z0-9_-]+?)(?:_default)?\/index\.html/i;
const YOUTUBE_URL = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
const VIMEO_URL = /vimeo\.com\/(?:video\/)?(\d+)/i;
const FILE_URL = /\.(mp4|webm|ogv)(?:$|[?#])/i;
/* only an absolute reference may fall through to the generic embed branch */
const ABSOLUTE_URL = /^(?:https?:)?\/\//i;

/**
 * Parses a value into a URL without throwing on an author typo.
 * @param {string} value The authored value
 * @returns {URL|null} The parsed URL, or null when the value is not one
 */
function toUrl(value) {
  try {
    return new URL(value, window.location.href);
  } catch (e) {
    return null;
  }
}

/**
 * Resolves an authored video reference into something embeddable.
 *
 * Returns null rather than throwing for anything unrecognised, so a half
 * filled-in block degrades to its poster instead of breaking the page.
 * @param {string} raw The authored URL, or an account/player/videoId triple
 * @returns {{type: string, src: string}|null} The resolved source
 */
function parseSource(raw) {
  const value = (raw || '').trim();
  if (!value) return null;

  const triple = value.match(BRIGHTCOVE_TRIPLE);
  if (triple) {
    const [, account, player, videoId] = triple;
    return {
      type: 'brightcove',
      src: `https://players.brightcove.net/${account}/${player}_default/index.html`
        + `?videoId=${videoId}&autoplay=1&playsinline=1`,
    };
  }

  const brightcove = value.match(BRIGHTCOVE_URL);
  if (brightcove) {
    const [, account, player] = brightcove;
    const videoId = toUrl(value)?.searchParams.get('videoId') || '';
    return {
      type: 'brightcove',
      src: `https://players.brightcove.net/${account}/${player}_default/index.html`
        + `?videoId=${videoId}&autoplay=1&playsinline=1`,
    };
  }

  const youtube = value.match(YOUTUBE_URL);
  if (youtube) {
    return {
      type: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${youtube[1]}?autoplay=1&rel=0`,
    };
  }

  const vimeo = value.match(VIMEO_URL);
  if (vimeo) {
    return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  }

  if (FILE_URL.test(value)) {
    return { type: 'file', src: value };
  }

  // an unknown provider is still worth trying in an iframe, but only when the
  // author gave an absolute reference — `new URL` would happily resolve a
  // sentence like "Watch our video" against the current page
  if (ABSOLUTE_URL.test(value)) {
    const url = toUrl(value);
    if (url) return { type: 'embed', src: url.href };
  }

  return null;
}

/**
 * Classifies one authored cell by content, never by position.
 * @param {Element} cell The cell to classify
 * @returns {string} 'poster' | 'url' | 'title' | 'empty'
 */
function classifyCell(cell) {
  if (cell.querySelector('picture, img')) return 'poster';
  const content = cell.textContent.trim();
  if (!content && !cell.children.length) return 'empty';
  if (cell.querySelector('a[href]')) return 'url';
  return parseSource(content) ? 'url' : 'title';
}

/**
 * Rebuilds the authored poster as an optimized, lazily loaded picture.
 * @param {Element} cell The poster cell
 * @returns {Element|null} The poster picture, or null when none was authored
 */
function buildPoster(cell) {
  const img = cell.querySelector('img');
  if (!img) return null;
  const picture = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
  const optimizedImg = picture.querySelector('img');
  optimizedImg.setAttribute('loading', 'lazy');
  // createOptimizedPicture copies only src/alt — carry the real dimensions
  if (img.getAttribute('width')) optimizedImg.setAttribute('width', img.getAttribute('width'));
  if (img.getAttribute('height')) optimizedImg.setAttribute('height', img.getAttribute('height'));
  moveInstrumentation(img, optimizedImg);
  picture.classList.add('video-poster');
  return picture;
}

/**
 * Builds the play affordance shown on top of the poster.
 * Inline rather than an /icons/*.svg fetch so the facade needs no second
 * request before it is interactive.
 * @returns {Element} The decorative play glyph
 */
function createPlayGlyph() {
  const glyph = document.createElement('span');
  glyph.className = 'video-play';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 6.5 18 12l-9 5.5z" fill="currentColor"/></svg>';
  return glyph;
}

/**
 * Builds the real player. Called on activation only.
 * @param {{type: string, src: string}} source The resolved source
 * @param {string} name The authored title, used as the accessible name
 * @returns {Element} The player element
 */
function createPlayer(source, name) {
  if (source.type === 'file') {
    const video = document.createElement('video');
    video.className = 'video-player';
    video.src = source.src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (name) video.setAttribute('title', name);
    return video;
  }

  const iframe = document.createElement('iframe');
  iframe.className = 'video-player';
  iframe.src = source.src;
  // an iframe without an accessible name is a WCAG 4.1.2 failure, so there is
  // always a fallback here even when the author left the title empty
  iframe.title = name || 'Video player';
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('loading', 'lazy');
  return iframe;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];

  let source = null;
  let posterCell = null;
  let name = '';

  cells.forEach((cell) => {
    const kind = classifyCell(cell);
    if (kind === 'poster' && !posterCell) {
      posterCell = cell;
    } else if (kind === 'url' && !source) {
      const link = cell.querySelector('a[href]');
      source = parseSource(link ? link.href : cell.textContent.trim());
    } else if (kind === 'title' && !name) {
      name = cell.textContent.trim();
    }
  });

  const frame = document.createElement('div');
  frame.className = 'video-frame';
  const poster = posterCell ? buildPoster(posterCell) : null;
  // the cell carries the poster field's instrumentation and is dropped here,
  // so hand it to the frame or the image stops being editable in UE
  if (posterCell) moveInstrumentation(posterCell, frame);

  if (!source) {
    // nothing playable was authored — show the poster rather than an empty box
    if (poster) {
      frame.append(poster);
      block.replaceChildren(frame);
    } else {
      block.replaceChildren();
    }
    return;
  }

  frame.dataset.videoType = source.type;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'video-trigger';
  trigger.setAttribute('aria-label', name ? `Play video: ${name}` : 'Play video');
  if (poster) trigger.append(poster);
  trigger.append(createPlayGlyph());
  frame.append(trigger);

  // a real <button> means Enter and Space already activate it; no extra
  // keydown handling, and no keyboard trap
  trigger.addEventListener('click', () => {
    const player = createPlayer(source, name);
    frame.replaceChildren(player);
    player.focus({ preventScroll: true });
  });

  block.replaceChildren(frame);
}
