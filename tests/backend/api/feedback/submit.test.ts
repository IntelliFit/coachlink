
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/feedback/submit/route';
import { NextResponse } from 'next/server';

// 1. Mock dependencies

const { mockSupabase } = vi.hoisted(() => {
    const mock = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(),
    };
    // Fix: the methods like .from() return 'this' so we can chain.
    // However, mockReturnThis() returns the mock object itself 'mock', not the proxy if we are not careful.
    // A safer way for recursive chaining:
    mock.from = vi.fn(() => mock);
    mock.insert = vi.fn(() => mock);
    mock.select = vi.fn(() => mock);
    return { mockSupabase: mock };
});

// Mock getServerSession
vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  default: mockSupabase,
}));

// Helper to create a mock Request
const createMockRequest = (body: any) => {
  return {
    json: async () => body,
  } as unknown as Request;
};

import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';

describe('POST /api/feedback/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not logged in', async () => {
    // Arrange
    (getServerSession as any).mockResolvedValue(null);
    const req = createMockRequest({ content: 'test feedback' });

    // Act
    const res = await POST(req);
    const json = await res.json();

    // Assert
    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.message).toBe('用户未登录');
  });

  it('should return 400 if content is missing', async () => {
    // Arrange
    (getServerSession as any).mockResolvedValue({ user: { id: 'user-123' } });
    const req = createMockRequest({ content: '' });

    // Act
    const res = await POST(req);
    const json = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(json.message).toBe('反馈内容不能为空');
  });

  it('should submit feedback successfully', async () => {
    // Arrange
    const userId = 'user-123';
    (getServerSession as any).mockResolvedValue({ user: { id: userId } });
    
    // Mock Supabase success
    mockSupabase.single.mockResolvedValue({
      data: { id: 1 },
      error: null,
    });

    const body = { content: 'This is a great app!', relatedQuestion: 'Q1' };
    const req = createMockRequest(body);

    // Act
    const res = await POST(req);
    const json = await res.json();

    // Assert
    expect(json.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('feedbacks');
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      user_id: userId,
      content: 'This is a great app!',
      related_question: 'Q1',
      status: 'pending',
    });
  });

  it('should handle database errors gracefully', async () => {
     // Arrange
     (getServerSession as any).mockResolvedValue({ user: { id: 'user-123' } });
     
     // Mock Supabase error
     mockSupabase.single.mockResolvedValue({
       data: null,
       error: { message: 'DB Error' },
     });
 
     const req = createMockRequest({ content: 'test' });
 
     // Act
     const res = await POST(req);
     const json = await res.json();
 
     // Assert
     expect(res.status).toBe(500);
     expect(json.success).toBe(false);
     expect(json.message).toBe('DB Error');
  });
});
