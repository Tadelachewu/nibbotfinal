import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import { AdminAuthProvider, useAdminAuth } from '../AdminAuthContext'

function TestConsumer() {
  const { login, currentUsername } = useAdminAuth()
  return (
    <div>
      <div data-testid="username">{currentUsername}</div>
      <button onClick={() => login('admin', 'Admin@1234')}>do-login</button>
    </div>
  )
}

const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = jest.fn((input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.endsWith('/api/admin/auth/session')) {
      return Promise.resolve(new Response(JSON.stringify({ isAuthenticated: false })))
    }
    if (url.endsWith('/api/admin/auth/login')) {
      return Promise.resolve(new Response(JSON.stringify({ success: true, username: 'admin', role: 'admin', csrfToken: 'tok', mustChangePassword: false }), { status: 200 }))
    }
    return Promise.resolve(new Response('{}'))
  }) as any
})

afterEach(() => {
  global.fetch = originalFetch
  jest.resetAllMocks()
})

test('login via context updates username', async () => {
  render(
    <AdminAuthProvider>
      <TestConsumer />
    </AdminAuthProvider>
  )

  fireEvent.click(screen.getByText('do-login'))

  await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('admin'))
})
