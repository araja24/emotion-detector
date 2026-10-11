/** The 8 feelings the FER+ model knows, in the order the backend sends them. */
export const EMOTIONS = ['neutral', 'happiness', 'surprise', 'sadness', 'anger', 'disgust', 'fear', 'contempt'] as const
export type Emotion = (typeof EMOTIONS)[number]
export type EmotionScores = Record<Emotion, number>

export const EMOTION_INFO: Record<Emotion, { label: string; emoji: string; color: string }> = {
  happiness: { label: 'Happy', emoji: '😀', color: '#facc15' },
  neutral: { label: 'Neutral', emoji: '😐', color: '#94a3b8' },
  surprise: { label: 'Surprise', emoji: '😮', color: '#f97316' },
  sadness: { label: 'Sad', emoji: '😢', color: '#60a5fa' },
  anger: { label: 'Angry', emoji: '😠', color: '#ef4444' },
  disgust: { label: 'Disgust', emoji: '🤢', color: '#4ade80' },
  fear: { label: 'Fear', emoji: '😨', color: '#a78bfa' },
  contempt: { label: 'Contempt', emoji: '😏', color: '#f472b6' },
}
