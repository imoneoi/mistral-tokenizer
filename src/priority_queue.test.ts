import { PriorityQueue } from './priority_queue'

describe('PriorityQueue', () => {
  let queue: PriorityQueue<number>

  beforeEach(() => {
    queue = new PriorityQueue<number>()
  })

  test('is empty when initialized', () => {
    expect(queue.isEmpty()).toBe(true)
  })

  test('size is zero when initialized', () => {
    expect(queue.size()).toBe(0)
  })

  test('peek returns undefined on empty queue', () => {
    expect(queue.peek()).toBeUndefined()
  })

  test('push increases size', () => {
    queue.push(5)
    expect(queue.size()).toBe(1)
  })

  test('peek returns the first element', () => {
    queue.push(5)
    expect(queue.peek()).toBe(5)
  })

  test('pop returns and removes the first element', () => {
    queue.push(5, 3)
    expect(queue.pop()).toBe(5)
    expect(queue.size()).toBe(1)
  })

  test('pop returns undefined when queue is empty', () => {
    expect(queue.pop()).toBeUndefined()
  })

  test('maintains correct order with multiple elements', () => {
    queue.push(5, 3, 8)
    expect(queue.pop()).toBe(8) // Assuming the default comparator
    expect(queue.pop()).toBe(5)
    expect(queue.pop()).toBe(3)
  })

  test('replace swaps the top element', () => {
    queue.push(5, 3)
    expect(queue.replace(10)).toBe(5) // Replaces 5 with 10
    expect(queue.pop()).toBe(10)
  })

  test('replace returns undefined when queue is empty', () => {
    expect(queue.replace(10)).toBeUndefined()
  })

  test('stress test with a large number of elements', () => {
    queue.push(...Array.from(Array(10_000), () => Math.random()))
    expect(queue.size()).toBe(10_000)

    let prev = queue.pop()
    for (let i = 1; i < 10000; i++) {
      const current = queue.pop()
      expect(current).toBeDefined()
      expect(prev).toBeGreaterThanOrEqual(current!)
      prev = current
    }
  })
})
