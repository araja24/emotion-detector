/** The 8 feelings the models know, in the order the backend sends them. */
export const EMOTIONS = ['neutral', 'happiness', 'surprise', 'sadness', 'anger', 'disgust', 'fear', 'contempt'] as const
export type Emotion = (typeof EMOTIONS)[number]
export type EmotionScores = Record<Emotion, number>

/**
 * "One light per mood" (from the Mien design): whichever emotion leads tints the aura, stage
 * rim, logo, mesh and floating label. `voice` is the one-line reading in the panel.
 */
export const EMOTION_INFO: Record<Emotion, { label: string; emoji: string; color: string; voice: string }> = {
  neutral: { label: 'Neutral', emoji: '😐', color: '#A9B4C4', voice: 'Resting face. Very composed.' },
  happiness: { label: 'Happy', emoji: '😊', color: '#FFC94D', voice: 'That’s a real smile, eyes and all.' },
  surprise: { label: 'Surprised', emoji: '😮', color: '#FF9A4D', voice: 'Eyebrows up. Something caught you off guard.' },
  sadness: { label: 'Sad', emoji: '😢', color: '#5FA2FF', voice: 'Corners down. Rough moment?' },
  anger: { label: 'Angry', emoji: '😠', color: '#FF6161', voice: 'Brow knitted tight. Deep breath?' },
  disgust: { label: 'Disgusted', emoji: '🤢', color: '#8FD460', voice: 'Nose wrinkle detected.' },
  fear: { label: 'Fearful', emoji: '😨', color: '#B28CFF', voice: 'Wide eyes, tense mouth.' },
  contempt: { label: 'Contempt', emoji: '😒', color: '#FF7EC8', voice: 'A one-sided smirk. Noted.' },
}

/** Accent while the camera runs but nothing is being read (no face, offline, loading). */
export const NEUTRAL_ACCENT = '#7C8392'

/** Short, honest names for the model picker (the backend's own names are more technical). */
export const MODEL_LABELS: Record<string, string> = {
  'hsemotion-b0': 'Balanced',
  'hsemotion-b2': 'Large',
  ferplus: 'Classic',
}
