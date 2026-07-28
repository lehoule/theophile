export function youtubeEmbedUrl(url: string): string {
  const parsed = new URL(url);
  let videoId = '';

  if (parsed.hostname === 'youtu.be') {
    videoId = parsed.pathname.slice(1);
  } else if (
    parsed.hostname === 'youtube.com' ||
    parsed.hostname === 'www.youtube.com'
  ) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v') || '';
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.slice('/embed/'.length);
    }
  }

  if (!/^[\w-]{11}$/.test(videoId)) {
    throw new Error(`Invalid YouTube URL: ${url}`);
  }

  return `https://www.youtube.com/embed/${videoId}`;
}
