import { describe, expect, it } from "vitest"
import { shallowThenDeep } from "./ls-and-fd.ts"

describe("shallowThenDeep", () => {
  it("returns shallow and deep promises", async () => {
    const shallowFn = async () => ["a.txt", "b.txt"]
    const deepFn = async () => ["a.txt", "a/sub.txt", "b.txt", "c.txt"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)

    expect(result).toHaveProperty("shallow")
    expect(result).toHaveProperty("deep")

    const shallowResults = await result.shallow
    const deepResults = await result.deep

    expect(shallowResults).toEqual(["a.txt", "b.txt"])
    expect(deepResults).toEqual(["a/sub.txt", "c.txt"])
  })

  it("filters deep results that have shallow prefix matches", async () => {
    const shallowFn = async () => ["dir1", "dir2"]
    const deepFn = async () => [
      "dir1",
      "dir1/file1.txt",
      "dir2",
      "dir2/sub/file2.txt",
      "dir3",
      "file.txt",
    ]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["dir3", "file.txt"])
  })

  it("handles empty shallow results", async () => {
    const shallowFn = async () => []
    const deepFn = async () => ["a.txt", "b.txt", "c/d.txt"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["a.txt", "b.txt", "c/d.txt"])
  })

  it("handles empty deep results", async () => {
    const shallowFn = async () => ["a.txt", "b.txt"]
    const deepFn = async () => []

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual([])
  })

  it("handles exact matches between shallow and deep", async () => {
    const shallowFn = async () => ["dir", "exact.txt"] // sorted
    const deepFn = async () => ["dir", "dir/file.txt", "exact.txt", "other.txt"] // sorted

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["other.txt"])
  })

  it("works with sorted results", async () => {
    const shallowFn = async () => ["a", "c", "e"]
    const deepFn = async () => [
      "a",
      "a/1",
      "b",
      "c",
      "c/2",
      "d",
      "e",
      "e/3",
      "f",
    ]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["b", "d", "f"])
  })

  it("handles nested prefixes correctly", async () => {
    const shallowFn = async () => ["ab", "abc"]
    const deepFn = async () => ["a", "ab", "abc", "abcd", "abx", "ac", "b"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["a", "ac", "b"])
  })

  it("filters when shallow has longer prefix than exact match", async () => {
    const shallowFn = async () => ["dir", "dir/sub"]
    const deepFn = async () => [
      "dir",
      "dir/sub",
      "dir/sub/file.txt",
      "dir/other",
      "other",
    ]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["other"])
  })

  it("handles deep items that come before all shallow items", async () => {
    const shallowFn = async () => ["m", "n", "o"]
    const deepFn = async () => ["a", "b", "c", "m", "n", "o", "z"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["a", "b", "c", "z"])
  })

  it("handles deep items that come after all shallow items", async () => {
    const shallowFn = async () => ["a", "b", "c"]
    const deepFn = async () => ["a", "b", "c", "x", "y", "z"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["x", "y", "z"])
  })

  it("handles interleaved shallow and deep items", async () => {
    const shallowFn = async () => ["b", "d", "f"]
    const deepFn = async () => ["a", "b", "c", "d", "e", "f", "g"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["a", "c", "e", "g"])
  })

  it("handles all deep items filtered out", async () => {
    const shallowFn = async () => ["a", "b", "c"]
    const deepFn = async () => ["a", "a/1", "b", "b/2", "c", "c/3"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual([])
  })

  it("handles all shallow items filtered from deep", async () => {
    const shallowFn = async () => ["x", "y", "z"]
    const deepFn = async () => ["a", "b", "c"]

    const result = shallowThenDeep("/tmp", "test", shallowFn, deepFn)
    const deepResults = await result.deep

    expect(deepResults).toEqual(["a", "b", "c"])
  })
})
