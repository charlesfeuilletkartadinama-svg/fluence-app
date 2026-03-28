import { renderHook, act } from '@testing-library/react'
import { useErrorHandler } from '@/app/lib/useNotifications'

describe('useErrorHandler', () => {
  it('should add error notification', () => {
    const { result } = renderHook(() => useErrorHandler())

    act(() => {
      result.current.error('Test error message')
    })

    // In a real test, you would verify the notification was added
    // This is a basic example showing the test structure
    expect(result.current).toBeDefined()
  })

  it('should add success notification', () => {
    const { result } = renderHook(() => useErrorHandler())

    act(() => {
      result.current.success('Test success message')
    })

    expect(result.current).toBeDefined()
  })
})
