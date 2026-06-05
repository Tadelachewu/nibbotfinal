import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ChatBubble } from '../ChatBubble'

describe('ChatBubble', () => {
  test('renders bot bubble with text and bot avatar fallback', () => {
    render(<ChatBubble isBot={true} botAvatar={{ text: 'AI' }}>Hello Bot</ChatBubble>)
    expect(screen.getByText('Hello Bot')).toBeInTheDocument()
    // bot avatar fallback text should be present in DOM (hidden in image fallback)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  test('renders user bubble aligned to the right with user avatar', () => {
    render(<ChatBubble isBot={false} userAvatar={{ text: 'ME' }}>User says hi</ChatBubble>)
    expect(screen.getByText('User says hi')).toBeInTheDocument()
    expect(screen.getByText('ME')).toBeInTheDocument()
  })
})
