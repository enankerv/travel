export const SKIP_WORDS = [
  'favicon',
  'icon',
  'logo',
  'avatar',
  'badge',
  'sprite',
  'pixel',
  '1x1',
  'tracking',
  'analytics',
  'beacon',
  'spacer',
  'blank',
  'gravatar',
  'profile-pic',
  'emoji',
  'arrow',
  'button',
  'social',
  'share',
  'flag',
  'rating',
  'star',
  'check',
  'bullet',
  'caret',
  'spinner',
  'loader',
  'placeholder',
  'widget',
  'banner-ad',
  'static/packages',
  '/user/',
  'profile_pic',
  'superhog',
  'footer',
];

export function scoreImg(img, skipWords = SKIP_WORDS) {
  const src = img.getAttribute('src') || '';
  const srcLower = src.toLowerCase();

  if (/\.svg|\.gif/i.test(src)) return -1;

  const isAirbnbPhoto =
    srcLower.includes('muscache.com') && srcLower.includes('/im/pictures/');

  if (srcLower.includes('muscache.com') && !isAirbnbPhoto) return -1;
  if (isAirbnbPhoto && srcLower.includes('platform-assets')) return -1;
  if (isAirbnbPhoto && srcLower.includes('/user/')) return -1;

  if (!isAirbnbPhoto && skipWords.some((w) => srcLower.includes(w))) return -1;

  const rawW = img.getAttribute('width') || '';
  const rawH = img.getAttribute('height') || '';
  let w = rawW.includes('%') ? 0 : (parseInt(rawW) || 0);
  let h = rawH.includes('%') ? 0 : (parseInt(rawH) || 0);

  if (!w || !h) {
    const m = src.match(/[-_](\d+)x(\d+)/);
    if (m) {
      w = parseInt(m[1]);
      h = parseInt(m[2]);
    }
  }

  if (isAirbnbPhoto) {
    const imW = src.match(/[?&]im_w=(\d+)/);
    if (imW) w = parseInt(imW[1]);
  }

  if (!isAirbnbPhoto && ((w > 0 && w < 120) || (h > 0 && h < 120))) return -1;

  const area = w && h ? w * h : 0;
  const alt = (img.getAttribute('alt') || '').toLowerCase();
  const hasPhotoHint = /villa|house|pool|view|bedroom|exterior|interior|garden|terrace|property|photo|listing/i.test(
    alt + ' ' + src
  );
  const isJpeg = /\.(jpe?g|webp)/i.test(src);

  return area + (hasPhotoHint ? 500000 : 0) + (isJpeg ? 100000 : 0);
}
