import axios from 'axios';

// Simple TTS fallback - we'll use browser's SpeechSynthesis API on frontend
// Gemini TTS requires more complex setup, so we'll use browser TTS for now

export const generateAnnouncement = async (username, message) => {
  const announcementText = `This song was added by ${username}. They say: ${message}`;
  
  // Return the text - frontend will handle the actual TTS
  return announcementText;
};

// Alternative: Use Web Speech API on frontend directly
// This avoids needing Gemini API key and is simpler for LAN use