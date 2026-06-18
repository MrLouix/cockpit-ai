import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    directory: { type: String, required: true },
    titre: { type: String, required: true },
  },
  { timestamps: true }
);

sessionSchema.index({ directory: 1 });

export const Session = mongoose.model('Session', sessionSchema);
export default Session;
