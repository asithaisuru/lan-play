import axios from 'axios';

export const extractYouTubeId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|music\.youtube\.com\/watch\?v=)([^&?#]+)/,
    /youtube\.com\/watch\?.*v=([^&?#]+)/,
    /youtu\.be\/([^&?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

export const getYouTubeVideoInfo = async (videoId) => {
  try {
    // Using oEmbed API for simple metadata (free, no API key required)
    const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    
    return {
      title: response.data.title,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0 // YouTube API required for duration
    };
  } catch (error) {
    throw new Error('Invalid YouTube URL or video not available');
  }
};