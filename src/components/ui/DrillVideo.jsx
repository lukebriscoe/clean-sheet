import { useState } from 'react'
import { isVideoId } from '../../lib/schema.js'

// A drill's video, embedded without handing YouTube a coach on arrival.
//
// The panel below is drawn from our own tokens — it is NOT a YouTube thumbnail.
// Loading i.ytimg.com would put a request to Google on every drill page whether
// or not anyone watches anything, and this app has no auth, no analytics and no
// tracking; quietly making that request on a volunteer's behalf is exactly the
// thing the rest of the project avoids. Nothing leaves the device until the
// coach taps. It is also faster on a touchline connection, and the thumbnail
// would only have been the title card we generated anyway.
//
// SECURITY: `videoId` may arrive from a session's drillSnapshot, which
// firestore.rules never validates (it only checks `blocks` is a list of 30 or
// fewer). So it is anonymous input on its way to an iframe src and goes through
// isVideoId() first — the same posture BlockDetail takes with references.

export default function DrillVideo({ videoId, drillName = 'this drill' }) {
  const [playing, setPlaying] = useState(false)
  if (!isVideoId(videoId)) return null

  const id = videoId.trim()

  return (
    <figure className="m-0">
      {playing ? (
        <iframe
          // youtube-nocookie, and only ever after a deliberate tap.
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`${drillName} — drill video`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="mx-auto block aspect-[9/16] w-full max-w-[260px] rounded-md border border-line"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          // Vertical, because the video is — so tapping play does not make the
          // panel jump to a different shape.
          className="mx-auto flex aspect-[9/16] w-full max-w-[260px] flex-col items-center justify-center gap-3 rounded-md border border-line bg-paper text-pitch transition-colors hover:bg-chalk"
        >
          {/* Pitch green, not high-vis. --hivis means "now" and nothing else;
              a play button is an affordance, not a state. */}
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pitch">
            <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-[2px]" aria-hidden="true">
              <path d="M6 3.5 L20 12 L6 20.5 z" fill="rgb(var(--chalk))" />
            </svg>
          </span>
          <span className="text-sm font-semibold">Watch this drill</span>
          <span className="text-xs text-mist">Plays on YouTube</span>
        </button>
      )}

      {/* print.css hides every button, which is right — a play control is no use
          on paper. But the video should not vanish from a printed plan entirely,
          so the link comes back in its place. See CLAUDE.md. */}
      <figcaption className="hidden text-xs text-mist print:block">
        Video: youtu.be/{id}
      </figcaption>
    </figure>
  )
}
