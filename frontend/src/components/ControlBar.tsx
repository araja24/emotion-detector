import type { ModelInfo } from '../hooks/useEmotionSocket'
import { MODEL_LABELS } from '../lib/emotions'
import { CameraIcon, PauseIcon, PlayIcon } from './icons'

type Props = {
  live: boolean
  paused: boolean
  showDots: boolean
  showMesh: boolean
  models: ModelInfo[]
  activeModel: string | null
  onToggleCamera: () => void
  onTogglePause: () => void
  onToggleDots: () => void
  onToggleMesh: () => void
  onModelChange: (id: string) => void
}

/** Camera on/off, pause, the Dots / Mesh switches and (when there's a choice) the model picker. */
export function ControlBar(props: Props) {
  const { live, paused } = props
  return (
    <div className="controls">
      <button
        type="button"
        className={`btn ${live ? 'btn--ghost' : 'btn--light'}`}
        onClick={props.onToggleCamera}
      >
        <CameraIcon />
        {live ? 'Stop camera' : 'Start camera'}
      </button>
      <button type="button" className="btn btn--quiet" onClick={props.onTogglePause} disabled={!live}>
        {paused ? <PlayIcon /> : <PauseIcon />}
        {paused ? 'Resume' : 'Pause'}
      </button>
      <span className="controls__divider" aria-hidden="true" />
      <Switch label="Dots" on={props.showDots} onToggle={props.onToggleDots} />
      <Switch label="Mesh" on={props.showMesh} onToggle={props.onToggleMesh} />

      {props.models.length > 1 && (
        <div className="controls__model">
          <label htmlFor="mien-model">Model</label>
          <select
            id="mien-model"
            value={props.activeModel ?? ''}
            onChange={(e) => props.onModelChange(e.target.value)}
          >
            {props.models.map((m) => (
              <option key={m.id} value={m.id}>
                {MODEL_LABELS[m.id] ?? m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn btn--switch" aria-pressed={on} onClick={onToggle}>
      <span className="switch" aria-hidden="true">
        <span className="switch__knob" />
      </span>
      {label}
    </button>
  )
}
