/**
 * Unit tests for the complexity estimator.
 * Uses fixture solutions with known, hand-verified expected outputs.
 * 
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import { parsePython } from '../parsers/python-parser';
import { parseJava } from '../parsers/java-parser';
import { parseCpp } from '../parsers/cpp-parser';
import { estimateComplexity } from '../complexity-estimator';

// ─── Python fixtures ─────────────────────────────────────────────────────────

describe('Python — complexity estimation', () => {
  it('detects O(n²) for brute-force Two Sum (nested loop)', () => {
    const code = `
def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
`;
    const parsed = parsePython(code);
    const result = estimateComplexity({ kind: 'python', data: parsed });
    expect(result.timeComplexity).toBe('O(n²)');
    expect(result.isEstimate).toBe(true);
  });

  it('detects O(n) for optimal Two Sum (hash map)', () => {
    const code = `
def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`;
    const parsed = parsePython(code);
    const result = estimateComplexity({ kind: 'python', data: parsed });
    expect(result.timeComplexity).toBe('O(n)');
    expect(result.spaceComplexity).toBe('O(n)');
  });

  it('detects O(2ⁿ) for non-memoized Fibonacci recursion', () => {
    const code = `
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`;
    const parsed = parsePython(code);
    expect(parsed.hasRecursion).toBe(true);
    expect(parsed.hasMemoization).toBe(false);
    const result = estimateComplexity({ kind: 'python', data: parsed });
    expect(result.timeComplexity).toBe('O(2ⁿ)');
  });

  it('detects O(n) for memoized Fibonacci with @lru_cache', () => {
    const code = `
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`;
    const parsed = parsePython(code);
    expect(parsed.hasRecursion).toBe(true);
    expect(parsed.hasMemoization).toBe(true);
    const result = estimateComplexity({ kind: 'python', data: parsed });
    expect(result.timeComplexity).toBe('O(n)');
  });

  it('detects O(n log n) for sort + linear pass', () => {
    const code = `
def merge_sort_sum(arr):
    arr.sort()
    total = 0
    for x in arr:
        total += x
    return total
`;
    const parsed = parsePython(code);
    expect(parsed.sortCalls).toBeGreaterThan(0);
    const result = estimateComplexity({ kind: 'python', data: parsed });
    expect(result.timeComplexity).toBe('O(n log n)');
  });

  it('detects O(1) for constant-time operation', () => {
    const code = `
def get_first(nums):
    return nums[0] if nums else -1
`;
    const parsed = parsePython(code);
    const result = estimateComplexity({ kind: 'python', data: parsed });
    expect(result.timeComplexity).toBe('O(1)');
  });
});

// ─── JavaScript fixtures ─────────────────────────────────────────────────────

describe('JavaScript — complexity estimation (AST-based)', async () => {
  it('detects O(n²) for brute-force Two Sum', async () => {
    const { parseJsTs } = await import('../parsers/js-parser');
    const code = `
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}
`;
    const { ast } = await parseJsTs(code, 'javascript');
    const result = estimateComplexity({ kind: 'js', ast, code });
    expect(result.timeComplexity).toBe('O(n²)');
    expect(result.isEstimate).toBe(true);
  });

  it('detects O(n) for hash-map Two Sum', async () => {
    const { parseJsTs } = await import('../parsers/js-parser');
    const code = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement), i];
    map.set(nums[i], i);
  }
  return [];
}
`;
    const { ast } = await parseJsTs(code, 'javascript');
    const result = estimateComplexity({ kind: 'js', ast, code });
    expect(result.timeComplexity).toBe('O(n)');
  });
});

// ─── Java fixtures ───────────────────────────────────────────────────────────

describe('Java — complexity estimation', () => {
  it('detects O(n²) for brute-force Two Sum', () => {
    const code = `
public int[] twoSum(int[] nums, int target) {
    for (int i = 0; i < nums.length; i++) {
        for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] == target) {
                return new int[]{i, j};
            }
        }
    }
    return new int[]{};
}
`;
    const parsed = parseJava(code);
    const result = estimateComplexity({ kind: 'java', data: parsed });
    expect(result.timeComplexity).toBe('O(n²)');
  });

  it('detects O(n) for HashMap Two Sum', () => {
    const code = `
public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (map.containsKey(complement)) {
            return new int[]{map.get(complement), i};
        }
        map.put(nums[i], i);
    }
    return new int[]{};
}
`;
    const parsed = parseJava(code);
    const result = estimateComplexity({ kind: 'java', data: parsed });
    expect(result.timeComplexity).toBe('O(n)');
    expect(result.spaceComplexity).toBe('O(n)');
  });
});

// ─── C++ fixtures ────────────────────────────────────────────────────────────

describe('C++ — complexity estimation', () => {
  it('detects O(n²) for brute-force Two Sum', () => {
    const code = `
vector<int> twoSum(vector<int>& nums, int target) {
    for (int i = 0; i < nums.size(); i++) {
        for (int j = i + 1; j < nums.size(); j++) {
            if (nums[i] + nums[j] == target) {
                return {i, j};
            }
        }
    }
    return {};
}
`;
    const parsed = parseCpp(code);
    const result = estimateComplexity({ kind: 'cpp', data: parsed });
    expect(result.timeComplexity).toBe('O(n²)');
  });

  it('detects O(n) for unordered_map Two Sum', () => {
    const code = `
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> map;
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (map.count(complement)) {
            return {map[complement], i};
        }
        map[nums[i]] = i;
    }
    return {};
}
`;
    const parsed = parseCpp(code);
    const result = estimateComplexity({ kind: 'cpp', data: parsed });
    expect(result.timeComplexity).toBe('O(n)');
  });
});

// ─── Language detection tests ────────────────────────────────────────────────

describe('Language detection', async () => {
  const { detectLanguage } = await import('../detect-language');

  it('correctly identifies Python', () => {
    const result = detectLanguage('def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i');
    expect(result.language).toBe('python');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('correctly identifies Java', () => {
    const result = detectLanguage('public int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> map = new HashMap<>();\n    return new int[]{};\n}');
    expect(result.language).toBe('java');
  });

  it('correctly identifies C++', () => {
    const result = detectLanguage('#include <vector>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {}');
    expect(result.language).toBe('cpp');
  });

  it('correctly identifies JavaScript', () => {
    const result = detectLanguage('function twoSum(nums, target) {\n  const map = new Map();\n  return [];\n}');
    expect(result.language).toBe('javascript');
  });

  it('returns null for empty/too-short input', () => {
    const result = detectLanguage('x');
    expect(result.language).toBeNull();
  });
});
