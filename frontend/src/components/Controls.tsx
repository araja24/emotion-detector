type Props = {
  showDots: boolean
  showLines: boolean
  paused: boolean
  onShowDotsChange: (value: boolean) => void
  onShowLinesChange: (value: boolean) => void
  onPausedChange: (value: boolean) => void
}

/** Switches under the video: dots on/off, lines on/off, pause/resume. */
export function Controls({ showDots, showLines, paused, onShowDotsChange, onShowLinesChange, onPausedChange }: Props) {
  return (
    <div className="controls">
      <label className="toggle">
        <input type="checkbox" checked={showDots} onChange={(e) => onShowDotsChange(e.target.checked)} />
        <span className="toggle__switch" aria-hidden="true" />
        Dots
      </label>
      <label className="toggle">
        <input type="checkbox" checked={showLines} onChange={(e) => onShowLinesChange(e.target.checked)} />
        <span className="toggle__switch" aria-hidden="true" />
        Lines
      </label>
      <button
        type="button"
        className="button button--ghost button--small"
        aria-pressed={paused}
        onClick={() => onPausedChange(!paused)}
      >
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>
    </div>
  )
}
