import { describe, it, expect } from 'vitest'
import { exceptionFromUnknown, safeSerialize } from './exception'

describe('exceptionFromUnknown', () => {
  it('leaves a real Error instance unchanged (regression guard)', () => {
    const result = exceptionFromUnknown(new Error('boom'))
    expect(result.type).toBe('Error')
    expect(result.value).toBe('boom')
    expect(result.extra).toBeUndefined()
  })

  it('uses a subclassed Error name unchanged', () => {
    class RangeishError extends Error {
      constructor(msg: string) {
        super(msg)
        this.name = 'RangeishError'
      }
    }
    const result = exceptionFromUnknown(new RangeishError('out of range'))
    expect(result.type).toBe('RangeishError')
    expect(result.value).toBe('out of range')
  })

  it('describes a plain object throw by its keys, not [object Object]', () => {
    const result = exceptionFromUnknown({ code: 'E_X', detail: 'nope' })
    expect(result.type).toBe('Error')
    expect(result.value).toBe('Non-Error exception captured with keys: code, detail')
    expect(result.value).not.toContain('[object Object]')
    expect(result.extra?.__serialized__).toEqual({ code: 'E_X', detail: 'nope' })
  })

  it('uses the promise-rejection phrasing when kind is promise rejection', () => {
    const result = exceptionFromUnknown({ foo: 'bar' }, 'promise rejection')
    expect(result.value).toBe('Non-Error promise rejection captured with keys: foo')
  })

  it('prefers a usable .message but still attaches the serialized object', () => {
    const result = exceptionFromUnknown({ message: 'custom msg', extra: 1 })
    expect(result.value).toBe('custom msg')
    expect(result.extra?.__serialized__).toEqual({ message: 'custom msg', extra: 1 })
  })

  it('uses a non-empty .name as the type for a non-Error object', () => {
    const result = exceptionFromUnknown({ name: 'ValidationFault', message: 'bad input' })
    expect(result.type).toBe('ValidationFault')
    expect(result.value).toBe('bad input')
  })

  it('renders a string throw as the readable string itself', () => {
    const result = exceptionFromUnknown('a string error')
    expect(result.value).toBe('a string error')
    expect(result.extra).toBeUndefined()
  })

  it('renders a number throw as its string form', () => {
    const result = exceptionFromUnknown(42)
    expect(result.value).toBe('42')
  })

  it('renders a boolean throw as its string form', () => {
    const result = exceptionFromUnknown(false)
    expect(result.value).toBe('false')
  })

  it('gives null a sensible placeholder instead of crashing or [object Object]', () => {
    const result = exceptionFromUnknown(null)
    expect(result.value).not.toContain('[object Object]')
    expect(result.value).toBe('Non-Error exception captured with value: null')
  })

  it('gives undefined a sensible placeholder', () => {
    const result = exceptionFromUnknown(undefined)
    expect(result.value).toBe('Non-Error exception captured with value: undefined')
  })

  it('does not throw on a circular object and marks the cycle as [Circular]', () => {
    const o: Record<string, unknown> = {}
    o.self = o
    let result: ReturnType<typeof exceptionFromUnknown> | undefined
    expect(() => {
      result = exceptionFromUnknown(o)
    }).not.toThrow()
    expect((result?.extra?.__serialized__ as Record<string, unknown>).self).toBe('[Circular]')
  })
})

describe('safeSerialize', () => {
  it('caps total keys per level to 50', () => {
    const big: Record<string, unknown> = {}
    for (let i = 0; i < 200; i++) big[`k${i}`] = i
    const out = safeSerialize(big) as Record<string, unknown>
    expect(Object.keys(out).length).toBeLessThanOrEqual(50)
  })

  it('caps array length to 50', () => {
    const arr = Array.from({ length: 200 }, (_, i) => i)
    const out = safeSerialize(arr) as unknown[]
    expect(out.length).toBeLessThanOrEqual(50)
  })

  it('caps string length to 1024 characters', () => {
    const out = safeSerialize({ s: 'x'.repeat(5000) }) as { s: string }
    expect(out.s.length).toBeLessThanOrEqual(1024)
  })

  it('caps nesting depth and never throws on deeply nested input', () => {
    let deep: Record<string, unknown> = { leaf: 'bottom' }
    for (let i = 0; i < 10; i++) deep = { nested: deep }
    let out: unknown
    expect(() => {
      out = safeSerialize(deep)
    }).not.toThrow()
    // the leaf is beyond the depth cap, so it must not survive serialization
    expect(JSON.stringify(out)).not.toContain('bottom')
  })

  it('replaces a circular reference with [Circular] instead of throwing', () => {
    const o: Record<string, unknown> = { a: 1 }
    o.self = o
    const out = safeSerialize(o) as Record<string, unknown>
    expect(out.self).toBe('[Circular]')
    expect(out.a).toBe(1)
  })

  it('replaces functions with [Function]', () => {
    const out = safeSerialize({ fn: () => 'x' }) as Record<string, unknown>
    expect(out.fn).toBe('[Function]')
  })

  it('drops undefined values', () => {
    const out = safeSerialize({ a: undefined, b: 1 }) as Record<string, unknown>
    expect('a' in out).toBe(false)
    expect(out.b).toBe(1)
  })

  it('stringifies bigint and symbol values', () => {
    const out = safeSerialize({ big: BigInt(10), sym: Symbol('x') }) as Record<string, unknown>
    expect(out.big).toBe('10')
    expect(out.sym).toBe('Symbol(x)')
  })
})
