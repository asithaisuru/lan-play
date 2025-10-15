import mongoose from "mongoose";

const songSchema = new mongoose.Schema({
  youtubeId: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String, required: true },
  duration: { type: Number, required: true },
  addedBy: { type: String, required: true },
  message: { type: String, default: "" },
  addedAt: { type: Date, default: Date.now },
});

const playlistSchema = new mongoose.Schema(
  {
    roomCode: { type: String, unique: true, required: true },
    ownerSocketId: { type: String, required: true },
    playlistName: { type: String, default: "LAN Play" },
    songs: [songSchema],
    currentPlaying: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
    isPlaying: { type: Boolean, default: false },
    currentTime: { type: Number, default: 0 },
    users: [
      {
        socketId: String,
        username: String,
        joinedAt: { type: Date, default: Date.now },
        isHost: { type: Boolean, default: false },
      },
    ],
    announcementEnabled: { type: Boolean, default: false },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Auto-delete rooms after 24 hours of inactivity
playlistSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("Playlist", playlistSchema);
