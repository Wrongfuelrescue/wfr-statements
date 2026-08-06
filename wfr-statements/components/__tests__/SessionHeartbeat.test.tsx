import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { SessionHeartbeat } from '../SessionHeartbeat'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('SessionHeartbeat', () => {
  it('renews the session when the contractor actually interacts', () => {
    const fetchMock = stubFetch()
    render(<SessionHeartbeat />)

    fireEvent.keyDown(window, { key: 'a' })

    expect(fetchMock).toHaveBeenCalledWith('/api/session/touch', { method: 'POST' })
  })

  it('pings at most once every two minutes, however much the contractor types', () => {
    const fetchMock = stubFetch()
    // A real wall-clock base: the throttle compares against Date.now().
    const start = new Date('2026-08-05T00:00:00Z').getTime()
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(start)
    render(<SessionHeartbeat />)

    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: 'b' })
    now.mockReturnValue(start + 60_000)
    fireEvent.keyDown(window, { key: 'c' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    now.mockReturnValue(start + 121_000)
    fireEvent.keyDown(window, { key: 'd' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // The whole point of the ten-minute idle timeout: a phone left on the
  // statement screen must lock. A timer-driven heartbeat would keep it alive
  // forever, so time passing with no interaction must ping nothing.
  it('never pings on a timer alone, so an abandoned phone still expires', () => {
    vi.useFakeTimers()
    const fetchMock = stubFetch()
    render(<SessionHeartbeat />)

    vi.advanceTimersByTime(30 * 60 * 1000)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const fetchMock = stubFetch()
    const { unmount } = render(<SessionHeartbeat />)
    unmount()

    fireEvent.keyDown(window, { key: 'a' })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
