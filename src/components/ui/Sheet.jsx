import { useEffect, useRef } from 'react'

/**
 * A bottom sheet, on a native <dialog>.
 *
 * Same reasoning as DrillDetail: the browser gives us focus trapping, Escape,
 * the Android back button and the backdrop for free, and does it better with a
 * screen reader than anything hand-rolled. This is the mobile-width home for
 * panels that live in the right-hand rail on desktop.
 *
 * It sits at the bottom rather than centred because it is opened by a control at
 * the bottom of the screen and used one-handed — a centred modal puts its
 * contents under the thumb that just tapped, and its close button out of reach.
 */
export default function Sheet({ open, onClose, title, children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [open, onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className="sheet no-print w-full max-w-none border-t border-line bg-paper p-0 text-ink backdrop:bg-ink/40"
      onClick={event => {
        if (event.target === dialogRef.current) dialogRef.current.close()
      }}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2">
          <h2 className="font-display text-lg font-bold text-pitch">{title}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="btn-icon ml-auto"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  )
}
