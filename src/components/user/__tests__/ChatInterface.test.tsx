/**
 * ChatInterface component tests
 * - Mocks fetch to provide app settings and menus
 * - Mocks socket.io-client to avoid real network
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('socket.io-client', () => ({
  io: (url: any, opts: any) => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    return {
      emit: jest.fn((ev: string, payload: any) => {
        // simulate ack handlers if provided
        return true
      }),
      on: jest.fn((ev: string, cb: (...args: unknown[]) => void) => {
        listeners[ev] = listeners[ev] || []
        listeners[ev].push(cb)
      }),
      disconnect: jest.fn(),
    }
  }
}))

// Minimal fetch mock sequence used by ChatInterface on mount
const originalFetch = global.fetch
beforeEach(() => {
  global.fetch = jest.fn((input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.endsWith('/api/admin/auth/session')) {
      return Promise.resolve(new Response(JSON.stringify({ isAuthenticated: false })))
    }
    if (url.endsWith('/api/app-settings')) {
      return Promise.resolve(new Response(JSON.stringify({ data: { supportedLanguages: [{ code: 'en', isDefault: true }] } })))
    }
    if (url.includes('/api/menus')) {
      return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'm1', name: 'Test Menu', parentId: null, order: 1 }] })))
    }
    if (url.endsWith('/api/session-cookie')) return Promise.resolve(new Response('{}'))
    if (url.endsWith('/api/logs')) return Promise.resolve(new Response('{}'))
    return Promise.resolve(new Response('{}'))
  }) as any
})
afterEach(() => {
  global.fetch = originalFetch
  jest.resetAllMocks()
})

import { ChatInterface } from '../ChatInterface'

test('renders welcome message and initial menu options', async () => {
  render(<ChatInterface />)
  // welcome message is inserted as a bot message with options
  await waitFor(() => expect(screen.getByText(/Please select an option|Select/)).toBeInTheDocument(), { timeout: 2000 })
})

test('sends a session start log and stores sessionId', async () => {
  // localStorage mocking for session id
  const store: Record<string,string> = {}
  jest.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation((k: string) => store[k] || null)
  jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation((k: string, v: string) => { store[k] = v })

  render(<ChatInterface />)

  await waitFor(() => expect(store['nib_user_session']).toBeDefined())
  // verify a call to /api/logs was made during session start
  expect((global.fetch as jest.Mock).mock.calls.some(call => String(call[0]).includes('/api/logs'))).toBe(true)
})
