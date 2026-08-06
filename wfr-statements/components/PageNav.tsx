'use client'

import Link from 'next/link'

export const HOME_HREF = '/statements'

/**
 * Asked before a navigation that throws away entered work. Worded like the
 * form's own period-change guard — what will be lost, then "Continue?" — so
 * the two prompts a contractor can meet read as one voice.
 */
export const LEAVE_CONFIRM_MESSAGE =
  'Returning to the home screen will discard everything you have entered. Continue?'

/**
 * The way out of a screen. Every screen a contractor can reach gets one:
 * before this, a contractor part-way into a form or a review had no
 * signposted route anywhere except forward.
 *
 * `onBack` is a callback rather than a route because the form's steps
 * (edit → review) are React state, not navigation — a browser Back would
 * leave the app entirely rather than returning to the form.
 *
 * `hasUnsavedEntries` is the guard. Nothing here is persisted: the entered
 * fortnight lives only in React state, so following the home link discards
 * it outright — fourteen days of work gone from a link sitting directly
 * under "Review statement". It defaults to false so the screens with nothing
 * at stake (the submissions list, the success screen) can never nag, and a
 * form with an empty grid does not either: a prompt that fires when there is
 * nothing to lose is the fastest way to teach a contractor to dismiss it
 * unread.
 */
export function PageNav({
  onBack,
  backLabel = 'Back',
  hasUnsavedEntries = false,
}: {
  onBack?: () => void
  backLabel?: string
  hasUnsavedEntries?: boolean
}) {
  function handleHomeClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!hasUnsavedEntries) return
    if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) event.preventDefault()
  }

  return (
    <div className="flex gap-3 text-sm">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg bg-white p-3 text-center font-medium shadow-sm"
        >
          {backLabel}
        </button>
      ) : null}
      <Link
        href={HOME_HREF}
        onClick={handleHomeClick}
        className="flex-1 rounded-lg bg-white p-3 text-center font-medium shadow-sm"
      >
        Return to home screen
      </Link>
    </div>
  )
}
